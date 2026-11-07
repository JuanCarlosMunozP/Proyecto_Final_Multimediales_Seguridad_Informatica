class DomainError(Exception):
    """Excepción base de la capa de dominio."""


class ValidationError(DomainError):
    """Datos de entrada que violan invariantes del dominio."""


class UserAlreadyExistsError(DomainError):
    """Intento de registrar un nombre de usuario ya existente."""


class InvalidCredentialsError(DomainError):
    """Credenciales inválidas en autenticación."""


class AccountLockedError(DomainError):
    """Cuenta bloqueada temporalmente por exceso de intentos fallidos (SEG-004)."""

    def __init__(self, remaining_seconds: int):
        self.remaining_seconds = max(1, int(remaining_seconds))
        super().__init__(
            f"Demasiados intentos fallidos. Espera {self.remaining_seconds} s antes de reintentar."
        )


class TamperDetectedError(DomainError):
    """Intento de manipular progreso o saltar niveles ilegalmente (SEG-003)."""


class UnauthorizedError(DomainError):
    """Operación requerida sin sesión autenticada válida."""


class CsrfValidationError(DomainError):
    """Fallo de validación del token anti-CSRF en operación mutante."""


class ForbiddenOperationError(DomainError):
    """Intento de acceder a un recurso administrativo o de otro usuario sin autorización."""
