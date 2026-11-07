from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.exceptions import TamperDetectedError, ValidationError

MIN_LEVEL = 1
MAX_LEVEL = 3
MIN_PLAUSIBLE_VICTORY_SECONDS = 5


@dataclass
class GameProgress:
    """
    Entidad de dominio para el progreso del jugador (CU-017 / CU-018).
    Incluye invariantes anti-trampa verificadas en servidor (SEG-003).
    """

    user_id: str
    username: str
    current_level: int = 1
    best_time_seconds: int = 0
    victories: int = 0
    integrity_hmac: str = ""
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def reset_to_safe_default(self, new_hmac: str) -> None:
        """Restablece el progreso al Nivel 1 cuando se detecta adulteración en base de datos."""
        self.current_level = 1
        self.best_time_seconds = 0
        self.victories = 0
        self.integrity_hmac = new_hmac
        self.updated_at = datetime.now(timezone.utc)

    def apply_progress_update(
        self,
        requested_level: int | None = None,
        victory_seconds: int | None = None,
    ) -> None:
        """
        Aplica reglas de negocio y controles anti-cheat en el servidor:
        1. El nivel debe estar en el rango [1, 3].
        2. Un jugador no puede saltar del Nivel 1 directamente al Nivel 3 sin haber desbloqueado el Nivel 2.
        3. Una victoria requiere un tiempo físicamente plausible (>= 5 s).
        """
        if requested_level is not None:
            if not isinstance(requested_level, int) or requested_level < MIN_LEVEL or requested_level > MAX_LEVEL:
                raise ValidationError(f"El nivel debe estar entre {MIN_LEVEL} y {MAX_LEVEL}.")
            if requested_level > self.current_level + 1:
                raise TamperDetectedError(
                    f"Transición ilegal de nivel: intento de saltar del nivel {self.current_level} al {requested_level}."
                )
            if requested_level > self.current_level:
                self.current_level = requested_level

        if victory_seconds is not None:
            if not isinstance(victory_seconds, int) or victory_seconds <= 0:
                raise ValidationError("El tiempo de victoria debe ser un entero positivo.")
            if victory_seconds < MIN_PLAUSIBLE_VICTORY_SECONDS:
                raise TamperDetectedError(
                    f"Tiempo de victoria físicamente implausible ({victory_seconds} s < {MIN_PLAUSIBLE_VICTORY_SECONDS} s)."
                )
            self.victories += 1
            if self.best_time_seconds == 0 or victory_seconds < self.best_time_seconds:
                self.best_time_seconds = victory_seconds

        self.updated_at = datetime.now(timezone.utc)
