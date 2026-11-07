# Máquina de estados del videojuego

**Versión:** 0.2
**Estado:** Contrato del módulo aislado; integración pendiente de aprobación
**Referencia de auditoría:** `dev/jesus`, commit `8bdba73d89cc1294a22a9ec6611ae1a54f437fe6`
**Misión:** FSM-002, formalización documental y validación de entradas autorizadas.
ADR-002 continúa **Propuesto**; esta misión no aprueba su integración.

## 1. Propósito

Documentar el comportamiento observado en `frontend/src/main.js` y el contrato
del módulo aislado `frontend/src/juego/game-state-machine.js`. La FSM no está
integrada en el ciclo de vida del juego. Los nombres de eventos de este documento
pertenecen al módulo aislado; `main.js` continúa realizando asignaciones directas.

## 2. Estados identificados

| Estado | Responsabilidad |
|---|---|
| cargando | Inicialización de recursos |
| inicio | Espera de inicio de partida |
| jugando | Actualización del gameplay |
| pausa | Suspensión de la actualización del jugador y de la cinemática; el render continúa |
| cinematica | Secuencia narrativa |
| victoria | Finalización exitosa |
| derrota | Finalización por derrota |

## 3. Contrato del módulo aislado

Interfaz: `transicionar(estado, evento, contexto = {})`.

- `estado` debe ser una cadena primitiva del catálogo de la sección 2.
- `evento` debe ser una cadena primitiva y una propiedad propia de la tabla del
  estado de origen. No se convierten números, objetos ni cadenas encapsuladas.
  Las propiedades heredadas, incluidas `toString`, `constructor` y `__proto__`,
  no son eventos ni estados autorizados.
- `contexto` debe ser un objeto no nulo y no un array. Omitirlo o pasar
  `undefined` utiliza el valor predeterminado `{}`. `cineActivo` es opcional; si
  su valor efectivo está definido debe ser un booleano, incluso si procede de
  una propiedad heredada. Ausente o `undefined` explícito equivale a `false`. No se admite
  coerción de valores como `1` o `'true'`. Otras propiedades no deciden destinos.
- Se valida primero el estado/evento. Si no autorizan una transición, se devuelve
  `{ aceptada: false, estado, motivo: 'TRANSICION_NO_PERMITIDA' }`.
- Para una transición autorizada, un contexto inválido devuelve
  `{ aceptada: false, estado, motivo: 'CONTEXTO_INVALIDO' }`, incluso si ese evento
  no utiliza `cineActivo`.
- Una transición válida devuelve `{ aceptada: true, estado: destino }`, sin
  `motivo`. El destino siempre pertenece al catálogo.
- Todo rechazo conserva exactamente el valor de entrada `estado`; no repara ni
  convierte un estado inválido. Por ello, la garantía de estado válido corresponde
  a transiciones aceptadas y a llamadores que conservan un estado inicial válido.
- El módulo calcula resultados sin cambiar entradas, DOM, audio, almacenamiento,
  temporizadores ni objetos de Three.js. No almacena historial ni la instancia de
  cinemática; el futuro adaptador deberá conservar ese contexto.
- El contexto se trata como un objeto de datos ordinario. Getters y proxies
  hostiles quedan fuera del contrato; no se garantiza rechazo sin excepción
  frente a código ejecutable en el acceso a propiedades.

El endurecimiento de entradas es el alcance local autorizado de FSM-002. No
supone aprobación de la migración propuesta en `ADR/ADR-002.md:47` ni de nuevas
transiciones funcionales. El contrato se verifica con pruebas ejecutables; la
integración continúa pendiente.

## 4. Tabla completa de transiciones autorizadas

Las condiciones de entrada de la sección 3 se aplican a todas las filas. Los
efectos son evidencia del juego actual y responsabilidad de un futuro adaptador;
la FSM aislada no los ejecuta. Las referencias a `main.js` son relativas a
`frontend/src/` y corresponden a la referencia de auditoría.

