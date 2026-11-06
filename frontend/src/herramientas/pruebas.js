// Pruebas de funcionalidad de la logica del juego (corren en el navegador: /pruebas.html).
// Cubren mundos, armas, daño, combate, suministros, frio y objetivos. Cada prueba imprime OK o FALLA;
// al final deja el resumen en la consola ("RESUMEN n bien, m mal") y en document.title.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonarModelo } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { crearMundo } from '../escenario/mundo.js';
import { TEMAS } from '../escenario/temas.js';
import { Humano } from '../personajes/personaje.js';
import { Enemigo } from '../personajes/enemigo.js';
import { ARMAS, armaAleatoria, armaDeKit, zonaDeBala } from '../personajes/armas.js';
import { resolverGolpe, dispararJugador } from '../juego/combate.js';
import { crearSuministros } from '../juego/suministros.js';
import { crearFrio } from '../juego/frio.js';
import { NIVELES, CASAS, IDOLOS_POR_NIVEL, METROS_NADO, GUIONES, CINEMATICAS, objetivos } from '../juego/datos.js';

const salida = document.getElementById("salida");
let bien = 0, mal = 0;
function prueba(nombre, condicion, detalle = "") {
  condicion ? bien++ : mal++;
  const linea = document.createElement("div");
  linea.className = condicion ? "bien" : "mal";
  linea.textContent = `${condicion ? "OK   " : "FALLA"} ${nombre}${!condicion && detalle ? "  -> " + detalle : ""}`;
  salida.appendChild(linea);
  console.log(linea.textContent);
}
const sonido = new Proxy({}, { get: () => () => {} });        // el audio no importa aqui
const vista = { sacudida: 0, yaw: Math.PI };            // yaw PI: Max mira hacia +z (direccion = yaw + PI)
const loader = new GLTFLoader();
const base = await loader.loadAsync("/models/daniel.glb");
salida.textContent = "";

// ---------------------------------------------------------------- datos y objetivos
prueba("hay 3 niveles y 3 temas", NIVELES.length === 3 && TEMAS.length === 3);
prueba("cada nivel tiene guion", GUIONES.length === NIVELES.length && GUIONES.every((g) => g.length > 0));
prueba("las cinematicas caen dentro del guion del nivel 1: avion y luego playa",
  Object.keys(CINEMATICAS[0]).every((i) => +i > 0 && +i < GUIONES[0].length) && CINEMATICAS[0][1] === "avion" && CINEMATICAS[0][2] === "playa");
prueba("hay casas para todos los mercenarios", CASAS.length >= Math.max(...NIVELES.map((n) => n.enemigos)));
{
  const vacio = { idolos: 0, derrotados: 0, fogata: false, altar: false, nado: 0 };
  const lista = (n, o) => objetivos(n, { ...vacio, ...o });
  prueba("objetivos nivel 1: 3 sin cumplir", lista(0, {}).length === 3 && lista(0, {}).every(([, ok]) => !ok));
  prueba("objetivos nivel 1 completos", lista(0, { idolos: IDOLOS_POR_NIVEL, derrotados: NIVELES[0].enemigos, altar: true }).every(([, ok]) => ok));
  prueba("objetivo de nadar del desierto usa METROS_NADO", lista(2, { nado: METROS_NADO }).at(-1)[1] === true && lista(2, { nado: METROS_NADO - 1 }).at(-1)[1] === false);
  prueba("montaña pide altar y fogata", lista(1, {}).length === 4);
}

// ---------------------------------------------------------------- armas y daño
prueba("daño: puños < cuchillo < machete < bate",
  ARMAS.puños.dano < ARMAS.cuchillo.dano && ARMAS.cuchillo.dano < ARMAS.machete.dano && ARMAS.machete.dano < ARMAS.bate.dano);
