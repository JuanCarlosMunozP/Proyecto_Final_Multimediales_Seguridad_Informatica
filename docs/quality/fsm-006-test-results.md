# FSM-006 — QA de adaptadores aislados

Fecha: 2026-11-06. Rama `dev/jesus`; HEAD de referencia
`8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`. Validación del árbol de trabajo
con cambios locales, sin nuevo commit. Aplicados `agents/qa-engineer.md` y
`skills/software-testing/SKILL.md`. Sin instalaciones ni cambios de QA en main.js.

## Ejecución real

Desde `frontend/`, Windows PowerShell; Node.js v26.13.0, npm 11.14.1,
Vitest 5.1.0 y Vite 8.3.5. Se usó npm.cmd sin cambiar política de PowerShell.

| Comando final | Resultado observado |
|---|---|
| `npm.cmd test` | Código 0, 5 archivos aprobados, 174 pruebas aprobadas; 357 ms. Sin fallos ni omitidos reportados. |
| `npm.cmd run build` | Código 0, 49 módulos transformados; 371 ms. Bundle principal 750.00 kB; gzip 202.32 kB. |

Advertencia real: chunks superiores a 500 kB tras minificación. No se cambió
configuración para ocultarla. El build genera artefactos en dist/. La cuenta
final es 105 FSM pura + 46 coordinador + 7 caracterización + 4 datos + 12
adaptadores = 174. Las 162 anteriores son la línea base histórica FSM-004.
Se ejecutaron comprobaciones preliminares de 172 antes de ampliar escenarios;
la ejecución final de 174 corresponde a los tests actuales.

`git diff --check`: código 0, sin errores de whitespace; avisos Git de futura
conversión LF a CRLF en archivos del árbol. Para los nuevos tests y este informe
se ejecutó además `git diff --no-index --check -- NUL <archivo>`: código 1 por
las diferencias de un archivo nuevo frente a NUL, sin diagnósticos de whitespace;
solo avisos LF/CRLF. El check ordinario no incluye archivos sin seguimiento.

## Método y casos

Fuente: `frontend/tests/game-state-adapters.test.js`. Scheduler manual que guarda
tareas y permite entregar callbacks prematuros, repetidos o cancelados; reloj
numérico inyectado. No se usan temporizadores reales, DOM ni navegador. Los
adaptadores y su coordinador son reales; efectos y daño son dobles explícitos.
Un helper simula la pérdida de vida; no ejecuta `danar` de main.js.

Todos los casos siguientes fueron **aprobados** en el entorno anterior; el
resultado observado coincidió con el esperado. IDs relacionados son criterios
locales; no elevan RF ni ADR propuestos a aprobación de integración.

| ID | Casos | Requisito / criterio | Precondiciones, entrada y pasos | Resultado esperado y real |
|---|---:|---|---|---|
| TC-ADAPT-001 | 1 | RF-005; CA-POL-001 parcial | Juego; doble de jugador vida10; daño3, daño7 y repetido; evidencia no mortal y registro duplicado directos. | Daño no letal no agenda; muerte agenda1500 una vez; duplicado rechazado; un efecto muerte, cero terminal; aprobado. |
| TC-ADAPT-002 | 1 | CA-POL-002 | Muerte válida; perder puntero; avanzar1500; entregar tarea. | Derrota desde pausa sin reanudar y un efecto terminal; aprobado. |
| TC-ADAPT-003 | 1 | CA-POL-003 | Muerte; pausa a700; reanudar a1400; entregar a1500. | Una tarea con vencimiento original; no desplazar plazo; aprobado. |
| TC-ADAPT-004 | 1 | CA-POL-002/004 | Entregar tarea a1499, repetir callback antiguo, avanzar1 y entregar reintento. | Temprano rechazado; reintento solo1ms; callback viejo no vigente y no duplica tareas; un efecto muerte; derrota al vencer; aprobado. |
| TC-ADAPT-005 | 1 | CA-POL-004/005 | Entregar dos veces mismo callback vencido. | Primera aceptación; segunda CALLBACK_NO_VIGENTE; un efecto terminal; aprobado. |
| TC-ADAPT-006 | 1 | RF-001; CA-POL-004/005 | Muerte; reinicio; nueva partida/muerte; entregar tarea vieja; destruir y entregar nueva cancelada. | Cancelación solicitada e invalidación efectiva aunque scheduler entregue callback; sin terminal; API destruida rechaza; aprobado. |
| TC-ADAPT-007 | 1 | RF-006; CA-POL-005 | Muerte pendiente; WIN; entregar callback cancelado y repetir WIN. | Victoria única, tarea cancelada, muerte tardía no sobrescribe; aprobado. |
| TC-ADAPT-008 | 1 | CA-POL-005; orden externo | Efecto terminal consulta estado y simula pérdida de puntero reentrante. | Estado derrota publicado antes del efecto; pérdida de puntero no pausa ni emite transición; aprobado. |
| TC-ADAPT-009 | 2 | CA-FSM-006/007 parcial | Cine válido termina; alcanzar victoria o derrota; entregar finalización residual. | Cine válido emite transición CINEMATIC_END; residual rechazado en ambos terminales sin efectos de cine ni reapertura; aprobado. |
| TC-ADAPT-010 | 1 | CA-FSM-003/004; POL A | Eventos LOSE/heredados/coercibles, contexto null, evidencia no mortal y fin cine desde juego. | Rechazos sin efectos, tareas ni cambios de estado; aprobado. |
| TC-ADAPT-011 | 1 | CA-POL-004 | Dos instancias; callback de A invocado con this B y argumento externo. | Solo A finaliza; B conserva estado y no recibe tareas/efectos; aprobado. |

## Alcance y límites

Integración **simulada entre módulos nuevos**, no integración del videojuego:
ningún adaptador está conectado a main.js. Los espías terminal/muerte/transición
demuestran entrega de efectos únicos en las secuencias ensayadas; no prueban
HUD/audio/persistencia/escena final reales. `perderPuntero` es una llamada directa,
no un evento browser real. El caso de cine comprueba estados y entrega de efectos,
no conservación de instancia, progreso, cámara ni diálogo real.

CA-POL-001 sigue parcial: falta demostrar que únicamente daño mortal legítimo
del juego registra la muerte. CA-POL-006 y CA-FSM-006/007 siguen pendientes en
lo referido a jugador, tiempo, render, cinemáticas y efectos reales. Sin pruebas
de navegador, escritorio/táctil, visibilidad, permisos de puntero/pantalla completa,
throttling real ni medición de cobertura de líneas/ramas.

El reloj debe ser monotónico y en milisegundos; scheduler confiable asíncrono
(no ejecutar callback dentro de programar) y efectos que no lancen excepciones.
Fuera del camino normal, un rechazo por reloj roto o estado de cine limpia la
tarea del adaptador sin reintento automático: no se afirma recuperación de esas
dependencias. El coordinador puede conservar pendiente hasta reinicio; cualquier
política de recuperación requiere decisión explícita. Una pestaña suspendida
puede retrasar ejecución; no se promete precisión física de1500ms.

La aprobación de estos tests no aprueba migración, gameplay ni ADR-002. Antes
de integrar se requiere revisión humana del diff y plan de navegador real.
