from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class SecurityAuditLog:
    """Entidad de dominio para eventos forenses y auditoría de seguridad (SEG-008)."""

    event_type: str
    ip_address: str
    user_agent: str
    username: str | None = None
    user_id: str | None = None
    details: dict[str, Any] = field(default_factory=dict)
    id: int | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
