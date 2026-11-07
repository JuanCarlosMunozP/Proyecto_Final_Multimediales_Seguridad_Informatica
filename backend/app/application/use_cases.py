from datetime import datetime, timedelta, timezone
import uuid

from app.application.dtos import AuthResultDTO, ProgressDTO
from app.core.config import settings
from app.core.security import (
    emit_structured_security_log,
    generate_opaque_token,
    hash_password_argon2id,
    hash_session_token,
    sign_progress,
    verify_password_argon2id,
    verify_progress_signature,
)
from app.domain.entities.audit_log import SecurityAuditLog
from app.domain.entities.progress import GameProgress
from app.domain.entities.session import UserSession
from app.domain.entities.user import User
from app.domain.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    TamperDetectedError,
    UserAlreadyExistsError,
)
from app.domain.repositories import (
    AbstractAuditRepository,
    AbstractProgressRepository,
    AbstractSessionRepository,
    AbstractUserRepository,
)


def _issue_opaque_session(
    session_repo: AbstractSessionRepository,
    user: User,
    ip_address: str,
    user_agent: str,
    now: datetime | None = None,
) -> tuple[str, str]:
    current_time = now or datetime.now(timezone.utc)
    raw_token = generate_opaque_token(32)
    csrf_token = generate_opaque_token(24)
    session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        token_hash=hash_session_token(raw_token),
        csrf_token=csrf_token,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=current_time + timedelta(seconds=settings.session_ttl_seconds),
        created_at=current_time,
    )
    session_repo.save(session)
    return raw_token, csrf_token


