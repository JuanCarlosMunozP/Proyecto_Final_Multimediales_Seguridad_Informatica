# RELEASE-005A — Reparación del bloqueo de cinemática táctil

Fecha de informe: 6 de noviembre de 2026, America/Bogota.
Rama: `dev/jesus`; HEAD: `8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`, más cambios locales.

## Alcance y causa

Único cambio de producción: `frontend/src/escenario/cineUtil.js`.
En el original, `interfazCine()` registraba el callback `alTocar` en la rama táctil (línea 34) antes de inicializar su declaración `const` (línea 39). La evaluación dentro de esa zona temporal producía ReferenceError y no devolvía la interfaz a la cinemática.

Se inspeccionaron ambos llamadores: avión (`cinematica.js:90`) y playa (`cinematicaPlaya.js:63`); sus cierres invocan `ui.cerrar()` en las líneas 113 y 69 respectivamente. No necesitan cambios.

Se movieron solamente la inicialización de `ui` y `alTocar` al inicio de la función, antes de registrar cualquier listener. No cambiaron textos, historias, duraciones, entradas, reglas de salto, listeners o limpieza. El registro sigue usando la misma función que luego recibe removeEventListener.

## RED antes de corregir

QA creó `frontend/tests/cine-util.test.js` e importó el módulo real; únicamente perfil de dispositivo, HUD y DOM son dobles. Se usa EventTarget real, sin temporizadores ni navegador.

Comando desde frontend: `npm.cmd test -- tests/cine-util.test.js`.

- Salida 1, 414 ms observados: **2 fallidas y 6 aprobadas**.
- CINE-001 y variante táctil de CINE-002 reprodujeron `ReferenceError: Cannot access 'alTocar' before initialization`, en cineUtil.js:34.
- La ejecución RED precedió al parche de producción.

## GREEN posterior y suite completa

| Ejecución | Resultado real |
|---|---|
| npm.cmd test -- tests/cine-util.test.js | Salida 0; **8 aprobadas**, 257 ms. |
| npm.cmd test | Salida 1; **230 aprobadas, 4 fallidas**, 234 casos, 10 archivos; 4.02 s. |
| npm.cmd run build | Salida 0; 49 módulos; 2.19 s; bundle 750.59 kB, gzip 202.54 kB. Advertencia de chunk superior a 500 kB. |
| git diff --check -- frontend/src/escenario/cineUtil.js | Salida 0. |

Las cuatro fallidas son las mismas de RELEASE-004: R004-002/003 (muerte/carga), R004-007 (borde de obstáculo en disparo del jugador) y R004-010 (obstáculo entre muestras de bala enemiga). No se omitieron ni alteraron; siguen fuera del alcance autorizado. El parche no convierte la suite global en verde.

Los ocho casos cubren creación táctil, salto por pointerdown, limpieza con referencias exactas en táctil/escritorio, ausencia de respuesta tras cerrar, teclado e/E/Enter/Espacio, ausencia de salto por puntero en escritorio y subtítulos con textContent y umbrales temporales.

## Navegador real, emulación y consola

Se ejecutó Chrome headless **156.0.8078.80**, contra Vite en `http://127.0.0.1:5173`, con perfiles temporales sin cuentas del usuario. Se habilitó fallback SwiftShader; esto no mide GPU física.

La instrumentación del navegador registra altas y bajas de las referencias `alTocar` y `alSaltar`; delega sus operaciones originales sin modificar el código de producción.

| Modo | Avión | Playa | Listeners al finalizar | Consola/red |
|---|---|---|---|---|
| Táctil emulado: 844x390, cinco puntos táctiles, UA Android, pointer coarse | Creada, cuadros ejecutados, salto por eventos CDP touchStart/touchEnd; vuelve a respuesta de Max. | Creada y saltada con toque; vuelve a Daniel. | 4 altas/4 bajas acumuladas; 0 activas. | 0 errores y 0 advertencias capturados. |
| Escritorio | Creada y saltada con E; vuelve a respuesta de Max. | Creada y saltada con E; vuelve a Daniel. | 2 altas/2 bajas acumuladas; 0 activas. | 0 errores y 0 advertencias capturados. |

Ambas ejecuciones terminaron con salida 0 y `passed:true`. En las dos, daniel.glb, palmera.glb e idolo.glb respondieron HTTP 200. El ReferenceError de RELEASE-004 no reapareció en el flujo reproducido.

El diálogo restaurado tras avión fue la respuesta de Max sobre la semana a la deriva; tras playa fue “Por suerte te encontré. Pero no nos iremos sin el ídolo que viniste a buscar.” Los controles indicaron “Toca · continuar” en táctil y “E · continuar” en escritorio.

Pasos reproducibles, sin instalar dependencias:

```powershell
# Terminal 1, desde frontend:
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort

# Terminal 2, desde frontend, con Chrome instalado en Windows:
node tests/browser/cine-touch-check.mjs touch
node tests/browser/cine-touch-check.mjs desktop
```

Puede configurarse CINE_BROWSER con la ruta de Chrome. El harness usa Node con fetch/WebSocket disponibles, un perfil temporal y el puerto CDP local 9231; ejecutar los modos secuencialmente. Cierra el navegador propio al acabar y no borra perfiles.

Secuencia: abrir `/#demo=-2,12`, elegir invitado, esperar Daniel a 1 m, E para abrir diálogo, E para iniciar avión, esperar aviso de salto, tocar (o E en escritorio), comprobar retorno al diálogo y limpieza; E inicia playa, repetir salto y comprobaciones. Se usa E para reproducir exactamente el disparador anterior aun en emulación táctil; el salto sí usa entrada táctil enviada al navegador.

Esto valida una ruta real de navegador con entrada móvil emulada. No equivale a móvil físico, inspección visual humana ni recorrido completo del juego. Tampoco se esperó la finalización natural de 24/15 segundos; esas duraciones y ramas no se modificaron.

## Diff de producción completo

```diff
 export function interfazCine(subtitulos) {
+  const ui = { saltar: false };
+  const alTocar = () => { ui.saltar = true; };
   const caja = document.createElement("div");
@@
-  const ui = { saltar: false };
-  const alTocar = () => { ui.saltar = true; };
   const alSaltar = (e) => { if (["e", "enter", " "].includes(e.key.toLowerCase())) ui.saltar = true; };
```

Archivos del parche:

- Modificado: `frontend/src/escenario/cineUtil.js`, dos líneas reubicadas.
- Nuevo: `frontend/tests/cine-util.test.js`, regresiones unitarias.
- Nuevo: `frontend/tests/browser/cine-touch-check.mjs`, reproducción de navegador sin dependencias nuevas.
- Nuevo: este informe.

## Riesgos y dictamen

**GO técnico para la reparación acotada RELEASE-005A**, con RED previo, GREEN específico y flujo de navegador táctil/escritorio correcto. **NO-GO para declarar la entrega global validada**, por los cuatro fallos anteriores y las comprobaciones de dispositivos/recorrido pendientes.

No se modificaron main.js, FSM, combate, llamadores o historia. La cancelación por cualquier pointerdown global conserva el comportamiento previo; no se cambia aquí. Los problemas previos de liberación de recursos y políticas de concurrencia permanecen fuera de alcance. Sin instalaciones, commits, push ni merge. Detenerse antes de cualquier otro cambio de producción.

Se compararon hashes de los 124 archivos iniciales: solo cambió cineUtil.js. Durante la fase aparecieron archivos nuevos bajo backend/ por actividad externa; no los creó, ejecutó ni modificó el equipo de esta reparación y no se incluyen en su validación.
