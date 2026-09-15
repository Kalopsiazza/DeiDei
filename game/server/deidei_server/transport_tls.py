"""Startup-only TLS configuration; never relax client or room authentication."""
import ipaddress
import ssl
from pathlib import Path


def load_tls_context(cert_file: str | Path | None, key_file: str | Path | None) -> ssl.SSLContext | None:
    if (cert_file is None) != (key_file is None):
        raise ValueError('TLS certificate and key must be supplied together')
    if cert_file is None:
        return None

    def reject_password() -> str:
        raise ValueError('Password-protected TLS keys are unsupported')

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    try:
        context.load_cert_chain(cert_file, key_file, password=reject_password)
    except (OSError, ValueError) as exc:
        raise ValueError('TLS certificate/key unreadable, invalid, mismatched or password-protected') from exc
    return context


def validate_bind(host: str, port: int, *, tls_context: ssl.SSLContext | None = None,
                  allow_remote: bool = False) -> None:
    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise ValueError('Bind host must be an IP literal') from exc
    if '%' in host or address.is_multicast:
        raise ValueError('Scoped or multicast bind hosts are unsupported')
    if type(port) is not int or not 0 <= port <= 65535:
        raise ValueError('port must be 0..65535')
    if tls_context is not None and (not isinstance(tls_context, ssl.SSLContext)
            or tls_context.protocol != ssl.PROTOCOL_TLS_SERVER
            or tls_context.minimum_version < ssl.TLSVersion.TLSv1_2):
        raise ValueError('TLS requires a server context with minimum TLS 1.2')
    if not address.is_loopback and (allow_remote is not True or tls_context is None):
        raise ValueError('Non-loopback listening requires --allow-remote and TLS')