class RegisterUserUseCase:
    """CU-002 — Registrar usuario con Argon2id, sesión opaca revocable, CSRF y progreso firmado con HMAC."""

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        progress_repo: AbstractProgressRepository,
        session_repo: AbstractSessionRepository,
        audit_repo: AbstractAuditRepository,
    ):
        self.user_repo = user_repo
        self.progress_repo = progress_repo
        self.session_repo = session_repo
        self.audit_repo = audit_repo

    def execute(
        self, display_name: str, password: str, ip_address: str, user_agent: str
    ) -> AuthResultDTO:
        clean_name = User.validate_display_name(display_name)
        username = User.normalize_username(clean_name)
        User.validate_password(password)

        if self.user_repo.get_by_username(username) is not None:
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type="REGISTER_DUPLICATE",
                    username=username,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            )
            emit_structured_security_log("REGISTER_DUPLICATE", username, ip_address)
            raise UserAlreadyExistsError("Ese nombre ya está registrado. Elige otro o inicia sesión.")

        password_hash = hash_password_argon2id(password)
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            username=username,
            display_name=clean_name,
            password_hash=password_hash,
            role="player",
        )
        self.user_repo.save(user)

        initial_hmac = sign_progress(username, 1, 0, 0)
        progress = GameProgress(
            user_id=user_id,
            username=username,
            current_level=1,
            best_time_seconds=0,
            victories=0,
            integrity_hmac=initial_hmac,
        )
        self.progress_repo.save(progress)

        raw_token, csrf_token = _issue_opaque_session(
            self.session_repo, user, ip_address, user_agent
        )

        self.audit_repo.record(
            SecurityAuditLog(
                event_type="REGISTER_OK",
                user_id=user_id,
                username=username,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )
        emit_structured_security_log("REGISTER_OK", username, ip_address)

        return AuthResultDTO(
            user_id=user_id,
            username=username,
            display_name=clean_name,
            role=user.role,
            opaque_session_token=raw_token,
            csrf_token=csrf_token,
            progreso=ProgressDTO(nivel=1, mejor_tiempo=0, victorias=0),
        )


class AuthenticateUserUseCase:
    """CU-003 — Iniciar sesión con Argon2id, bloqueo exponencial en BD y sesión opaca revocable."""

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        progress_repo: AbstractProgressRepository,
        session_repo: AbstractSessionRepository,
        audit_repo: AbstractAuditRepository,
    ):
        self.user_repo = user_repo
        self.progress_repo = progress_repo
        self.session_repo = session_repo
        self.audit_repo = audit_repo

    def execute(
        self,
        display_name: str,
        password: str,
        ip_address: str,
        user_agent: str,
        now: datetime | None = None,
    ) -> AuthResultDTO:
        current_time = now or datetime.now(timezone.utc)
        username = (display_name or "").strip().lower()
        user = self.user_repo.get_by_username(username)

        if user is None:
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type="LOGIN_FAIL_UNKNOWN_USER",
                    username=username[:32],
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            )
            emit_structured_security_log("LOGIN_FAIL_UNKNOWN_USER", username[:32], ip_address)
            raise InvalidCredentialsError("Nombre o contraseña incorrectos.")

        if user.is_locked(current_time):
            remaining = user.remaining_lockout_seconds(current_time)
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type="LOGIN_BLOCKED_LOCKOUT",
                    user_id=user.id,
                    username=user.username,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={"remaining_seconds": remaining},
                )
            )
            emit_structured_security_log(
                "LOGIN_BLOCKED_LOCKOUT", user.username, ip_address, {"remaining_seconds": remaining}
            )
            raise AccountLockedError(remaining)

        if not verify_password_argon2id(password or "", user.password_hash):
            penalty = user.register_failed_attempt(current_time)
            self.user_repo.save(user)
            event = "ACCOUNT_LOCKED" if penalty > 0 else "LOGIN_FAIL_BAD_PASSWORD"
            details = {"failed_attempts": user.failed_attempts, "lockout_seconds": penalty}
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type=event,
                    user_id=user.id,
                    username=user.username,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details=details,
                )
            )
            emit_structured_security_log(event, user.username, ip_address, details)
            if penalty > 0:
                raise AccountLockedError(penalty)
            raise InvalidCredentialsError("Nombre o contraseña incorrectos.")

        user.reset_failed_attempts()
        self.user_repo.save(user)

        get_progress_uc = GetProgressUseCase(self.user_repo, self.progress_repo, self.audit_repo)
        progress_dto = get_progress_uc.execute(user.username, ip_address, user_agent)

        raw_token, csrf_token = _issue_opaque_session(
            self.session_repo, user, ip_address, user_agent, current_time
        )

        self.audit_repo.record(
            SecurityAuditLog(
                event_type="LOGIN_OK",
                user_id=user.id,
                username=user.username,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )
        emit_structured_security_log("LOGIN_OK", user.username, ip_address)

        return AuthResultDTO(
            user_id=user.id,
            username=user.username,
            display_name=user.display_name,
            role=user.role,
            opaque_session_token=raw_token,
            csrf_token=csrf_token,
            progreso=progress_dto,
        )


class RevokeSessionUseCase:
    """Revoca inmediatamente en PostgreSQL una sesión opaca activa al cerrar sesión."""

    def __init__(
        self,
        session_repo: AbstractSessionRepository,
        audit_repo: AbstractAuditRepository,
    ):
        self.session_repo = session_repo
        self.audit_repo = audit_repo

    def execute(self, raw_token: str | None, ip_address: str, user_agent: str) -> bool:
        if not raw_token:
            return False
        token_hash = hash_session_token(raw_token)
        session = self.session_repo.get_by_token_hash(token_hash)
        if session is None or not session.is_active():
            return False
        session.revoke()
        self.session_repo.save(session)
        self.audit_repo.record(
            SecurityAuditLog(
                event_type="LOGOUT_SESSION_REVOKED",
                user_id=session.user_id,
                username=session.username,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"session_id": session.id},
            )
        )
        emit_structured_security_log("LOGOUT_SESSION_REVOKED", session.username, ip_address)
        return True


