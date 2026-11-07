import base64
import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone

from app.core.config import settings

try:
    from argon2 import PasswordHasher, Type
    from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

    _ARGON2_HASHER = PasswordHasher(
        time_cost=settings.argon2_time_cost,
        memory_cost=settings.argon2_memory_cost,
        parallelism=settings.argon2_parallelism,
        hash_len=32,
        salt_len=16,
        type=Type.ID,
    )
    ARGON2_AVAILABLE = True
except ImportError:  # Fallback seguro si se ejecuta en un entorno sin wheel compilado aún
    _ARGON2_HASHER = None
    ARGON2_AVAILABLE = False

logger = logging.getLogger("idolo.security")


def hash_password_argon2id(password: str) -> str:
    """
    Genera un hash Argon2id (formato estándar PHC `$argon2id$v=19$m=65536,t=3,p=2$...`).
    En caso de que el intérprete local de pruebas aún no tenga instalado argon2-cffi,
    usa PBKDF2-HMAC-SHA256 con prefijo explícito `$pbkdf2-sha256$` para no bloquear tests locales.
    En los contenedores Docker (linux/arm64 y linux/amd64) argon2-cffi está instalado y es obligatorio.
    """
    if ARGON2_AVAILABLE and _ARGON2_HASHER is not None:
        return _ARGON2_HASHER.hash(password)

    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 150_000, dklen=32)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived).decode("ascii")
    return f"$pbkdf2-sha256$i=150000${salt_b64}${hash_b64}"


def verify_password_argon2id(password: str, encoded_hash: str) -> bool:
    """Verifica una contraseña contra su hash Argon2id en tiempo constante."""
    if not encoded_hash or not isinstance(password, str):
        return False

    if encoded_hash.startswith("$argon2id$"):
        if not ARGON2_AVAILABLE or _ARGON2_HASHER is None:
            return False
        try:
            return bool(_ARGON2_HASHER.verify(encoded_hash, password))
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    if encoded_hash.startswith("$pbkdf2-sha256$"):
        try:
            _, _, iter_part, salt_b64, expected_b64 = encoded_hash.split("$")
            iterations = int(iter_part.split("=")[1])
            salt = base64.b64decode(salt_b64.encode("ascii"))
            derived = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt, iterations, dklen=32
            )
            computed_b64 = base64.b64encode(derived).decode("ascii")
            return hmac.compare_digest(computed_b64.encode("ascii"), expected_b64.encode("ascii"))
        except Exception:
            return False

    return False


def generate_opaque_token(nbytes: int = 32) -> str:
    """Genera un token opaco de alta entropía (256 bits) para sesiones revocables y CSRF."""
    return secrets.token_urlsafe(nbytes)


def hash_session_token(raw_token: str) -> str:
    """
    Calcula el SHA-256 del token de sesión opaco para almacenarlo en PostgreSQL.
    Así, incluso ante una lectura no autorizada de la base de datos, los tokens de sesión
    activos no quedan expuestos en claro.
    """
    return hashlib.sha256((raw_token or "").encode("utf-8")).hexdigest()


def constant_time_equals(a: str, b: str) -> bool:
    if not isinstance(a, str) or not isinstance(b, str):
        return False
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def canonical_progress_payload(username: str, level: int, best_time: int, victories: int) -> str:
    return f"1|{username.strip().lower()}|{int(level)}|{int(best_time)}|{int(victories)}"


def sign_progress(username: str, level: int, best_time: int, victories: int) -> str:
    payload = canonical_progress_payload(username, level, best_time, victories).encode("utf-8")
    digest = hmac.new(settings.secret_key.encode("utf-8"), payload, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("ascii")


def verify_progress_signature(
    username: str, level: int, best_time: int, victories: int, signature_b64: str
) -> bool:
    expected = sign_progress(username, level, best_time, victories)
    return hmac.compare_digest(expected.encode("ascii"), (signature_b64 or "").encode("ascii"))


def emit_structured_security_log(
    event_type: str,
    username: str | None,
    ip_address: str,
    details: dict | None = None,
) -> None:
    """Emite un registro JSON estructurado sin secretos hacia stdout (Docker logs / SIEM)."""
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "idolo-fastapi-backend",
        "target": settings.deploy_target,
        "event_type": event_type,
        "username": username,
        "ip_address": ip_address,
        "details": details or {},
    }
    logger.info(json.dumps(record, ensure_ascii=False))