| Origen | Evento | Condición funcional | Destino | Efectos observados / evidencia |
|---|---|---|---|---|
| cargando | LOAD_COMPLETE | Carga de modelo, sesión y nivel finalizadas; ruta normal | inicio | Habilitar botón y mostrar introducción. `main.js:186`, `:199`, `:214`. |
| cargando | DEMO_START | Adaptador: `import.meta.env.DEV` y hash comienza por `#demo` | jugando | Posición/cámara opcionales, ocultar pantalla y mostrar UI. `main.js:203`. El módulo no comprueba entorno ni hash. |
| inicio | START | `cineActivo` ausente o `false` | jugando | Iniciar audio; pantalla completa táctil, ocultar pantalla, mostrar UI, pedir puntero y bienvenida una vez. `main.js:153`. |
| inicio | START | `cineActivo === true` | cinematica | Mismos efectos del botón; conservar la instancia `cine`. Rama observada en `main.js:157`; alcanzabilidad desde inicio con escena activa no demostrada. |
| jugando | PAUSE | Adaptador: pérdida de puntero, pestaña oculta o control táctil | pausa | Mostrar pantalla PAUSA/Continuar. `main.js:126`, `:130`, `:146`, `:151`. |
| cinematica | PAUSE | Adaptador: pérdida de puntero; no generalizar a otros disparadores | pausa | Mostrar pantalla de pausa y conservar `cine`. `main.js:126`, `:130`, `:719`. |
| pausa | RESUME | `cineActivo` ausente o `false` | jugando | Efectos del botón de inicio/continuar. `main.js:153`. |
| pausa | RESUME | `cineActivo === true` | cinematica | Efectos del botón y continuar la misma instancia de cinemática. `main.js:157`, `:719`. |
| jugando | START_CINEMATIC | Adaptador: diálogo avanza a línea con cinemática aún no vista | cinematica | Registrar cinemática vista, cerrar diálogo y crear escena según tipo. `main.js:315`. |
| cinematica | CINEMATIC_END | Adaptador: `cine.actualizar(dt)` termina y estado no es pausa | jugando | Limpiar `cine`, recuperar cámara y mostrar línea actual de diálogo. `main.js:719`. |
| jugando | WIN | Adaptador: portal final activo, jugador vivo, sin cambio en curso y dentro del radio | victoria | Salir de puntero, sonido, escena de casa, registrar victoria y mostrar resultado. `main.js:329`, `:402`. |
| jugando | LOSE | Adaptador: vence temporizador de muerte y origen sigue siendo jugando | derrota | Muerte/sonido ya se iniciaron; salir de puntero y mostrar resultado. `main.js:384`, `:402`. Véase discrepancia de sección 5. |

No existen otras transiciones autorizadas. Para los siete estados y los nueve
eventos del catálogo (`LOAD_COMPLETE`, `DEMO_START`, `START`, `PAUSE`,
`START_CINEMATIC`, `WIN`, `LOSE`, `CINEMATIC_END`, `RESUME`),
la tabla enumera diez pares origen/evento; `START` y `RESUME` tienen dos destinos
según contexto. Todo par no enumerado se rechaza, incluidas autorrepeticiones,
`pausa + LOSE` y cualquier evento desde `victoria` o `derrota`.
El reinicio actual es `location.reload()` desde botón o tecla R
(`main.js:104`, `:165`), no una transición interna de la FSM.

## 5. Diferencias observadas y riesgos pendientes

