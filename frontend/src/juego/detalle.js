// Control de rendimiento en tiempo real:
//  - personajes: los modelos con esqueleto no se recortan solos por la camara (frustumCulled = false,
//    porque su malla se deforma), asi que sin esto un mercenario detras de Max o a 80 m se dibuja
//    completo, con su pasada de sombra, aunque no se vea. `gestionarPersonajes` los oculta y deja de
//    animarlos mientras no se ven, y les quita la sombra cuando quedan fuera del alcance de la luz.
//  - resolucion dinamica: si la tarjeta grafica no da abasto, baja poco a poco la resolucion de
//    dibujo (la imagen se ve un poco mas suave, pero el juego va fluido) y la recupera si sobra potencia.
import * as THREE from 'three';

const RADIO_PERSONAJE = 2.4;       // esfera que envuelve a un personaje (con margen para armas y caidas)
const DIST_FUERA_DE_CAMARA = 25;   // fuera de camara y mas lejos que esto: se oculta (sus sombras ya no llegan)
const DIST_MAXIMA = 110;           // mas lejos que esto la niebla ya lo tapa
const DIST_SOMBRA = 38;            // la luz solo proyecta sombras en unos 32 m alrededor de Max

const _frustum = new THREE.Frustum();
const _matriz = new THREE.Matrix4();
const _esfera = new THREE.Sphere();

// humanos = lista de Humano; centro = posicion de Max. Devuelve en cada humano `h.activo` (true si se ve).
export function gestionarPersonajes(camera, humanos, centro) {
  _matriz.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_matriz);
  for (const h of humanos) {
    const p = h.grupo.position;
    const dist = Math.hypot(p.x - centro.x, p.z - centro.z);
    _esfera.center.set(p.x, p.y + 1, p.z);
    _esfera.radius = RADIO_PERSONAJE;
    const enCamara = _frustum.intersectsSphere(_esfera);
    const activo = dist < DIST_MAXIMA && (enCamara || dist < DIST_FUERA_DE_CAMARA);
    h.activo = activo;
    h.grupo.visible = activo;
    if (activo) fijarSombra(h, dist < DIST_SOMBRA);
  }
}

// activa o quita la sombra de todas las mallas del personaje (solo cuando cambia)
function fijarSombra(h, proyecta) {
  if (h.sombraActiva === proyecta) return;
  h.sombraActiva = proyecta;
  if (!h.mallasConSombra) {            // las que proyectaban sombra de origen (el cabello de los mercenarios no)
    h.mallasConSombra = [];
    h.grupo.traverse((o) => { if (o.isMesh && o.castShadow) h.mallasConSombra.push(o); });
  }
  for (const m of h.mallasConSombra) m.castShadow = proyecta;
}

// Resolucion dinamica. Mide el tiempo real entre cuadros y ajusta el pixelRatio del renderizador.
export function crearResolucionDinamica(renderer, { maximo = 1.5, minimo = 0.6 } = {}) {
  const tope = Math.min(window.devicePixelRatio || 1, maximo);
  let ratio = tope;
  let tiempoMedio = 16.7;      // ms por cuadro (media movil)
  let lento = 0, rapido = 0;   // segundos seguidos por encima / por debajo del objetivo
  renderer.setPixelRatio(ratio);

  return {
    get ratio() { return ratio; },
    // msCuadro = tiempo real del ultimo cuadro; activo = false en menus y pausa (no se mide)
    medir(msCuadro, activo) {
      if (!activo || msCuadro > 120) { lento = rapido = 0; return; }   // pausas y cargas no cuentan
      tiempoMedio += (msCuadro - tiempoMedio) * 0.08;
      const s = msCuadro / 1000;
      if (tiempoMedio > 24) { lento += s; rapido = 0; }         // por debajo de ~40 cuadros por segundo
      else if (tiempoMedio < 15 && ratio < tope) { rapido += s; lento = 0; }
      else lento = rapido = 0;
      if (lento > 1.5 && ratio > minimo) {
        ratio = Math.max(minimo, ratio - 0.15);
        renderer.setPixelRatio(ratio);
        lento = 0;
        tiempoMedio = 16.7;      // se vuelve a medir con la nueva resolucion
      } else if (rapido > 8) {
        ratio = Math.min(tope, ratio + 0.1);
        renderer.setPixelRatio(ratio);
        rapido = 0;
      }
    }
  };
}
