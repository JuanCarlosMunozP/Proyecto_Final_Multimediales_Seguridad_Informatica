import { describe, expect, it, beforeEach } from 'vitest';
import {
  disponible,
  aB64,
  deB64,
  salAleatoria,
  derivar,
  iguales,
  firmar,
  firmaValida,
} from '../src/cuenta/seguridad.js';
import {
  NOMBRE_VALIDO,
  llave,
  registroValido,
  leerUsuarios,
  guardarUsuarios,
  leerIntentos,
  guardarIntentos,
  leerSesion,
  guardarSesion,
  borrarSesion,
} from '../src/cuenta/almacen.js';
import {
  registrar,
  entrar,
  entrarComoInvitado,
  cerrarSesion,
  guardarNivel,
  registrarVictoria,
  nivelGuardado,
  usuario,
} from '../src/cuenta/cuenta.js';
import {
  MODOS_CUENTA,
  modoCuentaActual,
  tokenCsrfActual,
  configurarClienteApi,
  adaptarDatosServidor,
  registrarEnServidor,
  entrarEnServidor,
  actualizarProgresoEnServidor,
  cerrarSesionEnServidor,
} from '../src/cuenta/apiCliente.js';

function crearStorageMemoria() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

describe('Seguridad criptográfica y almacenamiento de cuentas (SEG-001, SEG-002, SEG-003)', () => {
  beforeEach(() => {
    globalThis.localStorage = crearStorageMemoria();
    globalThis.sessionStorage = crearStorageMemoria();
    configurarClienteApi({ modo: MODOS_CUENTA.LOCAL, csrfToken: null });
  });

  it('TC-SEC-001: SubtleCrypto disponible y codificación Base64 reversible', () => {
    expect(disponible()).toBe(true);
    const s = salAleatoria();
    expect(typeof s).toBe('string');
    expect(deB64(s)).toHaveLength(16);
    expect(aB64(deB64(s))).toBe(s);
  });

  it('TC-SEC-002: PBKDF2-SHA256 (150 000 iteraciones) separa verificador y clave HMAC', async () => {
    const sal = salAleatoria();
    const d1 = await derivar('ClaveSegura123', sal);
    const d2 = await derivar('ClaveSegura123', sal);
    const dOtra = await derivar('OtraClave456', sal);

    expect(d1.verificador).toBe(d2.verificador);
    expect(d1.clave).toBe(d2.clave);
    expect(d1.verificador).not.toBe(d1.clave);
    expect(d1.verificador).not.toBe(dOtra.verificador);
  });

  it('TC-SEC-003: comparación en tiempo constante (iguales) rechaza longitudes o tipos distintos', () => {
    expect(iguales('abc123', 'abc123')).toBe(true);
    expect(iguales('abc123', 'abc124')).toBe(false);
    expect(iguales('abc123', 'abc12')).toBe(false);
    expect(iguales(null, 'abc')).toBe(false);
  });

  it('TC-SEC-004: firma HMAC-SHA256 detecta adulteración de nivel, tiempo, victorias o nombre', async () => {
    const { clave } = await derivar('ClaveSegura123', salAleatoria());
    const datos = { nivel: 1, mejorTiempo: 240, victorias: 2 };
    const firma = await firmar(clave, 'Max', datos);

    expect(await firmaValida(clave, 'Max', datos, firma)).toBe(true);
    expect(await firmaValida(clave, 'Max', { ...datos, nivel: 2 }, firma)).toBe(false);
    expect(await firmaValida(clave, 'Max', { ...datos, mejorTiempo: 60 }, firma)).toBe(false);
    expect(await firmaValida(clave, 'Max', { ...datos, victorias: 99 }, firma)).toBe(false);
    expect(await firmaValida(clave, 'Daniel', datos, firma)).toBe(false);
    expect(await firmaValida(clave, 'Max', datos, 'firma_corrupta_!!!')).toBe(false);
  });

  it('TC-SEC-005: validación estricta de formato de nombre y registros en localStorage', () => {
    expect(NOMBRE_VALIDO.test('Max_Montenegro')).toBe(true);
    expect(NOMBRE_VALIDO.test('<script>alert(1)</script>')).toBe(false);
    expect(NOMBRE_VALIDO.test('ab')).toBe(false);
    expect(llave('  Max_Montenegro ')).toBe('max_montenegro');

    globalThis.localStorage.setItem('ideolo:v1:cuentas', '{json_roto');
    expect(leerUsuarios()).toEqual([]);

    const invalido = {
      nombre: 'Max',
      sal: 'AAAAAAAAAAAAAAAAAAAAAA==',
      verificador: 'BBBBBBBBBBBBBBBBBBBBBB==',
      firma: 'CCCCCCCCCCCCCCCCCCCCCC==',
      datos: { nivel: 99, mejorTiempo: null, victorias: 0 },
    };
    expect(registroValido(invalido)).toBe(false);
  });

  it('TC-SEC-006: registro, ingreso, detección de adulteración en localStorage y bloqueo exponencial', async () => {
    const rReg = await registrar('Explorador_1', ' Secreta123 ');
    expect(rReg.ok).toBe(true);
    expect(usuario()?.nombre).toBe('Explorador_1');

    // No permite duplicados (case-insensitive)
    const rDup = await registrar('explorador_1', 'OtraClave123');
    expect(rDup.ok).toBe(false);

    // Contraseña nunca en texto plano en localStorage
    const crudo = globalThis.localStorage.getItem('ideolo:v1:cuentas');
    expect(crudo).not.toContain('Secreta123');

    cerrarSesion();
    expect(leerSesion()).toBeNull();

    // 3 intentos fallidos activan bloqueo temporal
    for (let i = 0; i < 3; i++) {
      const f = await entrar('Explorador_1', 'incorrecta');
      expect(f.ok).toBe(false);
      expect(f.mensaje).toBe('Nombre o contraseña incorrectos.');
    }
    const fBloqueado = await entrar('Explorador_1', ' Secreta123 ');
    expect(fBloqueado.ok).toBe(false);
    expect(fBloqueado.mensaje).toMatch(/Demasiados intentos/);

    // Limpiar intentos para probar detección de adulteración en localStorage
    guardarIntentos({});
    const lista = leerUsuarios();
    lista[0].datos.nivel = 2; // Adulteración manual sin recalcular HMAC
    guardarUsuarios(lista);

    const rLogin = await entrar('Explorador_1', ' Secreta123 ');
    expect(rLogin.ok).toBe(true);
    expect(nivelGuardado()).toBe(0); // Restablecido a 0 por firma inválida
    expect(usuario()?.aviso).toMatch(/modificados y se restablecieron/);
  });

  it('TC-SEC-007: modo invitado no persiste claves y guardado de nivel/victoria actualiza progreso', async () => {
    entrarComoInvitado();
    expect(usuario()?.invitado).toBe(true);
    guardarNivel(2);
    expect(nivelGuardado()).toBe(0);
    cerrarSesion();

    await registrar('MaxPro', 'ClaveFuerte99');
    guardarNivel(2);
    expect(nivelGuardado()).toBe(2);
    registrarVictoria(185.4);
    expect(usuario()?.datos.victorias).toBe(1);
    expect(usuario()?.datos.mejorTiempo).toBe(185);
    expect(nivelGuardado()).toBe(0);
  });

  it('TC-SEC-008: modos explícitos local vs server, envío de X-CSRF-Token y prohibición de fallback silencioso', async () => {
    expect(modoCuentaActual()).toBe(MODOS_CUENTA.LOCAL);
    expect(adaptarDatosServidor({ nivel: 2, mejorTiempo: 140, victorias: 3 })).toEqual({
      nivel: 1,
      mejorTiempo: 140,
      victorias: 3,
    });

    // En modo 'local', el cliente servidor rechaza invocaciones accidentales
    const rechazoModo = await registrarEnServidor('Explorador', 'ClaveSegura#26');
    expect(rechazoModo.ok).toBe(false);
    expect(rechazoModo.codigo).toBe('MODE_NOT_SERVER');

    // Activar modo explícito 'server'
    const llamadas = [];
    configurarClienteApi({
      modo: MODOS_CUENTA.SERVER,
      fetchFn: async (ruta, opciones) => {
        llamadas.push({
          ruta,
          metodo: opciones.method,
          headers: opciones.headers,
          cuerpo: opciones.body ? JSON.parse(opciones.body) : null,
        });
        if (ruta === '/api/v1/auth/register') {
          return {
            ok: true,
            status: 201,
            headers: { get: () => 'csrf-token-opaco-123' },
            json: async () => ({
              ok: true,
              nombre: 'RaspberryPi_01',
              csrfToken: 'csrf-token-opaco-123',
              progreso: { nivel: 1, mejorTiempo: 0, victorias: 0 },
            }),
          };
        }
        if (ruta === '/api/v1/progress') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({ nivel: 2, mejorTiempo: 120, victorias: 1 }),
          };
        }
        if (ruta === '/api/v1/auth/logout') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({ ok: true }),
          };
        }
        throw new Error('Network unreachable');
      },
    });

    const reg = await registrarEnServidor('RaspberryPi_01', 'ClaveSegura#2026');
    expect(reg.ok).toBe(true);
    expect(tokenCsrfActual()).toBe('csrf-token-opaco-123');
    // No escribe nada en localStorage ni sessionStorage
    expect(leerUsuarios()).toEqual([]);
    expect(leerSesion()).toBeNull();

    // Al actualizar progreso envía automáticamente la cabecera X-CSRF-Token
    const prog = await actualizarProgresoEnServidor({ nivel: 1, tiempoVictoria: 120 });
    expect(prog.ok).toBe(true);
    expect(llamadas[1].headers['X-CSRF-Token']).toBe('csrf-token-opaco-123');

    // Al cerrar sesión envía X-CSRF-Token y limpia el token en memoria
    const out = await cerrarSesionEnServidor();
    expect(out.ok).toBe(true);
    expect(tokenCsrfActual()).toBeNull();

    // Si la red o API falla en modo 'server', NO hace fallback silencioso a localStorage
    const falloRed = await entrarEnServidor('RaspberryPi_01', 'ClaveSegura#2026');
    expect(falloRed.ok).toBe(false);
    expect(falloRed.codigo).toBe('SERVER_UNREACHABLE');
    expect(leerUsuarios()).toEqual([]);
  });
});
