export const ESTADOS = Object.freeze({
  CARGANDO: 'cargando',
  INICIO: 'inicio',
  JUGANDO: 'jugando',
  PAUSA: 'pausa',
  CINEMATICA: 'cinematica',
  VICTORIA: 'victoria',
  DERROTA: 'derrota',
});

const TRANSICIONES = Object.freeze({
  cargando: {
    LOAD_COMPLETE: ESTADOS.INICIO,
    DEMO_START: ESTADOS.JUGANDO,
  },
  inicio: {
    START: ({ cineActivo }) =>
      cineActivo ? ESTADOS.CINEMATICA : ESTADOS.JUGANDO,
  },
  jugando: {
    PAUSE: ESTADOS.PAUSA,
    START_CINEMATIC: ESTADOS.CINEMATICA,
    WIN: ESTADOS.VICTORIA,
    LOSE: ESTADOS.DERROTA,
  },
  cinematica: {
    PAUSE: ESTADOS.PAUSA,
    CINEMATIC_END: ESTADOS.JUGANDO,
  },
  pausa: {
    RESUME: ({ cineActivo }) =>
      cineActivo ? ESTADOS.CINEMATICA : ESTADOS.JUGANDO,
  },
  victoria: {},
  derrota: {},
});

export function transicionar(estado, evento, contexto = {}) {
  // No coaccionar entradas ni resolver propiedades heredadas del prototipo.
  if (
    typeof estado !== 'string' ||
    typeof evento !== 'string' ||
    !Object.hasOwn(TRANSICIONES, estado) ||
    !Object.hasOwn(TRANSICIONES[estado], evento)
  ) {
    return {
      aceptada: false,
      estado,
      motivo: 'TRANSICION_NO_PERMITIDA',
    };
  }

  if (
    contexto === null ||
    typeof contexto !== 'object' ||
    Array.isArray(contexto) ||
    (contexto.cineActivo !== undefined &&
      typeof contexto.cineActivo !== 'boolean')
  ) {
    return {
      aceptada: false,
      estado,
      motivo: 'CONTEXTO_INVALIDO',
    };
  }

  const regla = TRANSICIONES[estado][evento];
  const destino =
    typeof regla === 'function' ? regla(contexto) : regla;

  return {
    aceptada: true,
    estado: destino,
  };
}
