# Arquitectura del Sistema (AS-IS) y Diagramación UML/Mermaid

**Proyecto:** La Búsqueda del Ídolo Perdido
**Versión:** 1.0
**Estado:** Verificado contra código fuente (`dev/jesus` @ `8bdba73`)
**Propósito:** Documentar con fidelidad forense la arquitectura real implementada (*AS-IS*), el inventario clasificado de componentes y los **8 diagramas arquitectónicos obligatorios**.

> **Aviso de vigencia:** Este documento es una instantánea del análisis previo a la incorporación de `backend/` (base `8bdba73`, 2026-11-06); sus secciones sobre cuentas locales y ausencia de backend ya no describen el estado actual. Para la arquitectura cliente-servidor vigente, consultar [arch-deploy-001.md](arch-deploy-001.md).

---

## 1. Resumen Ejecutivo de la Arquitectura AS-IS

**«La Búsqueda del Ídolo Perdido»** es una aplicación web 3D interactiva ejecutada 100 % en el navegador del cliente (*Rich Client SPA / Multi-Entry Vite App*), construida con **JavaScript ES Modules**, **Three.js (`^0.186.1`)**, **WebGL**, **Web Audio API** y **Web Crypto API**.

- **Sin Backend ni Base de Datos Centralizada (`AUSENTE`):** No existe servidor Node/Express/Python ni base de datos SQL/NoSQL. Toda la lógica de simulación, renderizado, audio, autenticación local y persistencia se ejecuta en el navegador del usuario.
- **Coordinación del Ciclo de Vida (`frontend/src/main.js`):** El archivo `main.js` (735 líneas) actúa como orquestador central del bucle `requestAnimationFrame(animar)`, gestionando los estados de ejecución mediante variables mutables (`estado`, `cambiandoNivel`, `cinematicaActiva`, `dialogo`) y delegando la construcción de biomas, personajes, combate, audio e interfaz a módulos especializados.
- **Subsistema FSM Aislado (`PARCIAL / PROPUESTO`):** En `frontend/src/juego/` existen tres módulos (`game-state-machine.js`, `game-state-coordinator.js`, `game-state-adapters.js`) desarrollados en las tareas `FSM-002` a `FSM-010` con 204 pruebas unitarias. Conforme a la restricción operativa del proyecto, **estos módulos permanecen aislados y no están importados en `main.js`**.

---

## 2. Inventario Clasificado del Repositorio (Auditoría Inicial Obligatoria)

Cada componente del sistema ha sido inspeccionado y clasificado como **`IMPLEMENTADO`**, **`PARCIAL`**, **`AUSENTE`**, **`PROPUESTO`** o **`NO APLICABLE`**:

