# Coordinador aislado de derrota programada — FSM-004

**Estado:** Contrato local autorizado para implementación aislada; integración pendiente.
**Referencia de inspección:** rama `dev/jesus`, commit `8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`, más cambios locales FSM-002.
**Decisión funcional:** POL-FSM-001, alternativa A confirmada por el usuario.
**Decisiones arquitectónicas:** ADR-001 y ADR-002 continúan **Propuestos**.

## 1. Política aprobada y alcance

POL-FSM-001: una derrota legítimamente programada tras daño letal se resuelve
aunque el jugador haya pausado antes de su vencimiento. La pausa no cancela ni
reinicia su plazo. Una petición arbitraria de derrota desde pausa permanece
rechazada. Esta política no autoriza derrota inmediata por una nueva ruta de
gameplay ni aprobación de integración en `main.js`.

FSM-004 implementa un coordinador aislado con procedencia y consumo internos.
La FSM pura conserva su tabla: `jugando + LOSE` es válido, `pausa + LOSE` sigue
rechazado (`frontend/src/juego/game-state-machine.js:20`, `:30`). El coordinador
añade restricciones locales: su API genérica rechaza `LOSE` incluso durante
juego y reserva la resolución a una capacidad emitida al programar la muerte.
Esta diferencia es deliberada en el contrato local; no cambia el juego, que
continúa usando las funciones existentes sin integrar ninguno de los módulos.

## 2. Evidencia del comportamiento actual

| Hecho observado | Evidencia |
|---|---|
| Daño letal por combate incluye indicador `mortal` y daño acumulado que lleva vida a cero. | `frontend/src/main.js:369`, `:372`, `:380`. |
| El frío también puede llevar vida a cero y llama a la misma función de muerte. | `frontend/src/main.js:575`, `:581`. |
| La muerte lógica marca `vivo = false`, inicia animación/sonido y programa finalizar derrota con retraso 1500 ms. | `frontend/src/main.js:384`. |
| Pausar cambia estado y UI, sin cancelar temporizador. | `frontend/src/main.js:130`. |
| Finalizar protege victoria/derrota, sale de puntero y presenta pantalla final; la rama de victoria tiene efectos propios. | `frontend/src/main.js:402`. |
| El botón reanuda según instancia de cinemática; desde terminal recarga. | `frontend/src/main.js:153`. |
| El tiempo de partida y jugador solo avanzan jugando; el render continúa. | `frontend/src/main.js:690`, `:728`. |

La preservación futura comprende las dos fuentes de muerte existentes: combate
y frío. No debe confundirse muerte lógica inmediata con pantalla final diferida.
El callback de `setTimeout` puede ejecutarse después del retraso solicitado por
planificación del navegador; no se promete una precisión física de 1500 ms.

## 3. Responsabilidades y límites

El coordinador mantiene estado local y una única pendiente de la partida actual.
Un reloj inyectado permite verificar vencimiento sin navegador. No registra un
temporizador real ni modifica DOM, sonido, jugador, almacenamiento, cámara o
Three.js. El llamador debe invocar la capacidad al vencer el plazo; el módulo no
finaliza automáticamente por el mero avance del reloj.

`programarDerrota({ vida, vivo })` acepta evidencia de datos solo con
vida numérica finita menor o igual a cero, `vivo === false`, estado local jugando
y ninguna pendiente vigente. Aceptar valores negativos es tolerancia del contrato
local; los caminos observados del juego limitan la vida a cero.
Esto NO demuestra que hubo daño real: un llamador puede fabricar esos datos.
Sin integración y control del punto de llamada en `main.js`, la garantía es de
ciclo interno de programación/resolución, no autenticidad de daño o seguridad
frente a código que ya puede invocar la API de programación.

La capacidad de resolución es una closure opaca asociada a token privado. No se
expone token en logs ni resultados serializables. Su tenencia autoriza intentar
resolver la pendiente concreta; no reemplaza validación de origen real del daño.
El contexto libre o un booleano enviado a la API genérica no crea una pendiente.

## 4. Interfaz y ciclo de vida local

Interfaz implementada en `frontend/src/juego/game-state-coordinator.js:6`:
`crearCoordinador({ ahora = () => globalThis.performance.now() } = {})` devuelve
`getEstado()`, `despachar(evento, contexto)`,
`programarDerrota({ vida, vivo })` y `reiniciarPartida()`.

Los éxitos incluyen `{ aceptada: true, estado }`; programar añade `resolver`.
Los rechazos devuelven `{ aceptada: false, estado, motivo }` y conservan estado.
`getEstado()` devuelve la cadena actual. La instancia empieza en cargando y
`reiniciarPartida()` vuelve a cargando (`game-state-coordinator.js:7`, `:63`).

