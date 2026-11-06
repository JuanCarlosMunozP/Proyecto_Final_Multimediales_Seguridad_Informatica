// Relieve del escenario: la altura del suelo en cualquier punto, segun el bioma del nivel.
import * as THREE from 'three';

// ---------- terreno: cada nivel tiene su bioma (isla, montaña o desierto)
let desfase = 0;       // desplaza las colinas para que cada nivel tenga otra forma
let bioma = "isla";
export const OASIS = { x: 24, z: -20 };
// fija el bioma y la forma de las colinas del nivel que se va a construir
export function usarBioma(tema) {
  desfase = tema.desfase;
  bioma = tema.tipo;
}

export function altura(x, z) {
  const d = Math.hypot(x, z);
  const suave = THREE.MathUtils.smoothstep;
  const lerp = THREE.MathUtils.lerp;
  const ruido = 0.9 * Math.sin(x * 0.09 + desfase) * Math.cos(z * 0.08 - desfase)
    + 0.45 * Math.sin(x * 0.21 + 1 + desfase) * Math.sin(z * 0.17 + desfase);

  if (bioma === "montana") {
    // un gran monte con crestas: el altar esta en la cima y hay que escalarlo
    const monte = 1 - suave(d, 8, 58);
    const crestas = 2.4 * monte * Math.sin(Math.atan2(z, x) * 5 + desfase) * suave(d, 14, 30);
    let h = 1.5 + ruido + 14 * monte + crestas;
    h = lerp(h, 1.0, suave(d, 48, 62));
    return lerp(h, 15.4, 1 - suave(d, 6, 12));
  }
  if (bioma === "desierto") {
    // dunas amplias y un oasis con estanque (se puede nadar)
    let h = 2.6 + 1.5 * Math.sin(x * 0.055 + desfase) * Math.cos(z * 0.045)
      + 0.8 * Math.sin((x + z) * 0.09 + 1 + desfase) * Math.sin(z * 0.07);
    h = lerp(h, 1.0, suave(d, 48, 62));
    h = lerp(h, -2.6, 1 - suave(Math.hypot(x - OASIS.x, z - OASIS.z), 5.5, 10));
    return lerp(h, 2.6, 1 - suave(d, 6, 12));
  }
  // isla
  let h = 1.5 + ruido;
  const orilla = suave(d, 30, 50);
  h = h * (1 - orilla) - 3 * orilla;
  return lerp(h, 0.6, 1 - suave(d, 6, 12));
}