| # | Componente / Subsistema | Clasificación | Evidencia Exacta en Repositorio | Observaciones Técnicas |
|---|---|---|---|---|
| 1 | **Estructura de carpetas** | `IMPLEMENTADO` | `frontend/src/`, `frontend/tests/`, `frontend/public/`, `blender/`, `docs/`, `agents/`, `skills/` | Organización modular por dominios funcionales. |
| 2 | **Tecnologías y versiones** | `IMPLEMENTADO` | `frontend/package.json:1-22` | `three: ^0.186.1`, `vite: ^8.3.5`, `vitest: ^5.1.0`. |
| 3 | **Punto de entrada del frontend** | `IMPLEMENTADO` | `frontend/index.html:127` → `frontend/src/main.js:1-735` | Entradas secundarias de diagnóstico: `visor.html`, `niveles.html`, `pruebas.html`, `rendimiento.html`. |
| 4 | **Backend existente** | `AUSENTE` | Verificado en raíz y `frontend/package.json` | No existe directorio `backend/`, `server/` ni API REST/GraphQL. |
| 5 | **Framework y lenguaje de backend** | `NO APLICABLE` | Sin backend | La arquitectura actual es 100 % *client-side*. |
| 6 | **Base de datos de servidor** | `AUSENTE` | Sin motor SQL/NoSQL | Persistencia delegada al navegador (`Web Storage API`). |
| 7 | **Sistema real de autenticación** | `IMPLEMENTADO` (Local) | `frontend/src/cuenta/cuenta.js:1-244`, `seguridad.js:1-151`, `pantalla.js:1-232` | Registro/login local con `PBKDF2-SHA256` (150k iteraciones), comparación en tiempo constante y bloqueo exponencial local. |
| 8 | **Persistencia de usuarios y partidas** | `IMPLEMENTADO` (Local) | `frontend/src/cuenta/almacen.js:1-147` | `localStorage` (`ideolo:v1:cuentas`, `ideolo:v1:intentos`, `calidad`) y `sessionStorage` (`ideolo:v1:sesion`) firmados con `HMAC-SHA256`. |
| 9 | **Motor de renderizado** | `IMPLEMENTADO` | `frontend/src/main.js:18-48`, `juego/detalle.js:1-51` | `THREE.WebGLRenderer` con `ACESFilmicToneMapping`, sombras `PCFSoftShadowMap` y 3 niveles de calidad (`bajo`, `medio`, `alto`). |
| 10 | **Sistema de físicas y colisiones** | `IMPLEMENTADO` | `main.js:500-526`, `escenario/utilidades.js:4-25`, `escenario/terreno.js:3-19`, `juego/combate.js:13-86` | Cinemática custom en 2.5D: altura analítica `alturaTerreno(x,z,tema)`, gravedad (`28 u/s²`), colisión círculo-círculo (`empujarFuera`) y hitboxes anatómicos (`zonaDeBala`). |
| 11 | **Recursos 3D y formatos** | `IMPLEMENTADO` | `frontend/public/models/daniel.glb`, `idolo.glb` (`max.glb` y `enemigo.glb` presentes pero no referenciados) | `main.js:188-189` carga `daniel.glb` (reutilizado y personalizado para Max, Daniel y enemigos) e `idolo.glb`. Escenario 100 % procedural. |
| 12 | **Controladores de cámara** | `IMPLEMENTADO` | `frontend/src/juego/camara.js:1-92`, `escenario/cinematicaPlaya.js`, `escenario/cinematica.js`, `escenario/casa.js` | Cámara en 3.ª persona con seguimiento exponencial, anticolisión con terreno/obstáculos y modos cinemáticos (playa, altar, casa, muerte). |
| 13 | **Gestión de sonido** | `IMPLEMENTADO` | `frontend/src/audio/audio.js:1-383` | Sintetizador procedural Web Audio API (música por bioma, viento, oleaje, pasos, disparos, alertas, victoria y derrota). |
| 14 | **Sistema de misiones** | `IMPLEMENTADO` | `frontend/src/juego/datos.js:23-61`, `main.js:559-627`, `interfaz/hud.js:47-62` | Objetivos por nivel con verificación de prerrequisitos (`requisitosListos`), diálogo con Daniel y checklist dinámico en HUD. |
| 15 | **Gestión de niveles** | `IMPLEMENTADO` | `frontend/src/escenario/temas.js:3-98`, `mundo.js:19-160`, `main.js:234-275`, `main.js:337-352` | 3 niveles jugables (`Selva Tropical`, `Montaña Nevada`, `Desierto`) + escena final de victoria (`casa.js`). |
| 16 | **FSM y coordinador de estados** | `PARCIAL` / `PROPUESTO` | `frontend/src/juego/game-state-machine.js`, `game-state-coordinator.js`, `game-state-adapters.js` | Implementados y probados en aislamiento (204 tests), pero **no integrados en `main.js`** (`ADR-001` y `ADR-002` en estado `Propuesto`). |
| 17 | **Pruebas automatizadas** | `IMPLEMENTADO` | `frontend/tests/*.test.js` (8 suites, 215 tests en Vitest) + `frontend/src/herramientas/pruebas.js` (40+ aserciones en navegador) | Cobertura de FSM, criptografía, cuentas, misiones, combate, frío y terreno. |
| 18 | **Configuración dev / prod** | `IMPLEMENTADO` | `frontend/package.json:6-11`, `dist/` | Scripts `dev`, `build`, `preview`, `test`, `test:watch` operativos con Vite 8 y Vitest 5. |
| 19 | **Documentación de ingeniería** | `IMPLEMENTADO` | `docs/requirements/`, `docs/architecture/`, `docs/security/`, `docs/quality/`, `docs/engineering/` | Conjunto documental completo alineado con el código real. |

---

## 3. Arquitectura en Capas (AS-IS vs. TO-BE)

### 3.1 Modelo en Capas AS-IS (Implementación Real)
1. **Capa de Presentación e Interfaz (`frontend/index.html`, `interfaz/`, `cuenta/pantalla.js`):**
   - Superposiciones DOM (`#inicio`, `#hud`, `#dialogo`, `#pausa`, `#derrota`, `#victoria`, `#cortina`, `.cuenta-capa`), controles táctiles (`tactil.js`) y estilos responsivos (`style.css`, `responsivo.css`).
