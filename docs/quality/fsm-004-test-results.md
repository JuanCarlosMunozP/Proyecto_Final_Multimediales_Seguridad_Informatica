# FSM-004 — Resultados QA del coordinador aislado

Fecha: 2026-11-06. Rama: `dev/jesus`. HEAD de referencia:
`8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`; se verificó el árbol de trabajo con
cambios locales, no un nuevo commit. No se instalaron dependencias ni se crearon
commits. Aplicado `agents/qa-engineer.md` y `skills/software-testing/SKILL.md`.

## Entorno y ejecución real

Windows PowerShell; Node.js v26.13.0; npm 11.14.1; Vitest 5.1.0; Vite 8.3.5.
Comandos ejecutados desde `frontend/` con los lanzadores `npm.cmd` existentes.
Las pruebas nuevas usan reloj numérico inyectado: no crean timers reales ni usan
DOM, navegador o Three.js.

| Comando | Resultado observado |
|---|---|
| `npm.cmd test` | Código 0; 4 archivos aprobados, 162 pruebas aprobadas; 340 ms. Sin fallos ni omitidos reportados. |
| `npm.cmd run build` | Código 0; 49 módulos transformados; 517 ms. Bundle principal 750.00 kB, gzip 202.32 kB. |

Advertencia real del build: algunos chunks superan 500 kB tras minificación.
No se cambió configuración para suprimirla. Build produjo artefactos `dist/`.
No se midió cobertura de líneas/ramas ni rendimiento del juego.

Histórico FSM-002: 116 pruebas aprobadas en tres archivos, documentadas en
`../architecture/game-state-machine.md:149`. FSM-003 fue análisis sin ejecución.
FSM-004 añade 46 casos ejecutados de coordinador y conserva los 116 anteriores:
105 de FSM pura, 7 de caracterización y 4 de datos. La parametrización explica
por qué 16 identificadores nuevos representan 46 casos ejecutados.

## Casos, trazabilidad y resultados

Fuente: `frontend/tests/game-state-coordinator.test.js`. En todos los casos el
resultado real coincidió con el esperado: **aprobado** en el entorno anterior.
Los casos se trazan a POL-FSM-001 A; RF relacionados continúan con el estado de
revisión que declara la SRS. Las guards técnicas son diseño local del coordinador,
no nuevos requisitos aprobados del juego.

