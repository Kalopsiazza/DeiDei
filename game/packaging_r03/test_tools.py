"""Small negative checks for the packaging trust boundaries; no fake GUI acceptance."""
import copy
import json
from pathlib import Path
import struct
import tempfile
import unittest
from candidate import BASE, ROOT, LOCK_HASH, PROTECTED, validate_receipt, verify_source
from verify import STAGE, architecture, inventory, paths, sha, verify, write_json


class Tools(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix='叠叠 包 空格 ')
        self.root = Path(self.temp.name)
        self.resources, _, _ = paths(self.root, 'win32-x64')
        app = self.resources / 'app'
        for name in STAGE + ['package.json']:
            p = app / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text('{}')
        worker = self.resources / 'worker/_internal/deidei_runtime'
        (worker/'data').mkdir(parents=True); (worker/'data/catalog.json').write_text('{}'); (worker/'entry-map.json').write_text('{}')
        (self.root/'room-server').mkdir()
        (self.root/'THIRD-PARTY').mkdir()
        for name in ['Electron-LICENSE','Electron-LICENSES.chromium.html','Python-LICENSE.txt','websockets-LICENSE.txt']:
            (self.root/'THIRD-PARTY'/name).write_text('synthetic test')
        self.info = dict(source_sha=BASE,packaging_sha='a'*40,platform='win32-x64',stage_sha256={p:sha(app/p) for p in STAGE},catalog_sha256=sha(app/'catalog.json'),entry_map_sha256=sha(worker/'entry-map.json'))
        for p in [self.root/'build-info.json',app/'build-info.json',self.root/'room-server/build-info.json']: write_json(p,self.info)
        self.seal()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def seal(self) -> None:
        write_json(self.root/'FILE-MANIFEST.json', inventory(self.root))

    def check(self) -> dict:
        return verify(self.root,BASE,'a'*40,'win32-x64',native=False)

    def test_space_path_and_inventory(self) -> None:
        self.assertEqual(self.check(),self.info)

    def test_missing_online_and_resources(self) -> None:
        for name in ['online/wire.cjs','online/network-room-port.cjs','catalog.json','build/ui/renderer.js']:
            p=self.resources/'app'/name; content=p.read_bytes();p.unlink();self.seal()
            with self.assertRaises(AssertionError):self.check()
            p.write_bytes(content);self.seal()

    def test_test_file_leak(self) -> None:
        p=self.resources/'app/tests-online';p.mkdir();(p/'fake.cjs').write_text('fake');self.seal()
        with self.assertRaises(AssertionError):self.check()

    def test_wrong_sha_and_corrupt_manifest(self) -> None:
        with self.assertRaises(AssertionError):verify(self.root,'b'*40,'a'*40,'win32-x64',False)
        (self.root/'FILE-MANIFEST.json').write_text('{')
        with self.assertRaises(json.JSONDecodeError):self.check()

    def test_changed_bytes_and_wrong_output_path(self) -> None:
        (self.resources/'app/main.cjs').write_text('changed')
        with self.assertRaises(AssertionError):self.check()
        with self.assertRaises(AssertionError):verify(self.root/'wrong',BASE,'a'*40,'win32-x64',False)

    def test_architecture(self) -> None:
        p=self.root/'test.exe';b=bytearray(256);b[:2]=b'MZ';struct.pack_into('<I',b,0x3c,128);b[128:132]=b'PE\0\0';struct.pack_into('<H',b,132,0x8664);p.write_bytes(b)
        architecture(p,'win32-x64');struct.pack_into('<H',b,132,0xaa64);p.write_bytes(b)
        with self.assertRaises(AssertionError):architecture(p,'win32-x64')

    def test_symlink_escape_and_permission_drift(self) -> None:
        if hasattr(__import__('os'), 'symlink'):
            try:(self.root/'escape').symlink_to(self.root.parent)
            except OSError:pass  # Windows can deny link creation; inventory still checks real bundle links.
            else:
                with self.assertRaises(AssertionError):inventory(self.root)
                (self.root/'escape').unlink()
        if __import__('os').name!='nt':
            (self.resources/'app/main.cjs').chmod(0o700)
            with self.assertRaises(AssertionError):self.check()

    def test_receipt_and_protected_source(self) -> None:
        value=dict(schema_version=1,task_id='R03-T04-a',base_sha=BASE,code_sha='a'*40,core_tree=PROTECTED['game/core'],runtime_tree=PROTECTED['game/runtime'],desktop_lock_sha256=LOCK_HASH,stage='source_checked_pending_gui',checks=dict(service='PASS',core='PASS',runtime='PASS',desktop='PASS',independent_socket='PASS',real_gui='NOT_RUN'))
        validate_receipt(value)
        for update in [{'command':'evil'},{'base_sha':'a'*40},{'desktop_lock_sha256':'wrong'},{'stage':'integrated_local_pass'}]:
            with self.assertRaises(AssertionError):validate_receipt(value|update)
        verify_source(ROOT,BASE)
        with self.assertRaises(AssertionError):verify_source(ROOT,'main')


if __name__ == '__main__':
    unittest.main()