2. **Capa de Orquestación y Bucle de Simulación (`frontend/src/main.js`):**
   - Inicializa `THREE.WebGLRenderer`, captura entradas de teclado/ratón/toque, ejecuta el bucle `animar()` y coordina directamente transiciones de nivel, combate, diálogos y llamadas a `cuenta.guardarProgreso()`.
3. **Capa de Dominio de Juego y Reglas (`frontend/src/juego/`):**
   - Reglas de combate (`combate.js`), cámara (`camara.js`), frío ambiental (`frio.js`), recolección de suministros (`suministros.js`), calidad gráfica (`detalle.js`) y catálogo de niveles/armas (`datos.js`).
   - *Módulos aislados pre-integración:* `game-state-machine.js`, `game-state-coordinator.js`, `game-state-adapters.js`.
4. **Capa de Entidades 3D, Escenarios y Multimedia (`frontend/src/escenario/`, `personajes/`, `audio/`):**
   - Generación procedural de mundos (`mundo.js`, `terreno.js`, `agua.js`, `vegetacion.js`, `cielo.js`, `nieve.js`, `portal.js`, `botiquines.js`, `casa.js`), cinemáticas (`cinematica.js`, `cinematicaPlaya.js`), articulación de personajes (`personaje.js`, `enemigo.js`, `daniel.js`, `armas.js`, `poses.js`) y síntesis Web Audio (`audio.js`).
5. **Capa de Seguridad Local y Persistencia (`frontend/src/cuenta/`):**
   - Fachada de sesión y autorización local (`cuenta.js`), primitivas criptográficas `PBKDF2-SHA256` y `HMAC-SHA256` (`seguridad.js`) y adaptador de almacenamiento validado (`almacen.js` sobre `localStorage` y `sessionStorage`).

---

## 4. Los 8 Diagramas Arquitectónicos Obligatorios (Mermaid)

### 4.1 Diagrama de Casos de Uso (`ACT-001` a `ACT-006` y `CU-001` a `CU-019`)

```mermaid
flowchart LR
    subgraph Actores["Actores del Sistema"]
        ACT1["ACT-001 Jugador"]
        ACT2["ACT-002 Sistema de Juego (Autónomo)"]
        ACT3["ACT-003 NPC / Daniel"]
        ACT4["ACT-004 Administrador / Desarrollador"]
        ACT5["ACT-005 Servicio de Persistencia (Web Storage)"]
        ACT6["ACT-006 Servicio de Autenticación (Local Web Crypto)"]
    end

    subgraph Acceso["Identidad y Acceso Local"]
        CU01["CU-001 Iniciar videojuego"]
        CU02["CU-002 Registrar usuario"]
        CU03["CU-003 Iniciar sesión"]
        CU04["CU-004 Comenzar partida"]
    end

    subgraph Gameplay["Exploración, Narrativa y Supervivencia"]
        CU05["CU-005 Explorar escenario 3D"]
        CU06["CU-006 Interactuar con NPC"]
        CU07["CU-007 Recibir una misión"]
        CU08["CU-008 Completar una misión"]
        CU09["CU-009 Enfrentar enemigos"]
        CU10["CU-010 Recibir daño o perder salud"]
        CU11["CU-011 Morir / Perder partida"]
    end

    subgraph Progreso["Transiciones, Estado y Persistencia"]
        CU12["CU-012 Activar portal o transición"]
        CU13["CU-013 Cambiar de nivel"]
        CU14["CU-014 Completar el juego (Victoria)"]
        CU15["CU-015 Pausar y reanudar"]
        CU16["CU-016 Reiniciar nivel o partida"]
        CU17["CU-017 Guardar progreso"]
        CU18["CU-018 Cargar progreso"]
        CU19["CU-019 Actualizar HUD"]
    end

    ACT1 --> CU01 & CU02 & CU03 & CU04
    ACT1 --> CU05 & CU06 & CU08 & CU09
    ACT1 --> CU12 & CU15 & CU16

    CU06 <--> ACT3
    CU06 --> CU07

    ACT2 --> CU10 & CU11 & CU13 & CU14 & CU19
    CU08 --> CU12 --> CU13
    CU13 --> CU17
    CU14 --> CU17
    CU03 --> CU18

    CU02 & CU03 --> ACT6
    ACT6 --> ACT5
    CU17 & CU18 --> ACT5

    ACT4 -.->|"Audita y ejecuta pruebas"| CU01
```

