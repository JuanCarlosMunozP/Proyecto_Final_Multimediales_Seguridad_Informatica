from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CredentialsRequest(StrictBaseModel):
    nombre: str = Field(..., min_length=1, max_length=64, description="Nombre visible del jugador")
    clave: str = Field(..., min_length=1, max_length=128, description="Contraseña del jugador")


class ProgressPayload(StrictBaseModel):
    nivel: int = Field(..., ge=1, le=3)
    mejorTiempo: int = Field(..., ge=0)
    victorias: int = Field(..., ge=0)


class AuthSuccessResponse(StrictBaseModel):
    ok: bool = True
    nombre: str
    csrfToken: str
    progreso: ProgressPayload
    aviso: str | None = None


class ProgressUpdateRequest(StrictBaseModel):
    nivel: int | None = Field(default=None, ge=1, le=3)
    tiempoVictoria: int | None = Field(default=None, ge=1, le=86400)


class AuditLogEntryResponse(StrictBaseModel):
    id: int | None
    event_type: str
    username: str | None
    ip_address: str
    user_agent: str
    details: dict[str, Any]
    created_at: datetime
