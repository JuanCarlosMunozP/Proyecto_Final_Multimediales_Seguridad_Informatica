import { afterEach, describe, expect, it, vi } from 'vitest';

// Módulo real; solo sus dependencias DOM/perfil/HUD se sustituyen.
// No hay navegador, temporizadores ni WebGL en estas regresiones.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('../src/interfaz/dispositivo.js');
  vi.doUnmock('../src/interfaz/hud.js');
  vi.resetModules();
});

async function preparar(tactil) {
  vi.resetModules();
  const fundido = { style: { opacity: 1 } };
  vi.doMock('../src/interfaz/dispositivo.js', () => ({ dispositivo: { tactil } }));
  vi.doMock('../src/interfaz/hud.js', () => ({ fundido }));
  const elementos = [];
  const body = { appendChild: vi.fn((elemento) => elementos.push(elemento)) };
  const document = { body, createElement: () => {
    const elemento = { style: {}, textContent: '', setAttribute: vi.fn(),
      remove: vi.fn(() => { const i = elementos.indexOf(elemento); if (i >= 0) elementos.splice(i, 1); }) };
    return elemento;
  } };
  const window = new EventTarget();
  const agregar = vi.spyOn(window, 'addEventListener');
  const quitar = vi.spyOn(window, 'removeEventListener');
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  const { interfazCine } = await import('../src/escenario/cineUtil.js');
  const emitir = (tipo, key) => {
    const evento = new Event(tipo);
    if (key !== undefined) Object.defineProperty(evento, 'key', { value: key });
    window.dispatchEvent(evento);
  };
  return { interfazCine, elementos, fundido, emitir, agregar, quitar };
}

describe('RELEASE-005A: interfaz cinematográfica real (RF-001/002/006)', () => {
  it('CINE-001: táctil crea interfaz sin excepción y pointerdown solicita saltar', async () => {
    const h = await preparar(true);
    let ui;
    expect(() => { ui = h.interfazCine([]); }).not.toThrow();
    expect(ui.saltar).toBe(false);
    expect(h.elementos).toHaveLength(2);
    expect(h.elementos[1].textContent).toBe('Toca para saltar');
    h.emitir('pointerdown');
    expect(ui.saltar).toBe(true);
    ui.cerrar();
  });

  it.each([true, false])('CINE-002: cerrar retira callbacks exactos y elementos; táctil=%s', async (tactil) => {
    const h = await preparar(tactil);
    const ui = h.interfazCine([]);
    const elementos = [...h.elementos];
    const registros = [...h.agregar.mock.calls];
    expect(registros.map(([tipo]) => tipo).sort())
      .toEqual(tactil ? ['keydown', 'pointerdown'] : ['keydown']);
    ui.cerrar();
    for (const [tipo, callback] of registros) expect(h.quitar).toHaveBeenCalledWith(tipo, callback);
    for (const elemento of elementos) expect(elemento.remove).toHaveBeenCalledTimes(1);
    expect(h.elementos).toHaveLength(0);
    expect(h.fundido.style.opacity).toBe(0);
    h.emitir('keydown', 'E'); h.emitir('pointerdown');
    expect(ui.saltar).toBe(false);
  });

  it.each(['e', 'E', 'Enter', ' '])('CINE-003: escritorio permite saltar con %j', async (key) => {
    const h = await preparar(false);
    const ui = h.interfazCine([]);
    h.emitir('pointerdown'); h.emitir('keydown', 'x');
    expect(ui.saltar).toBe(false);
    h.emitir('keydown', key);
    expect(ui.saltar).toBe(true);
    ui.cerrar();
  });

  it('CINE-004: subtítulos respetan tiempos y se pintan como texto', async () => {
    const h = await preparar(false);
    const ui = h.interfazCine([[1, '<b>Primero</b>'], [3, 'Segundo']]);
    const caja = h.elementos[0];
    ui.texto(0); expect(caja.style.display).toBe('none');
    ui.texto(1); expect(caja.textContent).toBe('<b>Primero</b>');
    expect(caja.style.display).toBe('');
    ui.texto(2.99); expect(caja.textContent).toBe('<b>Primero</b>');
    ui.texto(3); expect(caja.textContent).toBe('Segundo');
    ui.cerrar();
  });
});