---

### 4.2 Diagrama de Componentes (Arquitectura Real AS-IS vs. Componentes Aislados/Propuestos)

```mermaid
flowchart TD
    subgraph Browser["Navegador Web (Cliente 100% SPA)"]
        subgraph UI["Capa de Interfaz y Entrada"]
            HTML["index.html + style.css + responsivo.css"]
            HUD["interfaz/hud.js"]
            TOUCH["interfaz/tactil.js + dispositivo.js"]
            AUTH_UI["cuenta/pantalla.js"]
        end

        subgraph Core["Orquestador Principal (AS-IS)"]
            MAIN["main.js (Loop requestAnimationFrame + Estados)"]
        end

        subgraph Domain["Capa de Dominio de Juego"]
            CAM["juego/camara.js"]
            COMB["juego/combate.js"]
            FRIO["juego/frio.js"]
            SUM["juego/suministros.js"]
            DET["juego/detalle.js"]
            DATOS["juego/datos.js"]
        end

        subgraph IsolatedFSM["Subsistema FSM Aislado (FSM-002..010 — NO integrado en main.js)"]
            style IsolatedFSM stroke-dasharray: 5 5
            GSM["juego/game-state-machine.js"]
            GSC["juego/game-state-coordinator.js"]
            GSA["juego/game-state-adapters.js"]
            GSC --> GSM
            GSC --> GSA
        end

        subgraph World3D["Capa Multimedia 3D y Audio"]
            MUNDO["escenario/mundo.js + temas.js + terreno.js"]
            CINE["escenario/cinematica.js + cinematicaPlaya.js + casa.js"]
            CHARS["personajes/personaje.js + enemigo.js + daniel.js + armas.js"]
            AUDIO["audio/audio.js (Web Audio API)"]
        end

        subgraph SecAuth["Capa de Seguridad y Persistencia Local"]
            CUENTA["cuenta/cuenta.js"]
            SEG["cuenta/seguridad.js (PBKDF2 + HMAC-SHA256)"]
            ALMACEN["cuenta/almacen.js"]
            LSTORE[("localStorage\nideolo:v1:cuentas\nideolo:v1:intentos")]
            SSTORE[("sessionStorage\nideolo:v1:sesion")]
        end
    end

    HTML --> MAIN
    MAIN --> HUD & TOUCH & AUTH_UI
    MAIN --> CAM & COMB & FRIO & SUM & DET & DATOS
    MAIN --> MUNDO & CINE & CHARS & AUDIO
    MAIN --> CUENTA
    CUENTA --> SEG & ALMACEN
    ALMACEN --> LSTORE & SSTORE
```

---

### 4.3 Diagrama de Clases y Módulos Principales

```mermaid
classDiagram
    class MainOrchestrator {
        +String estado
        +Number nivelActual
        +Boolean cambiandoNivel
        +Boolean cinematicaActiva
        +Object jugador
        +iniciar() Promise
        +empezarNivel(idx) void
        +recogerIdolo() void
        +matarJugador() void
        +terminar(resultado) void
        +animar() void
    }

    class CuentaFacade {
        +disponible() Boolean
        +sesionActual() Object
        +registrar(nombre, clave) Promise
        +iniciarSesion(nombre, clave) Promise
        +modoInvitado() Object
        +cargarProgreso() Promise
        +guardarProgreso(cambios) Promise
    }

    class SeguridadCrypto {
        +derivar(contrasena, salBytes) Promise
        +firmar(claveB64, texto) Promise
        +verificarFirma(claveB64, texto, firmaB64) Promise
        +iguales(a, b) Boolean
    }

    class AlmacenLocal {
        +leerCuentas() Object
        +guardarCuenta(registro) Boolean
        +leerSesion() Object
        +guardarSesion(sesion) void
        +registrarFallo(id) Object
    }

    class MundoEscenario {
        +Group grupo
        +Array obstaculos
        +Array enemigos
        +Array botiquines
        +Array fuegos
        +altura(x, z) Number
        +actualizar(t, dt, posJugador, camara) void
        +destruir() void
    }

    class Personaje3D {
        +Group modelo
        +Object partes
        +animar(t, vel, agachado, herido, enAgua, apuntando, arma) void
        +herir(parte, lado) void
        +limpiarHeridas() void
        +animarMuerte(progreso) void
    }

    class GameStateCoordinator_Aislado {
        <<Isolated / Not Integrated>>
        +getState() String
        +canAcceptGameplayInput() Boolean
        +requestTransition(trigger, context) Object
        +resetExecutionLocks() void
    }

    MainOrchestrator --> CuentaFacade : usa
    MainOrchestrator --> MundoEscenario : instancia
    MainOrchestrator --> Personaje3D : controla
    CuentaFacade --> SeguridadCrypto : delega PBKDF2/HMAC
    CuentaFacade --> AlmacenLocal : persiste JSON
    MundoEscenario *-- Personaje3D : contiene enemigos y Daniel
```

