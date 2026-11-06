// Funciones matematicas de las animaciones.
import * as THREE from 'three';

export const amortiguar = (actual, objetivo, k) => actual + (objetivo - actual) * k;

export const suave = (inicio, fin, valor) => {
  const t = THREE.MathUtils.clamp((valor - inicio) / (fin - inicio), 0, 1);
  return t * t * (3 - 2 * t);
};
