# FSM-006 — Adaptadores aislados y criterios de integración simulada

**Estado:** Alcance local autorizado: archivos nuevos de adaptadores, pruebas y documentación.
**Política:** POL-FSM-001 alternativa A confirmada; ADR-001 y ADR-002 siguen propuestos.
**Límite:** Ninguna modificación ni integración en `frontend/src/main.js`.

## 1. Política, comportamiento observado y objetivo

Una derrota programada por muerte legítima conserva su vencimiento durante
pausa y se resuelve al ejecutarse el callback autorizado. Una solicitud arbitraria
desde pausa continúa rechazada. Muerte lógica inmediata y presentación final
diferida son etapas distintas; la política no habilita una derrota inmediata nueva.

| Observado en el juego actual | Objetivo del adaptador aislado |
|---|---|
| Daño acumulado o mortal reduce vida; al llegar a cero llama a muerte (`frontend/src/main.js:369`, `:380`). El frío también puede hacerlo (`:575`, `:581`). | Simular daño y registrar la transición vivo→muerto una sola vez; enlazar con programación del coordinador, sin afirmar ejecución de combate/frío reales. |
| Muerte marca jugador no vivo, inicia animación/sonido y programa finalización a 1500 ms (`main.js:384`). | Scheduler inyectado programa resolución; el deadline original no cambia por pausa/reanudación ni callback prematuro. |
| Finalizar comprueba terminal antes de modificar estado/salir de puntero/presentar resultado (`main.js:402`). | Establecer estado terminal aceptado antes de efectos; no ejecutar efectos por rechazos o callbacks duplicados. |
| El tiempo de partida/jugador solo avanzan jugando; entorno/render continúan (`main.js:690`, `:714`, `:728`). | Preservación pendiente; no hay adaptador de cuadro ni evidencia nueva de render en FSM-006. |
| `cine.actualizar` se detiene en pausa; al terminar limpia escena y restaura cámara/diálogo (`main.js:719`). | Rechazar fin de cine desde terminal sin efectos de transición. Conservación de instancia/progreso pendiente; el módulo no actualiza escenas. La guarda local no demuestra equivalencia de gameplay. |

El comportamiento observado de finalización de cine comprueba solo no pausa:
una terminación tardía podría asignar jugando después de un terminal. Su
alcanzabilidad real no se ha demostrado. Proteger terminal en el adaptador es
un contrato local adicional; trasladarlo a gameplay requiere revisión posterior.

## 2. Responsabilidades y contrato temporal

La FSM pura valida transiciones y el coordinador conserva autorización/consumo
(`frontend/src/juego/game-state-coordinator.js:23`, `:44`). Los adaptadores nuevos
conectan colaboradores simulados, scheduler y efectos. No alteran esos módulos.

El reloj y scheduler deben compartir escala de milisegundos y avanzar de forma
coherente. El deadline de derrota es instante de programación más 1500 ms.
El scheduler puede invocar un callback antes o después de lo solicitado: el
adaptador comprueba el reloj; un callback prematuro no finaliza ni consume
autorización y agenda un reintento por el tiempo restante, sin fijar un nuevo
deadline de 1500 ms. Al cumplirse el plazo se intenta resolver la capacidad.

Solo una resolución aceptada autoriza efectos finales. El estado terminal debe
ser observable antes del primer efecto, también ante reentrada de un colaborador.
Un rechazo no produce sonido, pantalla final, persistencia, salida de puntero ni
restauración de cámara/diálogo de una finalización no aceptada. Programar una
muerte válida sí puede iniciar sus propios efectos de muerte lógica; no deben
confundirse con efectos finales.

Duplicados, reinicio y callbacks obsoletos no afectan a la partida actual. La
invalidación de capacidades del coordinador es la protección funcional; cancelar
un timer puede ahorrar trabajo, pero no reemplaza comprobar vigencia y aceptación.
No se garantiza ejecución física exactamente a 1500 ms: el navegador puede
retrasar callbacks, especialmente en segundo plano.

## 3. Criterios nuevos de aceptación del adaptador

Estos criterios hacen verificable el alcance simulado y no sustituyen los
CA-POL-001 a 006 originales.