---

### 4.4 Diagrama de Secuencia — Registro, Inicio de Sesión y Carga Segura de Progreso (`CU-002`, `CU-003`, `CU-018`)

```mermaid
sequenceDiagram
    autonumber
    actor J as ACT-001 Jugador
    participant UI as cuenta/pantalla.js
    participant C as cuenta/cuenta.js
    participant S as cuenta/seguridad.js (Web Crypto)
    participant A as cuenta/almacen.js (Web Storage)

    J->>UI: Ingresa usuario y contraseña
    UI->>C: iniciarSesion(nombre, contrasena)
    C->>A: estadoIntentos(id)
    A-->>C: { fallos, hasta }
    alt Cuenta bloqueada temporalmente (hasta > Date.now())
        C-->>UI: { ok: false, error: "Demasiados intentos..." }
    else Permitido
        C->>A: obtenerCuenta(nombre)
        A-->>C: registro { sal, iteraciones, verificador, progreso, firma }
        C->>S: derivar(contrasena, salBytes, 150000)
        S-->>C: { verificadorDerivado, claveHMAC }
        C->>S: iguales(verificadorDerivado, registro.verificador)
        alt Credencial inválida
            C->>A: registrarFallo(id)
            C-->>UI: { ok: false, error: "Nombre o contraseña incorrectos." }
        else Credencial válida
            C->>A: limpiarFallos(id)
            C->>S: verificarFirma(claveHMAC, textoProgreso, registro.firma)
            alt Firma HMAC alterada en localStorage
                C->>S: firmar(claveHMAC, "1|id|1|0|0")
                C->>A: guardarCuenta(progresoReiniciadoNivel1)
            end
            C->>A: guardarSesion({ nombre, clave: claveHMAC })
            C-->>UI: { ok: true, sesion, aviso }
        end
    end
```

---

### 4.5 Diagrama de Secuencia — Daño Mortal, Colisión de Transición y Derrota (`CU-010`, `CU-011`, `POL-FSM-001`)

```mermaid
sequenceDiagram
    autonumber
    participant Loop as main.js (animar)
    participant E as personajes/enemigo.js
    participant Armas as personajes/armas.js
    participant Timer as setTimeout (1500 ms)
    participant HUD as interfaz/hud.js

    Loop->>E: actualizarEnemigos(enemigos, mundo, jugador, dt, t)
    E->>E: actualizarBalas(mundo, jugador, dt)
    E->>Armas: zonaDeBala(alturaRelativa, lateral)
    Armas-->>E: { zona: "el pecho", dano: 100, mortal: true }
    E->>Loop: callback golpeJugador(impacto)
    Loop->>Loop: jugador.vida = 0; matarJugador()
    Note over Loop,Timer: Riesgo AS-IS [MM-P0-02]: Si cambiandoNivel==true o dialogo!=null,<br/>el enemigo sigue disparando y matarJugador() agenda derrota diferida.
    Loop->>Loop: jugador.vivo = false; jugador.tiempoMuerte = 0.001
    Loop->>Timer: setTimeout(() => terminar("derrota"), 1500)
    Timer->>Loop: terminar("derrota") (si estado === "jugando")
    Loop->>HUD: mostrarDerrota(causaMuerte)
```

---

### 4.6 Diagrama de Estados — Ciclo de Vida en `main.js` (AS-IS) vs. FSM Formal (`FSM-002..010`)

