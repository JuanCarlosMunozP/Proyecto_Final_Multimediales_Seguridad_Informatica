import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    """Configuración centralizada (12-Factor App) para Raspberry Pi (ARM64) y VPS (AMD64/ARM64)."""

    app_name: str = "La Búsqueda del Ídolo Perdido — API"
    app_version: str = "1.0.0"
    deploy_target: str = field(default_factory=lambda: os.getenv("DEPLOY_TARGET", "raspberry"))
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "production"))
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://idolo_user:CHANGE_ME@postgres:5432/idolo_db",
        )
    )
    secret_key: str = field(
        default_factory=lambda: os.getenv(
            "SECRET_KEY",
            "dev-only-placeholder-key-replace-via-env-in-raspberry-and-vps-64chars",
        )
    )
    admin_audit_token: str = field(
        default_factory=lambda: os.getenv("ADMIN_AUDIT_TOKEN", "")
    )
    # Parámetros Argon2id calibrados para ARM64 (Raspberry Pi) y AMD64 (VPS)
    argon2_time_cost: int = field(default_factory=lambda: int(os.getenv("ARGON2_TIME_COST", "3")))
    argon2_memory_cost: int = field(
        default_factory=lambda: int(os.getenv("ARGON2_MEMORY_COST", "65536"))
    )  # 64 MiB
    argon2_parallelism: int = field(
        default_factory=lambda: int(os.getenv("ARGON2_PARALLELISM", "2"))
    )
    session_cookie_name: str = "ideolo_session"
    csrf_cookie_name: str = "ideolo_csrf"
    session_ttl_seconds: int = field(
        default_factory=lambda: int(os.getenv("SESSION_TTL_SECONDS", "28800"))
    )  # 8 horas
    cookie_secure: bool = field(
        default_factory=lambda: os.getenv("COOKIE_SECURE", "true").lower() == "true"
    )
    csrf_protection_enabled: bool = field(
        default_factory=lambda: os.getenv("CSRF_PROTECTION_ENABLED", "true").lower() == "true"
    )
    max_login_attempts: int = 3
    base_lockout_seconds: int = 15
    max_lockout_seconds: int = 300
    rate_limit_per_minute: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    )
    auth_rate_limit_per_minute: int = field(
        default_factory=lambda: int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "10"))
    )


settings = Settings()
