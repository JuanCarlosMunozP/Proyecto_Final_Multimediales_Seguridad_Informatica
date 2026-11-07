from collections import defaultdict, deque
from contextlib import asynccontextmanager
import time
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.infrastructure.session import init_db
from app.presentation.dependencies import get_client_ip
from app.presentation.routers import api_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "API de Identidad (IAM), Persistencia Firmada (HMAC-SHA256) y Auditoría Forense "
        "con Arquitectura Limpia para La Búsqueda del Ídolo Perdido."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Ventanas deslizantes en memoria para Rate Limiting defensivo en capa de aplicación
_ip_windows: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_limiter() -> None:
    _ip_windows.clear()


@app.middleware("http")
async def security_hardening_and_rate_limit_middleware(request: Request, call_next):
    now = time.monotonic()
    client_ip = get_client_ip(request)
    path = request.url.path
    is_auth_route = path.startswith("/api/v1/auth/login") or path.startswith("/api/v1/auth/register")
    bucket_key = f"{client_ip}:{'auth' if is_auth_route else 'general'}"
    limit = (
        settings.auth_rate_limit_per_minute
        if is_auth_route
        else settings.rate_limit_per_minute
    )

    window = _ip_windows[bucket_key]
    while window and (now - window[0]) > 60.0:
        window.popleft()

    if len(window) >= limit:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": "Límite de peticiones por minuto excedido (Rate Limit activo).",
            },
            headers={"Retry-After": "60"},
        )

    window.append(now)
    response = await call_next(request)

    # Cabeceras defensivas HTTP (SEG-006)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(api_router)