```mermaid
stateDiagram-v2
    [*] --> menu : Carga inicial (index.html + iniciar())

    state "Estados en main.js (AS-IS)" as ASIS {
        menu --> cinematica_playa : Click #btn-jugar (Nivel 0)
        menu --> jugando : Click #btn-jugar (Nivel 1 o 2)
        cinematica_playa --> jugando : Fin cinemática o tecla E / Espacio

        state jugando {
            [*] --> exploracion_combate
            exploracion_combate --> dialogo_activo : Tecla E cerca de Daniel (dialogo != null)
            dialogo_activo --> exploracion_combate : Fin líneas de diálogo
            exploracion_combate --> cinematica_idolo : recogerIdolo() (cinematicaActiva = true)
            cinematica_idolo --> portal_activo : Fin cinemática (6.5 s)
            portal_activo --> transicion_nivel : Entrar al portal (cambiandoNivel = true)
            exploracion_combate --> muriendo : matarJugador() (jugador.vivo = false)
        }

        jugando --> pausado : Tecla ESC
        pausado --> jugando : Tecla ESC o #btn-continuar
        jugando --> derrota : Timer 1500 ms tras matarJugador()
        jugando --> victoria : Portal en Nivel 3 (terminar("victoria"))
        derrota --> jugando : Tecla R o #btn-reintentar
        victoria --> jugando : Tecla R o #btn-reiniciar
    }
```

---

### 4.7 Diagrama de Despliegue (AS-IS Estático vs. TO-BE Opcional con Servidor Endurecido)

```mermaid
flowchart TB
    subgraph ClientDevice["Dispositivo del Jugador (Escritorio o Móvil)"]
        subgraph BrowserRuntime["Navegador Compatible con WebGL2 + Web Crypto"]
            WEBGL["WebGL Renderer (Three.js v0.186)"]
            WAUDIO["Web Audio Context (Síntesis Procedural)"]
            WCRYPTO["Web Crypto Subtle (PBKDF2 + HMAC-SHA256)"]
            WSTORE["Web Storage (localStorage + sessionStorage)"]
        end
    end

    subgraph StaticHost_ASIS["Despliegue Actual AS-IS (Vite Dev / Build Estático)"]
        VITE["Servidor Estático / CDN\ndist/index.html + assets/*.js + models/*.glb"]
    end

    subgraph Server_TOBE["Infraestructura TO-BE Propuesta (NO implementada en repo)"]
        style Server_TOBE stroke-dasharray: 5 5
        NGINX["Reverse Proxy Nginx\n(TLS 1.3, CSP, HSTS, Rate Limit)"]
        API["API Backend Autenticación/Progreso\n(Propuesto)"]
        DB[("Base de Datos Servidor\n(Propuesto)")]
        NGINX --> API --> DB
    end

    VITE -->|"HTTPS / ES Modules + GLB"| BrowserRuntime
    BrowserRuntime -.->|"Solo en arquitectura futura TO-BE"| NGINX
```

---

### 4.8 Diagrama de Datos y Persistencia Local (`Web Storage API`)

```mermaid
erDiagram
    LOCAL_STORAGE_CUENTAS ||--o{ CUENTA_USUARIO : "almacena en ideolo:v1:cuentas"
    CUENTA_USUARIO ||--|| PROGRESO_JUGADOR : "contiene y firma con HMAC"
    LOCAL_STORAGE_INTENTOS ||--o{ REGISTRO_INTENTO : "controla en ideolo:v1:intentos"
    SESSION_STORAGE_SESION ||--o| SESION_ACTIVA : "mantiene en ideolo:v1:sesion"

    CUENTA_USUARIO {
        string nombre PK "3..16 chars (A-Za-z0-9 _-)"
        int v "Versión esquema (1)"
        string creado "Fecha ISO-8601"
        string sal "Base64 (16 bytes aleatorios)"
        int iteraciones "150000 (PBKDF2-SHA256)"
        string verificador "Base64 (primeros 256 bits derivados)"
        string firma "Base64 (HMAC-SHA256 sobre progreso)"
    }

    PROGRESO_JUGADOR {
        int nivel "Nivel máximo desbloqueado (1..3)"
        int mejorTiempo "Mejor tiempo total en segundos (>=0)"
        int victorias "Total de partidas completadas (>=0)"
    }

    REGISTRO_INTENTO {
        string idUsuario PK "nombre normalizado en minúsculas"
        int fallos "Contador de fallos consecutivos"
        int hasta "Timestamp epoch ms de desbloqueo"
    }

    SESION_ACTIVA {
        string nombre "Nombre visible del jugador"
        string clave "Base64 (segundos 256 bits derivados para HMAC)"
        boolean invitado "True si juega sin persistencia criptográfica"
    }
```
