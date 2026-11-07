# FSM-008 — Recuperación técnica de adaptadores aislados

**Estado:** Cambio técnico aislado autorizado; integración y ADR-002 pendientes.
**Política funcional vigente:** POL-FSM-001 alternativa A, confirmada por el usuario.
**Alcance:** Recuperar fallos de dependencias sin modificar `main.js`, estados ni
orígenes autorizados de derrota. No constituye aprobación de cambios de gameplay.

## 1. Línea base y restricciones

El juego actual inicia muerte lógica y programa derrota diferida con 1500 ms
(`frontend/src/main.js:384`); pausar no cancela ese temporizador (`:130`). El
coordinador aislado solo resuelve una pendiente vigente, vencida y originada en
jugando, estando actualmente en jugando o pausa
(`frontend/src/juego/game-state-coordinator.js:34`, `:54`).

La recuperación técnica debe conservar esa partida y el vencimiento original.
Pausar no cancela ni reinicia el plazo. Un evento LOSE genérico continúa rechazado
(`game-state-coordinator.js:30`). Recuperar no crea nueva muerte ni prueba origen
real de daño: los datos vida/vivo siguen siendo evidencia declarada.

No se permite resolver derrota desde cinematica ni introducir un nuevo estado
como error/recuperación. Un registro técnico de fallo no es un estado de gameplay.
La API de recuperación, si existe, solo reintenta trabajo autorizado que conserva
vigencia; no debe sustituir la comprobación final del coordinador.

## 2. Diagnóstico por fallo y resultado requerido

| Fallo | Diagnóstico mínimo | Recuperación técnica y límite |
|---|---|---|
| Scheduler lanza en programación inicial | Identificar fallo inicial de agenda y si ya existe pendiente interna. | Conservar capacidad/partida/deadline y permitir reintentar agenda sin registrar otra muerte. No dejar callback parcial aceptable si fue entregado antes del error. |
| Scheduler lanza al rearmar callback prematuro | Identificar fallo de reintento y pendiente vigente. | Recuperar el restante del plazo original; nunca otros 1500 ms desde recuperación. Versionar callbacks para rechazar entregas obsoletas. |
| Cancelación lanza | Registrar fallo de cancelación sin confundirlo con transición rechazada. | Invalidar autorización del callback antes de cancelar; callback entregado pese al fallo debe ser inocuo. Continuar limpieza/efectos autorizados según contrato. |
| Reloj lanza o entrega dato inválido | Distinguir fallo de lectura de una solicitud no autorizada. | No consumir pendiente ni finalizar antes de poder comprobar vencimiento. Reintentar solo con reloj coherente restaurado; conservar deadline/partida. |
| Reentrada durante dependencia o efecto | Identificar operación ocupada o callback obsoleto. | Impedir que trabajo antiguo sobrescriba recursos del ciclo vigente; publicar terminal antes de efectos y proteger reinicio/destrucción. |
| Efecto de muerte, transición o terminal lanza | Identificar clase de efecto fallido y aceptación previa. | No revertir estado ni repetir automáticamente un efecto cuyo avance parcial se desconoce. Garantía de intento como máximo una vez por aceptación, no finalización exactamente una vez. |

Un resultado aceptado con diagnóstico puede significar transición realizada pero
dependencia fallida; no debe confundirse con rechazo sin efectos. Los motivos,
campos y precedencias exactos deben coincidir con la API implementada.

## 3. Efectos parciales y ausencia de repetición

Si un efecto compuesto ejecuta sonido y luego falla antes de actualizar pantalla,
repetir todo el efecto duplicaría sonido. FSM-008 debe registrar el fallo y evitar
repetición automática. La garantía local es de **intento como máximo una vez**;
no asegura que todos los efectos externos se completaron ni permite deducir que
un efecto que lanza no hizo nada.

Recuperar scheduler o reloj no vuelve a invocar efectos de muerte ya intentados.
Cancelar con error no vuelve a publicar una transición terminal. Tras reinicio o
destrucción, recuperación y callbacks antiguos no actúan sobre la nueva partida.
Los colaboradores reales deberán decidir posteriormente cómo reparar una
pantalla o audio parcial; esa reparación no está aprobada como nueva ruta local.

## 4. Criterios verificables nuevos

