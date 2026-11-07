// Interfaz sobre el juego: HUD, mensajes, fundido a negro, dialogo con Daniel y lista de objetivos.
import { dispositivo } from './dispositivo.js';
const $ = (id) => document.getElementById(id);

export const hud = {
  barraVida: $("barra-vida"),
  pista: $("pista"),
  mensaje: $("mensaje"),
  dano: $("dano"),
  pantalla: $("pantalla"),
  titulo: $("pantalla-titulo"),
  texto: $("pantalla-texto"),
  boton: $("btn-jugar"),
  ui: $("ui"),
  objetivos: $("objetivos"),
  filaFrio: $("fila-frio"),
  barraFrio: $("barra-frio"),
  filaCalor: $("fila-calor"),
  barraCalor: $("barra-calor")
};

let temporizadorMensaje = 0;
export function decir(texto, segundos = 3) {
  hud.mensaje.textContent = texto;
  hud.mensaje.classList.add("visible");
  clearTimeout(temporizadorMensaje);
  temporizadorMensaje = setTimeout(() => hud.mensaje.classList.remove("visible"), segundos * 1000);
}

// negro de transicion entre niveles
export const fundido = document.createElement("div");
fundido.style.cssText = "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;" +
  "transition:opacity .6s;z-index:5";
document.body.appendChild(fundido);

// ---- dialogo con Daniel (tecla E)
export const cajaDialogo = document.createElement("div");
cajaDialogo.style.cssText = "position:fixed;left:50%;bottom:9%;transform:translateX(-50%);width:min(720px,88vw);" +
  "padding:14px 20px;border-radius:14px;background:rgba(22,14,18,.86);border:1px solid rgba(255,190,110,.45);" +
  "color:#f3e8dc;font-size:17px;line-height:1.5;z-index:4;display:none";
cajaDialogo.id = "dialogo";
cajaDialogo.setAttribute("role", "status");     // los lectores de pantalla leen cada linea nueva
document.body.appendChild(cajaDialogo);
export const avisoHablar = document.createElement("div");
avisoHablar.style.cssText = "position:fixed;left:50%;bottom:22%;transform:translateX(-50%);padding:6px 16px;" +
  "border-radius:20px;background:rgba(22,14,18,.75);color:#ffd98a;font-size:15px;z-index:3;display:none";
avisoHablar.textContent = "Pulsa E para hablar con Daniel";
document.body.appendChild(avisoHablar);

export function mostrarLinea({ lineas, i }) {
  const [quien, texto] = Array.isArray(lineas[i]) ? lineas[i] : ["Daniel", lineas[i]];
  const color = quien === "Max" ? "#9fd0ff" : "#ffc27a";
  cajaDialogo.innerHTML = `<b style="color:${color}">${quien}</b><br>${texto}` +
    `<div style="text-align:right;font-size:13px;color:#aaa;margin-top:6px">${dispositivo.tactil ? "Toca" : "E"} · ${i < lineas.length - 1 ? "continuar" : "aceptar misión"}</div>`;
  cajaDialogo.style.display = "block";
}
export function cerrarDialogo() {
  cajaDialogo.style.display = "none";
}

// ---- lista de objetivos del panel izquierdo (solo se repinta si cambia)
let htmlObjetivos = "";
export function pintarObjetivos(lista) {
  const html = lista.map(([t, ok]) => `<div class="${ok ? "ok" : ""}">${ok ? "✔" : "○"} ${t}</div>`).join("");
  if (html !== htmlObjetivos) {
    htmlObjetivos = html;
    hud.objetivos.innerHTML = html;
  }
}

// Pantalla de victoria o derrota (sobre el menu): `segundos` = tiempo total, `niveles` = cuantos habia
export function pantallaFinal(resultado, segundos, niveles) {
  const victoria = resultado === "victoria";
  hud.titulo.textContent = victoria ? "¡MISIÓN CUMPLIDA!" : "FIN DEL JUEGO";
  hud.texto.textContent = victoria
    ? `Max Montenegro encontró el ídolo perdido, cruzó los ${niveles} niveles y volvió a casa en ${segundos} segundos. Por fin puede descansar.`
    : "Los mercenarios te derrotaron. La isla no perdona.";
  hud.boton.textContent = "Jugar de nuevo (R)";
  hud.pantalla.classList.remove("oculta");
  hud.ui.classList.add("oculta");
}
