import os

os.environ["DATABASE_URL"] = "sqlite:///./test_security.db"
os.environ["SECRET_KEY"] = "test-secret-key-hmac-256-bits-for-automated-suite"
os.environ["ADMIN_AUDIT_TOKEN"] = "token-admin-auditoria-2026"
os.environ["COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient
import pytest

from app.core.security import hash_password_argon2id, verify_password_argon2id
from app.domain.entities.progress import GameProgress
from app.domain.entities.user import User
from app.domain.exceptions import TamperDetectedError, ValidationError
from app.infrastructure.models import Base, GameProgressModel
from app.infrastructure.session import SessionLocal, engine
from app.main import app, reset_rate_limiter


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    reset_rate_limiter()
    yield


def test_argon2id_password_hashing_and_domain_invariants():
    """Verifica hashing Argon2id y reglas puras de la Capa de Dominio."""
    h = hash_password_argon2id("MiClaveFuerte#2026")
    assert verify_password_argon2id("MiClaveFuerte#2026", h) is True
    assert verify_password_argon2id("OtraClave", h) is False

    with pytest.raises(ValidationError):
        User.validate_display_name("<script>alert(1)</script>")

    progress = GameProgress(user_id="u1", username="max", current_level=1)
    with pytest.raises(TamperDetectedError):
        progress.apply_progress_update(requested_level=3)

    progress.apply_progress_update(requested_level=2)
    assert progress.current_level == 2


def test_opaque_revocable_session_and_csrf_protection():
    """
    Verifica:
    1. Emisión de sesión opaca en cookie HttpOnly + token CSRF.
    2. Rechazo HTTP 403 si se intenta mutar progreso sin cabecera X-CSRF-Token.
    3. Revocación inmediata en BD al hacer logout (reutilizar cookie da HTTP 401).
    """
    with TestClient(app) as client:
        res = client.post(
            "/api/v1/auth/register", json={"nombre": "Explorador_1", "clave": "ClaveSegura#26"}
        )
        assert res.status_code == 201
        assert "ideolo_session" in res.cookies
        csrf_token = res.json()["csrfToken"]
        session_cookie = res.cookies["ideolo_session"]

        # Sin cabecera X-CSRF-Token debe bloquear con 403 Forbidden
        res_no_csrf = client.put("/api/v1/progress", json={"nivel": 2})
        assert res_no_csrf.status_code == 403

        # Con cabecera X-CSRF-Token válida actualiza el progreso
        res_ok = client.put(
            "/api/v1/progress",
            json={"nivel": 2},
            headers={"X-CSRF-Token": csrf_token},
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["nivel"] == 2

        # Cerrar sesión revoca el token opaco en la tabla user_sessions
        res_logout = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf_token})
        assert res_logout.status_code == 200

        # Si un atacante intenta reutilizar el token opaco revocado, recibe 401 Unauthorized
        res_replay = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {session_cookie}"},
        )
        assert res_replay.status_code == 401


def test_user_isolation_and_admin_endpoint_protection():
    """
    Verifica aislamiento estricto entre usuarios (no IDOR) y protección del endpoint administrativo.
    """
    with TestClient(app) as c1, TestClient(app) as c2:
        r1 = c1.post("/api/v1/auth/register", json={"nombre": "Jugador_A", "clave": "ClaveSegura#26"})
        csrf_a = r1.json()["csrfToken"]
        c1.put("/api/v1/progress", json={"nivel": 2}, headers={"X-CSRF-Token": csrf_a})

        r2 = c2.post("/api/v1/auth/register", json={"nombre": "Jugador_B", "clave": "ClaveSegura#26"})
        assert r2.status_code == 201

        # Jugador B solo ve su propio progreso (Nivel 1), nunca el de Jugador A
        assert c2.get("/api/v1/progress").json()["nivel"] == 1

        # Un jugador normal no puede leer /api/v1/security/audit-logs (403 Forbidden)
        assert c2.get("/api/v1/security/audit-logs").status_code == 403

        # Con autorización administrativa explícita sí puede auditar los eventos
        res_admin = c2.get(
            "/api/v1/security/audit-logs",
            headers={"X-Admin-Audit-Token": "token-admin-auditoria-2026"},
        )
        assert res_admin.status_code == 200
        assert len(res_admin.json()) >= 2


def test_anti_cheat_blocks_level_jump_and_brute_force_locks_account():
    """Verifica bloqueo anti-cheat (Nivel 1->3) y bloqueo por fuerza bruta (HTTP 423)."""
    with TestClient(app) as client:
        reg = client.post(
            "/api/v1/auth/register", json={"nombre": "Pentester", "clave": "ClaveSegura#26"}
        )
        csrf = reg.json()["csrfToken"]

        # Intento de saltar del nivel 1 al 3
        res_cheat = client.put(
            "/api/v1/progress", json={"nivel": 3}, headers={"X-CSRF-Token": csrf}
        )
        assert res_cheat.status_code == 403

        # Fuerza bruta sobre login
        client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        assert client.post("/api/v1/auth/login", json={"nombre": "Pentester", "clave": "x1"}).status_code == 401
        assert client.post("/api/v1/auth/login", json={"nombre": "Pentester", "clave": "x2"}).status_code == 401
        r_lock = client.post("/api/v1/auth/login", json={"nombre": "Pentester", "clave": "x3"})
        assert r_lock.status_code == 423
        assert "Retry-After" in r_lock.headers


def test_db_hmac_tampering_auto_resets_to_level_1():
    """Verifica que alterar directamente la fila en SQL invalida el HMAC y restablece a Nivel 1."""
    with TestClient(app) as client:
        reg = client.post(
            "/api/v1/auth/register", json={"nombre": "AuditorSQL", "clave": "ClaveSegura#26"}
        )
        csrf = reg.json()["csrfToken"]
        client.put("/api/v1/progress", json={"nivel": 2}, headers={"X-CSRF-Token": csrf})

        db = SessionLocal()
        row = db.query(GameProgressModel).filter_by(username="auditorsql").first()
        row.current_level = 3
        db.commit()
        db.close()

        me_res = client.get("/api/v1/auth/me")
        assert me_res.status_code == 200
        body = me_res.json()
        assert body["progreso"]["nivel"] == 1
        assert "restableció al nivel 1" in (body["aviso"] or "")
