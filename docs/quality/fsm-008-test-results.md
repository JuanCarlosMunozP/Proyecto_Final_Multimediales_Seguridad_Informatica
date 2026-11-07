# FSM-008 — Pruebas negativas y recuperación aislada

Fecha: 2026-11-06. Rama `dev/jesus`; HEAD de referencia
`8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`, con cambios locales sin commit.

Los tres subagentes aportaron implementación, criterios y pruebas parciales,
pero sus turnos finalizaron por límite de uso. Coordinación completó la revisión,
añadió los casos finales y ejecutó los comandos siguientes directamente. No se
atribuye una revisión independiente final ni ejecución a un subagente interrumpido.

## Ejecución real

Windows PowerShell, Node.js v26.13.0, npm 11.14.1, Vitest 5.1.0 y Vite 8.3.5.
Comandos npm ejecutados desde `frontend/` mediante los lanzadores existentes.

| Comando | Resultado final observado |
|---|---|
| `npm.cmd test` | Código 0; 6 archivos y 202 pruebas aprobadas; 432 ms. Sin fallos ni omitidos reportados. |
| `npm.cmd run build` | Código 0; 49 módulos; 554 ms. Bundle principal 750.00 kB; gzip 202.32 kB. |
| `git diff --check` | Código 0, sin errores de espacios. Se verifican también los archivos nuevos con `git diff --no-index --check`. |

Vite advierte que algunos chunks superan 500 kB tras minificación. Git advierte
normalización LF/CRLF en archivos existentes; no se cambió configuración para
ocultar avisos. El build genera `frontend/dist/`, sin integrar los módulos nuevos.
No se midieron cobertura de líneas/ramas ni rendimiento de gameplay.

Hubo ejecuciones intermedias de 191, 195, 198 y 201 pruebas durante la revisión. El resultado
final de 202 corresponde a 174 casos anteriores y 28 nuevos de recuperación.
La suite completa conserva 105 FSM, 46 coordinador, 7 caracterización, 4 datos,
12 adaptadores y añade 28 recuperación. No se instalaron dependencias.

## Matriz ejecutada

Fuente: `frontend/tests/game-state-recovery.test.js`. Se usa reloj numérico y un
scheduler manual que puede fallar, reentrar o entregar callbacks cancelados. No se
usan temporizadores reales. Cada resultado real coincidió con el esperado:
**los 28 casos fueron aprobados**. Los IDs parametrizados explican la diferencia
entre 21 identificadores y 28 ejecuciones.

