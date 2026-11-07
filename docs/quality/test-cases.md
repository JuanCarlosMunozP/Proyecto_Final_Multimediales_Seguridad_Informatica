# Catálogo de Casos de Prueba (`TC`)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Versión:** 1.0
**Total de pruebas automatizadas en Vitest:** **216 pruebas** distribuidas en **8 archivos de suite**.

---

## 1. Suites de Seguridad e Identidad Local (`frontend/tests/security-account.test.js`)

| ID Caso | Nombre de la Prueba | Requisito / Caso de Uso | Entrada / Estímulo | Resultado Esperado |
|---|---|---|---|---|
| **TC-SEC-001** | Derivación `PBKDF2-SHA256` determinista con sal única | `SEG-001`, `CU-002` | `seguridad.derivar("Secreto#2026", sal)` (`150 000` iteraciones) | Devuelve `verificador` y `clave` distintos entre sí (32 bytes cada uno); la misma sal produce idéntico resultado y otra sal produce hashes disjuntos. |
| **TC-SEC-002** | Comparación en tiempo constante `iguales(a, b)` | `SEG-001`, `CU-003` | Cadenas Base64 iguales, diferentes por 1 bit y de distinta longitud | Retorna `true` solo en coincidencia exacta; rechaza longitudes distintas o tipos no string sin excepción. |
| **TC-SEC-003** | Firma `HMAC-SHA256` y detección de adulteración | `SEG-002`, `CU-017`, `CU-018` | Firma de `"1\|explorador\|2\|145\|1"` y prueba con `"1\|explorador\|3\|145\|1"` | `verificarFirma` retorna `true` para el registro legítimo y `false` ante cualquier cambio en nivel, tiempo, victorias o clave. |
| **TC-SEC-004** | Saneamiento de `localStorage` corrupto y filtro XSS | `SEG-003`, `CU-002` | JSON truncado, entradas con `nivel: 99` y nombres `<script>alert(1)</script>` | `leerCuentas()` descarta registros inválidos sin lanzar excepción; `nombreValido()` rechaza etiquetas HTML, SQLi y longitudes fuera de `3..16`. |
| **TC-SEC-005** | Ciclo completo de registro, persistencia y detección de tampering | `RF-009`, `SEG-002`, `CU-002`, `CU-017`, `CU-018` | Registro de `"Elena"`, ascenso a Nivel 2, y posterior edición manual de `localStorage` a `nivel: 3` | Al detectar que la firma HMAC no coincide con `nivel: 3`, `cargarProgreso()` restablece automáticamente la cuenta a `nivel: 1` y emite advertencia de seguridad. |
| **TC-SEC-006** | Bloqueo temporal exponencial por fuerza bruta | `SEG-004`, `CU-003` | 3 intentos de login con contraseña errónea seguidos de un 4.º intento con la contraseña correcta | Tras el 3.er fallo se activa `bloqueadoHasta > ahora`; el 4.º intento es rechazado aunque la contraseña sea válida hasta que expire la ventana de bloqueo (`15 s`). |
| **TC-SEC-007** | Modo invitado sin persistencia en `localStorage` | `RF-001`, `SEG-005`, `CU-004` | `cuenta.modoInvitado()` seguido de `guardarProgreso({ nivel: 3 })` | Crea sesión `{ nombre: "Invitado", invitado: true }`, no escribe en `ideolo:v1:cuentas` y mantiene el progreso base efímero. |

---

## 2. Suites de Dominio Multimedia y Jugabilidad (`frontend/tests/gameplay-domain.test.js`)

| ID Caso | Nombre de la Prueba | Requisito / Caso de Uso | Entrada / Estímulo | Resultado Esperado |
|---|---|---|---|---|
| **TC-DOM-001** | Progresión de misiones y objetivos en los 3 niveles | `RF-004`, `RF-007`, `CU-007`, `CU-008` | Estados de progreso por nivel en `NIVELES[0..2]` (`datos.js`) | Verifica `requisitosListos` y el texto de `objetivoActual` para Selva (Daniel → Arma → Ídolo → Portal), Montaña (Daniel → Fogata → Arma → Ídolo → Portal) y Desierto. |
| **TC-DOM-002** | Dinámica térmica de frío, calor de fogata y daño por hipotermia | `RF-006`, `CU-010` | `actualizarFrio()` fuera del radio (`15 u`) y dentro de la fogata (`2 u`) en Nivel 2 | Fuera del radio de `9 u`, el frío sube a razón de `0.085/s`; al superar `0.7` genera daño proporcional; cerca del fuego se reduce a razón de `0.28/s`. En Selva/Desierto retorna `0`. |
| **TC-DOM-003** | Estadísticas de armas y detección anatómica `zonaDeBala` | `RF-005`, `CU-009`, `CU-010`, `CU-011` | Impactos a distintas alturas (`1.58`, `1.20`, `1.30`, `0.50`, `2.50`) y desplazamientos laterales | Cabeza y pecho centrados producen impacto letal (`mortal: true`, `dano: 100`); extremidades producen daño no letal (`10-18 HP`) y metadatos de vendaje `{ parte, lado }`. |
| **TC-DOM-004** | Consistencia matemática de terreno y nivel de agua en los 3 biomas | `RF-003`, `CU-005` | Evaluación de `alturaTerreno(x, z, tema)` en meseta del altar `(0,0)`, playa `(0,40)` y grilla de muestreo | La meseta central del altar permanece plana y sobre el nivel del agua; la costa de la selva desciende bajo `nivelAgua` (`-0.85`); ninguna coordenada produce `NaN` o `Infinity`. |
| **TC-DOM-005** | Oclusión de proyectiles enemigos contra obstáculos sólidos (`[MM-P0-01]`) | `RF-005`, `CU-009` | Disparo enemigo hacia Max con un obstáculo (`r=1.2` en `z=2`) interpuesto vs. línea de tiro despejada | Con obstáculo interpuesto la bala es absorbida (`0` impactos a Max); sin obstáculo impacta normalmente (`1` impacto). |

---

## 3. Suites de Máquina de Estados, Coordinación y Datos (`frontend/tests/game-state*.test.js` y `game-data.test.js`)

| Suite | Archivo | N.º de Pruebas | Cobertura Funcional |
|---|---|---|---|
| **FSM Core** | `frontend/tests/game-state.test.js` | 105 | Estados canónicos (`menu`, `cinematica_playa`, `jugando`, `pausado`, `dialogo`, `cinematica_idolo`, `transicion_nivel`, `derrota`, `victoria`), tabla de transiciones, política `POL-FSM-001` e historial acotado. |
| **FSM Coordinator** | `frontend/tests/game-state-coordinator.test.js` | 46 | Candados de exclusión mutua (`transitionLock`, `levelChangePending`, `defeatPending`) y consultas de estado. |
| **FSM Recovery** | `frontend/tests/game-state-recovery.test.js` | 30 | Recuperación ante estados inválidos, reinicios de nivel (`R`), y desbloqueo de candados tras desenlace terminal. |
| **FSM Adapters** | `frontend/tests/game-state-adapters.test.js` | 12 | Adaptadores de diálogo, cinemática del ídolo, transición de nivel y resultado terminal (`derrota` / `victoria`). |
| **FSM Characterization** | `frontend/tests/game-state-characterization.test.js` | 7 | Pruebas de caracterización del flujo heredado de `main.js`. |
| **Game Data Baseline** | `frontend/tests/game-data.test.js` | 4 | Integridad estructural del catálogo estático `NIVELES` en `datos.js`. |