| ID / línea | Casos | Requisito | Precondición, entrada y pasos | Resultado esperado y real |
|---|---:|---|---|---|
| TC-COORD-001 / 20 | 1 | RF-001; CA-FSM-001 | Cargando; cargar, iniciar, iniciar cine, pausar, reanudar con cine activo y finalizar cine. | Contratos completos y destinos correctos; aprobado. |
| TC-COORD-002 / 31 | 1 | POL A; RF-005 | Juego; evidencia congelada vida=0/vivo=false; pausa; resolver a 1499 y 1500 ms; repetir y reanudar. | Prematuro rechazado sin consumir; derrota al vencer; callback sin token expuesto; repetición y reapertura rechazadas; aprobado. |
| TC-COORD-003 / 50 | 1 | POL A | Muerte pendiente; pausa a 700 ms; reanudar a 1400; resolver antes y al plazo original. | Pendiente conservada; derrota a 1500 ms sin reiniciar plazo; aprobado. |
| TC-COORD-004 / 63 | 1 | POL A | Pendiente en pausa; callback con argumentos falsificados y LOSE con banderas externas. | No adelanta vencimiento ni autoriza LOSE; aprobado. |
| TC-COORD-005 / 74 | 7 | POL A; CA-FSM-002 | Preparar cada uno de los siete estados; despachar LOSE genérico. | DERROTA_NO_AUTORIZADA y estado conservado; aprobado. |
| TC-COORD-006 / 94 | 12 | POL A; RF-005 | Juego; evidencia ausente, null, array, primitivos, incompleta, vida positiva/no finita/no numérica o vivo distinto de false; después evidencia válida. | EVIDENCIA_MUERTE_INVALIDA; no crea pendiente ni bloquea posterior registro válido; aprobado. |
| TC-COORD-007 / 102 | 1 | POL A | Registrar muerte; duplicar a 1000 ms; resolver a 1500. | Duplicado rechazado sin reemplazar plazo original; aprobado. |
| TC-COORD-008 / 112 | 1 | POL A; RF-001 | Registrar, reiniciar, iniciar otra partida y registrar nueva muerte; vencer ambos callbacks. | Antiguo no vigente; nuevo aceptado; aprobado. |
| TC-COORD-009 / 125 | 1 | POL A | Dos coordinadores; callback de A invocado con this/argumento B al vencer A. | Solo A termina; B sigue jugando; aprobado. |
| TC-COORD-010 / 137 | 1 | POL A; CA-FSM-007 | Muerte pendiente; WIN aceptado antes del plazo; vencer callback y repetir WIN. | Victoria única; callback invalidado y segunda victoria rechazada; aprobado. |
| TC-COORD-011 / 150 | 10 | CA-FSM-003 | Juego; eventos heredados, desconocidos y entradas no string primitiva. | TRANSICION_NO_PERMITIDA, sin coerción ni cambio de estado; aprobado. |
| TC-COORD-012 / 157 | 1 | CA-FSM-004; POL A | Muerte pendiente; PAUSE con null y cineActivo no booleano; vencer. | Contextos rechazados; pendiente sigue válida; aprobado. |
| TC-COORD-013 / 167 | 1 | POL A | Pausa sin muerte registrada; intentar registrar evidencia y LOSE externo. | Registro fuera de juego y LOSE rechazados; aprobado. |
| TC-COORD-014 / 176 | 5 | RNF-003; contrato reloj | Juego; reloj no función o que devuelve valor no finito/no numérico. | RELOJ_INVALIDO al registrar; no cambio de estado; aprobado. |
| TC-COORD-015 / 183 | 1 | RNF-003; POL A | Registrar con reloj válido; invalidarlo al resolver; restaurarlo al plazo. | Error de reloj no consume pendiente; resolución posterior aceptada; aprobado. |
| TC-COORD-016 / 194 | 1 | Contrato local de origen | Registrar en juego; iniciar cine; vencer callback. | TRANSICION_NO_PERMITIDA desde cinematica; estado conservado; aprobado. |

## Alcance, riesgos y revisión

Las pruebas observan respuestas y estado del coordinador; la finalización única
se demuestra por una aceptación seguida de rechazos. No demuestran llamadas
únicas al HUD/audio/persistencia real: el coordinador no ejecuta esos efectos y
no está integrado en `main.js`. TC-FSM-007 existente sigue siendo un harness
limitado de funciones reales extraídas, sin listeners ni navegador.

Estado de criterios de política: **CA-POL-001 parcialmente demostrado**: se
validan los datos de muerte y el registro interno, queda pendiente probar que
proceden del camino de daño legítimo. **CA-POL-006 pendiente de integración**:
preservación real de pausa, jugador, tiempo y render no se demuestra mediante
estos tests aislados. No se marca satisfecho por ausencia de dependencias.

Inspección directa de `frontend/src/juego/game-state-coordinator.js:12`, `:41`
y `:44`: el módulo lee el reloj inyectado, almacena vencimiento y entrega una
closure; no importa un scheduler ni llama setTimeout/setInterval. La ejecución
de las pruebas nuevas avanza una variable numérica (`preparar`, línea 5 del
archivo de pruebas), sin temporizadores reales. Los tests históricos conservan
su metodología independiente, incluido reloj simulado de TC-FSM-007.

La evidencia vida/vivo es aportada por un llamador confiable. La closure impide
crear un LOSE autorizado mediante un simple evento/bandera pública, pero no
autentica que un llamador que accede a programarDerrota represente daño real.
Integración futura deberá limitar ese registro al camino legítimo de muerte.

El reloj inyectado supone avance monotónico y milisegundos; la validación finita
no garantiza monotonicidad de una dependencia externa. Una función de reloj que
lanza excepciones está fuera del contrato. En navegador oculto no debe exigirse
ejecución física exacta a 1500 ms: solo no finalizar antes del vencimiento y
resolver cuando se ejecute el callback autorizado.

Pendiente, sin ejecutar: regresión de pointer lock/visibilidad, escritorio/táctil,
continuidad de instancia/progreso de ambas cinemáticas, orden de cámara/diálogo,
render continuo y efectos terminales reales. Corresponde a CA-FSM-006/007 y
RNF-004. Requiere autorización de integración; este resultado no aprueba ADR-002
ni sustituye revisión humana del diff.
