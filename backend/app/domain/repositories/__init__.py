"""Puertos (Interfaces abstractas) de repositorios de la capa de Dominio."""
from abc import ABC, abstractmethod
from app.domain.entities.user import User
from app.domain.entities.progress import GameProgress
from app.domain.entities.session import UserSession
from app.domain.entities.audit_log import SecurityAuditLog


class AbstractUserRepository(ABC):
    @abstractmethod
    def get_by_username(self, username: str) -> User | None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, user_id: str) -> User | None:
        raise NotImplementedError

    @abstractmethod
    def save(self, user: User) -> User:
        raise NotImplementedError


class AbstractProgressRepository(ABC):
    @abstractmethod
    def get_by_user_id(self, user_id: str) -> GameProgress | None:
        raise NotImplementedError

    @abstractmethod
    def save(self, progress: GameProgress) -> GameProgress:
        raise NotImplementedError


class AbstractSessionRepository(ABC):
    @abstractmethod
    def get_by_token_hash(self, token_hash: str) -> UserSession | None:
        raise NotImplementedError

    @abstractmethod
    def save(self, session: UserSession) -> UserSession:
        raise NotImplementedError

    @abstractmethod
    def revoke_all_for_user(self, user_id: str) -> int:
        raise NotImplementedError


class AbstractAuditRepository(ABC):
    @abstractmethod
    def record(self, entry: SecurityAuditLog) -> SecurityAuditLog:
        raise NotImplementedError

    @abstractmethod
    def list_recent(self, limit: int = 50) -> list[SecurityAuditLog]:
        raise NotImplementedError