| Prioridad | Evidencia y diferencia | Tratamiento / alternativas pendientes |
|---|---|---|
| Alta | `matarJugador` programa `terminar('derrota')` a 1500 ms (`main.js:384`); `terminar` solo protege estados terminales (`:402`). Si se pausa antes de vencer, producción puede pasar de pausa a derrota. El módulo rechaza `pausa + LOSE`. | No cambiar la tabla en FSM-002. Antes de integrar, caracterizar esta secuencia y aprobar una política: autorizar derrota desde pausa para preservar lo observado, o diferir/cancelar resolución mientras hay pausa, lo que cambia gameplay. |
| Alta | Pausa no equivale a congelar toda la aplicación: solo durante juego se incrementa `tiempoFinal` y actualiza jugador (`main.js:690`); mundo, respiración, iluminación y render siguen actualizándose (`:693`, `:714`, `:728`). | Preservar estas diferencias. No sustituir el bucle por un bloqueo global de pausa. |
| Alta | `cineActivo` decide destino pero no conserva progreso, cámara ni diálogo. `main.js:719` detiene la instancia durante pausa y restaura diálogo al finalizar. | El futuro adaptador debe conservar la misma instancia y orden de efectos. Una prueba aislada del destino no demuestra equivalencia. |
| Media | Pérdida de puntero pausa cinemática, mientras ocultación de pestaña y botón táctil solo pausan juego (`main.js:126`, `:146`, `:151`). | Conservar guardas por disparador. Cambiar esta asimetría requiere decisión humana. |
| Media | Producción aplica `terminar(resultado)` desde cualquier estado no terminal (`main.js:402`); FSM limita WIN/LOSE a jugando. Finalización de cine comprueba únicamente no pausa (`:719`). | No afirmar equivalencia exhaustiva. Investigar alcanzabilidad y temporización antes de migrar cada transición. |
| Media | La FSM permite `DEMO_START` sin comprobar entorno; producción exige desarrollo (`main.js:203`). | Mantener la guarda en el futuro adaptador y verificar que el atajo no se active en producción. |
| Media | El endurecimiento usa `Object.hasOwn`, disponible en ES2022; SRS:82 deja navegadores/dispositivos objetivo pendientes. | Verificar compatibilidad de los navegadores objetivo antes de integrar; un build exitoso no demuestra disponibilidad de esta API en ejecución. |

## 6. Criterios verificables y trazabilidad

Los IDs locales siguientes formalizan el contrato para revisión; no convierten
los RF del SRS, actualmente «Por verificar», ni ADR-002 en decisiones aprobadas.
Fuentes: `../requirements/SRS.md:48`, `:74`, `:78`, `:86`;
`ADR/ADR-002.md:28`, `:63`.

| ID | Criterio de aceptación | Fuente / requisito relacionado | Método de verificación |
|---|---|---|---|
| CA-FSM-001 | Cada par autorizado produce `aceptada: true` y el destino exacto de sección 4; START/RESUME cubren contexto ausente, false y true. | RF-001; ADR-002:29–32 | Pruebas del módulo contra tabla explícita. |
| CA-FSM-002 | Cada par restante del producto siete estados por nueve eventos se rechaza con motivo exacto y estado conservado; terminales no tienen salidas. | ADR-002:31, :66–67 | Matriz completa de pares; incluir `pausa + LOSE`. |
| CA-FSM-003 | Estados/eventos fuera del catálogo, tipos no primitivos y claves heredadas se rechazan sin aceptar destinos ajenos al catálogo. | ADR-002:29–31 | Casos `toString`, `constructor`, `__proto__`, strings encapsuladas, null y otros tipos. |
| CA-FSM-004 | Contextos null, arrays, primitivos o `cineActivo` definido no booleano se rechazan con CONTEXTO_INVALIDO cuando el par está autorizado; undefined equivale a omitido y pares inválidos conservan prioridad de TRANSICION_NO_PERMITIDA. | Contrato local FSM-002; RNF-003 | Pruebas de entradas, valores heredados y precedencia de motivos. |
| CA-FSM-005 | Evaluar una transición no muta entradas ni produce efectos externos y puede probarse sin navegador/Three.js. | RNF-002/003; ADR-002:33–35 | Pruebas con contexto congelado e inspección de importaciones; no sustituye prueba de integración. |
| CA-FSM-006 | Futuro adaptador pausa y reanuda la misma cinemática sin avanzar durante pausa; finalizar restaura cámara y diálogo en el orden actual. | ADR-002:32, :68; main.js:157, :719 | Pendiente: prueba ejecutable de integración y validación manual de ambas cinemáticas. |
| CA-FSM-007 | Futuro adaptador conserva disparadores/guardas, tiempo de partida, render continuo, efectos únicos terminales y restricción DEV del demo. | RF-001/002/006; SRS:87–88; main.js:126, :203, :402, :680 | Pendiente: regresión de secuencias, pruebas de integración y revisión manual de gameplay. |