class GetProgressUseCase:
    """CU-018 — Cargar progreso verificando integridad HMAC-SHA256 en servidor."""

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        progress_repo: AbstractProgressRepository,
        audit_repo: AbstractAuditRepository,
    ):
        self.user_repo = user_repo
        self.progress_repo = progress_repo
        self.audit_repo = audit_repo

    def execute(self, username: str, ip_address: str = "0.0.0.0", user_agent: str = "") -> ProgressDTO:
        user = self.user_repo.get_by_username(username.lower())
        if user is None:
            raise InvalidCredentialsError("Sesión inválida.")

        progress = self.progress_repo.get_by_user_id(user.id)
        if progress is None:
            fresh_hmac = sign_progress(user.username, 1, 0, 0)
            progress = GameProgress(
                user_id=user.id,
                username=user.username,
                current_level=1,
                best_time_seconds=0,
                victories=0,
                integrity_hmac=fresh_hmac,
            )
            self.progress_repo.save(progress)
            return ProgressDTO(nivel=1, mejor_tiempo=0, victorias=0)

        aviso = None
        if not verify_progress_signature(
            user.username,
            progress.current_level,
            progress.best_time_seconds,
            progress.victories,
            progress.integrity_hmac,
        ):
            fresh_hmac = sign_progress(user.username, 1, 0, 0)
            progress.reset_to_safe_default(fresh_hmac)
            self.progress_repo.save(progress)
            aviso = "Se detectó una modificación externa del progreso en base de datos; se restableció al nivel 1."
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type="DB_TAMPER_RESET",
                    user_id=user.id,
                    username=user.username,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            )
            emit_structured_security_log("DB_TAMPER_RESET", user.username, ip_address)

        return ProgressDTO(
            nivel=progress.current_level,
            mejor_tiempo=progress.best_time_seconds,
            victorias=progress.victories,
            aviso=aviso,
        )


class UpdateProgressUseCase:
    """CU-017 — Guardar progreso aplicando reglas anti-trampa y firma HMAC-SHA256 en servidor."""

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        progress_repo: AbstractProgressRepository,
        audit_repo: AbstractAuditRepository,
    ):
        self.user_repo = user_repo
        self.progress_repo = progress_repo
        self.audit_repo = audit_repo

    def execute(
        self,
        username: str,
        requested_level: int | None,
        victory_seconds: int | None,
        ip_address: str,
        user_agent: str,
    ) -> ProgressDTO:
        user = self.user_repo.get_by_username(username.lower())
        if user is None:
            raise InvalidCredentialsError("Sesión inválida.")

        get_uc = GetProgressUseCase(self.user_repo, self.progress_repo, self.audit_repo)
        get_uc.execute(user.username, ip_address, user_agent)

        progress = self.progress_repo.get_by_user_id(user.id)
        assert progress is not None

        try:
            progress.apply_progress_update(
                requested_level=requested_level,
                victory_seconds=victory_seconds,
            )
        except TamperDetectedError as exc:
            details = {
                "current_level": progress.current_level,
                "requested_level": requested_level,
                "victory_seconds": victory_seconds,
                "reason": str(exc),
            }
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type="TAMPER_BLOCKED",
                    user_id=user.id,
                    username=user.username,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details=details,
                )
            )
            emit_structured_security_log("TAMPER_BLOCKED", user.username, ip_address, details)
            raise

        progress.integrity_hmac = sign_progress(
            user.username,
            progress.current_level,
            progress.best_time_seconds,
            progress.victories,
        )
        self.progress_repo.save(progress)

        details = {
            "nivel": progress.current_level,
            "mejor_tiempo": progress.best_time_seconds,
            "victorias": progress.victories,
        }
        self.audit_repo.record(
            SecurityAuditLog(
                event_type="PROGRESS_UPDATED",
                user_id=user.id,
                username=user.username,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details,
            )
        )
        emit_structured_security_log("PROGRESS_UPDATED", user.username, ip_address, details)

        return ProgressDTO(
            nivel=progress.current_level,
            mejor_tiempo=progress.best_time_seconds,
            victorias=progress.victories,
        )
