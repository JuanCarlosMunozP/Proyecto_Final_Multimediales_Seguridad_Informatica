import { crearCoordinador } from './game-state-coordinator.js';
import { ESTADOS } from './game-state-machine.js';

const DEMORA_DERROTA_MS = 1500;

// Dependencias confiables: reloj monótono y scheduler asíncrono en milisegundos.
// No importa navegador, Three.js ni los adaptadores de efectos del juego real.
export function crearAdaptadores({ ahora, programar, cancelar, efectos = {} }) {
  if (
    typeof ahora !== 'function' || typeof programar !== 'function' ||
    typeof cancelar !== 'function'
  ) throw new TypeError('Se requieren reloj, programar y cancelar');

  let ciclo = Symbol('ciclo');
  let revision = 0;
  let ultimaLectura;
  const errores = [];
  const informar = (operacion, motivo) => errores.push(Object.freeze({ operacion, motivo }));
  const leerTiempo = () => {
    const cicloInicial = ciclo;
    const revisionInicial = revision;
    try {
      const tiempo = ahora();
      if (ciclo !== cicloInicial || revision !== revisionInicial) return NaN;
      if (!Number.isFinite(tiempo)) {
        informar('ahora', 'RELOJ_INVALIDO');
        return NaN;
      }
      ultimaLectura = tiempo;
      return tiempo;
    } catch {
      informar('ahora', 'RELOJ_INVALIDO');
      return NaN;
    }
  };
  const coordinador = crearCoordinador({ ahora: leerTiempo });
  let tarea = null;
  let destruido = false;
  let terminalInvocado = false;
  const getEstado = () => coordinador.getEstado();
  const rechazar = (motivo) => ({ aceptada: false, estado: getEstado(), motivo });
  const esTerminal = () =>
    getEstado() === ESTADOS.VICTORIA || getEstado() === ESTADOS.DERROTA;

  function cancelarSeguro(id) {
    try { cancelar(id); }
    catch { informar('cancelar', 'CANCELACION_ERROR'); }
  }

  function limpiarTarea() {
    const anterior = tarea;
    tarea = null; // Invalidar antes de llamar a una dependencia externa.
    if (anterior) {
      anterior.version++;
      if (anterior.agendada) cancelarSeguro(anterior.id);
      anterior.agendada = false;
    }
  }

  function invocar(nombre, resultado, evento) {
    try { efectos[nombre]?.(resultado, ...(nombre === 'transicion' ? [evento] : [])); }
    catch { informar(nombre, 'EFECTO_ERROR'); }
  }

  function aplicarEfectos(resultado, evento) {
    if (!resultado.aceptada) return resultado;
    // La publicación ya ocurrió dentro del coordinador. Una salida de puntero
    // reentrante no puede convertir el resultado terminal en pausa.
    const cicloInicial = ciclo;
    const revisionInicial = revision;
    if (esTerminal()) {
      limpiarTarea();
      if (destruido || ciclo !== cicloInicial || revision !== revisionInicial) return resultado;
      if (!terminalInvocado) {
        terminalInvocado = true; // No repetir un efecto cuyo éxito parcial es desconocido.
        invocar('terminal', resultado);
      }
    } else {
      invocar('transicion', resultado, evento);
    }
    return resultado;
  }

  function despachar(evento, contexto) {
    if (destruido) return rechazar('ADAPTADOR_DESTRUIDO');
    const resultado = coordinador.despachar(evento, contexto);
    if (resultado.aceptada) revision++;
    return aplicarEfectos(resultado, evento);
  }

  function agendar(registro, demora) {
    if (registro.agendando) return rechazar('SCHEDULER_OCUPADO');
    if (registro.agendada) return { aceptada: true, estado: getEstado() };
    const cicloInicial = ciclo;
    const revisionInicial = revision;
    const version = ++registro.version;
    let dentroDeProgramar = true;
    let callbackSincrono = false;
    const callback = () => {
      if (dentroDeProgramar) {
        callbackSincrono = true;
        informar('programar', 'CALLBACK_SINCRONO');
        return rechazar('CALLBACK_SINCRONO');
      }
      if (destruido || tarea !== registro || version !== registro.version) {
        return rechazar('CALLBACK_NO_VIGENTE');
      }
      registro.agendada = false;
      registro.version++; // El mismo callback entregado dos veces es obsoleto.
      const resultado = registro.resolver();
      if (destruido || tarea !== registro) return rechazar('CALLBACK_NO_VIGENTE');
      if (resultado.motivo === 'DERROTA_NO_VENCIDA') {
        // No reiniciar otros 1500 ms. El coordinador conserva el plazo real y
        // decide la aceptación; este cálculo solo orienta el próximo intento.
        const tiempo = leerTiempo();
        if (Number.isFinite(tiempo) && tarea === registro && !destruido) {
          agendar(registro, Math.max(1, registro.vence - tiempo));
        }
      } else if (resultado.aceptada) {
        revision++;
        aplicarEfectos(resultado, 'DERROTA_PROGRAMADA');
      } else if (resultado.motivo === 'DERROTA_NO_VIGENTE') {
        limpiarTarea();
      }
      // Reloj/origen inválido: conservar capacidad para recuperar explícitamente.
      return resultado;
    };
    let id;
    registro.agendando = true;
    try { id = programar(callback, demora); }
    catch {
      registro.version++; // Invalida incluso si el scheduler guardó el callback antes de lanzar.
      informar('programar', 'SCHEDULER_ERROR');
      return rechazar('SCHEDULER_ERROR');
    } finally {
      dentroDeProgramar = false;
      registro.agendando = false;
    }
    if (callbackSincrono) {
      // El scheduler incumplió la entrega asíncrona: conservar la capacidad,
      // pero no fingir que existe una tarea futura ni aceptar su callback viejo.
      registro.version++;
      registro.agendada = false;
      cancelarSeguro(id);
      return rechazar('CALLBACK_SINCRONO');
    }
    if (
      destruido || tarea !== registro || ciclo !== cicloInicial ||
      revision !== revisionInicial || version !== registro.version
    ) {
      registro.version++;
      cancelarSeguro(id);
      return rechazar('OPERACION_OBSOLETA');
    }
    registro.id = id;
    registro.agendada = true;
    return { aceptada: true, estado: getEstado() };
  }

  function programarDerrota(evidencia) {
    if (destruido) return rechazar('ADAPTADOR_DESTRUIDO');
    const cicloInicial = ciclo;
    const resultado = coordinador.programarDerrota(evidencia);
    if (!resultado.aceptada) return resultado;
    const registro = {
      resolver: resultado.resolver,
      vence: ultimaLectura + DEMORA_DERROTA_MS,
      version: 0,
      agendada: false,
      agendando: false,
      id: undefined,
      muerteInvocada: false,
    };
    tarea = registro;
    agendar(registro, DEMORA_DERROTA_MS);
    const aceptada = { aceptada: true, estado: resultado.estado };
    if (
      !destruido && ciclo === cicloInicial &&
      tarea === registro && !registro.muerteInvocada
    ) {
      registro.muerteInvocada = true;
      invocar('muerte', aceptada);
    }
    return aceptada;
  }

  function recuperar() {
    if (destruido) return rechazar('ADAPTADOR_DESTRUIDO');
    const registro = tarea;
    if (!registro) return rechazar('SIN_DERROTA_PENDIENTE');
    if (registro.agendando || registro.recuperando) return rechazar('SCHEDULER_OCUPADO');
    if (getEstado() !== ESTADOS.JUGANDO && getEstado() !== ESTADOS.PAUSA) {
      return rechazar('TRANSICION_NO_PERMITIDA');
    }
    if (registro.agendada) return { aceptada: true, estado: getEstado() };
    const cicloInicial = ciclo;
    const revisionInicial = revision;
    registro.recuperando = true;
    try {
      const tiempo = leerTiempo();
      if (tarea !== registro || ciclo !== cicloInicial || revision !== revisionInicial || destruido) {
        return rechazar('OPERACION_OBSOLETA');
      }
      if (!Number.isFinite(tiempo)) return rechazar('RELOJ_INVALIDO');
      return agendar(registro, Math.max(1, registro.vence - tiempo));
    } finally {
      registro.recuperando = false;
    }
  }

  function perderPuntero() {
    if (destruido) return rechazar('ADAPTADOR_DESTRUIDO');
    if (getEstado() !== ESTADOS.JUGANDO && getEstado() !== ESTADOS.CINEMATICA) {
      return rechazar('TRANSICION_NO_PERMITIDA');
    }
    return despachar('PAUSE');
  }

  function finalizarCinematica() {
    // En terminal el coordinador rechaza CINEMATIC_END; cámara y diálogo no
    // reciben efectos de fin de cine a partir de una transición rechazada.
    return despachar('CINEMATIC_END');
  }

  function reiniciarPartida() {
    if (destruido) return rechazar('ADAPTADOR_DESTRUIDO');
    ciclo = Symbol('ciclo');
    revision++;
    terminalInvocado = false;
    const resultado = coordinador.reiniciarPartida();
    limpiarTarea();
    return resultado;
  }

  function destruir() {
    if (destruido) return rechazar('ADAPTADOR_DESTRUIDO');
    destruido = true;
    ciclo = Symbol('ciclo');
    revision++;
    limpiarTarea();
    return { aceptada: true, estado: getEstado() };
  }

  return Object.freeze({
    getEstado, despachar, programarDerrota, perderPuntero,
    finalizarCinematica, reiniciarPartida, destruir, recuperar,
    getErrores: () => Object.freeze([...errores]),
  });
}
