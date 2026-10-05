"""S03--S05 startup validation without any external listening."""
import asyncio
import os
import select
from pathlib import Path
import ssl
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from deidei_server.server import RoomServer
from deidei_server.transport_tls import load_tls_context, validate_bind
from game.integration.secure.certificates import certificates


class StartupTLS(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory(prefix='deidei-tls-unit-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.directory = Path(cls.temp.name)
        certificates(cls.directory)

    def test_pair_missing_mismatch_and_encryption_fail_before_bind(self) -> None:
        d = self.directory
        self.assertIsNone(load_tls_context(None, None))
        for cert, key in [(d/'valid.pem', None), (None, d/'valid.key'),
                          (d/'missing', d/'valid.key'), (d/'valid.pem', d/'missing'),
                          (d/'valid.pem', d/'unknown.key'), (d/'valid.key', d/'valid.key')]:
            with self.subTest(cert=cert.name if cert else None, key=key.name if key else None):
                with self.assertRaises(ValueError):
                    load_tls_context(cert, key)
        encrypted = subprocess.run([os.environ.get('DEIDEI_OPENSSL', 'openssl'), 'pkey', '-in', str(d/'valid.key'),
            '-aes-256-cbc', '-passout', 'stdin', '-out', str(d/'encrypted.key')], input='synthetic-test-only\n',
            capture_output=True, text=True, timeout=5)
        self.assertEqual(encrypted.returncode, 0)
        with self.assertRaisesRegex(ValueError, 'password-protected'):
            load_tls_context(d/'valid.pem', d/'encrypted.key')

    def test_cli_valid_tls_listens_then_exits(self) -> None:
        child = subprocess.Popen([sys.executable, '-u', '-m', 'deidei_server', '--port', '0',
            '--tls-cert-file', str(self.directory/'valid.pem'), '--tls-key-file', str(self.directory/'valid.key')],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertTrue(select.select([child.stdout], [], [], 5)[0], 'CLI startup timeout')
            self.assertRegex(child.stdout.readline(), r'^Listening: wss://127\.0\.0\.1:[0-9]+/rooms-v1')
            child.send_signal(__import__('signal').SIGINT)
            child.communicate(timeout=5)
            self.assertEqual(child.returncode, 0)
        finally:
            if child.poll() is None:
                child.kill()
            child.communicate(timeout=5)

    def test_remote_validation_and_context_minimum_without_network(self) -> None:
        d = self.directory
        context = load_tls_context(d/'valid.pem', d/'valid.key')
        self.assertEqual(context.minimum_version, ssl.TLSVersion.TLSv1_2)
        with patch('deidei_server.server.serve') as serve:
            for host in ('0.0.0.0', '192.0.2.1', '::'):
                for kwargs in ({}, {'allow_remote': True}, {'tls_context': context}):
                    with self.assertRaises(ValueError):
                        validate_bind(host, 8765, **kwargs)
                validate_bind(host, 8765, tls_context=context, allow_remote=True)
            for host in ('localhost', 'example.com', 'ff02::1', 'fe80::1%en0'):
                with self.assertRaises(ValueError):
                    validate_bind(host, 8765, tls_context=context, allow_remote=True)
            for host in ('127.0.0.1', '::1'):
                validate_bind(host, 0)
            for port in (-1, 65536, True):
                with self.assertRaises(ValueError):
                    validate_bind('127.0.0.1', port)
            with self.assertRaises(ValueError):
                validate_bind('127.0.0.1', 0, tls_context=ssl.create_default_context())
            async def rejected_start() -> None:
                server = RoomServer()
                try:
                    with self.assertRaises(ValueError):
                        await server.start('0.0.0.0', 0, allow_remote=True)
                finally:
                    await server.close()
            asyncio.run(rejected_start())
            serve.assert_not_called()

    def test_cli_rejects_bad_pairs_and_remote_before_listening(self) -> None:
        for args in [ ['--tls-cert-file', str(self.directory/'valid.pem')],
                      ['--tls-key-file', str(self.directory/'valid.key')],
                      ['--tls-cert-file', str(self.directory/'valid.pem'), '--tls-key-file', str(self.directory/'unknown.key')],
                      ['--host', '0.0.0.0', '--allow-remote'], ['--host', 'localhost'] ]:
            result = subprocess.run([sys.executable, '-m', 'deidei_server', '--port', '0', *args], capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 2)
            self.assertNotIn('Listening:', result.stdout)
            self.assertNotIn('PRIVATE KEY', result.stderr)
