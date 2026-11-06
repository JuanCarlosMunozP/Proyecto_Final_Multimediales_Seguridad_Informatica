// Datos de los niveles: objetivos, guiones de Daniel y puntos de partida de los mercenarios.
import { TEMAS } from '../escenario/temas.js';

// Tres niveles = tres biomas (TEMAS en mundo.js). En cada uno hay 2 ídolos y objetivos sencillos;
// al completarlos aparece la salida (bote, refugio o caravana): llegar a ella lleva al siguiente
// nivel y, en el último, de vuelta a casa.
export const IDOLOS_POR_NIVEL = 2;
export const METROS_NADO = 15;
export const NIVELES = [
  { nombre: TEMAS[0].nombre, enemigos: 2, extras: ["ruinas"] },
  { nombre: TEMAS[1].nombre, enemigos: 3, extras: ["altar", "fogata"] },
  { nombre: TEMAS[2].nombre, enemigos: 4, extras: ["nadar"] }
];

// Cada línea es el texto de Daniel, o ["Max", texto] cuando responde el protagonista.
// Daniel, el guía: da la bienvenida y entrega las misiones de cada nivel. Solo después de hablar
// con él aparecen los objetivos en el panel de la izquierda.
export const GUIONES = [
  [
    "¡Max! Te estaba esperando. Soy Daniel y vine a rescatarte. ¿Qué te pasó? ¿Cómo llegaste a esta isla?",
    ["Max", "Pasé una semana a la deriva, hasta que el mar me arrastró a esta playa. Llevo una semana varado en esta isla."],
    "Por suerte te encontré. Pero no nos iremos sin el ídolo que viniste a buscar.",
    "Para volver a casa necesitamos el ídolo perdido, y está repartido en tres lugares. Esta playa es el primero.",
    "Tu misión: reúne los 2 ídolos dorados, derrota a los mercenarios que patrullan y toca las ruinas antiguas del centro.",
    "Cuando termines, aparecerá un bote en el mar: nada hasta él. Cada cierto tiempo aparecen por la isla botiquines de cruz roja (curan) y cajas verdes con armas para defenderte, pero desaparecen al minuto. ¡Mucha suerte!"
  ],
  [
    "Lo lograste, Max. Esta es la montaña: aquí hace frío y los mercenarios vigilan cada ladera.",
    "Tu misión: reúne los 2 ídolos, derrota a los mercenarios, escala hasta el altar de la cima y calienta tus manos en la fogata.",
    "¡Ojo con el frío! Si tu barra de calor se vacía, el frío te congelará y perderás vida: acércate a las fogatas y antorchas para entrar en calor, y busca botiquines para curarte.",
    "Al terminar se abrirá un refugio en la ladera. Baja hasta él con cuidado."
  ],
  [
    "Último tramo, Max. El desierto es duro: poca sombra y mucho sol.",
    "Tu misión: reúne los 2 ídolos y derrota a los mercenarios. Pero antes bebe y refréscate: busca el oasis entre las dunas y nada en él.",
    "Con todo cumplido llegará una caravana. Súbete a ella y volverás a casa. ¡Tú puedes!"
  ]
];

// Cinematicas de cada nivel: { indice de la linea ANTES de la cual se muestra: tipo }.
// Nivel 1: el choque del avion (Max queda flotando) antes de su respuesta, y su llegada
// inconsciente a la playa justo despues de ella.
export const CINEMATICAS = [{ 1: "avion", 2: "playa" }, {}, {}];

export const CASAS = [[-14, -13], [15, -7], [11, 19], [-19, 9], [3, -24]];

// Lista de objetivos de un nivel: [texto, cumplido]. `obj` es el progreso del jugador.
export function objetivos(nivel, obj) {
  const def = NIVELES[nivel];
  const lista = [
    [`Ídolos dorados ${obj.idolos}/${IDOLOS_POR_NIVEL}`, obj.idolos >= IDOLOS_POR_NIVEL],
    [`Derrotar mercenarios ${obj.derrotados}/${def.enemigos}`, obj.derrotados >= def.enemigos]
  ];
  for (const e of def.extras) {
    if (e === "fogata") lista.push(["Calentarte junto a la fogata", obj.fogata]);
    if (e === "ruinas") lista.push(["Tocar las ruinas antiguas", obj.altar]);
    if (e === "altar") lista.push(["Escalar hasta el altar de la cima", obj.altar]);
    if (e === "nadar") lista.push([`Encontrar el oasis y nadar en él ${Math.min(METROS_NADO, Math.floor(obj.nado))}/${METROS_NADO} m`,
      obj.nado >= METROS_NADO]);
  }
  return lista;
}
