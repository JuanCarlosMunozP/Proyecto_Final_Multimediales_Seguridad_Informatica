import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');

describe('ARCH-DEPLOY-001: Verificación de infraestructura Docker, Nginx, PostgreSQL, Alembic y Clean Architecture', () => {
  it('TC-ARCH-001: existen los artefactos obligatorios de Docker, Nginx, Alembic y FastAPI Clean Architecture', () => {
    const requeridos = [
      'compose.yaml',
      'compose.raspberry.yaml',
      'compose.vps.yaml',
      'backend/Dockerfile',
      'frontend/Dockerfile',
      'deploy/nginx/nginx.conf',
      'deploy/nginx/entrypoint-tls.sh',
      '.env.example',
      'backend/alembic.ini',
      'backend/alembic/env.py',
      'backend/alembic/versions/0001_initial_schema.py',
      'backend/app/domain/entities/user.py',
      'backend/app/domain/entities/progress.py',
      'backend/app/domain/entities/session.py',
      'backend/app/application/use_cases.py',
      'backend/app/infrastructure/models.py',
      'backend/app/infrastructure/repositories.py',
      'backend/app/presentation/routers.py',
    ];
    for (const archivo of requeridos) {
      expect(existsSync(resolve(root, archivo)), `Falta ${archivo}`).toBe(true);
    }
  });

  it('TC-ARCH-002: PostgreSQL (5432) y FastAPI (8000) no publican puertos al host y backend_net es internal: true', () => {
    const base = leer('compose.yaml');
    const rpi = leer('compose.raspberry.yaml');
    const vps = leer('compose.vps.yaml');

    expect(base).toContain('frontend_net:');
    expect(base).toContain('backend_net:');
    expect(base).toContain('internal: true');

    // Ni compose.yaml, ni compose.raspberry.yaml, ni compose.vps.yaml publican 5432 o 8000 en ports:
    for (const contenido of [base, rpi, vps]) {
      expect(contenido).not.toMatch(/ports:[\s\S]*?(?:5432|8000)\b/);
    }

    // Solo el servicio nginx define mapeo de puertos HTTP/HTTPS
    expect(rpi).toMatch(/nginx:[\s\S]*?ports:/);
    expect(vps).toMatch(/nginx:[\s\S]*?ports:/);
  });

  it('TC-ARCH-003: Hardening de Nginx exige TLS 1.2/1.3, ocultamiento de versión, CSP, HSTS y Rate Limiting', () => {
    const nginx = leer('deploy/nginx/nginx.conf');
    expect(nginx).toContain('server_tokens off;');
    expect(nginx).toContain('ssl_protocols       TLSv1.2 TLSv1.3;');
    expect(nginx).toContain('Strict-Transport-Security');
    expect(nginx).toContain('Content-Security-Policy');
    expect(nginx).toContain('X-Frame-Options "DENY"');
    expect(nginx).toContain('X-Content-Type-Options "nosniff"');
    expect(nginx).toContain('limit_req_zone');
    expect(nginx).toContain('proxy_pass http://fastapi_backend;');
  });

  it('TC-ARCH-004: Backend implementa Argon2id, sesiones opacas revocables, CSRF, Alembic y endpoints /api/v1', () => {
    const reqs = leer('backend/requirements.txt');
    const sec = leer('backend/app/core/security.py');
    const deps = leer('backend/app/presentation/dependencies.py');
    const routers = leer('backend/app/presentation/routers.py');
    const migration = leer('backend/alembic/versions/0001_initial_schema.py');

    expect(reqs).toContain('argon2-cffi');
    expect(reqs).toContain('alembic');
    expect(sec).toContain('PasswordHasher');
    expect(sec).toContain('Type.ID');
    expect(sec).toContain('hash_session_token');
    expect(deps).toContain('require_csrf_protection');
    expect(deps).toContain('require_admin_access');
    expect(routers).toContain('APIRouter(prefix="/api/v1")');
    expect(migration).toContain('"user_sessions"');
    expect(migration).toContain('"security_audit_logs"');
  });

  it('TC-ARCH-005: cuenta.js integra modo explícito server con apiCliente.js sin fallback silencioso a localStorage', async () => {
    const cuenta = await import('../src/cuenta/cuenta.js');
    const api = await import('../src/cuenta/apiCliente.js');

    api.configurarClienteApi({
      modo: api.MODOS_CUENTA.SERVER,
      fetchFn: async () => {
        throw new Error('Network unreachable');
      },
      csrfToken: null,
    });

    const fallo = await cuenta.registrar('MaxServer', 'ClaveSegura123');
    expect(fallo.ok).toBe(false);
    expect(fallo.mensaje).toContain('modo \'server\' no se utiliza almacenamiento local');

    api.configurarClienteApi({
      modo: api.MODOS_CUENTA.SERVER,
      fetchFn: async (ruta) => ({
        ok: true,
        status: ruta.endsWith('/register') ? 201 : 200,
        headers: { get: () => 'csrf-server-token' },
        json: async () => ({
          id: 1,
          nombre: 'MaxServer',
          csrfToken: 'csrf-server-token',
          progreso: { nivel: 2, mejorTiempo: 120, victorias: 1 },
        }),
      }),
    });

    const exito = await cuenta.entrar('MaxServer', 'ClaveSegura123');
    expect(exito.ok).toBe(true);
    expect(cuenta.usuario()?.remoto).toBe(true);
    expect(cuenta.nivelGuardado()).toBe(1);

    cuenta.cerrarSesion();
    api.configurarClienteApi({ modo: api.MODOS_CUENTA.LOCAL, csrfToken: null });
  });
});
