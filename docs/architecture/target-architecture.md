# Arquitectura Objetivo (TO-BE) y Hoja de Ruta de Estabilización

**Proyecto:** La Búsqueda del Ídolo Perdido
**Versión:** 1.0
**Estado:** Diseño Técnico de Referencia y Plan de Estabilización Controlada
**Rama / Commit base:** `dev/jesus` (`8bdba73`)

---

## 1. Propósito

Definir la arquitectura objetivo (*TO-BE*) del sistema en dos horizontes claramente diferenciados:
1. **Horizonte Corto Plazo (Estabilización Pre-Entrega en Cliente):** Corrección quirúrgica de defectos bloqueantes `P0`/`P1` en `main.js`, `enemigo.js`, `combate.js` y `camara.js`, manteniendo intacta la arquitectura probada de `main.js` o integrando de forma supervisada el coordinador `GameStateCoordinator` (`ADR-001`, `ADR-002`).
2. **Horizonte Medio Plazo (Evolución Cliente-Servidor DevSecOps):** Migración opcional de la autenticación y persistencia local hacia un backend endurecido con validación en servidor, eliminando las limitaciones intrínsecas del modelo *100 % client-side*.

---

## 2. Evaluación del Subsistema FSM Aislado (`FSM-002` a `FSM-010`)

En el árbol de trabajo actual existen tres módulos en `frontend/src/juego/`:
- `game-state-machine.js`: Máquina de estados pura y determinista con 9 estados (`menu`, `cinematica_playa`, `jugando`, `pausado`, `dialogo`, `cinematica_idolo`, `transicion_nivel`, `derrota`, `victoria`), tabla declarativa de transiciones y política de precedencia `POL-FSM-001` (*Death Over Level Transition*).
- `game-state-coordinator.js`: Coordinador con candados de exclusión mutua (`transitionLock`, `levelChangePending`, `defeatPending`) y consultas de permisos (`canAcceptGameplayInput()`, `isSimulationActive()`).
- `game-state-adapters.js`: Adaptadores puros (`createDialogTransitionAdapter`, `createIdolCinematicTransitionAdapter`, `createLevelTransitionAdapter`, `createTerminalOutcomeAdapter`) para sincronizar estados con variables heredadas de `main.js`.

### Decisión Arquitectónica para la Entrega Académica
Conforme a las reglas del proyecto (`AGENTS.md` y Sección 2 del Prompt Maestro):
- **No se integra la FSM en `main.js` sin autorización humana explícita.**
- Para resolver los defectos `P0` de condiciones de carrera (`[MM-P0-02]`) con el **mínimo riesgo de regresión**, se propone un parche puntual de 12 líneas en `main.js` (Opción A, recomendada para entrega inmediata) o, alternativamente, la conexión supervisada del adaptador FSM si el equipo humano lo autoriza (Opción B).

---

## 3. Diseño de Parches Mínimos para Defectos P0 y P1 (Horizonte Corto Plazo)

### 3.1 `[MM-P0-01]` Oclusión de Proyectiles contra Obstáculos Sólidos (`enemigo.js` y `combate.js`)
- **Problema actual:** `actualizarBalas` (`enemigo.js:85-111`) y `dispararJugador` (`combate.js:45-52`) comprueban la altura del terreno (`mundo.altura(b.x, b.z)`), pero ignoran `mundo.obstaculos`. Los enemigos disparan y matan instantáneamente a Max a través del altar de piedra (`r=2.9`), columnas de ruinas (`r=0.75`), rocas y árboles.
- **Solución mínima:** Verificar si cada paso de proyectil `(b.x, b.z)` intersecta algún cilindro en `mundo.obstaculos` cuya altura cubra `b.y` (asumiendo altura efectiva de obstáculo `alturaTerreno + r * 2.5`), destruyendo la bala en el impacto.

### 3.2 `[MM-P0-02]` Condición de Carrera en Diálogo, Transición de Nivel y Muerte Diferida (`main.js`)
- **Problema actual:**
  1. Durante el diálogo con Daniel (`dialogo !== null`), Max no puede moverse, pero `actualizarEnemigos` sigue ejecutándose y los enemigos lo acribillan.
  2. Durante `cambiandoNivel = true` (fade-out de 700 ms), si una bala mortal impacta a Max, `matarJugador()` agenda `setTimeout(() => terminar("derrota"), 1500)` y pone `jugador.vivo = false`. Al iniciar el nuevo nivel, `empezarNivel()` restaura `jugador.vida = 60` pero **no restaura `jugador.vivo = true` ni cancela el temporizador de derrota**, provocando una derrota fantasma en el nuevo nivel.
- **Solución mínima:**
  1. Guardar el identificador del temporizador `timerDerrota` y cancelarlo (`clearTimeout`) en `empezarNivel()`, además de restaurar `jugador.vivo = true`.
  2. Ignorar daño en `golpeJugador` si `cambiandoNivel || cinematicaActiva || dialogo !== null`, y pausar el disparo/avance ofensivo enemigo mientras `dialogo !== null` o `cambiandoNivel`.

### 3.3 `[MM-P0-03]` Sincronización Asíncrona en `terminar("victoria")` (`main.js`)
- **Problema actual:** `terminar("victoria")` (`main.js:392-413`) asigna `estado = "victoria"` antes de que la función asíncrona `irACasa()` termine de cargar `idolo.glb` y posicionar a Max en `(5000, 0, 5000)`.
- **Solución mínima:** Invocar `irACasa()` y actualizar `estado = "victoria"` cuando la escena de la casa esté lista o posicionar inmediatamente las coordenadas base antes del `await`.

### 3.4 `[MM-P1-01]` Separación entre Fogata de Campamento y Antorchas de Altar en Nivel 2 (`main.js` / `mundo.js`)
- **Problema actual:** En `main.js:564-568`, `dFuego` mide la distancia a cualquier elemento de `mundo.fuegos`, que incluye las 4 antorchas del altar central (`(±4.2, ±4.2)`). Acercarse al altar marca automáticamente el objetivo *"Calentarte junto a la fogata"* (`progreso.fogata = true`) sin haber visitado la fogata en `(4.5, 10.5)`.
- **Solución mínima:** Evaluar el objetivo `progreso.fogata` únicamente contra `mundo.fuegos[0]` (la fogata principal del campamento), manteniendo el calor térmico (`actualizarFrio`) para todas las fuentes de fuego.

---

## 4. Arquitectura TO-BE Cliente-Servidor (Horizonte Medio Plazo — Propuesta Académica)

Para superar las limitaciones inherentes al almacenamiento local en navegador (`SEC-HIGH-01` y `SEC-MED-01`), la evolución hacia producción multiusuario contempla:

1. **Reverse Proxy Endurecido (Nginx):**
   - Terminación TLS 1.3, cabeceras `Content-Security-Policy` (sin `'unsafe-inline'` en scripts), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy`.
2. **Servicio Backend de Identidad y Progreso (API REST):**
   - Verificación de credenciales con `Argon2id` o `PBKDF2-SHA256` en servidor.
   - Emisión de sesión mediante cookie `HttpOnly; Secure; SameSite=Strict` (eliminando la necesidad de persistir claves criptográficas en `sessionStorage`).
   - Limitación de tasa (*rate limiting*) por IP y cuenta en memoria del servidor/Redis (no eludible borrando `localStorage`).
3. **Validación de Transiciones de Progreso en Servidor:**
   - El servidor valida que un jugador solo pueda desbloquear el nivel $N+1$ si completó el nivel $N$ en un tiempo físicamente plausible ($t \ge t_{\min}$).