| ID | Casos | Precondición / fallo inyectado | Resultado esperado y observado | Trazabilidad |
|---|---:|---|---|---|
| TC-REC-001 | 1 | Programación inicial falla; reloj avanza y se restaura scheduler. | Registro aceptado con diagnóstico; recuperación explícita agenda restante, no duplica muerte ni tarea. | CA-REC-001; CA-POL-002/003 |
| TC-REC-002 | 1 | Callback temprano; falla programación del reintento. | Callback anterior inválido; recuperar conserva deadline; una derrota al vencer. | CA-REC-002; CA-POL-004 |
| TC-REC-003 | 1 | Cancelador lanza al alcanzar victoria con muerte pendiente. | Victoria publicada; efecto terminal único; callback tardío inocuo; error observable. | CA-REC-003; CA-POL-005 |
| TC-REC-004 | 3 | Efectos muerte/transición/terminal realizan una acción y luego lanzan. | Acción parcial una sola vez; diagnóstico EFECTO_ERROR; recuperar no reproduce efecto compuesto. | CA-REC-005 |
| TC-REC-005 | 1 | Cancelador reinicia e inicia otra partida durante limpieza terminal. | Ningún efecto terminal antiguo llega al ciclo nuevo. | CA-REC-006; RF-001 |
| TC-REC-006 | 2 | Reloj devuelve NaN o lanza al resolver; después vuelve a ser válido. | No consumir autorización; recuperar conserva plazo y permite resolución válida. | CA-REC-004; CA-POL-003/004 |
| TC-REC-007 | 1 | Callback vencido durante cine; recuperación explícita después de volver a juego. | Cine rechaza sin efectos; mantiene capacidad; misma obligación vencida puede reintentarse solo desde origen permitido. | CA-REC-007 |
| TC-REC-008 | 1 | Reloj falla y después se reinicia la partida. | Capacidad vieja no se recupera; nuevo callback puede finalizar exclusivamente la partida nueva. | CA-REC-006; CA-POL-004 |
| TC-REC-009 | 2 | Programar/reloj reinicia e inicia otra partida durante registro. | No entregar muerte ni terminal del trabajo anterior; sin pendiente recuperable del ciclo viejo. | CA-REC-006 |
| TC-REC-010 | 1 | Consumidor intenta alterar snapshot de errores. | Diagnósticos internos permanecen intactos; solo operación/motivo, sin tokens. | RNF-002/003 |
| TC-REC-011 | 1 | Scheduler guarda callback y luego lanza. | Versión antigua invalidada aunque se entregue; recuperación agenda el restante una vez. | CA-REC-001/002 |
| TC-REC-012 | 1 | Reloj reentra y reinicia durante resolución vencida. | La comprobación posterior detecta cambio de partida; no derrota el ciclo nuevo. | CA-REC-006 |
| TC-REC-013 | 1 | Victoria, reinicio y una nueva derrota. | Un intento terminal por partida; ledger anterior no suprime el efecto de la nueva. | CA-POL-005; RF-001 |
| TC-REC-014 | 1 | Scheduler intenta entregar callback dentro de su llamada. | CALLBACK_SINCRONO; no fingir tarea futura; recuperación con scheduler corregido conserva deadline. | CA-REC-001/006 |
| TC-REC-015 | 3 | Efectos muerte/transición/terminal reinician e inician otra partida. | No queda trabajo antiguo autorizado sobre el ciclo nuevo; no duplicar terminales. | CA-REC-006 |
| TC-REC-016 | 2 | Cancelación lanza durante reinicio o destrucción. | Limpieza lógica conserva invalidación; callbacks antiguos inocuos; destrucción sigue bloqueando API. | CA-REC-003/006 |
| TC-REC-017 | 1 | Reloj lanza antes de registrar la muerte y luego se restaura. | Primer registro rechazado sin efecto; registro posterior válido no queda bloqueado. | CA-REC-004 |
| TC-REC-018 | 1 | Reloj del coordinador directo lanza, sin wrapper de adaptadores. | RELOJ_INVALIDO no deja pendiente; después puede registrarse una muerte. | CA-REC-004 |
| TC-REC-019 | 1 | Reloj del coordinador directo reinicia durante programación. | OPERACION_OBSOLETA; no registra muerte antigua en la partida nueva. | CA-REC-006 |
| TC-REC-020 | 1 | Reloj del coordinador directo reinicia y registra otra muerte durante resolución antigua. | La capacidad vieja no consume la nueva; se conserva su propio vencimiento. | CA-REC-006 |
| TC-REC-021 | 1 | Scheduler reentra en recuperar durante su propia programación. | SCHEDULER_OCUPADO sin recursión ni tareas duplicadas; resolución original única al vencer. | CA-REC-006 |

## Qué se demuestra y qué permanece pendiente

Se comprueba recuperación entre módulos reales mediante dependencias y efectos
simulados. No se ejecutan `main.js`, combate/frío, HUD, audio, cámara, listeners,
cinemáticas ni navegador reales. Tampoco se autoriza una derrota desde cine.
TC-REC-007 verifica una capacidad retenida y una solicitud explícita posterior,
no implementa una política automática de esperar/interrumpir cinemáticas.

El estado de derrota sigue exigiendo autorización vigente y plazo cumplido.
Un fallo de scheduler deja un registro aceptado cuya agenda no está garantizada;
el consumidor debe consultar `getErrores()` e invocar `recuperar()` tras corregir
la dependencia. No hay bucle automático infinito ni nueva muerte en recuperación.

La garantía sobre efectos parciales es de intento como máximo una vez por
aceptación, no de ejecución completa exactamente una vez. Si el callback hizo
algo antes de lanzar, no se deshace ni se repite. Reparar presentación parcial
requiere un futuro contrato de acciones idempotentes y revisión humana.

CA-POL-001 mantiene pendiente la procedencia real del daño; CA-POL-006 mantiene
pendiente la conservación real de jugador, tiempo y render. CA-POL-002/003/005
tienen evidencia con dobles, no aceptación completa de gameplay. Permanecen
pendientes escritorio/móvil, visibilidad, puntero y audio reales, continuidad
cinematográfica y carreras de carga de nivel.

Dictamen: GO para revisión humana de este endurecimiento aislado; NO-GO para
integrar todavía. Faltan revisión final independiente tras los límites de los
subagentes, política de nivel/cine concurrentes y regresión de navegador. ADR-002
permanece propuesto; no se modificó main ni se crearon commits.
