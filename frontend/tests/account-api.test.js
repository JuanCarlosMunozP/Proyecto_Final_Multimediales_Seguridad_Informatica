import { beforeEach, describe, expect, it } from 'vitest';
import * as api from '../src/cuenta/apiCliente.js';
import * as cuenta from '../src/cuenta/cuenta.js';

const respuesta = (status, datos, csrf = null) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => name.toLowerCase() === 'x-csrf-token' ? csrf : null },
  json: async () => datos,
});

describe('Cuenta y progreso delegados al backend', () => {
  beforeEach(() => {
    api.configurarFetchApi(async () => {
      throw new Error('Backend no configurado para esta prueba');
    });
  });

  it('registra e inicia sesión únicamente mediante la API', async () => {
    const llamadas = [];
    api.configurarFetchApi(async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return respuesta(200, {
        nombre: 'Explorador_1',
        progreso: { nivel: 2, mejorTiempo: 140, victorias: 3 },
      }, 'csrf-token');
    });

    const registro = await cuenta.registrar('Explorador_1', 'ClaveSegura123');
    expect(registro.ok).toBe(true);
    expect(cuenta.usuario()).toMatchObject({
      nombre: 'Explorador_1',
      remoto: true,
      datos: { nivel: 1, mejorTiempo: 140, victorias: 3 },
    });

    const ingreso = await cuenta.entrar('Explorador_1', 'ClaveSegura123');
    expect(ingreso.ok).toBe(true);
    expect(llamadas.map(({ ruta }) => ruta)).toEqual([
      '/api/v1/auth/register',
      '/api/v1/auth/login',
    ]);
    expect(llamadas[0].opciones.credentials).toBe('same-origin');
    expect(JSON.parse(llamadas[0].opciones.body)).toEqual({
      nombre: 'Explorador_1',
      clave: 'ClaveSegura123',
    });
  });

  it('envía progreso y token CSRF al backend, sin almacenarlo en el navegador', async () => {
    const llamadas = [];
    api.configurarFetchApi(async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      if (ruta.endsWith('/register')) {
        return respuesta(201, {
          nombre: 'MaxPro',
          progreso: { nivel: 1, mejorTiempo: 0, victorias: 0 },
        }, 'csrf-token');
      }
      if (ruta === '/api/v1/progress') {
        return respuesta(200, { nivel: 1, mejorTiempo: 120, victorias: 1 });
      }
      return respuesta(200, { ok: true });
    });

    await cuenta.registrar('MaxPro', 'ClaveSegura123');
    const progreso = await api.actualizarProgresoEnServidor({ nivel: 1, tiempoVictoria: 120 });
    expect(progreso).toMatchObject({
      ok: true,
      datos: { nivel: 0, mejorTiempo: 120, victorias: 1 },
    });
    expect(llamadas[1].opciones.headers['X-CSRF-Token']).toBe('csrf-token');
    expect(JSON.parse(llamadas[1].opciones.body)).toEqual({ nivel: 2, tiempoVictoria: 120 });

    const salida = await api.cerrarSesionEnServidor();
    expect(salida.ok).toBe(true);
    expect(llamadas[2].opciones.headers['X-CSRF-Token']).toBe('csrf-token');
    expect(api.tokenCsrfActual()).toBeNull();
  });

  it('reporta la falla del backend sin fallback local', async () => {
    const resultado = await cuenta.entrar('MaxPro', 'ClaveSegura123');

    expect(resultado).toEqual({
      ok: false,
      mensaje: 'No se pudo conectar con el servidor de cuentas (/api/v1).',
    });
  });

  it('mantiene el modo invitado sin persistir progreso de cuenta', async () => {
    cuenta.entrarComoInvitado();
    cuenta.guardarNivel(2);
    cuenta.registrarVictoria(120);

    expect(cuenta.usuario()).toEqual({ invitado: true });
    expect(cuenta.nivelGuardado()).toBe(0);
  });
});
