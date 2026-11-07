import { ESTADOS, transicionar } from './game-state-machine.js';

const DEMORA_DERROTA_MS = 1500;

// Coordinador aislado: no crea temporizadores ni ejecuta efectos del juego.
export function crearCoordinador({ ahora = () => globalThis.performance.now() } = {}) {
  let estado = ESTADOS.CARGANDO;
  let partida = Symbol('partida');
  let pendiente = null;
  let revision = 0;

  const rechazar = (motivo) => ({ aceptada: false, estado, motivo });
  const leerTiempo = () => {
    try { return typeof ahora === 'function' ? ahora() : NaN; }
    catch { return NaN; }
  };
  const esTerminal = () => estado === ESTADOS.VICTORIA || estado === ESTADOS.DERROTA;

  function publicar(resultado) {
    if (resultado.aceptada) {
      estado = resultado.estado;
      revision++;
      if (esTerminal()) pendiente = null;
    }
    return resultado;
  }

  function despachar(evento, contexto) {
    // La derrota requiere el callback emitido al registrar la muerte.
    if (evento === 'LOSE') return rechazar('DERROTA_NO_AUTORIZADA');
    return publicar(transicionar(estado, evento, contexto));
  }

  function programarDerrota(evidencia) {
    if (estado !== ESTADOS.JUGANDO) return rechazar('TRANSICION_NO_PERMITIDA');
    if (
      evidencia === null || typeof evidencia !== 'object' || Array.isArray(evidencia) ||
      !Number.isFinite(evidencia.vida) || evidencia.vida > 0 || evidencia.vivo !== false
    ) return rechazar('EVIDENCIA_MUERTE_INVALIDA');
    if (pendiente) return rechazar('DERROTA_YA_PENDIENTE');

    const revisionInicial = revision;
    const partidaInicial = partida;
    const inicio = leerTiempo();
    if (partida !== partidaInicial || revision !== revisionInicial || pendiente) {
      return rechazar('OPERACION_OBSOLETA');
    }
    if (!Number.isFinite(inicio) || !Number.isFinite(inicio + DEMORA_DERROTA_MS)) {
      return rechazar('RELOJ_INVALIDO');
    }
    const registro = { partida, vence: inicio + DEMORA_DERROTA_MS };
    pendiente = registro;

    function resolver() {
      if (partida !== registro.partida || pendiente !== registro) {
        return rechazar('DERROTA_NO_VIGENTE');
      }
      const revisionInicial = revision;
      const tiempo = leerTiempo();
      if (partida !== registro.partida || pendiente !== registro) {
        return rechazar('DERROTA_NO_VIGENTE');
      }
      if (revision !== revisionInicial) return rechazar('OPERACION_OBSOLETA');
      if (!Number.isFinite(tiempo)) return rechazar('RELOJ_INVALIDO');
      if (tiempo < registro.vence) return rechazar('DERROTA_NO_VENCIDA');
      if (estado !== ESTADOS.JUGANDO && estado !== ESTADOS.PAUSA) {
        return rechazar('TRANSICION_NO_PERMITIDA');
      }
      // POL-FSM001 A: autoriza la derrota pendiente desde pausa sin reanudar.
      const resultado = transicionar(ESTADOS.JUGANDO, 'LOSE');
      pendiente = null;
      return publicar(resultado);
    }

    return { aceptada: true, estado, resolver };
  }

  function reiniciarPartida() {
    partida = Symbol('partida');
    pendiente = null;
    estado = ESTADOS.CARGANDO;
    revision++;
    return { aceptada: true, estado };
  }

  return Object.freeze({
    getEstado: () => estado,
    despachar,
    programarDerrota,
    reiniciarPartida,
  });
}
