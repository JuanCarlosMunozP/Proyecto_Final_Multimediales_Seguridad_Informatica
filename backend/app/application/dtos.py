from dataclasses import dataclass


@dataclass(frozen=True)
class ProgressDTO:
    nivel: int
    mejor_tiempo: int
    victorias: int
    aviso: str | None = None


@dataclass(frozen=True)
class AuthResultDTO:
    user_id: str
    username: str
    display_name: str
    role: str
    opaque_session_token: str
    csrf_token: str
    progreso: ProgressDTO