prueba("puños hacen muy poco daño (≤ 5)", ARMAS.puños.dano <= 5);
{
  const cuenta = {};
  for (let i = 0; i < 4000; i++) { const a = armaAleatoria().id; cuenta[a] = (cuenta[a] || 0) + 1; }
  prueba("el sorteo de armas da las 5 armas", Object.keys(ARMAS).every((k) => cuenta[k] > 100), JSON.stringify(cuenta));
  const kit = new Set(Array.from({ length: 300 }, () => armaDeKit().id));
  prueba("los kits nunca dan puños y dan las otras 4", !kit.has("puños") && kit.size === 4, [...kit].join());
}
prueba("zona de bala: cabeza mortal", zonaDeBala(1.7).mortal === true);
prueba("zona de bala: pecho mortal", zonaDeBala(1.3).mortal === true);
prueba("zona de bala: abdomen hiere 20", zonaDeBala(1.0).dano === 20 && !zonaDeBala(1.0).mortal);
prueba("zona de bala: piernas hieren 10", zonaDeBala(0.4).dano === 10 && !zonaDeBala(0.4).mortal);
prueba("zona de bala: lejos del eje es brazo, hiere y no mata", zonaDeBala(1.3, 0.3).herida?.parte === "brazo" && !zonaDeBala(1.3, 0.3).mortal && zonaDeBala(1.3, 0.3).herida.lado === "I");
prueba("zona de bala: rodilla y pierna dan herida con lado", zonaDeBala(0.45, -0.1).herida?.parte === "rodilla" && zonaDeBala(0.45, -0.1).herida.lado === "D" && zonaDeBala(0.2).herida?.parte === "pierna");

// ---------------------------------------------------------------- mundos
const resultadosMundo = [];
for (let n = 0; n < TEMAS.length; n++) {
  const escena = new THREE.Scene();
  const mundo = await crearMundo(escena, loader, TEMAS[n]);
  const nombre = NIVELES[n].nombre;
  prueba(`${nombre}: el punto de inicio es tierra firme`, mundo.altura(mundo.spawn.x, mundo.spawn.z) > 0.4 && !mundo.esAgua(mundo.spawn.x, mundo.spawn.z));
  prueba(`${nombre}: ${mundo.idolos.length} ídolos, todos en tierra`, mundo.idolos.length === IDOLOS_POR_NIVEL && mundo.idolos.every((i) => mundo.altura(i.x, i.z) > 0.3));
  const alturas = [];
  for (let x = -60; x <= 60; x += 3) for (let z = -60; z <= 60; z += 3) alturas.push(mundo.altura(x, z));
  prueba(`${nombre}: la altura del terreno es siempre un número`, alturas.every(Number.isFinite));
  const puestos = CASAS.slice(0, NIVELES[n].enemigos).map(([x, z]) => new Enemigo(clonarModelo(base.scene), x, z, mundo, new THREE.Scene()));
  prueba(`${nombre}: los mercenarios nacen fuera de los obstáculos (Enemigo los separa)`, puestos.every((e) =>
    !mundo.esAgua(e.pos.x, e.pos.z) && !mundo.obstaculos.some((o) => Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r - 0.01)));
  prueba(`${nombre}: el jugador no nace dentro de un obstáculo`, !mundo.obstaculos.some((o) => Math.hypot(mundo.spawn.x - o.x, mundo.spawn.z - o.z) < o.r + 0.3));
  mundo.mostrarPortal(mundo.salida.x, mundo.salida.z, mundo.tema.vehiculo);
  mundo.ocultarPortal();
  prueba(`${nombre}: la salida (${mundo.tema.vehiculo}) se muestra y se oculta sin error`, true);
  const p = new THREE.Vector3(1, 0, 1);
  mundo.resolver(p, 0.4);
  prueba(`${nombre}: resolver colisiones no produce NaN`, Number.isFinite(p.x) && Number.isFinite(p.z));
  prueba(`${nombre}: agua ${mundo.agua ? mundo.agua.tipo : "ninguna"} (la montaña no tiene)`, (n === 1) === !mundo.agua);
  if (n === 2) prueba("desierto: el oasis es agua y la arena no", mundo.esAgua(24, -20) && !mundo.esAgua(0, 40));
  resultadosMundo.push(mundo);
}
prueba("solo la montaña tiene frío y nieve", TEMAS.map((t) => !!t.frio).join() === "false,true,false" && TEMAS.map((t) => !!t.nieve).join() === "false,true,false");
prueba("la montaña no usa sombrero", TEMAS[1].sombrero === false && TEMAS[0].sombrero !== false && TEMAS[2].sombrero !== false);

