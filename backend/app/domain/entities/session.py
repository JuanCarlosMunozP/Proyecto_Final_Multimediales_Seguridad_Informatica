from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class UserSession:
    """
    Entidad de dominio para una sesión opaca y revocable en servidor.
    Almacena únicamente el hash SHA-256 del token opaco junto con su token CSRF asociado.
    """

    id: str
    user_id: str
    username: str
    display_name: str
    role: str
    token_hash: str
    csrf_token: str
    ip_address: str
    user_agent: str
    expires_at: datetime
    revoked_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_active(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(timezone.utc)
        if self.revoked_at is not None:
            return False
        exp = (
            self.expires_at
            if self.expires_at.tzinfo is not None
            else self.expires_at.replace(tzinfo=timezone.utc)
        )
        return exp > current

    def revoke(self, now: datetime | None = None) -> None:
        self.revoked_at = now or datetime.now(timezone.utc)
