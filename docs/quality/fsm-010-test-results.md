# FSM-010 — Regresiones de reentrada en adaptadores aislados

Fecha: 2026-11-06. Rama `dev/jesus`; HEAD de referencia
`8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`, con cambios locales sin commit.

Alcance autorizado: dos defectos identificados en FSM-009, sin integración
en `main.js`, cambios de gameplay, dependencias ni decisiones ADR.
QA escribió las regresiones; coordinación es responsable de la corrección
en producción. La fase RED se ejecutó antes de esa corrección.

## Entorno y método

Windows PowerShell; Node.js v26.13.0, npm 11.14.1, Vitest 5.1.0 y Vite 8.3.5.
Se empleó el script existente `npm.cmd test`.
Comandos ejecutados desde `frontend/`. Se reutilizó el helper de reloj numérico,
scheduler manual, hooks reentrantes y efectos simulados de
`frontend/tests/game-state-recovery.test.js`. No hay temporizadores reales.

| ID | Trazabilidad | Precondición e entrada | Resultado esperado |
|---|---|---|---|
| FSM-010-001 | CA-ADAPT-001; CA-REC-006; RF-005; RNF-002/003 | Partida jugando; evidencia vida=0/vivo=false; scheduler llama una vez a perderPuntero durante agenda inicial. Recuperar a 1000 ms; entregar callbacks a 1500 ms y repetirlos. | Un intento de muerte, pausa conservada y deadline original 1500 ms; una derrota y un intento terminal; callbacks repetidos no repiten efectos. |
| FSM-010-002 | CA-REC-001/002/003/006; RNF-002/003 | Falla scheduler inicial; se restaura a 1000 ms. Durante lectura de reloj de recuperar, otra llamada recuperar reentra una vez; después destruir y entregar callbacks al vencer. | Una tarea con demora 500 ms y deadline 1500 ms; destrucción cancela todas las tareas; callbacks obsoletos no producen terminal ni repiten muerte. |

## RED — ejecutado antes de la corrección

Comando: `npm.cmd test -- tests/game-state-recovery.test.js -t FSM-010`.
Código de salida **1**; un archivo fallido; **2 pruebas fallidas y 28 omitidas
por filtro**, 30 registradas. Duración total observada: 249 ms.

- FSM-010-001 falló en la comprobación del efecto muerte: esperado 1 intento,
  observado 0 (`game-state-recovery.test.js:396` en esta ejecución).
- FSM-010-002 falló en la cantidad de tareas: esperada 1, observadas 2
  (`game-state-recovery.test.js:421` en esta ejecución).

Las comprobaciones posteriores a esas aserciones no se ejecutaron en RED.
Estos resultados confirman los dos defectos; no representan una regresión
introducida por la corrección, que todavía no se había aplicado.

## GREEN y regresión — ejecutados después de la corrección

Coordinación corrigió exclusivamente el adaptador de producción entre RED y
GREEN: conservar el intento de muerte ante pausa de la misma partida y evitar
agenda duplicada mediante exclusión de recuperar reentrante e idempotencia
de agenda ya registrada. QA no modificó producción.

| Comando | Resultado real |
|---|---|
| `npm.cmd test -- tests/game-state-recovery.test.js -t FSM-010` | Código 0; 2 aprobadas y 28 omitidas por filtro; un archivo aprobado; 234 ms. |
| `npm.cmd test` | Código 0; 6 archivos y 204 pruebas aprobadas, sin omitidas ni fallidas reportadas; 368 ms. |
| `npm.cmd run build` | Código 0; 49 módulos; 446 ms; bundle principal 750.00 kB, gzip 202.32 kB. |
| `git diff --check` | Código 0; sin errores de espacios; avisos de normalización LF/CRLF. |
| `git diff --no-index --check -- NUL frontend/tests/game-state-recovery.test.js` | Código 1 por diferencias frente a archivo vacío; sin diagnósticos de espacios; aviso LF/CRLF. |
| `git diff --no-index --check -- NUL docs/quality/fsm-010-test-results.md` | Código 1 por diferencias frente a archivo vacío; sin diagnósticos de espacios; aviso LF/CRLF. |

Ambas regresiones completaron sus comprobaciones posteriores: FSM-010-001
intentó muerte una vez y produjo un único terminal a 1500 ms tras recuperar;
FSM-010-002 mantuvo una sola agenda, deadline 1500 ms y cancelación efectiva
al destruir, sin efectos terminales por callbacks antiguos.

El build conserva la advertencia de chunks mayores de 500 kB y genera
`frontend/dist/`. No se alteró configuración para ocultarla. La suite completa
consta de 105 FSM, 46 coordinador, 7 caracterización, 4 datos, 12 adaptadores
y 30 recuperación (28 anteriores y estas dos regresiones).

Dictamen QA: GO para revisión humana de estas dos correcciones aisladas con
evidencia RED/GREEN; NO-GO para integración en gameplay. El resultado no cierra
los demás riesgos y vacíos de cobertura de FSM-009 ni aprueba ADR.

## Límites y revisión humana

Las pruebas usan los módulos reales aislados con dependencias simuladas.
No ejecutan navegador, HUD, audio, Three.js, combate/frío ni gameplay completo.
Los 202 casos aprobados de FSM-008 son evidencia histórica separada.
No se ha medido cobertura de líneas/ramas ni rendimiento.

Integración y ADR-001/002 continúan pendientes de revisión humana.