// ---------------------------------------------------------------- frio
{
  const f = crearFrio();
  f.reiniciar(false);
  prueba("frío inactivo fuera de la montaña", f.actualizar(10, false) === 0 && f.frio === 0);
  f.reiniciar(true);
  for (let i = 0; i < 100; i++) f.actualizar(1, false);
  prueba("sin calor ni fuego el frío llega a 100 y hace daño", f.frio === 100 && f.congelando && f.actualizar(1, false) === 3);
  f.actualizar(1, true);
  prueba("junto al fuego sube el calor y baja el frío", f.calor > 0 && f.frio < 100);
  const fuego = [{ grupo: { position: { x: 0, z: 0 } } }];
  prueba("cercaDelFuego: cerca sí, lejos no", f.cercaDelFuego({ x: 2, z: 0 }, fuego) && !f.cercaDelFuego({ x: 9, z: 0 }, fuego));
}

// ---------------------------------------------------------------- enemigos y combate
const mundo1 = resultadosMundo[0];
const escena = new THREE.Scene();
function nuevoEnemigo(arma, x = 0, z = 0) {
  const e = new Enemigo(clonarModelo(base.scene), x, z, mundo1, escena, arma);
  e.pos.set(x, mundo1.altura(x, z), z);
  return e;
}
function nuevoJugador(extra = {}) {
  return { pos: new THREE.Vector3(0, mundo1.altura(0, 0), 0), vivo: true, vida: 100, arma: null, municion: 0, ...extra };
}
{
  const maxHumano = new Humano(clonarModelo(base.scene));
  maxHumano.actualizar(1 / 60, 2.5, true, 0.3);
  maxHumano.actualizar(1 / 60, 2, true, 0.6, 0, "mar");
  maxHumano.actualizar(1 / 60, 1, true, 0.9, 0, "oasis");
  maxHumano.actualizar(1 / 60, 0, false, 1.2, 7.2);
  maxHumano.actualizar(1 / 60, 0, true, 1.5);
  maxHumano.golpear();
  maxHumano.actualizar(1 / 60, 0, true, 1.8);
  maxHumano.destello();
  maxHumano.herir("brazo");
  maxHumano.actualizar(1 / 60, 0, true, 2.1);
  maxHumano.tendido = true;
  maxHumano.actualizar(1 / 60, 0, true, 2.4);
  maxHumano.morir("atras");
  maxHumano.actualizar(1 / 60, 0, true, 2.7);
  prueba("Humano actualiza caminar, nado, salto, golpe, herida, inconsciencia y muerte sin NaN",
    Object.values(maxHumano.pose).every((rotacion) => rotacion.every(Number.isFinite)));
  maxHumano.direccion = 0;                                    // mira hacia +z
  const jugador = nuevoJugador();
  const ctx = (enemigos) => ({ axel: maxHumano, jugador, enemigos, sonido, vista, obj: { derrotados: 0 }, scene: escena });

  let e = nuevoEnemigo(ARMAS.puños, 0, 1.2);
  let c = ctx([e]);
  for (let i = 0; i < 2; i++) resolverGolpe(c);
  prueba("puños: 2 golpes no matan (3 de vida)", e.vivo && e.vida === 1);
  resolverGolpe(c);
  prueba("puños: el 3.er golpe mata y suma 1 derrotado", !e.vivo && c.obj.derrotados === 1);

  e = nuevoEnemigo(ARMAS.puños, 0, -1.2);
  resolverGolpe(ctx([e]));
  prueba("un golpe no alcanza a un mercenario a la espalda", e.vida === 3);
  e = nuevoEnemigo(ARMAS.puños, 0, 6);
  resolverGolpe(ctx([e]));
  prueba("un golpe de puños no alcanza a 6 m", e.vida === 3);

  jugador.arma = ARMAS.bate;
  e = nuevoEnemigo(ARMAS.puños, 0, 2.4);
  c = ctx([e]); resolverGolpe(c); resolverGolpe(c);
  prueba("bate: alcance mayor y 2 golpes matan", !e.vivo && c.obj.derrotados === 1);

  jugador.arma = ARMAS.cuchillo;
  e = nuevoEnemigo(ARMAS.puños, 0, 1.2);
  resolverGolpe(ctx([e]));
  prueba("cuchillo quita 1.5 de vida", e.vida === 1.5);

  jugador.arma = ARMAS.pistola; jugador.municion = 10;
  e = nuevoEnemigo(ARMAS.puños, 0, 8);
  c = ctx([e]); dispararJugador(c);
  prueba("pistola: acierta a 8 m, quita 1.5 y gasta una bala", e.vida === 1.5 && jugador.municion === 9);
  e = nuevoEnemigo(ARMAS.puños, 6, 8);
  dispararJugador(ctx([e]));
  prueba("pistola: falla si el mercenario no está en la línea", e.vida === 3);
  const lejano = nuevoEnemigo(ARMAS.puños, 0, 25);
  dispararJugador(ctx([lejano]));
  prueba("pistola: no alcanza a 25 m", lejano.vida === 3);
  const cerca = nuevoEnemigo(ARMAS.puños, 0, 4), lejos = nuevoEnemigo(ARMAS.puños, 0, 10);
  dispararJugador(ctx([lejos, cerca]));
  prueba("pistola: le pega al más cercano de la línea", cerca.vida === 1.5 && lejos.vida === 3);
}

