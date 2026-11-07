from typing import Any
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response, status

from app.application.use_cases import (
    AuthenticateUserUseCase,
    GetProgressUseCase,
    RegisterUserUseCase,
    RevokeSessionUseCase,
    UpdateProgressUseCase,
)
from app.core.config import settings
from app.domain.entities.session import UserSession
from app.domain.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    TamperDetectedError,
    UserAlreadyExistsError,
    ValidationError,
)
from app.presentation.dependencies import (
    get_client_ip,
    get_current_session,
    get_repositories,
    get_user_agent,
    require_admin_access,
    require_csrf_protection,
)
from app.presentation.schemas import (
    AuditLogEntryResponse,
    AuthSuccessResponse,
    CredentialsRequest,
    ProgressPayload,
    ProgressUpdateRequest,
)

api_router = APIRouter(prefix="/api/v1")


def _set_auth_cookies(response: Response, opaque_token: str, csrf_token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=opaque_token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=settings.session_ttl_seconds,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    response.headers["X-CSRF-Token"] = csrf_token


@api_router.get("/health", tags=["Health"])
def health_check() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "target": settings.deploy_target,
        "architecture": "clean-architecture",
    }


@api_router.post(
    "/auth/register",
    response_model=AuthSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["IAM & Auth"],
)
def register_user(
    body: CredentialsRequest,
    request: Request,
    response: Response,
    repos=Depends(get_repositories),
) -> AuthSuccessResponse:
    user_repo, progress_repo, session_repo, audit_repo = repos
    uc = RegisterUserUseCase(user_repo, progress_repo, session_repo, audit_repo)
    try:
        result = uc.execute(
            display_name=body.nombre,
            password=body.clave,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    _set_auth_cookies(response, result.opaque_session_token, result.csrf_token)
    return AuthSuccessResponse(
        nombre=result.display_name,
        csrfToken=result.csrf_token,
        progreso=ProgressPayload(
            nivel=result.progreso.nivel,
            mejorTiempo=result.progreso.mejor_tiempo,
            victorias=result.progreso.victorias,
        ),
    )


@api_router.post("/auth/login", response_model=AuthSuccessResponse, tags=["IAM & Auth"])
def login_user(
    body: CredentialsRequest,
    request: Request,
    response: Response,
    repos=Depends(get_repositories),
) -> AuthSuccessResponse:
    user_repo, progress_repo, session_repo, audit_repo = repos
    uc = AuthenticateUserUseCase(user_repo, progress_repo, session_repo, audit_repo)
    try:
        result = uc.execute(
            display_name=body.nombre,
            password=body.clave,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except AccountLockedError as exc:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(exc),
            headers={"Retry-After": str(exc.remaining_seconds)},
        ) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    _set_auth_cookies(response, result.opaque_session_token, result.csrf_token)
    return AuthSuccessResponse(
        nombre=result.display_name,
        csrfToken=result.csrf_token,
        progreso=ProgressPayload(
            nivel=result.progreso.nivel,
            mejorTiempo=result.progreso.mejor_tiempo,
            victorias=result.progreso.victorias,
        ),
        aviso=result.progreso.aviso,
    )


@api_router.post("/auth/logout", tags=["IAM & Auth"])
def logout_user(
    request: Request,
    response: Response,
    ideolo_session: str | None = Cookie(default=None, alias=settings.session_cookie_name),
    _session: UserSession = Depends(require_csrf_protection),
    repos=Depends(get_repositories),
) -> dict[str, bool]:
    _, _, session_repo, audit_repo = repos
    uc = RevokeSessionUseCase(session_repo, audit_repo)
    uc.execute(
        raw_token=ideolo_session,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    response.delete_cookie(key=settings.session_cookie_name, path="/", samesite="strict")
    response.delete_cookie(key=settings.csrf_cookie_name, path="/", samesite="strict")
    return {"ok": True}


@api_router.get("/auth/me", response_model=AuthSuccessResponse, tags=["IAM & Auth"])
def current_user_info(
    request: Request,
    response: Response,
    session: UserSession = Depends(get_current_session),
    repos=Depends(get_repositories),
) -> AuthSuccessResponse:
    user_repo, progress_repo, _, audit_repo = repos
    uc = GetProgressUseCase(user_repo, progress_repo, audit_repo)
    try:
        progreso = uc.execute(
            username=session.username,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    response.headers["X-CSRF-Token"] = session.csrf_token
    return AuthSuccessResponse(
        nombre=session.display_name,
        csrfToken=session.csrf_token,
        progreso=ProgressPayload(
            nivel=progreso.nivel,
            mejorTiempo=progreso.mejor_tiempo,
            victorias=progreso.victorias,
        ),
        aviso=progreso.aviso,
    )


@api_router.get("/progress", response_model=ProgressPayload, tags=["Progress & Anti-Cheat"])
def get_progress(
    request: Request,
    session: UserSession = Depends(get_current_session),
    repos=Depends(get_repositories),
) -> ProgressPayload:
    user_repo, progress_repo, _, audit_repo = repos
    uc = GetProgressUseCase(user_repo, progress_repo, audit_repo)
    dto = uc.execute(
        username=session.username,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return ProgressPayload(
        nivel=dto.nivel,
        mejorTiempo=dto.mejor_tiempo,
        victorias=dto.victorias,
    )


@api_router.put("/progress", response_model=ProgressPayload, tags=["Progress & Anti-Cheat"])
def update_progress(
    body: ProgressUpdateRequest,
    request: Request,
    session: UserSession = Depends(require_csrf_protection),
    repos=Depends(get_repositories),
) -> ProgressPayload:
    user_repo, progress_repo, _, audit_repo = repos
    uc = UpdateProgressUseCase(user_repo, progress_repo, audit_repo)
    try:
        dto = uc.execute(
            username=session.username,
            requested_level=body.nivel,
            victory_seconds=body.tiempoVictoria,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except TamperDetectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return ProgressPayload(
        nivel=dto.nivel,
        mejorTiempo=dto.mejor_tiempo,
        victorias=dto.victorias,
    )


@api_router.get(
    "/security/audit-logs",
    response_model=list[AuditLogEntryResponse],
    tags=["Security Audit & Pentest Evidence"],
)
def list_security_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    _admin_session: UserSession = Depends(require_admin_access),
    repos=Depends(get_repositories),
) -> list[AuditLogEntryResponse]:
    _, _, _, audit_repo = repos
    logs = audit_repo.list_recent(limit=limit)
    return [
        AuditLogEntryResponse(
            id=item.id,
            event_type=item.event_type,
            username=item.username,
            ip_address=item.ip_address,
            user_agent=item.user_agent,
            details=item.details,
            created_at=item.created_at,
        )
        for item in logs
    ]
