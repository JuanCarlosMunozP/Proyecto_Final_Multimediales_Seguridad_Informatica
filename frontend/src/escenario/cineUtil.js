// Piezas comunes de las cinematicas: subtitulos, "E · saltar", particulas simples y la posicion
// lejana (ORIGEN) donde se arman para no mezclarse con el nivel.
import * as THREE from 'three';
import { fundido } from '../interfaz/hud.js';
import { dispositivo } from '../interfaz/dispositivo.js';

const tactil = dispositivo.tactil;

export const ORIGEN = new THREE.Vector3(3000, 0, 3000);

// sistema de particulas simple: posiciones + velocidades, reciclado en anillo
export function crearParticulas(n, material) {
  const pos = new Float32Array(n * 3).fill(-9999);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const puntos = new THREE.Points(geo, material);
  puntos.frustumCulled = false;
  return { puntos, pos, vel: new Float32Array(n * 3), n, i: 0 };
}

// Subtitulos [[segundo, texto], ...] y la tecla para saltar. `cerrar()` quita todo y apaga el fundido.
export function interfazCine(subtitulos) {
  const caja = document.createElement("div");
  caja.style.cssText = "position:fixed;left:50%;bottom:11%;transform:translateX(-50%);width:min(760px,88vw);" +
    "padding:12px 18px;border-radius:10px;background:rgba(0,0,0,.62);color:#f3e8dc;font-size:18px;" +
    "text-align:center;z-index:4";
  caja.setAttribute("role", "status");          // subtitulos legibles por lectores de pantalla
  document.body.appendChild(caja);
  const aviso = document.createElement("div");
  aviso.style.cssText = "position:fixed;right:18px;bottom:14px;color:#ddd;font-size:13px;z-index:4";
  aviso.textContent = tactil ? "Toca para saltar" : "E · saltar";
  if (tactil) {                       // en el movil se toca la pantalla para saltar la cinematica
    aviso.style.cssText += ";padding:12px 18px;border-radius:20px;background:rgba(0,0,0,.55)";
    window.addEventListener("pointerdown", alTocar);
  }
  document.body.appendChild(aviso);

  const ui = { saltar: false };
  const alTocar = () => { ui.saltar = true; };
  const alSaltar = (e) => { if (["e", "enter", " "].includes(e.key.toLowerCase())) ui.saltar = true; };
  window.addEventListener("keydown", alSaltar);

  ui.texto = (t) => {
    let texto = "";
    for (const [desde, frase] of subtitulos) if (t >= desde) texto = frase;
    caja.textContent = texto;
    caja.style.display = texto ? "" : "none";
  };
  ui.cerrar = () => {
    window.removeEventListener("keydown", alSaltar);
    window.removeEventListener("pointerdown", alTocar);
    caja.remove();
    aviso.remove();
    fundido.style.opacity = 0;
  };
  return ui;
}

export const suavizar = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