| ID | Criterio de aceptación técnico | Método |
|---|---|---|
| CA-REC-001 | Fallo de scheduler inicial deja diagnóstico recuperable; reintentar no crea segunda pendiente, no reinicia deadline y no duplica efecto muerte. | Scheduler que lanza una vez y luego acepta; inspeccionar tiempos, estado y llamadas. |
| CA-REC-002 | Fallo en reintento prematuro conserva plazo; recuperación antes/después de vencer nunca finaliza antes del deadline ni autoriza callbacks anteriores. | Entregar callback temprano, fallar agenda siguiente y restaurar dependencia con reloj inyectado. |
| CA-REC-003 | Cancelación que lanza no permite actuar a callback obsoleto ni impide coherencia de reset/destrucción/terminal; se registra el fallo. | Scheduler que entrega incluso cancelados; espías y reentrada. |
| CA-REC-004 | Excepción o valor inválido de reloj se diagnostica sin consumir autorización; restaurar reloj permite reintentar con plazo original y partida vigente. | Reloj controlado con throw/no finito y posterior lectura válida. |
| CA-REC-005 | Efectos que lanzan conservan estado aceptado y no se reintentan automáticamente. Cada fallo identifica el efecto; recuperación técnica no duplica intentos previos. | Efectos con acción observable antes de lanzar; contar intentos y efectos parciales. |
| CA-REC-006 | Reentrada en scheduler/cancelación/efectos no crea timer huérfano aceptable ni modifica otra partida; terminal queda publicado antes de efectos. | Dependencias que llaman a API durante operación; callbacks viejos y nueva partida. |
| CA-REC-007 | Recuperación no acepta LOSE arbitrario, no resuelve desde cinematica y no cambia catálogo de estados; estados terminales y partida vigente conservan prioridad. | Matriz de estados y pendientes, con rechazo sin efectos finales. |

Estos criterios formalizan recuperación técnica autorizada. No sustituyen los
CA-POL originales ni autorizan nuevas reglas de resolución temporal o narrativa.

## 5. Trazabilidad y criterios originales

| Criterio original | Aporte técnico y pendiente funcional |
|---|---|
| CA-POL-001 — muerte legítima crea pendiente; no letal no | Recuperar evita duplicar registro interno; sigue pendiente demostrar origen real desde combate y frío. |
| CA-POL-002 — muerte, pausa, vencimiento y efectos únicos | Conservación de capacidad/deadline frente a fallos. Efectos parciales solo tienen garantía de intento único, no completitud. HUD/puntero/audio reales pendientes. |
| CA-POL-003 — plazo original sin pausa o con reanudación | Recuperación no reinicia 1500 ms. Tiempo físico de ejecución del navegador y orden real de efectos pendientes. |
| CA-POL-004 — solicitudes inválidas, prematuras y obsoletas rechazadas | Reintentar no crea autorización nueva; callbacks versionados y partida vigente. Evidencia declarada no autentica daño real. |
| CA-POL-005 — terminales y ausencia de duplicación | No revertir resultado ni repetir intentos de efecto tras excepción. No garantizar reparación de efectos parcialmente ejecutados. |
| CA-POL-006 — pausa detiene jugador/tiempo y mantiene render permitido | Sin evidencia nueva: FSM-008 no incorpora actualización de jugador, cuadro o render. Pendiente integración y regresión real. |

Relación SRS: RF-001 reinicio (`docs/requirements/SRS.md:50`), RF-002 pausa
(`:51`), RF-005 muerte por daño (`:54`), RF-006 resultado y cambios de nivel
(`:55`); RNF-002 interfaces claras (`:74`), RNF-003 reproducibilidad (`:78`),
RNF-004 plataformas (`:82`), compatibilidad y regresión (`:87`). El SRS continúa
borrador y RF «Por verificar»; estas relaciones no declaran completitud.

## 6. Interfaz y evidencia de implementación

Interfaz inspeccionada en `frontend/src/juego/game-state-adapters.js`: conserva
API del adaptador y añade `recuperar()` (`:187`) y `getErrores()` (`:242`).

`getErrores()` devuelve una copia de diagnósticos `{ operacion, motivo }`, sin
errores crudos, tokens, capacidades ni logs. Cada fallo capturado se asocia a:

| Operación | Motivo |
|---|---|
| programar | SCHEDULER_ERROR |
| cancelar | CANCELACION_ERROR |
| ahora | RELOJ_INVALIDO |
| muerte, terminal, transicion | EFECTO_ERROR |
| programar | CALLBACK_SINCRONO, si scheduler intenta ejecutar durante su propia llamada |

`recuperar()` solo vuelve a agendar una pendiente interna vigente y autorizada.
Si ya está agendada, no duplica tarea; sin pendiente devuelve
SIN_DERROTA_PENDIENTE; ante reloj roto RELOJ_INVALIDO, ante agenda que falla
SCHEDULER_ERROR. Desde cinematica devuelve TRANSICION_NO_PERMITIDA y conserva
capacidad sin resolver ni programar automáticamente una derrota posterior.
Durante una llamada al scheduler, una recuperación reentrante devuelve
SCHEDULER_OCUPADO sin crear una segunda agenda ni entrar en recursión.
La recuperación explícita puede ocasionar ejecución tardía de la misma obligación;
no recrea el instante fallido ni amplía orígenes funcionales.

El registro válido sigue aceptado aunque falle scheduler: su capacidad queda
retenida y se intenta efecto muerte una vez. Aceptación no certifica agenda ni
efectos completos; el consumidor debe consultar diagnósticos. Los efectos se
marcan intentados antes de invocarlos; el callback compuesto no se reproduce
automáticamente si ejecutó solo parte de su trabajo.

Evidencia de implementación: lectura/captura de reloj (`game-state-adapters.js:19`),
cancelación protegida (`:45`), captura de efectos (`:60`), marca de terminal antes
de invocar (`:74`), versionado y protección de callback síncrono (`:91`), captura
de agenda que lanza (`:130`) y registro con capacidad privada (`:159`).
OPERACION_OBSOLETA identifica trabajo invalidado durante una dependencia externa;
CALLBACK_NO_VIGENTE identifica entrega antigua/duplicada. No son nuevos estados.

La protección de ciclo se comprueba antes/después de dependencias externas;
una lectura de reloj reentrante debe revalidar identidad de partida/registro.
El coordinador captura excepciones de reloj y revalida partida/revisión antes
de registrar o resolver (`game-state-coordinator.js:13`, `:42`, `:58`).
El módulo base de FSM-006 trataba dependencias como confiables; sus contratos
históricos conservan ese alcance y no son evidencia de recuperación FSM-008.

## 7. Verificación

El [informe de resultados FSM-008](../quality/fsm-008-test-results.md) registra
la ejecución directa de coordinación: 202 pruebas aprobadas en seis archivos,
incluidos 28 casos nuevos de recuperación, y build exitoso. Los tres subagentes
aportaron cambios parciales, pero terminaron por límite de uso antes del cierre;
coordinación revisó, completó y ejecutó las verificaciones finales.

La entrega síncrona indebida del scheduler se diagnostica y no se registra como
tarea futura válida: la capacidad permanece recuperable, y su callback viejo
se invalida. Los fallos y reentradas se ensayan con colaboradores simulados;
no hay validación real de navegador ni integración con gameplay.

Los 174 casos históricos de FSM-006 no verificaban por sí solos FSM-008.
Los contratos y diffs anteriores son archivos históricos, conservados sin
sobrescribir; este documento describe la recuperación que los complementa.

## 8. Alternativas funcionales pendientes de aprobación

- Si una pendiente vence en cinematica, resolver allí, esperar a finalizar cine,
  interrumpir cine o impedir su inicio son alternativas funcionales. **Ninguna
  está aprobada por recuperación técnica.** Mantener rechazo desde cinematica;
  no seleccionar silenciosamente un momento posterior de derrota.
- Fallo técnico prolongado: resolver al recuperar reloj/scheduler conserva una
  obligación vencida, pero no autoriza cambiar su origen ni sobrepasar guardas.
  Cancelar derrota, revivir o abrir pantalla de error sería una regla nueva.
- Orden entre cambio de nivel asíncrono, muerte pendiente, victoria y reinicio
  continúa sin política aprobada. Cambiar nivel no equivale a nueva partida.
- Reparación manual o automática de efectos parciales necesita granularidad e
  idempotencia aprobadas; un callback compuesto no ofrece completitud transaccional.
- Validar navegador/táctil, visibilidad, puntero, audio y cinemáticas reales
  permanece pendiente. ADR-001/002 no se aprueban mediante este documento.