// balas enemigas: daño segun la altura donde pegan
{
  const llamadas = [];
  const danar = (cantidad, mortal, zona) => llamadas.push({ cantidad, mortal, zona });
  const probar = (alto, lateral = 0) => {
    llamadas.length = 0;
    const jugador = nuevoJugador();
    const e = nuevoEnemigo(ARMAS.pistola, 0, 5);
    const malla = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    malla.position.set(lateral, jugador.pos.y + alto, 3);
    e.balas.push({ mesh: malla, vel: new THREE.Vector3(0, 0, -20), vida: 2 });
    for (let i = 0; i < 12 && !llamadas.length; i++) e.actualizarBalas(1 / 60, jugador, danar);
    return llamadas[0];
  };
  let l = probar(1.3);
  prueba("bala al pecho (1.3 m) = mortal", l?.mortal === true && l.zona === "el pecho");
  l = probar(1.7);
  prueba("bala a la cabeza (1.7 m) = mortal", l?.mortal === true && l.zona === "la cabeza");
  l = probar(1.0);
  prueba("bala al abdomen (1.0 m) = 20 de daño", l?.mortal === false && l.cantidad === 20);
  l = probar(0.4);
  prueba("bala a las piernas (0.4 m) = 10 de daño", l?.mortal === false && l.cantidad === 10);
  prueba("bala por encima de la cabeza (2.5 m) no pega", probar(2.5) === undefined);
  prueba("bala a 1 m a un lado no pega", probar(1.3, 1) === undefined);
  const e = nuevoEnemigo(ARMAS.puños, 0, 0);
  e.recibirGolpe(0, 1, 5);
  prueba("un golpe fuerte mata aunque pase de la vida", !e.vivo && e.humano.muerto === true);
}

// muerte: tipos de caida
{
  const tipos = new Set();
  for (let i = 0; i < 200; i++) { const h = new Humano(clonarModelo(base.scene)); h.morir(); tipos.add(h.tipoCaida); }
  prueba("la caída al morir sortea atrás, adelante y de lado", tipos.size === 3, [...tipos].join());
  const h = new Humano(clonarModelo(base.scene)); h.morir("atras");
  prueba("morir('atras') fuerza caer hacia atrás", h.tipoCaida === "atras");
  const cae = (x, z) => { const q = new Humano(clonarModelo(base.scene)); q.morir(undefined, { x, z }); return q; };
  prueba("empujado en contra de donde mira cae de espaldas; a favor, de frente", cae(0, -1).tipoCaida === "atras" && cae(0, 1).tipoCaida === "adelante");
  prueba("golpe lateral cae de lado, izquierdo o derecho", cae(1, 0).tipoCaida === "lado" && cae(1, 0).ladoCaida === -1 && cae(-1, 0).ladoCaida === 1);
}

