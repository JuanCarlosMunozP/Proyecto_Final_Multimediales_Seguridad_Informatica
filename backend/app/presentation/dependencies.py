from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import constant_time_equals, hash_session_token
from app.domain.entities.session import UserSession
from app.infrastructure.repositories import (
    SqlAuditRepository,
    SqlProgressRepository,
    SqlSessionRepository,
    SqlUserRepository,
)
from app.infrastructure.session import get_db


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    if request.client and request.client.host:
        return request.client.host[:45]
    return "0.0.0.0"


def get_user_agent(request: Request) -> str:
    return (request.headers.get("user-agent") or "unknown")[:255]


def get_repositories(db: Session = Depends(get_db)):
    return (
        SqlUserRepository(db),
        SqlProgressRepository(db),
        SqlSessionRepository(db),
        SqlAuditRepository(db),
    )


def get_current_session(
    ideolo_session: str | None = Cookie(default=None, alias=settings.session_cookie_name),
    authorization: str | None = Header(default=None),
    repos=Depends(get_repositories),
) -> UserSession:
    raw_token = ideolo_session
    if not raw_token and authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization[7:].strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no autenticada o ausente.",
        )

    _, _, session_repo, _ = repos
    token_hash = hash_session_token(raw_token)
    session = session_repo.get_by_token_hash(token_hash)
    if session is None or not session.is_active():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida, expirada o revocada.",
        )
    return session


def require_csrf_protection(
    session: UserSession = Depends(get_current_session),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
    ideolo_csrf: str | None = Cookie(default=None, alias=settings.csrf_cookie_name),
) -> UserSession:
    """
    Valida protección anti-CSRF en operaciones mutantes (POST/PUT/DELETE):
    Exige cabecera X-CSRF-Token coincidente en tiempo constante con el token CSRF
    vinculado a la sesión opaca del servidor.
    """
    if not settings.csrf_protection_enabled:
        return session

    provided = x_csrf_token or ""
    if not provided or not constant_time_equals(provided, session.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Fallo de validación CSRF: cabecera X-CSRF-Token ausente o inválida.",
        )
    if ideolo_csrf and not constant_time_equals(ideolo_csrf, session.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Fallo de validación CSRF: discrepancia en cookie CSRF.",
        )
    return session


def require_admin_access(
    session: UserSession = Depends(get_current_session),
    x_admin_audit_token: str | None = Header(default=None, alias="X-Admin-Audit-Token"),
) -> UserSession:
    """
    Protección de endpoints administrativos (/api/v1/security/audit-logs):
    Exige rol 'admin' en la sesión del servidor o cabecera X-Admin-Audit-Token válida.
    """
    if session.role == "admin":
        return session
    if settings.admin_audit_token and x_admin_audit_token:
        if constant_time_equals(x_admin_audit_token, settings.admin_audit_token):
            return session
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acceso denegado: se requiere autorización administrativa para consultar registros de auditoría.",
    )
