// Suministros aleatorios: cada 10 segundos aparece un botiquin y un kit de arma en un punto al azar
// del mapa. Si Max no los recoge, desaparecen al minuto (parpadean los ultimos segundos).
//   botiquin: +40 de vida | kit de arma: Max recibe un arma al azar (puños, cuchillo, bate, machete
//   o pistola con 10 balas) que usa al atacar.
import { crearModeloBotiquin, crearModeloKitArma } from '../escenario/botiquines.js';
import { armaDeKit, equiparArma } from '../personajes/armas.js';
import { decir } from '../interfaz/hud.js';

const CADA = 10;          // segundos entre apariciones
const DURACION = 60;      // segundos que dura cada suministro en el mapa
const AVISO = 10;         // parpadea los ultimos segundos antes de desaparecer
const MAX_POR_TIPO = 6;   // para no llenar el mapa si Max no los recoge
const BALAS = 10;

export function crearSuministros({ scene, sonido, jugador }) {
  const items = [];       // { tipo, obj, x, y, z, edad }
  let reloj = CADA;

  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;left:18px;bottom:14px;padding:6px 14px;border-radius:20px;" +
    "background:rgba(22,14,18,.6);color:#ffd98a;font-size:14px;z-index:3;display:none";
  document.body.appendChild(panel);
  const pintarPanel = () => {
    panel.style.display = jugador.arma ? "block" : "none";
    if (jugador.arma) {
      panel.textContent = jugador.arma.tipo === "pistola"
        ? `Arma: ${jugador.arma.id} · ${jugador.municion} balas` : `Arma: ${jugador.arma.id}`;
    }
  };

  // punto de tierra firme al azar, lejos de Max y de los obstaculos
  function puntoAleatorio(mundo) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.sqrt(Math.random()) * mundo.tema.limite * 0.7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = mundo.altura(x, z);
      if (y < 0.6 || !mundo.dentroDelMapa(x, z)) continue;
      if (Math.hypot(x - jugador.pos.x, z - jugador.pos.z) < 5) continue;
      if (mundo.obstaculos.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1)) continue;
      return { x, y, z };
    }
    return null;
  }

  function aparecer(tipo, mundo) {
    if (items.filter((s) => s.tipo === tipo).length >= MAX_POR_TIPO) return;
    const p = puntoAleatorio(mundo);
    if (!p) return;
    const obj = tipo === "botiquin" ? crearModeloBotiquin() : crearModeloKitArma();
    obj.position.set(p.x, p.y + 0.5, p.z);
    scene.add(obj);
    items.push({ tipo, obj, ...p, edad: 0 });
  }

  function quitar(i) {
    scene.remove(items[i].obj);
    items.splice(i, 1);
  }

  function tomarArma(axel) {
    const arma = armaDeKit();
    jugador.arma = arma.id === "puños" ? null : arma;
    jugador.municion = arma.tipo === "pistola" ? BALAS : 0;
    equiparArma(axel, arma);
    axel.apuntando = arma.tipo === "pistola" ? 1 : 0;     // con pistola lleva el brazo extendido
    decir(`Kit de arma: ${arma.id}`, 3);
    pintarPanel();
  }

  // la llama main.js al disparar: gasta una bala y suelta la pistola cuando se acaban
  function gastarBala(axel) {
    if (jugador.municion > 0) { pintarPanel(); return; }
    equiparArma(axel, { crear: null });
    axel.apuntando = 0;
    jugador.arma = null;
    decir("Sin balas: guardas la pistola", 3);
    pintarPanel();
  }

  function quitarArma(axel) {
    if (axel) { equiparArma(axel, { crear: null }); axel.apuntando = 0; }
    jugador.arma = null;
    jugador.municion = 0;
    pintarPanel();
  }

  function reiniciar() {
    while (items.length) quitar(0);
    reloj = CADA;
  }

  function actualizar(dt, tiempo, mundo, axel) {
    reloj -= dt;
    if (reloj <= 0) {
      reloj += CADA;
      aparecer("botiquin", mundo);
      aparecer("arma", mundo);
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const s = items[i];
      s.edad += dt;
      if (s.edad >= DURACION) { quitar(i); continue; }
      s.obj.rotation.y = tiempo * 1.2 + i;
      s.obj.position.y = s.y + 0.5 + Math.sin(tiempo * 2 + i) * 0.08;
      s.obj.visible = s.edad < DURACION - AVISO || Math.floor(s.edad * 5) % 2 === 0;
      if (!jugador.vivo || Math.hypot(jugador.pos.x - s.x, jugador.pos.z - s.z) > 1.4) continue;
      if (s.tipo === "botiquin") {
        if (jugador.vida >= 100) continue;           // con la vida llena lo deja para despues
        jugador.vida = Math.min(100, jugador.vida + 40);
        decir("Botiquín: +40 de vida", 2.5);
      } else {
        tomarArma(axel);
      }
      sonido.recoger();
      quitar(i);
    }
  }

  return { actualizar, reiniciar, gastarBala, quitarArma };
}