El reloj inyectado debe ser función confiable, finita y no decreciente. El módulo
rechaza lecturas no finitas o un reloj que no sea función con `RELOJ_INVALIDO`,
pero no registra historial para detectar retrocesos; esa condición corresponde
al adaptador. Funciones de reloj que lanzan y getters/proxies hostiles quedan
fuera del contrato de datos ordinarios. El valor predeterminado usa reloj
monotónico `performance.now`; su disponibilidad debe verificarse en plataformas
objetivo antes de integrar.

| Operación | Precondición / responsabilidad | Resultado funcional |
|---|---|---|
| Crear coordinador con reloj inyectado | Reloj confiable expresado en milisegundos; instancia representa una partida local. | Estado inicial cargando y ninguna pendiente. |
| Enviar evento genérico | Validación de evento/contexto del módulo puro; `LOSE` prohibido en esta entrada en todo estado. | Aplicar transición aceptada o conservar estado ante rechazo; no crear capacidades por contexto. |
| `programarDerrota({ vida, vivo })` | Jugando, evidencia finita de vida <= 0, vivo false y ausencia de pendiente. | Guardar partida y vencimiento a 1500 ms, con jugando como origen autorizado; emitir closure de resolución vinculada a la partida. |
| Invocar closure antes del vencimiento | Pendiente vigente, aún no vencida. | Rechazar sin consumir pendiente; puede reintentarse al vencer. |
| Invocar closure vencida desde jugando o pausa | Misma partida, pendiente vigente y no consumida, plazo cumplido. | Calcular destino usando `LOSE` del origen jugando guardado; alcanzar derrota y consumir autorización una sola vez. |
| Invocar closure obsoleta/consumida | Reinicio, terminal o consumo anterior invalidan su autorización. | Rechazar conservando estado; sin segunda finalización. |
| Alcanzar un estado terminal | Victoria o derrota aceptada por una ruta autorizada. | Invalidar pendientes; ningún callback tardío sobrescribe el resultado. |
| `reiniciarPartida` | Reinicio explícito del ciclo local. | Invalidar pendientes y closures previas; nueva partida sin autorización heredada. No implica recargar navegador. |

La resolución desde pausa utiliza la transición pura del origen guardado; no
añade `pausa + LOSE` a la FSM. Esta excepción queda encapsulada y solo puede
aplicarse tras comprobar procedencia interna, vigencia, plazo y consumo.

| Motivo de rechazo | Condición / evidencia de implementación |
|---|---|
| DERROTA_NO_AUTORIZADA | `despachar('LOSE', ...)` en todo estado; `game-state-coordinator.js:25`. |
| TRANSICION_NO_PERMITIDA | Programar fuera de jugando; resolver desde estado distinto de jugando/pausa, o rechazo heredado de FSM; `:26`, `:30`, `:51`. |
| EVIDENCIA_MUERTE_INVALIDA | Objeto de evidencia inválido, vida no finita/positiva o vivo distinto de false; `:31`. |
| DERROTA_YA_PENDIENTE | Programación válida adicional con pendiente vigente; `:35`. |
| RELOJ_INVALIDO | Lectura no finita o vencimiento no finito; `:37`, `:48`. |
| DERROTA_NO_VIGENTE | Closure de partida anterior, consumida o invalidada por terminal; `:45`. |
| DERROTA_NO_VENCIDA | Closure vigente invocada antes del plazo; `:50`. |

Los motivos de contexto del módulo puro se conservan en eventos genéricos
distintos de LOSE. El futuro adaptador solo deberá ejecutar efectos finales tras
una resolución con `aceptada: true`; los rechazos no autorizan presentación.
El coordinador no contiene callbacks de efectos de UI.

## 5. Criterios derivados y trazabilidad

La política está confirmada; los criterios siguientes formalizan el contrato
local autorizado. No declaran verificados ni aprobados los requisitos generales
del SRS, aún borrador (`docs/requirements/SRS.md:4`, `:48`, `:100`).