// ---------------------------------------------------------------- suministros (botiquines y kits de arma)
{
  const escenaS = new THREE.Scene();
  const jugador = nuevoJugador({ vida: 50 });
  const sum = crearSuministros({ scene: escenaS, sonido, jugador });
  const maxHumano = new Humano(clonarModelo(base.scene));
  let t = 0;
  const avanzar = (seg) => { for (let i = 0; i < Math.round(seg * 10); i++) { t += 0.1; sum.actualizar(0.1, t, mundo1, maxHumano); } };
  jugador.pos.set(0, 0, 0);
  avanzar(9.5);
  prueba("a los 9.5 s todavía no hay suministros", escenaS.children.length === 0);
  avanzar(1);
  prueba("a los 10 s aparecen un botiquín y un kit de arma", escenaS.children.length === 2, String(escenaS.children.length));
  const objetos = [...escenaS.children];
  prueba("aparecen en tierra, lejos del jugador", objetos.every((p) => p.position.y > 0.5 && Math.hypot(p.position.x, p.position.z) >= 5));
  const botiquin = objetos.find((o) => o.children.length === 6), kitArma = objetos.find((o) => o !== botiquin);
  jugador.pos.set(botiquin.position.x, 0, botiquin.position.z);
  avanzar(0.2);
  prueba("recoger el botiquín da +40 de vida", jugador.vida === 90 && !escenaS.children.includes(botiquin), String(jugador.vida));
  jugador.pos.set(kitArma.position.x, 0, kitArma.position.z);
  avanzar(0.2);
  prueba("recoger el kit de arma equipa un arma", jugador.arma !== null && jugador.arma.id !== "puños" && !escenaS.children.includes(kitArma), String(jugador.arma?.id));
  prueba("la pistola trae 10 balas (el resto ninguna)", jugador.arma.tipo === "pistola" ? jugador.municion === 10 : jugador.municion === 0);
  jugador.pos.set(9999, 0, 9999);
  avanzar(100);
  const n1 = escenaS.children.length;
  prueba("nunca hay más de 6 de cada tipo (máximo 12)", n1 <= 12 && n1 > 0, String(n1));
  const idsAntes = new Set(escenaS.children.map((o) => o.id));
  avanzar(75);
  const sobreviven = escenaS.children.filter((o) => idsAntes.has(o.id)).length;
  prueba("los suministros de hace más de un minuto desaparecen", sobreviven === 0, `quedan ${sobreviven}`);
  prueba("siguen apareciendo nuevos", escenaS.children.length > 0);
  sum.reiniciar();
  prueba("reiniciar() limpia todo", escenaS.children.length === 0);
  jugador.vida = 100;
  avanzar(10.5);
  const bot2 = escenaS.children.find((o) => o.children.length === 6);
  jugador.pos.set(bot2.position.x, 0, bot2.position.z);
  avanzar(0.3);
  prueba("con la vida llena el botiquín se queda en el mapa", escenaS.children.includes(bot2) && jugador.vida === 100);
  jugador.arma = ARMAS.pistola; jugador.municion = 1;
  jugador.municion--; sum.gastarBala(maxHumano);
  prueba("sin balas, la pistola se guarda", jugador.arma === null);
}

console.log(`RESUMEN ${bien} bien, ${mal} mal`);
document.title = `${bien} bien, ${mal} mal`;
const resumen = document.createElement("div");
resumen.textContent = `\n${bien} bien, ${mal} mal`;
resumen.className = mal ? "mal" : "bien";
salida.appendChild(resumen);
