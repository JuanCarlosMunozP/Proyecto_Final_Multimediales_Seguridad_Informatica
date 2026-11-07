# RELEASE-004 — Validación y bloqueos de entrega

Fecha: 6 de noviembre de 2026 (America/Bogota).
Rama: `dev/jesus`. HEAD: `8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`.
El árbol contiene cambios locales anteriores; HEAD no representa por sí solo el artefacto evaluado.
Participaron requirements_analyst, software_architect y qa_engineer.
Esta fase añade pruebas y este informe; no corrige producción ni integra la FSM.

## Dictamen

**NO-GO para preparar una entrega declarada estable.** Hay cuatro regresiones automatizadas fallidas y un error real de navegador en la ruta táctil de una cinemática.
La suite anterior de 216 pruebas sí pasó antes de añadir las diez regresiones. El build correcto no demuestra jugabilidad completa.

## Diff de producción inspeccionado

Comparación contra HEAD, sin atribuir autoría ni autorización a esta fase:

| Archivo | Diff previo | Comportamiento cambiado |
|---|---:|---|
| frontend/src/main.js | +13/-6 | Cancela timer al empezar nivel, revive tras carga, restringe daño y enemigos durante diálogo/carga, suministra mundo al disparo, adelanta posición de victoria y exige fogata específica. |
| frontend/src/personajes/enemigo.js | +13/-2 | Comprueba obstáculos mediante cuatro muestras y una altura derivada del radio. |
| frontend/src/juego/combate.js | +7/-0 | Limita tiros por centro/radio horizontal de obstáculos. |

## Matriz ejecutada

| Ejecución | Resultado | Alcance |
|---|---|---|
| npm.cmd test, base inicial | 216 aprobadas, 8 archivos, salida 0 | Unitarias, dominio y caracterización existentes. |
| Suite release-004-regression.test.js | 6 aprobadas, 4 fallidas, salida 1 | Funciones originales de main/combate extraídas en VM y método original de Enemigo; reloj manual, carga controlada y colaboradores simulados. |
| npm.cmd test, final | 222 aprobadas, 4 fallidas, 9 archivos, salida 1 | Total 226. Ninguna omitida. |
| npm.cmd run build | Salida 0; 49 módulos; 686 ms observados | Bundle principal 750.59 kB, gzip 202.54 kB. Advertencia por superar 500 kB. |
| git diff --check | Salida 1 para cambios rastreados | Seis líneas con espacios finales preexistentes en current-architecture.md y SRS.md; advertencias LF→CRLF. No se corrigieron cambios ajenos. |
| Probe de seguridad Node | Cinco aserciones aprobadas | Web Crypto real y storage en memoria: registro, clave serializada, progreso alterado vuelto a firmar, ingreso y aceptación del nuevo progreso. Sin imprimir secretos. |
| Chrome headless, escritorio | Inicio parcial observado | Servidor Vite local, perfil temporal, invitado y #demo=-2,12. Canvas, HUD de Playa y Daniel a 1 m. Modelos daniel/palmera/idolo respondieron HTTP 200. Sin excepciones ni fallos de carga capturados en esa ventana; no es revisión completa de consola. |
| Chrome headless, emulación táctil | FALLO observado | 844x390, pointer coarse, cinco puntos táctiles, UA Android. Tras invitado y dos eventos E para avanzar Daniel, ReferenceError en cineUtil.js:34. No es móvil físico ni prueba de gestos reales. |

Las dos primeras preparaciones del harness de navegador no completaron CDP (await inconcluso/cierre de conexión); no son validaciones del juego. La ejecución posterior con perfil temporal y permisos de proceso adecuados sí obtuvo los resultados anteriores. Se habilitó fallback SwiftShader; no se midió rendimiento de GPU física.

### Regresiones nuevas

| ID | Esperado | Resultado |
|---|---|---|
| R004-001 | Muerte y pausa conservan plazo 1499/1500 ms y finalización única, sin carga. | PASS |
| R004-002 | Una carga en la misma partida pausada conserva derrota pendiente. | FAIL: sigue pausa. |
| R004-003 | Completar carga no revive una muerte pendiente de la misma partida. | FAIL: vivo vuelve a true. |
| R004-004 | Tiro libre del jugador impacta y consume una bala. | PASS |
| R004-005 | Obstáculo intermedio bloquea tiro del jugador. | PASS |
| R004-006 | Obstáculo lateral no bloquea tiro del jugador. | PASS |
| R004-007 | Borde delantero bloquea aunque centro quede detrás del blanco. | FAIL: impacta. |
| R004-008 | Bala enemiga libre impacta una vez y se retira. | PASS |
| R004-009 | Obstáculo intermedio muestreado bloquea bala enemiga. | PASS |
| R004-010 | Obstáculo estrecho entre muestras bloquea bala enemiga. | FAIL: impacta. |