| ID | Criterio verificable | Trazabilidad / método previsto |
|---|---|---|
| CA-POL-001 | Una muerte legítima por daño letal crea una única resolución pendiente; daño no letal no la crea. El coordinador solo comprueba evidencia finita vida <= 0/vivo false, jugando y ausencia de pendiente: es evidencia parcial del criterio, no validación del origen real de daño. | RF-005; `main.js:372`, `:380`, `:581`; validación de datos implementada y probada localmente; conexión a muerte legítima pendiente de integración. |
| CA-POL-002 | Programar, pausar y avanzar reloj 1499 ms conserva pausa; intento prematuro no consume capacidad; al llegar al vencimiento e invocarla, produce derrota una sola vez. | POL-FSM-001; RF-002/005; pruebas con reloj inyectado. |
| CA-POL-003 | Sin pausa, o pausando/reanudando antes del vencimiento, conservar la misma pendiente y vencimiento original; no adelantar pantalla final por muerte lógica. | RF-002/005; `main.js:153`, `:384`; secuencias temporales. |
| CA-POL-004 | `LOSE` genérico, incluso con supuesto permiso en contexto, no produce derrota en el coordinador. Pendientes de otra partida o ya consumidas no cambian estado. La FSM pura conserva sus reglas previas. | RF-001/002; contrato de procedencia; pruebas negativas de ambas APIs y reinicio. |
| CA-POL-005 | Tras victoria o derrota, callbacks tardíos y duplicados no sobrescriben estado ni vuelven a autorizar finalización. Reiniciar invalida closures antiguas. | RF-001/006; `main.js:403`; secuencias terminales/reinicio. |
| CA-POL-006 | La pausa conserva sus efectos actuales: no avanzan jugador ni tiempo de partida; render y actualizaciones permitidas continúan. Resolver derrota no modifica estas reglas. | RF-002; `main.js:690`, `:714`, `:728`; pendiente de verificación de integración y regresión. El aislamiento local solo aporta evidencia parcial; no prueba conservación de gameplay. |
| CA-COORD-001 | El coordinador opera sin navegador/Three.js ni temporizadores globales, no muta evidencia recibida y no ejecuta efectos de presentación. | RNF-002/003; `SRS.md:74`, `:78`; criterio local de aislamiento, distinto de CA-POL-006; evidencia ejecutada en informe QA. |

| Requisito SRS | Relación con la política |
|---|---|
| RF-001 (`SRS.md:50`) | Inicio/reinicio sin callbacks pertenecientes a partidas anteriores. El reinicio local es distinto de la recarga actual. |
| RF-002 (`SRS.md:51`) | Pausa/reanudación conserva pendiente y plazo; no autoriza muerte arbitraria. |
| RF-005 (`SRS.md:54`) | Resultado diferido tras muerte por daño letal; el frío comparte la función de muerte aunque no sea combate. |
| RF-006 (`SRS.md:55`) | Proteger victoria terminal y estudiar cambios de nivel antes de integrar; no se modifica progresión. |
| RNF-002/003 (`SRS.md:74`, `:78`) | Separar transición, autorización temporal y efectos; verificar secuencias deterministas. |
| RNF-004 (`SRS.md:82`) | Validación real de navegadores y planificación de callbacks sigue pendiente. |
| Restricciones (`SRS.md:87`) | Preservar comportamiento y exigir regresión antes de modificar gameplay. |

## 6. Verificación y resultados

El [informe QA FSM-004](../quality/fsm-004-test-results.md) registra los casos,
comandos, entorno, resultados y limitaciones de la ejecución real: 162 pruebas
aprobadas en cuatro archivos y build exitoso. Ese resultado verifica el alcance
aislado descrito por QA; CA-POL-001 sigue parcial respecto del origen de daño real
y CA-POL-006 sigue pendiente de verificación de integración.
Los resultados históricos FSM-002 (`game-state-machine.md:141`) no verifican este
nuevo coordinador. TC-FSM-007 existente extrae funciones reales y usa
colaboradores sustituidos (`frontend/tests/game-state-characterization.test.js:23`);
no inicializa listeners ni demuestra integración de este coordinador.

Los aspectos locales de CA-POL-001 a 005 y CA-COORD-001 se verifican con reloj
inyectado junto con pruebas existentes de la FSM; el alcance y los límites están
en el informe QA. Una implementación local correcta no demuestra conservación
de los efectos del juego ni evita que un futuro adaptador programe desde una
fuente incorrecta. Tras cambios autorizados: `npm test` y `npm run build` desde
`frontend/`, y presentación del diff para revisión.

## 7. Decisiones pendientes y riesgos

- Integración, punto exacto de programación después de muerte lógica, conexión
  del callback real y orden de efectos requieren revisión humana posterior.
- Rechazar `LOSE` genérico en el coordinador es una restricción local nueva;
  no eliminar la transición pura existente ni introducir una derrota inmediata
  de gameplay sin aprobación específica.
- Los datos vida/vivo son evidencia declarada, no procedencia demostrada. No
  presentar este componente como autenticación ni como frontera de seguridad.
- El reloj debe ser confiable y coherente; una integración debe acordar su
  origen y no reprogramar por pausa. La pestaña suspendida puede retrasar ejecución.
- Cambios de nivel, cierre y destrucción del futuro adaptador requieren definir
  invalidación del ciclo; no se asume que cambiar nivel equivale a nueva partida.
- El módulo no conserva la instancia de cinemática ni efectos de UI; los
  criterios de integración CA-FSM-006/007 permanecen pendientes.
- No aprobar ADR-002 ni modificar `main.js`, dependencias o gameplay mediante
  este documento. No interpretar pruebas aisladas como regresión de navegador.
