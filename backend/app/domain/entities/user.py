from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import re

from app.domain.exceptions import ValidationError

NOMBRE_REGEX = re.compile(r"^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{3,16}$")
MIN_PASSWORD_LEN = 6
MAX_PASSWORD_LEN = 64
MAX_FAILED_ATTEMPTS = 3
BASE_LOCKOUT_SECONDS = 15
MAX_LOCKOUT_SECONDS = 300


@dataclass
class User:
    """Entidad de dominio que representa a un Jugador registrado (ACT-001 / CU-002 / CU-003)."""

    id: str
    username: str
    display_name: str
    password_hash: str
    role: str = "player"
    failed_attempts: int = 0
    locked_until: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @staticmethod
    def validate_display_name(name: str) -> str:
        clean = (name or "").strip()
        if not NOMBRE_REGEX.match(clean):
            raise ValidationError(
                "El nombre debe tener entre 3 y 16 caracteres (letras, números, espacio, _ o -)."
            )
        return clean

    @staticmethod
    def normalize_username(name: str) -> str:
        return User.validate_display_name(name).lower()

    @staticmethod
    def validate_password(password: str) -> str:
        if not isinstance(password, str) or len(password) < MIN_PASSWORD_LEN:
            raise ValidationError(
                f"La contraseña debe tener al menos {MIN_PASSWORD_LEN} caracteres."
            )
        if len(password) > MAX_PASSWORD_LEN:
            raise ValidationError(
                f"La contraseña no puede superar {MAX_PASSWORD_LEN} caracteres."
            )
        return password

    def remaining_lockout_seconds(self, now: datetime | None = None) -> int:
        current = now or datetime.now(timezone.utc)
        if self.locked_until is None:
            return 0
        locked = (
            self.locked_until
            if self.locked_until.tzinfo is not None
            else self.locked_until.replace(tzinfo=timezone.utc)
        )
        diff = (locked - current).total_seconds()
        return max(0, int(round(diff)))

    def is_locked(self, now: datetime | None = None) -> bool:
        return self.remaining_lockout_seconds(now) > 0

    def register_failed_attempt(self, now: datetime | None = None) -> int:
        current = now or datetime.now(timezone.utc)
        self.failed_attempts += 1
        if self.failed_attempts >= MAX_FAILED_ATTEMPTS:
            penalty = min(
                MAX_LOCKOUT_SECONDS,
                BASE_LOCKOUT_SECONDS * (2 ** max(0, self.failed_attempts - MAX_FAILED_ATTEMPTS)),
            )
            self.locked_until = current + timedelta(seconds=penalty)
            return penalty
        return 0

    def reset_failed_attempts(self) -> None:
        self.failed_attempts = 0
        self.locked_until = None
