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
  const regla = TRANSICIONES[estado]?.[evento];

  if (regla === undefined) {
    return {
      aceptada: false,
      estado,
      motivo: 'TRANSICION_NO_PERMITIDA',
    };
  }

  const destino =
    typeof regla === 'function' ? regla(contexto) : regla;

  return {
    aceptada: true,
    estado: destino,
  };
}