| ID | Criterio | Verificación prevista |
|---|---|---|
| CA-ADAPT-001 | Daño simulado no letal no programa derrota; una transición simulada vivo→muerto programa una sola resolución e inicia efectos de muerte una sola vez. Daño posterior no repite programación. | Colaboradores de jugador/muerte y scheduler inyectados; verificar llamadas y estado. |
| CA-ADAPT-002 | Callback antes del deadline conserva pendiente, agenda el restante y no ejecuta efectos finales. A 1499 ms sigue sin derrota; al vencimiento o después resuelve una sola vez. | Reloj controlado y scheduler capturable; comprobar retrasos solicitados y duplicados. |
| CA-ADAPT-003 | Pausar y reanudar conserva deadline original. Derrota pendiente vence durante pausa sin reanudar primero. Evento LOSE genérico o contexto falsificado no produce efectos. | Secuencias con callbacks y espías de efectos. |
| CA-ADAPT-004 | Estado terminal queda publicado antes de efectos finales. Reentrada, duplicación o callback antiguo no repite finalización ni sobrescribe victoria. | Efecto que consulta estado/reentra y callback de partida anterior. |
| CA-ADAPT-005 | Finalizar cine desde cinematica acepta transición y permite efectos; desde pausa o terminal rechaza, no reabre juego ni ejecuta efectos de fin. | Eventos y espías de efectos: alcance implementado. Conservar instancia/progreso, detener cine.actualizar y restaurar cámara/diálogo reales son objetivos pendientes fuera del alcance implementado. |
| CA-ADAPT-006 | Propuesto pendiente, fuera del alcance implementado: cuadro en pausa no incrementa tiempo de partida ni actualiza jugador, pero conserva render y actualizaciones permitidas. | Requiere un futuro harness o integración de cuadro; no hay API ni evidencia nueva en FSM-006. |

## 4. Estado de los criterios originales y trazabilidad

| Criterio original | Aporte FSM-006 y límite |
|---|---|
| CA-POL-001: muerte legítima crea pendiente; no letal no | CA-ADAPT-001 verifica conexión desde daño **simulado**. El origen real desde combate/frío y el punto de llamada de producción siguen pendientes. |
| CA-POL-002: muerte→pausa→vencimiento, efectos únicos | CA-ADAPT-002/003/004 verifican scheduler/efectos sustituidos. No certifican listeners, HUD ni audio reales. |
| CA-POL-003: plazo original sin pausa o con reanudación | CA-ADAPT-002/003 cubren el ciclo con reloj/scheduler inyectados; planificación del navegador permanece pendiente. |
| CA-POL-004: solicitudes sin autorización, prematuras u obsoletas rechazadas | CA-ADAPT-002/003/004 complementan capacidades del coordinador; datos suministrados por llamador confiable no autentican daño real. |
| CA-POL-005: terminales protegidos y efectos sin duplicación | CA-ADAPT-004/005 verifican efectos sustituidos y rechazo del evento de cine residual; equivalencia de efectos reales y alcanzabilidad pendientes. |
| CA-POL-006: pausa detiene jugador/tiempo y mantiene render permitido | Pendiente: CA-ADAPT-006 es propuesta sin implementación ni prueba de cuadro. FSM-006 no aporta evidencia nueva de este criterio. No declarar completo hasta integración y regresión del juego real. |

Trazabilidad SRS: RF-001 inicio/reinicio (`docs/requirements/SRS.md:50`), RF-002
control/pausa (`:51`), RF-005 daño/muerte (`:54`), RF-006 terminal y progresión
(`:55`); RNF-002 interfaces (`:74`), RNF-003 pruebas reproducibles (`:78`),
RNF-004 plataformas (`:82`), restricciones de compatibilidad/gameplay (`:87`).
El SRS sigue borrador y sus RF siguen «Por verificar». La relación de esta tabla
no aprueba requisitos generales ni convierte una prueba simulada en aceptación
de gameplay.

## 5. API y evidencia de implementación

Interfaz inspeccionada en `frontend/src/juego/game-state-adapters.js:8`:
`crearAdaptadores({ ahora, programar, cancelar, efectos = {} })`, con un
coordinador interno. No existe integración en `main.js`.

| API | Responsabilidad prevista |
|---|---|
| `getEstado()` | Leer estado del coordinador interno. |
| `despachar(evento, contexto)` | Aplicar transición; rechazos no ejecutan efectos. Una aceptación no terminal notifica `efectos.transicion`; terminal publica estado, limpia recursos y luego notifica `efectos.terminal`. |
| `programarDerrota(evidencia)` | Registrar vida/vivo declarados, iniciar efecto `efectos.muerte` y scheduler; mantener callbacks/capacidades privados. No autentica daño real. |
| `perderPuntero()` | Adaptar pérdida de puntero a pausa según estados permitidos. |
| `finalizarCinematica()` | Intentar fin de cinemática conservando guardas; desde terminal no reabre juego ni ejecuta efectos. |
| `reiniciarPartida()` | Invalidar ciclo anterior y callbacks; no cambiar la UI de reinicio real del juego. |
| `destruir()` | Invalidar adaptador y callbacks pendientes; nuevas operaciones se rechazan. |

`programar(callback, retrasoMs)` y `cancelar(handle)` son dependencias de
scheduler. Un callback prematuro rearma el restante con mínimo de 1 ms; los
callbacks obsoletos/duplicados se rechazan con `CALLBACK_NO_VIGENTE`. Un adaptador
destruido rechaza con `ADAPTADOR_DESTRUIDO`. Estos resultados no ejecutan efectos.
El helper de daño de QA es un productor simulado de evidencia, no una sustitución
implementada del combate real. La nueva guarda de cine terminal es del adaptador
aislado; no se implementó un cambio de gameplay.

