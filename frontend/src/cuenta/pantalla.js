// Pantalla de ingreso (ingresar / crear cuenta / invitado) y la linea con los datos del jugador en
// el menu. Todo el texto entra con textContent y los elementos se crean con el DOM: nada de
// innerHTML, asi un nombre de usuario nunca puede inyectar HTML.
const el = (etiqueta, props = {}, ...hijos) => {
  const e = Object.assign(document.createElement(etiqueta), props);
  e.append(...hijos);
  return e;
};
const tiempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function mostrarPantallaCuenta({ registrar, entrar, entrarComoInvitado, mensajeInicial = "" }) {
  return new Promise((resolver) => {
    let modo = "entrar";
    const mensaje = el("p", { className: "cuenta-mensaje", role: "alert" });
    const nombre = el("input", { type: "text", maxLength: 16, autocomplete: "username", placeholder: "Nombre de jugador" });
    const clave = el("input", { type: "password", maxLength: 64, autocomplete: "current-password", placeholder: "Contraseña" });
    const repetir = el("input", { type: "password", maxLength: 64, autocomplete: "new-password", placeholder: "Repite la contraseña" });
    const enviar = el("button", { type: "submit", className: "cuenta-principal" });
    const pestEntrar = el("button", { type: "button", textContent: "Ingresar" });
    const pestCrear = el("button", { type: "button", textContent: "Crear cuenta" });
    const invitado = el("button", { type: "button", className: "cuenta-invitado", textContent: "Jugar como invitado (sin guardar)" });
    const nota = el("p", { className: "cuenta-nota",
      textContent: "Tu cuenta y tu progreso se guardan de forma segura en el servidor." });
    const form = el("form", {}, nombre, clave, repetir, mensaje, enviar);
    const caja = el("div", { className: "cuenta-caja" },
      el("h2", { textContent: "Inicia sesión" }), el("div", { className: "cuenta-pestanas" }, pestEntrar, pestCrear), form, invitado, nota);
    const capa = el("div", { id: "cuenta", role: "dialog" }, caja);
    capa.setAttribute("aria-modal", "true");
    capa.setAttribute("aria-label", "Inicio de sesión");
    for (const [campo, texto] of [[nombre, "Nombre de jugador"], [clave, "Contraseña"], [repetir, "Repite la contraseña"]]) campo.setAttribute("aria-label", texto);
    const detras = ["pantalla", "ui"].map((id) => document.getElementById(id));
    detras.forEach((e) => (e.inert = true));            // lo de atras no recibe foco ni lector de pantalla

    const cambiar = (nuevo) => {
      modo = nuevo;
      repetir.style.display = modo === "crear" ? "" : "none";
      clave.autocomplete = modo === "crear" ? "new-password" : "current-password";
      enviar.textContent = modo === "crear" ? "Crear cuenta y jugar" : "Ingresar y jugar";
      pestEntrar.classList.toggle("activa", modo === "entrar");
      pestCrear.classList.toggle("activa", modo === "crear");
      mensaje.textContent = mensajeInicial;
    };
    const terminar = () => { detras.forEach((e) => (e.inert = false)); capa.remove(); resolver(); };
    capa.addEventListener("keydown", (e) => {            // el foco da vueltas dentro del cuadro (Tab / Mayús+Tab)
      if (e.key !== "Tab") return;
      const lista = [...capa.querySelectorAll("button, input")].filter((x) => !x.disabled && x.offsetParent);
      const primero = lista[0], ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (modo === "crear" && clave.value !== repetir.value) { mensaje.textContent = "Las contraseñas no coinciden."; return; }
      enviar.disabled = true;
      mensaje.textContent = "Comprobando…";
      const r = await (modo === "crear" ? registrar : entrar)(nombre.value, clave.value);
      enviar.disabled = false;
      clave.value = repetir.value = "";                    // la contraseña no se queda en el formulario
      if (!r.ok) { mensaje.textContent = r.mensaje; return; }
      terminar();
    });
    pestEntrar.onclick = () => cambiar("entrar");
    pestCrear.onclick = () => cambiar("crear");
    invitado.onclick = () => { entrarComoInvitado(); terminar(); };
    cambiar("entrar");
    document.body.appendChild(capa);
    nombre.focus();
  });
}

// "Jugador: Max · Progreso: nivel 2 de 3 · Mejor tiempo: 4:10" + boton para cerrar sesion
export function mostrarInfo(actual, cerrar) {
  document.getElementById("cuenta-info")?.remove();
  const d = actual?.datos;
  const texto = actual?.invitado ? "Invitado · el progreso no se guarda"
    : `Jugador: ${actual.nombre} · Progreso: nivel ${d.nivel + 1} de 3` + (d.mejorTiempo ? ` · Mejor tiempo: ${tiempo(d.mejorTiempo)}` : "");
  const boton = el("button", { type: "button", textContent: actual?.invitado ? "Iniciar sesión" : "Cerrar sesión", onclick: cerrar });
  const aviso = actual?.aviso ? el("span", { className: "cuenta-aviso", textContent: actual.aviso }) : "";
  document.getElementById("btn-jugar").before(el("p", { id: "cuenta-info" }, texto + " ", boton, aviso));
}
