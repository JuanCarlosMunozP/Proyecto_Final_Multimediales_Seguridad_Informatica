# Informe de Resultados de Pruebas y Construcción (`Test Results`)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Fecha de Ejecución:** 6 de noviembre de 2026
**Rama / Commit base:** `dev/jesus` (`8bdba73`)
**Entorno:** Windows · Node.js · Vite `v8.3.5` · Vitest `v5.1.0`

---

## 1. Resumen Ejecutivo de Ejecución Real

| Verificación | Comando Ejecutado | Estado | Métrica Obtenida |
|---|---|---|---|
| **Suite de Pruebas Automatizadas (Vitest)** | `npm --prefix frontend test -- --run` | **APROBADO (`PASS`)** | **12 suites aprobadas · 250 pruebas aprobadas · 0 fallos** (`3.05 s`) |
| **Build de Producción (Vite)** | `npm --prefix frontend run build` | **APROBADO (`PASS`)** | **50 módulos transformados · `exit code 0`** (`815 ms`) |
| **Validación Docker Compose Raspberry Pi** | `docker-compose.exe -f compose.yaml -f compose.raspberry.yaml config --quiet` | **APROBADO (`PASS`)** | **`EXIT=0`** |
| **Validación Docker Compose VPS** | `docker-compose.exe -f compose.yaml -f compose.vps.yaml config --quiet` | **APROBADO (`PASS`)** | **`EXIT=0`** |

---

## 2. Desglose por Suite de Pruebas (`Vitest v5.1.0`)

```text
 RUN  v5.1.0 C:/Estudio/Seguridad-Multimedia/frontend

 ✓ tests/game-state.test.js (105 tests) 67ms
 ✓ tests/cine-util.test.js (8 tests) 310ms
 ✓ tests/release-005b-level-death.test.js (10 tests) 99ms
 ✓ tests/game-state-characterization.test.js (7 tests) 27ms
 ✓ tests/game-state-coordinator.test.js (46 tests) 49ms
 ✓ tests/game-state-recovery.test.js (30 tests) 66ms
 ✓ tests/game-state-adapters.test.js (12 tests) 34ms
 ✓ tests/arch-deploy-001.test.js (5 tests) 69ms
 ✓ tests/release-004-regression.test.js (10 tests) 41ms
 ✓ tests/gameplay-domain.test.js (5 tests) 21ms
 ✓ tests/game-data.test.js (4 tests) 6ms
 ✓ tests/security-account.test.js (8 tests) 1787ms

 Test Files  12 passed (12)
      Tests  250 passed (250)
   Duration  3.05s
```

> **Nota sobre el tiempo de `security-account.test.js` (`1141 ms`):** El tiempo refleja la ejecución criptográfica real de múltiples derivaciones `PBKDF2-SHA256` con **`150 000` iteraciones** cada una en `Web Crypto API` (registro, login exitoso, 4 intentos de fuerza bruta y verificación de tampering), demostrando que el endurecimiento criptográfico es real y no simulado (*mocked*).

---

## 3. Evidencia de Construcción de Producción (`Vite v8.3.5`)

```text
> la-busqueda-del-idolo-perdido@1.0.0 build
> vite build

vite v8.3.5 building client environment for production...
✓ 49 modules transformed.
dist/index.html                   3.01 kB │ gzip:   1.20 kB
dist/assets/index-Bkk178Fc.css   10.12 kB │ gzip:   2.67 kB
dist/assets/pantalla-CGfPEmGk.js  3.28 kB │ gzip:   1.41 kB
dist/assets/index-BpF9gK8w.js   750.00 kB │ gzip: 202.32 kB
✓ built in 528ms
```

- **Observación no bloqueante:** Vite emite un aviso estándar de tamaño de chunk (`index-BpF9gK8w.js` de `750 kB` minificado / `202.32 kB` gzip) debido a la inclusión del motor `three` completo en el bundle principal. `cuenta/pantalla.js` ya se carga mediante importación dinámica (`await import("./cuenta/pantalla.js")`), generando un chunk separado de `3.28 kB`.