Las tres dependencias reloj/scheduler/cancelación son obligatorias y deben ser
funciones; la construcción inválida lanza `TypeError` (`game-state-adapters.js:9`).
El scheduler debe ser asíncrono y respetar la unidad milisegundos. Los efectos son
colaboradores síncronos confiables que no lanzan; no se garantiza recuperación
ante excepciones de dependencias.

Evidencia: aplicar efectos solo tras aceptación y estado ya publicado (`:32`);
versionar callbacks y reintentar exclusivamente DERROTA_NO_VENCIDA (`:50`);
devolver programación sin exponer resolver (`:75`); pérdida de puntero con guarda
de jugando/cinematica (`:94`); fin de cine mediante transición validada (`:102`);
reinicio y destrucción limpian tarea (`:108`, `:115`). Reiniciar/destruir no
notifican efectos de transición ni terminales.

El wrapper toma una muestra de reloj antes de programar en el coordinador; su
`vence` orienta el reintento, mientras la closure del coordinador decide el
vencimiento real. La diferencia entre muestras no permite finalizar temprano:
el reintento usa mínimo 1 ms y vuelve a validar. Ante RELOJ_INVALIDO, estado
inválido u otro rechazo distinto de prematuro se limpia tarea y no se reintenta
(`:66`). La pendiente del coordinador puede permanecer hasta reinicio/terminal;
no se promete recuperación automática de una dependencia defectuosa.

No hay API de instancia de cinemática, daño o cuadro en el módulo. El daño se
representa por evidencia declarada; finalizarCinematica protege
el estado y evita efectos de fin rechazado, pero por sí solo no impide que un
llamador externo actualice una escena residual. CA-ADAPT-005 solo verifica la
guarda de evento/efectos; continuidad de instancia y CA-ADAPT-006 siguen pendientes,
sin declarar cobertura de gameplay ni inventar un adaptador de cuadro.

## 6. Resultados y revisión

Evidencia de pruebas nuevas inspeccionadas en
`frontend/tests/game-state-adapters.test.js`: doble de daño explícitamente
simulado (`:39`), TC-ADAPT-001 daño/evidencia (`:56`), scheduler y plazo
TC-ADAPT-002/003/004 (`:74`, `:85`, `:98`), duplicados y ciclos
TC-ADAPT-005/006/007 (`:115`, `:126`, `:146`), publicación terminal previa
TC-ADAPT-008 (`:157`), cine residual TC-ADAPT-009 (`:173`), rechazos sin efectos
TC-ADAPT-010 (`:193`) y aislamiento entre instancias TC-ADAPT-011 (`:206`).
Esta enumeración describe inspección de casos, no una ejecución satisfactoria.
TC-ADAPT-009 comprueba terminales y fin aceptado; rechazo de fin desde pausa
se deduce de la transición delegada y de la tabla FSM, no de ese caso específico.

El [informe QA FSM-006](../quality/fsm-006-test-results.md) registra ejecución
real: 174 pruebas aprobadas en cinco archivos y build exitoso, con advertencia
de tamaño de chunks. Incluye 12 casos de adaptadores y separa la línea base
histórica FSM-004. Estos resultados corresponden a módulos y colaboradores
simulados; no se ejecutó regresión del gameplay real ni validación de navegador.
No se atribuyen resultados históricos FSM-002/FSM-004 a los adaptadores nuevos.

## 7. Riesgos y decisiones pendientes

- Integración en main, punto real de daño de combate/frío y orden de efectos
  reales necesitan aprobación posterior; el alcance actual solo añade archivos.
- Política de concurrencia entre cambio de nivel asíncrono, muerte pendiente,
  reinicio, victoria y callbacks: no resuelta por POL-FSM-001. No asumir que un
  cambio de nivel equivale a nueva partida ni inventar prioridad de resultados.
- Cine residual en terminal tiene guarda local; probar su alcanzabilidad y
  validar la conducta deseada antes de trasladarla al bucle real.
- Reentrada y excepciones de colaboradores requieren contrato explícito;
  una publicación terminal previa evita reapertura pero no garantiza completar
  efectos posteriores si un colaborador lanza.
- Scheduler síncrono que ignora el retraso puede provocar reintentos inmediatos;
  documentar dependencia confiable y límites, sin prometer robustez universal.
- Navegador oculto, pointer lock, táctil, continuidad visual y audio requieren
  pruebas de plataforma; ausencia de dependencias de navegador no las sustituye.
- ADR-001/002 siguen propuestos. No cambiar gameplay ni aprobar integración
  por resultados de estas simulaciones.