R004-002/003 declaran el supuesto de continuidad de la misma partida. La prioridad general carga/muerte estaba pendiente de aprobación; estas pruebas no autorizan una política nueva ni prioridad sobre victoria. Las geometrías de proyectiles son sintéticas; no demuestran frecuencia o alcanzabilidad en una partida normal.

## Hallazgos y decisiones

1. **P0 móvil, reproducido en navegador emulado:** cineUtil.js:34 registra alTocar antes de su const en :39. Stack real: interfazCine → crearCinematicaAvion → hablarConDaniel (main.js:324). Declarar callbacks antes de registrar listeners es la propuesta mínima; requiere aprobación de producción.
2. **P0, concurrencia y política:** main.js:236 cancela derrota y :243 revive tras await. POL-FSM-001 exige que una derrota ya programada se ejecute pese a pausa; pausa sola conserva esto, carga concurrente puede anularlo. El portal tiene demora de 700 ms (:344-348) y frío mata directamente (:583-586), sin pasar por la nueva guarda de danar. No se ha aprobado equiparar cambio de nivel con reinicio de partida. Decidir prioridad y vigencia antes de corregir.
3. **P0/P1, proyectiles:** combate.js:47-51 usa el centro del círculo como distancia de impacto y omite altura; enemigo.js:94-103 usa cuatro muestras y altura max(2,r*2.2). Los fallos nuevos demuestran límites geométricos. La revisión arquitectónica además ejecutó probes con un obstáculo radio .25 intersectado entre muestras, tiro elevado indebidamente bloqueado y pilar atravesado por altura ficticia. Definir segmento/volumen, orden de impactos y dimensiones físicas, no ajustar constantes arbitrariamente.
4. **P1, victoria parcialmente preparada:** main.js:402-403 adelanta posición, pero irACasa oculta mundo y retira enemigos antes de await (:395-404). terminar no espera ni captura rechazo (:414). La casa vuelve a cargar idolo.glb (casa.js:73). No se validaron rechazo de esa carga, continuidad visual ni liberación GPU. irACasa no llama limpiar de enemigos; las balas tienen objetos separados. Riesgo de recursos, sin fuga cuantificada.
5. **P1, veracidad documental:** SRS.md:54-56 y release-readiness-and-demo.md:15-28 atribuyen funciones/recorridos no demostrados. Hay dos ídolos por nivel (datos.js:7), vehículos de salida y cinemáticas avión/playa, no la cinemática de ídolo descrita. TC-DOM-001 evalúa objetivos preparados, no completa Daniel→portal. IDs RF y SEG/SEC no son consistentes entre documentos. Este informe no sobrescribe esos documentos ni sus cambios pendientes.

## Frontera de confianza y seguridad

El juego, la validación de cuenta, la derivación y el almacenamiento se ejecutan en el navegador. No hay backend de cuentas, autorización remota ni base de datos de servidor. localStorage guarda registros JSON de cuentas/progreso e intentos; sessionStorage guarda nombre y clave HMAC derivada (cuenta.js:30, almacen.js:51).

La contraseña no se guarda en texto plano. Se implementan PBKDF2-SHA256 (150000 iteraciones, sal de 16 bytes), verificador y HMAC-SHA256. HMAC detecta modificación sin firma válida **mientras el modificador no disponga de la clave**. Un usuario que controle el navegador o código del mismo origen puede leer esa clave, firmar nuevo progreso y obtener aceptación: el probe local lo confirmó. También puede restaurar registros antiguos válidos o borrar el bloqueo de intentos. Esto no es autenticación respaldada por servidor ni protección contra el propietario del cliente.

La suite security-account.test.js aporta siete casos con criptografía real y Web Storage en memoria: derivación, HMAC, formatos, registro/login, bloqueo inicial e invitado. No demuestra tiempo constante del motor JS, resistencia a XSS en navegador, seguridad del hosting, tolerancia a todos los fallos de almacenamiento ni aislamiento concurrente de cuentas. TC-SEC-007 observa progreso en memoria, no espera confirmación durable de la cola.

Pendientes conocidos de cuenta: cola consulta identidad mutable al ejecutar (cuenta.js:97-104), escrituras fallidas ignoradas (:105-107), acceso al objeto storage antes del try (almacen.js:37/50) y autenticación pendiente frente a selección de invitado (pantalla.js:57/65). No fueron corregidos ni todos reejecutados en RELEASE-004.

