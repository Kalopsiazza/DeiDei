"""Ephemeral OpenSSL test CA; callers own and remove the supplied directory."""
import os
from pathlib import Path
import subprocess


def certificates(directory: Path) -> dict:
    openssl = os.environ.get('DEIDEI_OPENSSL', 'openssl')
    commands = []

    def run(*args: str) -> str:
        result = subprocess.run([openssl, *args], cwd=directory, capture_output=True, text=True, timeout=20)
        commands.append({'command': ['openssl', *args], 'exit_code': result.returncode})
        if result.returncode:
            raise RuntimeError(f'OpenSSL {args[0]} failed (exit {result.returncode})')
        return result.stdout.strip()

    version = run('version')
    for name in ('ca', 'unknown-ca'):
        run('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', f'{name}.key', '-out', f'{name}.pem',
            '-days', '2', '-subj', '/CN=DeiDei temporary test root',
            '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign')
    (directory/'index').write_text('')
    (directory/'serial').write_text('1000\n')
    (directory/'ca.cnf').write_text('''[ca]
default_ca=local
[local]
database=index
serial=serial
new_certs_dir=.
certificate=ca.pem
private_key=ca.key
default_md=sha256
policy=names
[names]
commonName=supplied
''')
    fingerprints = {}
    for name in ('valid', 'wrong-san', 'expired', 'unknown'):
        run('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', f'{name}.key',
            '-out', f'{name}.csr', '-subj', f'/CN=DeiDei {name} test')
        san = 'DNS:wrong.invalid' if name == 'wrong-san' else 'DNS:localhost,IP:127.0.0.1,IP:::1'
        (directory/f'{name}.ext').write_text('[leaf]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName='+san+'\n')
        if name == 'expired':
            run('ca', '-batch', '-config', 'ca.cnf', '-in', f'{name}.csr', '-out', f'{name}.pem',
                '-startdate', '20000101000000Z', '-enddate', '20000102000000Z',
                '-extfile', f'{name}.ext', '-extensions', 'leaf', '-notext')
        else:
            ca = 'unknown-ca' if name == 'unknown' else 'ca'
            run('x509', '-req', '-in', f'{name}.csr', '-CA', f'{ca}.pem', '-CAkey', f'{ca}.key',
                '-CAcreateserial', '-out', f'{name}.pem', '-days', '1', '-sha256',
                '-extfile', f'{name}.ext', '-extensions', 'leaf')
        fingerprints[name] = run('x509', '-in', f'{name}.pem', '-noout', '-fingerprint', '-sha256')
    # No secret material escapes this directory or enters evidence.
    for key in directory.glob('*.key'):
        key.chmod(0o600)
    return {'openssl': version, 'commands': commands, 'fingerprints': fingerprints}