### Evidencia de pruebas y sus límites

La referencia auditada contiene once pruebas del módulo en
`frontend/tests/game-state.test.js:7`, seis de caracterización textual en
`frontend/tests/game-state-characterization.test.js:9` y cuatro de datos en
`frontend/tests/game-data.test.js:10`: 21 casos iniciales, no 21 pruebas de
integración de FSM. La caracterización lee `main.js` como texto (`:4`) y comprueba
expresiones/contenidos; no ejecuta eventos, temporizadores, efectos ni gameplay.
FSM-002 añade casos de contrato y una caracterización ejecutable limitada de la
derrota diferida. TC-FSM-007 extrae las declaraciones reales de `matarJugador`,
`pausar` y `terminar` de `main.js` y las ejecuta mediante `node:vm`, con reloj
simulado y colaboradores sustituidos. Comprueba pausa hasta 1499 ms y derrota a
1500 ms, salida del puntero y pantalla final; también expone el rechazo actual
de `pausa + LOSE` en la FSM. No inicializa listeners, navegador ni Three.js y
depende del formato de las declaraciones extraídas; no demuestra integración
completa del juego. Los seis casos textuales originales conservan su alcance.

### Resultados de ejecución FSM-002

Ejecución del 2026-11-06 desde `frontend/`, Windows PowerShell, Node.js
v26.13.0, npm 11.14.1. Se usó `npm.cmd` porque PowerShell bloquea el lanzador
`npm.ps1` por su política de ejecución; no se cambió esa política.

| Comando | Resultado real | Evidencia |
|---|---|---|
| `npm.cmd test` (`npm test`) | Código 0; 3 archivos, 116 pruebas aprobadas; 574 ms | Vitest 5.1.0; 105 casos de módulo, 7 de caracterización (6 textuales y 1 ejecutable), 4 de datos. Sin fallos ni omitidos reportados. |
| `npm.cmd run build` (`npm run build`) | Código 0; 49 módulos transformados; 986 ms | Vite 8.3.5; bundle principal 750.00 kB, gzip 202.32 kB. Advertencia: chunks mayores de 500 kB tras minificación. |

Los 105 casos del módulo incluyen los diez pares autorizados, ramas contextuales
y los 53 pares no autorizados del producto de siete estados por nueve eventos,
además de entradas inválidas. No se midió cobertura de líneas/ramas ni se
ejecutó una validación manual de gameplay o pruebas completas de navegador.
El build genera artefactos en `frontend/dist/`; no demuestra equivalencia entre
el módulo aislado y el ciclo actual. No se cambió configuración para ocultar la
advertencia de tamaño.

## 7. Límites y revisión humana

- Mantener `main.js`, gameplay, render y dependencias sin cambios en FSM-002.
- No integrar el módulo ni ampliar transiciones funcionales mediante esta tabla.
- ADR-001 y ADR-002 siguen propuestos y sujetos a revisión humana.
- Antes de integración: resolver la derrota diferida durante pausa, aprobar el
  adaptador/orden de efectos y completar CA-FSM-006/007.
- Tras cambios autorizados: ejecutar `npm test` y `npm run build` desde
  `frontend/`, reportar resultados reales y presentar diff para revisión.