Mitigaciones propuestas: capturar identidad/generación en guardados, resultado explícito de persistencia, recuperar UI ante excepciones y reducir exposición de usuario(). Mantener clave solo en memoria cambia reingreso tras recarga y exige decisión humana. Una CryptoKey no exportable tampoco impide uso por código malicioso del mismo origen. Cabeceras/CSP son propuestas pendientes del hosting, no protección verificada. No hay API propia que autorizar mediante CORS.

El informe de seguridad previo contiene afirmaciones de referencias/algoritmos y riesgo aceptado que requieren corrección. ADR-002 sigue propuesto; este informe no acepta riesgos en nombre del usuario. No se repitió npm audit aquí: el resultado obtenido en la auditoría anterior fue cero avisos conocidos, no certificación de seguridad.

## AS-IS, casos de uso y multimedia

JavaScript ES Modules + Three.js/WebGL + Web Audio; Vite para desarrollo/build, Vitest para pruebas, Blender/Python para producir modelos offline. main.js conserva el ciclo de vida real. FSM, coordinador y adaptadores permanecen aislados; no se conectaron al juego.

Casos reales: invitado; registrar/abrir cuenta local; hablar con Daniel; explorar, combatir y recoger dos ídolos por bioma; completar extras; salir en bote/refugio/caravana; pausar/reanudar; guardar nivel, mejor tiempo y victorias. Misiones y partida exacta no se persisten.

- Playa: dos ídolos, dos enemigos, ruinas y bote.
- Montaña: dos ídolos, tres enemigos, altar, fogata y refugio.
- Desierto: dos ídolos, cuatro enemigos, 15 m de nado en oasis y caravana.

Se verificaron cálculos de objetivos/terreno/frío/agua y casos de disparos con dobles. En navegador se observó solo inicio parcial de Playa y el fallo cinematográfico táctil. No se certifica completitud física de misiones, audio, iluminación, animaciones, cámara final, controles táctiles físicos ni integridad visual de los tres niveles.

## Validación pendiente y ejecución

Con dependencias existentes, desde frontend:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Abrir http://127.0.0.1:5173/ para el flujo normal; #demo=-2,12 es solo diagnóstico de desarrollo y no sustituye inicio normal. /niveles.html, /visor.html, /pruebas.html y /rendimiento.html son herramientas; ver un nivel no equivale a completarlo. No instalar dependencias dentro de esta fase.

Antes de aprobar entrega: corregir P0 autorizados y repetir suite; probar portal→muerte por frío→pausa con carga lenta y fallo de carga; tiros tangentes/elevados; recorrido completo de los tres biomas; ambas cinemáticas; pausa/reanudación, derrota, victoria/casa y recursos; HUD/audio/cámara y móvil físico; consola/red y memoria antes/después de transiciones. Registrar navegador, dispositivo, calidad, pasos y resultado, con presupuestos de rendimiento acordados.

## Guion honesto de exposición (10 minutos)

1. Arquitectura local y fronteras (2 min): cliente, Three/Web Audio/Web Crypto, sin servidor ni DB; FSM aislada.
2. Multimedia (3 min): mostrar Playa y Daniel; explicar biomas/objetivos reales. Presentar el fallo móvil conocido hasta corregirlo, sin afirmar recorrido completado.
3. Seguridad (2 min): cuenta desechable; derivación y HMAC; demostrar alteración de nivel dentro de 0..2 sin firma y reingreso con contraseña. Explicar que poseer la clave permite refirmar; no mostrar claves ni datos personales.
4. Calidad (2 min): enseñar 222 PASS/4 FAIL, causas, build y advertencia. Distinguir pruebas con dobles de Chrome emulado y móvil físico pendiente.
5. Decisiones (1 min): prioridad carga/muerte, contrato de proyectiles, recuperación de victoria y validación restante. No presentar ADR-002 aprobado.

No preparar un paquete etiquetado como validado hasta revisión humana. Próximas modificaciones de producción requieren aprobación específica.

## Preservación y archivos de esta fase

Se crearon únicamente `frontend/tests/release-004-regression.test.js` y este informe por el equipo RELEASE-004. Los 121 archivos del snapshot inicial conservaron su hash. `main.js` conserva SHA-256 `249941ab52f16106bc8c25ef9dc5f5ccf646f267f34a7e03b744b38ea104362d` durante esta fase. Apareció además `docs/architecture/backend-raspberry-plan.md` por actividad externa; no se modificó ni se considera evidencia de un backend implementado.

Vite y las sesiones de navegador utilizadas se cerraron. Los perfiles temporales de diagnóstico se dejaron fuera del repositorio; no se ejecutaron borrados. No hubo instalaciones, commits, push, merge ni aprobación de ADR-002.
