# Plan de Desarrollo — Backend FastAPI (Clean Architecture), Base de Datos, Nginx Hardening y Docker para Raspberry Pi

**Proyecto:** La Búsqueda del Ídolo Perdido
**Objetivo:** Incorporar una arquitectura Cliente-Servidor real con **FastAPI (Clean Architecture)**, **PostgreSQL**, **Nginx Reverse Proxy endurecido** y **Docker Compose multi-arquitectura (`linux/arm64` para Raspberry Pi y `linux/amd64` para PC)** orientada a pruebas de seguridad y penetración.

---

## 1. Topología de Contenedores (Docker Compose en Raspberry Pi)

1. **`gateway` (`nginx:1.27-alpine`):**
   - Sirve el build estático de producción del videojuego 3D (`frontend/dist`).
   - Enruta `/api/*` hacia el contenedor `backend:8000`.
   - Aplica **Hardening HTTP**: `server_tokens off`, `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` y `limit_req_zone` contra ataques de fuerza bruta y DoS.
2. **`backend` (`python:3.12-slim` + FastAPI + Uvicorn):**
   - Estructurado en **Arquitectura Limpia (4 capas)**:
     - **Domain (`app/domain/`):** Entidades `User`, `GameProgress`, `SecurityAuditLog`, reglas anti-trampa (prohibido saltar del nivel 1 al 3 sin completar el 2) y puertos de repositorio.
     - **Application (`app/application/`):** Casos de uso `RegisterUserUseCase`, `AuthenticateUserUseCase`, `GetProgressUseCase`, `UpdateProgressUseCase`, `ListAuditLogsUseCase`.
     - **Infrastructure (`app/infrastructure/`):** SQLAlchemy 2.0 + PostgreSQL (`psycopg` / `sqlite` para tests), hashing de contraseñas (`PBKDF2-SHA256` / `Argon2`), firma `HMAC-SHA256` en servidor y emisión de JWT en cookies `HttpOnly; SameSite=Strict`.
     - **Presentation (`app/presentation/`):** Routers FastAPI (`/api/v1/health`, `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/progress`, `/api/v1/security/audit-logs`) con validación estricta Pydantic v2.
3. **`db` (`postgres:16-alpine`):**
   - Aislado en una red Docker interna (`internal: true`, sin puertos publicados al host) con límites de memoria ajustados para Raspberry Pi (`shared_buffers=64MB`).
   - Almacena `users`, `game_progress` y `security_audit_logs` (bitácora forense de intentos de intrusión).

---

## 2. Fases de Ejecución

1. **Fase 1:** Construcción del backend FastAPI con Arquitectura Limpia en `backend/` y suite de pruebas automatizadas (`pytest`).
2. **Fase 2:** Creación de `Dockerfile` (multi-etapa para frontend+Nginx y backend), `nginx.conf` endurecido y `docker-compose.yml` optimizado para Raspberry Pi (`ARM64`).
3. **Fase 3:** Conexión híbrida en `frontend/src/cuenta/cuenta.js` (usa la API FastAPI cuando está disponible y conserva el modo local `Web Crypto` como respaldo automático para no romper ninguna de las 216 pruebas actuales) + Playbook de Pentesting en `docs/security/raspberry-pentest-playbook.md`.
