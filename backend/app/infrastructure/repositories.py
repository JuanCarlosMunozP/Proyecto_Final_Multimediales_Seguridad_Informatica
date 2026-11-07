from datetime import datetime, timezone
import json
from sqlalchemy.orm import Session

from app.domain.entities.audit_log import SecurityAuditLog
from app.domain.entities.progress import GameProgress
from app.domain.entities.session import UserSession
from app.domain.entities.user import User
from app.domain.repositories import (
    AbstractAuditRepository,
    AbstractProgressRepository,
    AbstractSessionRepository,
    AbstractUserRepository,
)
from app.infrastructure.models import (
    GameProgressModel,
    SecurityAuditLogModel,
    UserModel,
    UserSessionModel,
)


class SqlUserRepository(AbstractUserRepository):
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_entity(model: UserModel) -> User:
        return User(
            id=model.id,
            username=model.username,
            display_name=model.display_name,
            password_hash=model.password_hash,
            role=model.role,
            failed_attempts=model.failed_attempts,
            locked_until=model.locked_until,
            created_at=model.created_at,
        )

    def get_by_username(self, username: str) -> User | None:
        row = self.db.query(UserModel).filter(UserModel.username == username.lower()).first()
        return self._to_entity(row) if row else None

    def get_by_id(self, user_id: str) -> User | None:
        row = self.db.query(UserModel).filter(UserModel.id == user_id).first()
        return self._to_entity(row) if row else None

    def save(self, user: User) -> User:
        row = self.db.query(UserModel).filter(UserModel.id == user.id).first()
        if row is None:
            row = UserModel(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                password_hash=user.password_hash,
                role=user.role,
                failed_attempts=user.failed_attempts,
                locked_until=user.locked_until,
                created_at=user.created_at,
            )
            self.db.add(row)
        else:
            row.display_name = user.display_name
            row.password_hash = user.password_hash
            row.role = user.role
            row.failed_attempts = user.failed_attempts
            row.locked_until = user.locked_until
        self.db.commit()
        self.db.refresh(row)
        return self._to_entity(row)


class SqlProgressRepository(AbstractProgressRepository):
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_entity(model: GameProgressModel) -> GameProgress:
        return GameProgress(
            user_id=model.user_id,
            username=model.username,
            current_level=model.current_level,
            best_time_seconds=model.best_time_seconds,
            victories=model.victories,
            integrity_hmac=model.integrity_hmac,
            updated_at=model.updated_at,
        )

    def get_by_user_id(self, user_id: str) -> GameProgress | None:
        row = self.db.query(GameProgressModel).filter(GameProgressModel.user_id == user_id).first()
        return self._to_entity(row) if row else None

    def save(self, progress: GameProgress) -> GameProgress:
        row = (
            self.db.query(GameProgressModel)
            .filter(GameProgressModel.user_id == progress.user_id)
            .first()
        )
        if row is None:
            row = GameProgressModel(
                user_id=progress.user_id,
                username=progress.username,
                current_level=progress.current_level,
                best_time_seconds=progress.best_time_seconds,
                victories=progress.victories,
                integrity_hmac=progress.integrity_hmac,
                updated_at=progress.updated_at,
            )
            self.db.add(row)
        else:
            row.current_level = progress.current_level
            row.best_time_seconds = progress.best_time_seconds
            row.victories = progress.victories
            row.integrity_hmac = progress.integrity_hmac
            row.updated_at = progress.updated_at
        self.db.commit()
        self.db.refresh(row)
        return self._to_entity(row)


class SqlSessionRepository(AbstractSessionRepository):
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_entity(model: UserSessionModel) -> UserSession:
        return UserSession(
            id=model.id,
            user_id=model.user_id,
            username=model.username,
            display_name=model.display_name,
            role=model.role,
            token_hash=model.token_hash,
            csrf_token=model.csrf_token,
            ip_address=model.ip_address,
            user_agent=model.user_agent,
            expires_at=model.expires_at,
            revoked_at=model.revoked_at,
            created_at=model.created_at,
        )

    def get_by_token_hash(self, token_hash: str) -> UserSession | None:
        row = (
            self.db.query(UserSessionModel)
            .filter(UserSessionModel.token_hash == token_hash)
            .first()
        )
        return self._to_entity(row) if row else None

    def save(self, session: UserSession) -> UserSession:
        row = self.db.query(UserSessionModel).filter(UserSessionModel.id == session.id).first()
        if row is None:
            row = UserSessionModel(
                id=session.id,
                user_id=session.user_id,
                username=session.username,
                display_name=session.display_name,
                role=session.role,
                token_hash=session.token_hash,
                csrf_token=session.csrf_token,
                ip_address=session.ip_address,
                user_agent=session.user_agent,
                expires_at=session.expires_at,
                revoked_at=session.revoked_at,
                created_at=session.created_at,
            )
            self.db.add(row)
        else:
            row.revoked_at = session.revoked_at
            row.expires_at = session.expires_at
        self.db.commit()
        self.db.refresh(row)
        return self._to_entity(row)

    def revoke_all_for_user(self, user_id: str) -> int:
        now = datetime.now(timezone.utc)
        rows = (
            self.db.query(UserSessionModel)
            .filter(UserSessionModel.user_id == user_id, UserSessionModel.revoked_at.is_(None))
            .all()
        )
        for r in rows:
            r.revoked_at = now
        self.db.commit()
        return len(rows)


class SqlAuditRepository(AbstractAuditRepository):
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_entity(model: SecurityAuditLogModel) -> SecurityAuditLog:
        return SecurityAuditLog(
            id=model.id,
            event_type=model.event_type,
            user_id=model.user_id,
            username=model.username,
            ip_address=model.ip_address,
            user_agent=model.user_agent,
            details=model.get_details(),
            created_at=model.created_at,
        )

    def record(self, entry: SecurityAuditLog) -> SecurityAuditLog:
        row = SecurityAuditLogModel(
            event_type=entry.event_type,
            user_id=entry.user_id,
            username=entry.username,
            ip_address=(entry.ip_address or "0.0.0.0")[:45],
            user_agent=(entry.user_agent or "unknown")[:255],
            details_json=json.dumps(entry.details or {}, ensure_ascii=False),
            created_at=entry.created_at,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._to_entity(row)

    def list_recent(self, limit: int = 50) -> list[SecurityAuditLog]:
        rows = (
            self.db.query(SecurityAuditLogModel)
            .order_by(SecurityAuditLogModel.id.desc())
            .limit(max(1, min(limit, 200)))
            .all()
        )
        return [self._to_entity(r) for r in rows]
