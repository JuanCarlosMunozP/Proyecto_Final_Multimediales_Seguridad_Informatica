# Catálogo Formal de Actores y Casos de Uso — La Búsqueda del Ídolo Perdido

**Proyecto:** La Búsqueda del Ídolo Perdido
**Rama:** `dev/jesus`
**Commit base auditado:** `8bdba73`
**Fecha de verificación:** 2026-11-06
**Estado:** Verificado contra el código fuente real (`frontend/src/`)

---

## 1. Catálogo de Actores del Sistema

La siguiente tabla distingue estrictamente las capacidades **IMPLEMENTADAS** en el código actual de las capacidades **PARCIALES**, **AUSENTES** o **PROPUESTAS**.

| ID | Actor | Tipo | Clasificación Real | Responsabilidades Verificadas y Evidencia en Código |
|---|---|---|---|---|
| **ACT-001** | **Jugador** | Primario (Humano) | **IMPLEMENTADO** | • Crear cuenta local, iniciar sesión o jugar como invitado (`frontend/src/cuenta/pantalla.js:L11-L74`, `frontend/src/cuenta/cuenta.js:L33-L87`).<br>• Iniciar partida desde pantalla principal (`frontend/src/main.js:L153-L165`).<br>• Controlar a Max Montenegro con teclado/ratón o controles táctiles: desplazarse (`WASD`/joystick), correr (`Shift`), saltar (`Espacio`), nadar en mar y oasis (`frontend/src/main.js:L96-L118`, `:L441-L518`, `frontend/src/interfaz/tactil.js:L17-L122`).<br>• Interactuar con el NPC Daniel (`E` o botón táctil `HABLAR`) y recibir misiones (`frontend/src/main.js:L102-L103`, `:L299-L326`).<br>• Combatir mercenarios cuerpo a cuerpo o con armas de kits (`F`, clic izquierdo o botón táctil `GOLPEAR`/`DISPARAR`, `frontend/src/main.js:L101`, `:L352-L365`, `frontend/src/juego/combate.js:L21-L68`).<br>• Gestionar salud y recursos recogiendo botiquines (+40 vida) y kits de arma (`frontend/src/juego/suministros.js:L92-L117`), y calentarse junto a fogatas/antorchas en la montaña (`frontend/src/juego/frio.js:L18-L36`).<br>• Pausar y reanudar la partida (`Esc`, pérdida de puntero, cambio de pestaña o botón táctil `II`, `frontend/src/main.js:L126-L165`).<br>• Avanzar entre los 3 niveles a través del portal/vehículo y alcanzar la victoria o reiniciar tras derrota (`R` o botón final, `frontend/src/main.js:L104`, `:L329-L347`, `:L402-L413`). |
| **ACT-002** | **Sistema de Juego** | Secundario Lógico (Motor / Simulación) | **IMPLEMENTADO** | • Inicializar WebGLRenderer, cámara, iluminación ACES Filmic y resolución dinámica (`frontend/src/main.js:L28-L41`, `frontend/src/juego/detalle.js:L48-L76`).<br>• Cargar modelos GLB (`daniel.glb`, `idolo.glb`, `palmera.glb`) y precompilar shaders (`frontend/src/main.js:L186-L195`, `:L280-L286`).<br>• Generar proceduralmente los 3 biomas (isla, montaña nevada, desierto con oasis) con semilla determinista (`frontend/src/escenario/mundo.js:L16-L506`, `frontend/src/escenario/terreno.js:L14-L42`).<br>• Actualizar simulación por cuadro (`animar()`), IA de mercenarios, proyectiles, separación de cuerpos y colisiones circulares (`frontend/src/main.js:L680-L729`, `frontend/src/personajes/enemigo.js:L85-L271`).<br>• Evaluar condiciones de misión, daño por combate/frío, muerte diferida a 1500 ms y victoria (`frontend/src/main.js:L369-L413`, `:L575-L625`).<br>• Actualizar HUD con caché `WeakMap` y sintetizar audio procedural con Web Audio API (`frontend/src/main.js:L417-L428`, `frontend/src/audio/audio.js:L4-L464`). |
| **ACT-003** | **NPC / Daniel** | Secundario (Personaje Narrativo) | **IMPLEMENTADO** | • Ubicarse junto al punto de aparición (`spawn`) de cada uno de los 3 niveles y actuar como obstáculo físico de radio `0.5 m` (`frontend/src/main.js:L255-L261`, `frontend/src/personajes/daniel.js:L4-L9`).<br>• Orientar su mirada suavemente hacia Max cuando está activo en escena (`frontend/src/main.js:L630`, `:L714`).<br>• Presentar los diálogos de historia por nivel (`GUIONES[nivel]`), disparar las 2 cinemáticas del Nivel 1 (`avion` y `playa`) y desbloquear las misiones del nivel al concluir el diálogo (`misionesAceptadas = true`, `frontend/src/main.js:L299-L326`, `frontend/src/juego/datos.js:L18-L43`).<br>• Mostrar recordatorio si el jugador vuelve a interactuar tras aceptar las misiones (`frontend/src/main.js:L301-L303`). |
| **ACT-004** | **Administrador / Desarrollador** | Operación y Mantenimiento | **IMPLEMENTADO** (Herramientas locales y CLI) | • Ejecutar suite de pruebas automatizadas Vitest (`npm test`) y build de producción (`npm run build`, `frontend/package.json:L6-L11`).<br>• Inspeccionar niveles con cámara libre (`/niveles.html`, `frontend/src/herramientas/niveles.js:L1-L127`).<br>• Inspeccionar modelos, esqueletos y poses de personajes (`/visor.html`, `frontend/src/herramientas/visor.js:L1-L106`).<br>• Ejecutar pruebas funcionales en navegador (`/pruebas.html`, `frontend/src/herramientas/pruebas.js:L1-L271`).<br>• Medir telemetría de rendimiento WebGL: llamadas de dibujo, triángulos, sombras y tiempos de CPU/GPU por nivel (`/rendimiento.html`, `frontend/src/herramientas/rendimiento.js:L1-L107`).<br>• Utilizar atajos de desarrollo `#demo`, `#demo=x,z,yaw` y `#demo&nivel=N` restringidos por `import.meta.env.DEV` (`frontend/src/main.js:L200-L212`).<br>• Regenerar modelos 3D mediante scripts headless de Blender (`blender/crear_personajes.py`, `blender/convertir_mixamo.py`).<br>• *Nota:* No existe ni se requiere panel administrativo de servidor. |
| **ACT-005** | **Servicio de Persistencia** | Técnico Externo (Web Storage API) | **IMPLEMENTADO** (Local en Navegador) | • Almacenar y validar cuentas locales en `localStorage` bajo la clave `ideolo:v1:cuentas` (`frontend/src/cuenta/almacen.js:L4`, `:L36-L41`).<br>• Persistir control de intentos fallidos y bloqueos en `localStorage` bajo `ideolo:v1:intentos` (`frontend/src/cuenta/almacen.js:L5`, `:L44-L48`).<br>• Persistir sesión activa por pestaña en `sessionStorage` bajo `ideolo:v1:sesion` (`frontend/src/cuenta/almacen.js:L6`, `:L50-L52`).<br>• Persistir preferencia de calidad gráfica en `localStorage` bajo `calidad` (`frontend/src/interfaz/dispositivo.js:L8-L13`).<br>• Validar esquemas, tipos, rangos y firma de integridad HMAC-SHA256 al recuperar datos (`frontend/src/cuenta/almacen.js:L14-L22`, `frontend/src/cuenta/cuenta.js:L73-L78`).<br>• *Nota:* No existe base de datos SQL/NoSQL en servidor (`AUSENTE`). |
| **ACT-006** | **Servicio de Autenticación** | Técnico Condicional (Web Crypto API Local) | **PARCIAL** (Local en Cliente; sin Backend) | • Derivar verificador de contraseña (256 bits) y clave de firma HMAC (256 bits) mediante `SubtleCrypto` `PBKDF2-SHA256` con 150 000 iteraciones y sal aleatoria de 16 bytes (`frontend/src/cuenta/seguridad.js:L10-L25`).<br>• Comparar verificadores en tiempo constante (`iguales()`, `frontend/src/cuenta/seguridad.js:L28-L33`) y aplicar bloqueo exponencial tras 3 fallos (`frontend/src/cuenta/cuenta.js:L52-L68`).<br>• Firmar y verificar integridad del progreso con `HMAC-SHA256` (`frontend/src/cuenta/seguridad.js:L35-L47`).<br>• *Condición arquitectónica:* **No existe servicio de autenticación independiente en servidor (`AUSENTE`)**. En el diagrama AS-IS se modela como subsistema local dentro del navegador apoyado en `Web Crypto API`. |

---

## 2. Catálogo Formal de Casos de Uso (CU-001 a CU-019)

### CU-001 — Iniciar videojuego
- **Actor principal:** Jugador (`ACT-001`), asistido por Sistema de Juego (`ACT-002`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Inicializa el motor 3D WebGL, carga el modelo base de los personajes, gestiona la sesión de usuario, construye el nivel correspondiente, precompila los shaders y presenta la pantalla de inicio.
- **Precondiciones:** Navegador web moderno con soporte para ES Modules y WebGL.
- **Flujo principal:**
  1. El jugador abre la aplicación (`frontend/index.html`).
  2. El sistema detecta el perfil del dispositivo (`alta`, `media`, `baja` y soporte táctil) en `frontend/src/interfaz/dispositivo.js:L28-L66`.
  3. El sistema inicializa `THREE.WebGLRenderer`, escena, cámara y resolución dinámica, e inicia el bucle `animar()` (`frontend/src/main.js:L28-L41`, `:L680-L735`).
  4. `iniciar()` carga `/models/daniel.glb`, clona el modelo base para enemigos y configura a Max (`axel`) con cabello y vestuario (`frontend/src/main.js:L186-L198`).
  5. Se invoca `await cuenta.sesion()` para recuperar sesión o mostrar el diálogo de cuenta/invitado (`frontend/src/main.js:L199`).
  6. Se carga el nivel guardado o el nivel inicial (`await empezarNivel(...)`, `frontend/src/main.js:L201`, `:L234-L275`), incluyendo `precalentar()` para compilar shaders (`:L280-L286`).
  7. El estado pasa a `"inicio"`, se habilita el botón `#btn-jugar` con el texto `"Jugar"` y se muestra la sinopsis (`frontend/src/main.js:L214-L220`).
- **Flujos alternativos:**
  - *FA-01 (Modo desarrollo `#demo`):* Si `import.meta.env.DEV` es verdadero y el hash inicia con `#demo`, posiciona a Max según parámetros opcionales y entra directamente en estado `"jugando"` (`frontend/src/main.js:L204-L212`).
- **Excepciones:**
  - *EX-01 (Error de carga de modelos o WebGL):* El bloque `.catch()` en `frontend/src/main.js:L731-L734` registra el error en consola y presenta en pantalla: `"Error al cargar el juego. Revisa la consola (F12)."` evitando una pantalla negra silenciosa.
- **Postcondiciones:** Escena 3D renderizando con cámara orbital alrededor de Max y botón `"Jugar"` habilitado.
- **Criterios de aceptación:** No aparece pantalla negra permanente; cualquier fallo de carga informa al usuario en `#pantalla-texto`.
- **Evidencia de pruebas:** `TC-FSM-001`, `TC-FSM-002`, `TC-FSM-006` en `frontend/tests/game-state-characterization.test.js`.

---

### CU-002 — Registrar usuario
- **Actor principal:** Jugador (`ACT-001`), Servicio de Autenticación Local (`ACT-006`), Servicio de Persistencia (`ACT-005`).
- **Estado de implementación:** **IMPLEMENTADO** (Autenticación y almacenamiento locales en navegador; sin servidor).
- **Descripción:** Crea una nueva cuenta local validando formato de usuario y longitud de contraseña, derivando el verificador criptográfico y firmando el progreso inicial.
- **Precondiciones:** Contexto seguro (`https` o `localhost`) con `crypto.subtle` disponible (`frontend/src/cuenta/seguridad.js:L13`).
- **Flujo principal:**
  1. En el diálogo `#cuenta`, el jugador selecciona la pestaña `"Crear cuenta"` (`frontend/src/cuenta/pantalla.js:L20`, `:L34-L42`).
  2. Introduce nombre de jugador, contraseña y confirmación de contraseña (`frontend/src/cuenta/pantalla.js:L15-L17`, `:L54`).
  3. `registrar(nombre, password)` valida que `nombre` cumpla `/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{3,16}$/` y `password` tenga entre 6 y 64 caracteres (`frontend/src/cuenta/cuenta.js:L21-L26`, `:L36-L37`).
  4. Comprueba que el nombre normalizado (`llave(nombre)`) no exista ya en `localStorage` (`frontend/src/cuenta/cuenta.js:L38-L39`).
  5. Genera una sal aleatoria de 16 bytes (`salAleatoria()`) y deriva 512 bits mediante `PBKDF2-SHA256` (150 000 iteraciones): 256 bits para `verificador` y 256 bits para `clave` (`frontend/src/cuenta/seguridad.js:L18-L25`, `frontend/src/cuenta/cuenta.js:L40-L41`).
  6. Inicializa `datos = { nivel: 0, mejorTiempo: null, victorias: 0 }`, calcula la firma `HMAC-SHA256` y guarda el registro en `localStorage` (`frontend/src/cuenta/cuenta.js:L42-L44`).
  7. Abre la sesión en memoria y en `sessionStorage`, limpia los campos de contraseña del DOM y cierra el modal (`frontend/src/cuenta/cuenta.js:L45`, `frontend/src/cuenta/pantalla.js:L59-L61`).
- **Excepciones:**
  - *EX-01 (`SubtleCrypto` no disponible):* Deshabilita inputs e invita a jugar como invitado (`frontend/src/cuenta/pantalla.js:L66-L69`).
  - *EX-02 (Contraseñas no coinciden o formato inválido):* Muestra alerta accesible (`role="alert"`) sin exponer datos sensibles (`frontend/src/cuenta/pantalla.js:L54`, `frontend/src/cuenta/cuenta.js:L21-L25`).
  - *EX-03 (Usuario duplicado):* Devuelve `"Ese nombre ya está en uso."` (`frontend/src/cuenta/cuenta.js:L39`).
  - *EX-04 (`localStorage` bloqueado):* Devuelve error controlado si `guardarUsuarios` retorna `false` (`frontend/src/cuenta/cuenta.js:L44`).
- **Postcondiciones:** Cuenta persistida sin contraseña en texto plano y sesión activa iniciada.
- **Criterios de aceptación:** Contraseña nunca guardada en claro; rechazo de nombres con caracteres HTML (`<`, `>`); rechazo de duplicados insensible a mayúsculas/minúsculas.
- **Evidencia de pruebas:** `TC-SEC-001`, `TC-SEC-002`, `TC-SEC-005`, `TC-SEC-006` en `frontend/tests/security-account.test.js`.

---

### CU-003 — Iniciar sesión
- **Actor principal:** Jugador (`ACT-001`), Servicio de Autenticación Local (`ACT-006`), Servicio de Persistencia (`ACT-005`).
- **Estado de implementación:** **IMPLEMENTADO** (Local).
- **Descripción:** Verifica las credenciales de un jugador contra el registro local o permite ingresar en modo invitado.
- **Precondiciones:** Modal de sesión activo o sesión previa en `sessionStorage`.
- **Flujo principal:**
  1. El jugador introduce nombre y contraseña en modo `"Ingresar"` (`frontend/src/cuenta/pantalla.js:L52-L62`).
  2. `entrar(nombre, password)` verifica en `ideolo:v1:intentos` si existe un bloqueo temporal activo para el usuario (`frontend/src/cuenta/cuenta.js:L52-L56`).
  3. Busca el registro en `leerUsuarios()` y ejecuta `seg.derivar()` incluso si el usuario no existe (usando una sal aleatoria ficticia) para mitigar ataques de temporización (`frontend/src/cuenta/cuenta.js:L58-L61`).
  4. Compara el verificador con `seg.iguales()` en tiempo constante (`frontend/src/cuenta/cuenta.js:L62`, `frontend/src/cuenta/seguridad.js:L28-L33`).
  5. Limpia el contador de intentos fallidos (`frontend/src/cuenta/cuenta.js:L69-L70`).
  6. Verifica la firma `HMAC-SHA256` del progreso guardado con la clave derivada (`frontend/src/cuenta/cuenta.js:L73`).
  7. Abre sesión y muestra en el menú principal el resumen del jugador y botón `"Cerrar sesión"` (`frontend/src/cuenta/cuenta.js:L79-L81`, `frontend/src/cuenta/pantalla.js:L77-L85`).
- **Flujos alternativos:**
  - *FA-01 (Modo Invitado):* El jugador pulsa `"Jugar como invitado (sin guardar)"`; se activa `{ invitado: true }` sin persistir progreso (`frontend/src/cuenta/cuenta.js:L84-L87`).
  - *FA-02 (Recuperación automática de pestaña):* Al recargar la página, `sesion()` recupera `{ nombre, clave }` de `sessionStorage`, valida la firma HMAC y restaura la sesión sin pedir contraseña de nuevo (`frontend/src/cuenta/cuenta.js:L121-L128`).
- **Excepciones:**
  - *EX-01 (Credenciales inválidas o usuario inexistente):* Devuelve el mismo mensaje genérico `"Nombre o contraseña incorrectos."` e incrementa fallos; a partir del 3.º fallo aplica bloqueo exponencial $2^{n-3} \times 5\text{ s}$ hasta 300 s (`frontend/src/cuenta/cuenta.js:L62-L68`).
  - *EX-02 (Datos adulterados en `localStorage`):* Si `firmaValida()` falla, restablece `datos` a valores iniciales, vuelve a firmar y muestra el aviso `"Los datos guardados de esta cuenta fueron modificados y se restablecieron."` (`frontend/src/cuenta/cuenta.js:L73-L78`).
- **Postcondiciones:** Sesión autenticada localmente con progreso íntegro cargado.
- **Criterios de aceptación:** Mensajes uniformes ante usuario inexistente/clave errónea, bloqueo tras 3 intentos y restablecimiento automático ante manipulación de `localStorage`.
- **Evidencia de pruebas:** `TC-SEC-003`, `TC-SEC-004`, `TC-SEC-006`, `TC-SEC-007` en `frontend/tests/security-account.test.js`.

---

### CU-004 — Comenzar partida
- **Actor principal:** Jugador (`ACT-001`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Inicia la acción del juego desde la pantalla principal, posicionando a Max en el nivel correspondiente y habilitando controles, sonido y HUD.
- **Precondiciones:** Estado `"inicio"` alcanzado tras `iniciar()`.
- **Flujo principal:**
  1. El jugador hace clic en el botón `"Jugar"` (`#btn-jugar`, `frontend/src/main.js:L153`).
  2. Si el dispositivo es táctil, solicita pantalla completa y orientación horizontal (`frontend/src/main.js:L155`, `frontend/src/interfaz/dispositivo.js:L75-L84`).
  3. Inicializa el sintetizador `AudioContext` (`sonido.iniciar()`, `frontend/src/main.js:L156`).
  4. Cambia `estado` a `"jugando"`, oculta `#pantalla`, muestra `#ui` y solicita `requestPointerLock()` en escritorio (`frontend/src/main.js:L157-L160`).
  5. Muestra el mensaje inicial `"Habla con Daniel (E) para recibir tus misiones."` (`frontend/src/main.js:L161-L164`).
- **Postcondiciones:** Estado `"jugando"`, personaje ubicado sobre tierra firme en `mundo.spawn` fuera de obstáculos y HUD activo.
- **Criterios de aceptación:** Personaje jugable inmediatamente sin caer al vacío ni nacer atrapado en obstáculos.
- **Evidencia de pruebas:** `TC-DOM-004` (`frontend/tests/gameplay-domain.test.js`) y verificaciones de spawn en `frontend/src/herramientas/pruebas.js:L72`, `:L80`.

---

### CU-005 — Explorar escenario 3D
- **Actor principal:** Jugador (`ACT-001`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Desplazamiento en tercera persona por el terreno 3D, incluyendo carrera, salto, natación (crol en mar y braza en oasis), colisiones y seguimiento de cámara.
- **Precondiciones:** Estado `"jugando"` y `jugador.vivo === true`.
- **Flujo principal:**
  1. El jugador utiliza `WASD`, flechas/ratón o el joystick táctil (`frontend/src/main.js:L446-L456`).
  2. `moverJugador(dt)` calcula el vector de dirección relativo al `yaw` de la cámara y suaviza la velocidad horizontal (`3.4 m/s` caminando, `6.4 m/s` corriendo, `frontend/src/main.js:L458-L470`).
  3. Verifica límites del mapa (`mundo.dentroDelMapa(nx, nz)`) y resuelve colisiones circulares (`mundo.resolver(jugador.pos, 0.42)`, `frontend/src/main.js:L473-L485`).
  4. Evalúa estado de natación con histéresis (`-0.45 m` para entrar, `-0.15 m` para salir) o aplica salto (`vy = 7.2`) y gravedad (`19 m/s²`) anclando sobre `mundo.altura(x, z)` (`frontend/src/main.js:L488-L517`).
  5. `actualizarAnimacionJugador(dt)` interpola las articulaciones del esqueleto, gestiona el sombrero de Max y emite sonidos de pasos o brazadas (`frontend/src/main.js:L520-L547`).
  6. `vista.actualizar(dt, ctx)` posiciona la cámara evitando atravesar obstáculos y terreno (`frontend/src/juego/camara.js:L42-L92`).
- **Flujos alternativos:**
  - *FA-01 (Límite del mapa):* Si el jugador intenta salir del radio permitido (`tema.limite`), se detiene el avance exterior y se muestra `mundo.tema.limiteTexto` cada 5 s (`frontend/src/main.js:L481-L484`).
- **Postcondiciones:** Posición de Max, cámara y animaciones actualizadas coherentemente.
- **Criterios de aceptación:** Movimiento fluido, sin atravesar árboles/rocas/pilares ni hundirse en el terreno.
- **Evidencia de pruebas:** `TC-DOM-004` (`frontend/tests/gameplay-domain.test.js`) y `frontend/src/herramientas/pruebas.js:L75-L88`, `:L120-L136`.

---

### CU-006 — Interactuar con NPC
- **Actores:** Jugador (`ACT-001`) y NPC / Daniel (`ACT-003`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Aproximación a Daniel, visualización del indicador contextual y avance por las líneas de diálogo.
- **Precondiciones:** Estado `"jugando"`, `jugador.vivo === true` y distancia a `danielPos < 3.6 m`.
- **Flujo principal:**
  1. El jugador se acerca a menos de `3.6 m` de Daniel (`frontend/src/main.js:L629`).
  2. Daniel gira suavemente para mirar a Max y el sistema muestra `"Pulsa E para hablar con Daniel"` (o el botón táctil `HABLAR`, `frontend/src/main.js:L630-L632`).
  3. El jugador pulsa `E` (o toca `HABLAR` / el cuadro de diálogo en móvil, `frontend/src/main.js:L102-L103`, `:L148`).
  4. `hablarConDaniel()` inicia o avanza el índice `dialogo.i` y llama a `mostrarLinea(dialogo)` (`frontend/src/main.js:L299-L326`, `frontend/src/interfaz/hud.js:L52-L58`).
  5. Mientras `dialogo` está activo, el movimiento y el ataque de Max quedan bloqueados (`frontend/src/main.js:L101`, `:L446`).
- **Postcondiciones:** Línea de diálogo presentada en `#dialogo` o diálogo finalizado.
- **Criterios de aceptación:** Indicación visible al acercarse; bloqueo de golpes accidentales durante la conversación.
- **Evidencia de pruebas:** `TC-DATA-002` (`frontend/tests/game-data.test.js`).

---

### CU-007 — Recibir una misión
- **Actor principal:** Jugador (`ACT-001`), asistido por NPC / Daniel (`ACT-003`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Al finalizar el guion de Daniel en el nivel actual, el sistema registra las misiones como aceptadas y despliega la lista de objetivos en el HUD.
- **Precondiciones:** Estar interactuando con Daniel (`CU-006`) con `misionesAceptadas === false`.
- **Flujo principal:**
  1. El jugador avanza hasta la última línea de `GUIONES[nivel]` y pulsa `E` para aceptar la misión (`frontend/src/main.js:L306`).
  2. El sistema cierra la caja de diálogo, establece `misionesAceptadas = true`, reproduce sonido de confirmación y muestra `"Misiones recibidas: revisa el panel de la izquierda."` (`frontend/src/main.js:L307-L314`).
  3. En el siguiente cuadro, `actualizarObjetivosJugador()` invoca `pintarObjetivos(lista)` mostrando los objetivos específicos del nivel (`frontend/src/main.js:L616-L624`, `frontend/src/juego/datos.js:L48-L61`).
  4. El indicador `#pista` cambia de `"Daniel: X m"` a la distancia hacia el ídolo más cercano o el oasis (`frontend/src/main.js:L638-L651`).
- **Postcondiciones:** `misionesAceptadas === true` y objetivos visibles en `#objetivos`.
- **Criterios de aceptación:** Objetivos claros, medibles y actualizados en tiempo real en el panel izquierdo.
- **Evidencia de pruebas:** `TC-DOM-001` (`frontend/tests/gameplay-domain.test.js`).

---

### CU-008 — Completar una misión
- **Actor principal:** Jugador (`ACT-001`), Sistema de Juego (`ACT-002`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Cumplimiento de todas las actividades del nivel actual y activación del portal/vehículo de salida.
- **Precondiciones:** Estado `"jugando"` y `misionesAceptadas === true`.
- **Flujo principal:**
  1. El jugador recoge los 2 ídolos dorados acercándose a `< 1.5 m` (`obj.idolos++`, `frontend/src/main.js:L597-L609`).
  2. Derrota a los mercenarios del nivel (2 en Isla, 3 en Montaña, 4 en Desierto; `obj.derrotados++`, `frontend/src/juego/combate.js:L13`).
  3. Cumple los objetivos extra del bioma (`frontend/src/main.js:L612-L614`):
     - Nivel 1 (Isla): acercarse a `< 4.2 m` de las ruinas/altar (`obj.altar = true`).
     - Nivel 2 (Montaña): escalar al altar (`< 4.2 m`) y acercarse a `< 3.4 m` de la fogata/antorcha (`obj.fogata = true`).
     - Nivel 3 (Desierto): nadar `15 m` en el estanque del oasis (`obj.nado >= 15`).
  4. Cuando `lista.every(([, ok]) => ok)` se cumple y `metaLista` es `false`, el sistema marca `metaLista = true`, activa el haz luminoso del altar (`mundo.activarAltar()`) y despliega la salida (`mundo.mostrarPortal(...)`, `frontend/src/main.js:L617-L623`).
- **Postcondiciones:** Portal y vehículo de salida (`bote`, `refugio` o `caravana`) visibles y activos en `mundo.salida`, e indicador `#pista` apuntando a `"Salida: X m"`.
- **Criterios de aceptación:** La salida solo se habilita tras haber hablado con Daniel y completado el 100% de los objetivos del nivel.
- **Evidencia de pruebas:** `TC-DOM-001` (`frontend/tests/gameplay-domain.test.js`) y `frontend/src/herramientas/pruebas.js:L39-L46`.

---

### CU-009 — Combatir enemigos
- **Actor principal:** Jugador (`ACT-001`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Ejecución de ataques cuerpo a cuerpo (puños, cuchillo, bate, machete) o a distancia (pistola) contra los mercenarios.
- **Precondiciones:** Estado `"jugando"`, `jugador.vivo === true`, `!jugador.nadando`, `!dialogo` y `jugador.golpeCooldown <= 0`.
- **Flujo principal:**
  1. El jugador presiona `F`, `J`, clic izquierdo o el botón táctil `GOLPEAR`/`DISPARAR` (`frontend/src/main.js:L101`, `:L111`, `:L144`).
  2. Si lleva pistola (`jugador.arma?.tipo === "pistola"`):
     - Establece `golpeCooldown = 0.35`, orienta a Max hacia la cámara y llama a `dispararJugador()` (`frontend/src/main.js:L354-L358`).
     - Busca el mercenario vivo más cercano dentro de `18 m` con desviación lateral `< 0.7 m`, dibuja traza y fogonazo durante 60–70 ms y aplica `1.5` de daño (`frontend/src/juego/combate.js:L36-L67`).
     - Descuenta munición y si llega a 0 guarda la pistola (`frontend/src/juego/suministros.js:L71-L78`).
  3. Si pelea cuerpo a cuerpo:
     - Inicia la animación `axel.golpear()`, establece `golpeCooldown = 0.55 s` y programa el impacto en `INSTANTE_IMPACTO = 0.25 s` (`frontend/src/main.js:L360-L364`).
     - Al cumplirse `golpePendiente < 0`, `resolverGolpe()` verifica mercenarios dentro del alcance (`2.2 m` con puños, `arma.alcance + 0.65 m` con arma) en el cono frontal (`dot > 0.2`) y aplica daño (`1` puños, `1.5` cuchillo, `2` machete, `2.5` bate, `frontend/src/juego/combate.js:L21-L33`).
  4. El mercenario retrocede por empuje, destella en rojo y, cuando su vida (`3`) llega a `<= 0`, pasa a estado `"muerto"`, ejecuta animación de caída e incrementa `obj.derrotados` (`frontend/src/personajes/enemigo.js:L45-L58`).
- **Postcondiciones:** Vida del mercenario reducida o mercenario neutralizado y retirado de la escena tras 6 s (`frontend/src/personajes/enemigo.js:L129-L133`).
- **Criterios de aceptación:** Colisiones de golpe/disparo precisas, retroceso físico y conteo exacto de bajas.
- **Evidencia de pruebas:** `TC-DOM-003` (`frontend/tests/gameplay-domain.test.js`) y suite de combate en `frontend/src/herramientas/pruebas.js:L138-L178`.

---

### CU-010 — Recibir daño
- **Actor principal:** Sistema de Juego (`ACT-002`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Procesamiento de eventos de daño sobre Max provenientes de ataques cuerpo a cuerpo enemigos, proyectiles de pistola o hipotermia en la montaña.
- **Precondiciones:** `jugador.vivo === true`.
- **Flujo principal:**
  1. El sistema detecta un impacto enemigo (`frontend/src/personajes/enemigo.js:L97-L105`, `:L190-L193`) o daño continuo por congelación (`frontend/src/main.js:L577-L584`).
  2. En caso de ataque o disparo enemigo, invoca `danar(cantidad, mortal, zona, empuje, herida)` (`frontend/src/main.js:L369-L382`):
     - Si `jugador.invulnerable > 0` y el golpe no es `mortal` (cabeza o pecho), se ignora el daño para evitar impactos múltiples instantáneos (`:L370`).
     - Reduce `jugador.vida` (o la fija en `0` si `mortal === true`), activa `jugador.invulnerable = 0.6 s`, activa destello rojo en Max y viñeta `#dano`, sacude la cámara y reproduce `sonido.dolor()` (`:L372-L378`).
     - Si sobrevive y el impacto produjo `herida` (`brazo`, `abdomen`, `pierna`, `rodilla`), activa la pose de dolor `axel.herir()` (`:L381`).
  3. En el bucle principal, `actualizarHudJugador()` actualiza el ancho de `#barra-vida` y aplica la clase `.baja` si `vida < 35` (`frontend/src/main.js:L654-L663`).
- **Postcondiciones:** Vida de Max actualizada en estado y HUD, o transición a muerte si `vida <= 0`.
- **Criterios de aceptación:** Ventana de invulnerabilidad de `0.6 s` respetada en golpes no mortales; daño localizado de proyectiles según altura y desplazamiento lateral.
- **Evidencia de pruebas:** `TC-DOM-002`, `TC-DOM-003` (`frontend/tests/gameplay-domain.test.js`) y `frontend/src/herramientas/pruebas.js:L180-L207`.

---

### CU-011 — Morir y mostrar derrota
- **Actor principal:** Sistema de Juego (`ACT-002`).
- **Estado de implementación:** **IMPLEMENTADO** (con política `POL-FSM-001` verificada; módulos FSM aislados pendientes de autorización para integración).
- **Descripción:** Cuando la vida de Max llega a cero, cambia su estado lógico a muerto, reproduce la caída y el sonido de derrota, y tras 1500 ms muestra la pantalla final de derrota.
- **Precondiciones:** `jugador.vida <= 0` estando `jugador.vivo === true`.
- **Flujo principal:**
  1. `matarJugador(empuje)` establece `jugador.vivo = false` impidiendo nuevos controles, ataques o daños adicionales (`frontend/src/main.js:L384-L385`).
  2. Invoca `axel.morir(undefined, empuje)` calculando la dirección de desplome (`adelante`, `atras` o `lado`) y reproduce `sonido.derrota()` (`frontend/src/main.js:L386-L387`).
  3. Programa `setTimeout(() => terminar("derrota"), 1500)` (`frontend/src/main.js:L388`).
  4. Al cumplirse los `1500 ms`, `terminar("derrota")` verifica que el estado no sea ya terminal (`if (estado === "victoria" || estado === "derrota") return;`), asigna `estado = "derrota"`, libera el bloqueo del puntero (`exitPointerLock()`) y llama a `pantallaFinal("derrota", ...)` (`frontend/src/main.js:L402-L413`).
- **Política `POL-FSM-001`:** Si el jugador pausa durante los 1500 ms posteriores a la muerte lógica, el temporizador continúa y transiciona legítimamente de `"pausa"` a `"derrota"`.
- **Excepciones / Riesgos identificados:**
  - Si el jugador muere por frío/disparo justo al tocar el portal de victoria o al iniciar una cinemática, `terminar()` impide que un segundo estado terminal sobrescriba al primero (`main.js:L403`).
- **Postcondiciones:** Estado `"derrota"`, pantalla `"FIN DEL JUEGO"` visible con botón `"Jugar de nuevo (R)"`.
- **Criterios de aceptación:** Muerte única, animación de desplome anclada al suelo y cumplimiento de `POL-FSM-001`.
- **Evidencia de pruebas:** `TC-FSM-007` (`frontend/tests/game-state-characterization.test.js`), `frontend/tests/game-state-coordinator.test.js` (46 tests) y `frontend/tests/game-state-recovery.test.js` (30 tests).

---

### CU-012 — Pausar y reanudar
- **Actor principal:** Jugador (`ACT-001`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Suspende la actualización del jugador, enemigos y cinemáticas manteniendo el renderizado de la escena y permitiendo reanudar en el estado previo (`jugando` o `cinematica`).
- **Precondiciones:** Estado `"jugando"` o `"cinematica"`.
- **Flujo principal:**
  1. El jugador presiona `Esc` (liberando `pointerLock`), cambia de pestaña (`visibilitychange`) o pulsa el botón táctil `II` (`frontend/src/main.js:L126-L128`, `:L146`, `:L151`).
  2. `pausar()` cambia `estado = "pausa"`, actualiza `#pantalla-titulo` a `"PAUSA"`, el botón a `"Continuar"` y muestra `#pantalla` (`frontend/src/main.js:L130-L136`).
  3. Durante `"pausa"`, `animar()` detiene el avance de `tiempoFinal`, `actualizarJugador(dt)`, enemigos y `cine.actualizar(dt)`, pero mantiene la respiración de Max, el agua/fuegos del mundo y `renderer.render(scene, camera)` (`frontend/src/main.js:L690-L728`).
  4. Al pulsar `"Continuar"`, el sistema restablece `estado = cine ? "cinematica" : "jugando"`, oculta `#pantalla`, muestra `#ui` y solicita `bloquearRaton()` (`frontend/src/main.js:L153-L160`).
- **Postcondiciones:** Partida o cinemática reanudada exactamente donde se encontraba.
- **Criterios de aceptación:** Pausar no corrompe el cronómetro `tiempoFinal`, ni las cinemáticas en curso, ni el progreso del nivel.
- **Evidencia de pruebas:** `TC-FSM-003`, `TC-FSM-004` (`frontend/tests/game-state-characterization.test.js`) y `frontend/tests/game-state.test.js`.

---

### CU-013 — Reproducir cinemática
- **Actor principal:** Sistema de Juego (`ACT-002`), iniciado por Jugador (`ACT-001`) durante el diálogo con Daniel.
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Reproduce las secuencias narrativas en tiempo real con Three.js en el Nivel 1 (accidente de avión en el mar y llegada inconsciente de Max a la playa).
- **Precondiciones:** Estar en el diálogo del Nivel 1 (`CINEMATICAS[0] = { 1: "avion", 2: "playa" }`) y no haber reproducido antes esa secuencia (`!cinesHechas.has(...)`).
- **Flujo principal:**
  1. Al avanzar a la línea 1 o 2 del diálogo en el Nivel 1, `hablarConDaniel()` registra la secuencia en `cinesHechas`, oculta `#dialogo`, cambia `estado = "cinematica"` e instancia `crearCinematicaAvion` (24 s) o `crearCinematicaPlaya` (15 s) en `ORIGEN = (3000, 0, 3000)` (`frontend/src/main.js:L315-L324`, `frontend/src/escenario/cineUtil.js:L9`).
  2. En cada cuadro (si `estado !== "pausa"`), `cine.actualizar(dt)` anima los objetos, partículas, subtítulos accesibles y cámara cinemática (`frontend/src/main.js:L719`, `frontend/src/escenario/cinematica.js:L117-L195`, `frontend/src/escenario/cinematicaPlaya.js:L73-L98`).
  3. Al completarse la duración o cuando el jugador pulsa `E` / `Enter` / `Espacio` (o toca la pantalla en móvil) para saltar (`ui.saltar = true`), `terminar()` retira el grupo `g` de la escena, elimina los subtítulos, apaga el fundido y devuelve `false` (`frontend/src/escenario/cineUtil.js:L38-L55`).
  4. `main.js` limpia `cine = null`, restablece `estado = "jugando"`, devuelve la cámara a `jugador.pos` y muestra la línea de diálogo correspondiente (`frontend/src/main.js:L719-L724`). Tras la cinemática del avión, Max pasa a llevar el sombrero en la cabeza (`cinematicasVistas.add(0)`, `frontend/src/main.js:L318`, `:L533`).
- **Postcondiciones:** Retorno limpio al diálogo con Daniel y sombrero de Max actualizado.
- **Criterios de aceptación:** Cada cinemática se reproduce una sola vez por partida, puede saltarse sin dejar objetos residuales y no reabre estados terminales.
- **Evidencia de pruebas:** `TC-DATA-003` (`frontend/tests/game-data.test.js`), `TC-FSM-005` (`frontend/tests/game-state-characterization.test.js`).

---

### CU-014 — Cambiar de nivel
- **Actor principal:** Sistema de Juego (`ACT-002`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Transición desde el portal de salida de los niveles 1 y 2 hacia el siguiente bioma, liberando la memoria GPU del escenario anterior y construyendo el nuevo nivel.
- **Precondiciones:** `mundo.portal.activo === true`, `jugador.vivo === true`, `!cambiandoNivel` y distancia de Max al portal `<= 2.4 m` en los niveles `0` (Isla → Montaña) o `1` (Montaña → Desierto).
- **Flujo principal:**
  1. `revisarPortal()` detecta a Max dentro del radio del portal (`2.4 m`), activa el cerrojo `puedeTeletransportar = false` (3 s) y `cambiandoNivel = true` (`frontend/src/main.js:L329-L341`).
  2. Reproduce `sonido.victoria()` y activa el fundido a negro (`fundido.style.opacity = 1`, `frontend/src/main.js:L339-L341`).
  3. Tras `700 ms`, ejecuta `await empezarNivel(nivel + 1)` (`frontend/src/main.js:L342-L346`):
     - Persiste el nuevo nivel en la cuenta (`cuenta.guardarNivel(n)`, `:L237`).
     - `cargarMundo(n)` libera geometrías, materiales y texturas del nivel previo (`liberar(scene, mundo.objetos)`) y construye el nuevo escenario (`:L226-L232`, `frontend/src/escenario/utilidades.js:L29-L40`).
     - Reinicia contadores de objetivos `obj`, restaura vida mínima a `60`, limpia suministros y mercenarios anteriores e instancia los nuevos mercenarios y a Daniel junto al nuevo `spawn` (`:L240-L263`).
     - Posiciona a Max en el nuevo `spawn`, configura el sistema de frío/calor si el bioma es montaña y ejecuta `precalentar()` (`:L265-L274`).
  4. Desvanece el fundido a negro (`fundido.style.opacity = 0`) y anuncia el nuevo nivel (`frontend/src/main.js:L344-L345`).
- **Postcondiciones:** Nuevo nivel cargado sin fugas de memoria WebGL y progreso actualizado en `localStorage`.
- **Criterios de aceptación:** Ausencia de recursos mezclados entre biomas; liberación verificada de geometrías y texturas.
- **Evidencia de pruebas:** Pruebas de los 3 mundos en `frontend/src/herramientas/pruebas.js:L68-L90`.

---

### CU-015 — Alcanzar victoria
- **Actor principal:** Jugador (`ACT-001`), Sistema de Juego (`ACT-002`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Al llegar al vehículo de salida (caravana) del tercer y último nivel (El Desierto Ardiente) tras cumplir sus misiones, el juego presenta la escena final de Max descansando en su cabaña con el ídolo recuperado y registra la victoria.
- **Precondiciones:** Estar en el último nivel (`nivel === 2`), haber completado los objetivos (`metaLista === true`) y entrar en el radio de la caravana (`<= 2.4 m`).
- **Flujo principal:**
  1. `revisarPortal()` detecta que `nivel === NIVELES.length - 1` e invoca `terminar("victoria")` (`frontend/src/main.js:L335-L338`).
  2. `terminar("victoria")` verifica que no esté ya en estado terminal, fija `estado = "victoria"`, libera el puntero, reproduce `sonido.victoria()` y calcula `segundos = Math.round(tiempoFinal)` (`frontend/src/main.js:L402-L408`).
  3. Invoca `irACasa()`, que oculta los objetos del desierto, retira mercenarios y a Daniel, y monta la cabaña interior en `CASA_POS = (5000, 0, 5000)` con Max descansando en su cama y el ídolo dorado iluminado en la repisa (`frontend/src/main.js:L392-L400`, `frontend/src/escenario/casa.js:L4-L85`).
  4. Invoca `cuenta.registrarVictoria(segundos)`, que reinicia el nivel guardado a `0`, incrementa `victorias` y actualiza `mejorTiempo` si es menor al anterior (`frontend/src/main.js:L410`, `frontend/src/cuenta/cuenta.js:L111-L115`).
  5. Muestra `pantallaFinal("victoria", segundos, 3)` con el título `"¡MISIÓN CUMPLIDA!"` y el tiempo total (`frontend/src/interfaz/hud.js:L74-L83`).
- **Postcondiciones:** Estado terminal `"victoria"`, escena 3D de la cabaña con cámara orbital y estadísticas firmadas en `localStorage`.
- **Criterios de aceptación:** Victoria única e idempotente; cierre narrativo visual en la cabaña.
- **Evidencia de pruebas:** `TC-SEC-007` (`frontend/tests/security-account.test.js`) y `frontend/tests/game-state.test.js`.

---

### CU-016 — Guardar y recuperar progreso
- **Actor principal:** Jugador (`ACT-001`), Servicio de Persistencia (`ACT-005`), Servicio de Autenticación Local (`ACT-006`).
- **Estado de implementación:** **IMPLEMENTADO** (Persistencia automática por nivel y al alcanzar victoria).
- **Descripción:** Persistencia firmada criptográficamente del nivel actual, número de victorias y mejor tiempo de cada cuenta local, y restauración validada al iniciar sesión o recargar la pestaña.
- **Precondiciones:** Jugador con sesión de cuenta activa (`!actual.invitado`).
- **Flujo principal:**
  1. Al iniciar cada nivel (`empezarNivel(n)`) o al ganar (`registrarVictoria(segundos)`), `cuenta.js` encola la actualización en una promesa secuencial (`cola`, `frontend/src/cuenta/cuenta.js:L16`, `:L95-L108`).
  2. Se calcula una nueva firma `HMAC-SHA256` sobre la cadena canónica `1|nombre|nivel|mejorTiempo|victorias` usando la clave derivada en memoria (`frontend/src/cuenta/seguridad.js:L36-L41`).
  3. Se escribe el arreglo de usuarios en `localStorage` (`ideolo:v1:cuentas`, `frontend/src/cuenta/almacen.js:L41`).
  4. Al recuperar (`leerUsuarios()` y `entrar()`/`sesion()`), `registroValido()` filtra cualquier registro con esquema/tipos/rangos inválidos y `firmaValida()` comprueba el HMAC (`frontend/src/cuenta/almacen.js:L14-L40`, `frontend/src/cuenta/cuenta.js:L73-L78`, `:L126`).
- **Excepciones:**
  - *EX-01 (Manipulación manual de `localStorage` o JSON corrupto):* Los registros corruptos se descartan sin lanzar excepciones; si los datos de progreso fueron editados sin conocer la contraseña, la firma HMAC falla y los datos se restablecen de forma segura a `{ nivel: 0, mejorTiempo: null, victorias: 0 }`.
- **Postcondiciones:** Progreso persistido y restaurado de forma íntegra.
- **Criterios de aceptación:** Datos inconsistentes o editados manualmente en DevTools nunca rompen la ejecución del juego.
- **Evidencia de pruebas:** `TC-SEC-004`, `TC-SEC-005`, `TC-SEC-006`, `TC-SEC-007` (`frontend/tests/security-account.test.js`).

---

### CU-017 — Reiniciar partida
- **Actor principal:** Jugador (`ACT-001`).
- **Estado de implementación:** **IMPLEMENTADO**.
- **Descripción:** Reinicio limpio del juego tras alcanzar victoria o derrota.
- **Precondiciones:** Estado `"victoria"` o `"derrota"`.
- **Flujo principal:**
  1. El jugador presiona la tecla `R` (`frontend/src/main.js:L104`) o hace clic en el botón `"Jugar de nuevo (R)"` (`frontend/src/main.js:L165-L167`).
  2. El sistema ejecuta `location.reload()`, lo que destruye por completo el contexto WebGL, temporizadores y objetos en memoria de la partida anterior.
  3. Al recargar, `cuenta.sesion()` recupera automáticamente la sesión activa desde `sessionStorage` (`ideolo:v1:sesion`) sin obligar al usuario a escribir de nuevo su contraseña (`frontend/src/cuenta/cuenta.js:L121-L128`), y carga el nivel guardado actual.
- **Postcondiciones:** Nueva partida inicializada sin temporizadores ni efectos obsoletos.
- **Criterios de aceptación:** Ningún proyectil, enemigo ni temporizador de muerte de la partida anterior persiste tras el reinicio.
- **Evidencia de pruebas:** `frontend/tests/game-state-coordinator.test.js` y `frontend/tests/game-state-recovery.test.js` (para el ciclo aislado) e inspección de `main.js:L104`, `:L165`.

---

### CU-018 — Registrar eventos y errores
- **Actor principal:** Sistema de Juego (`ACT-002`).
- **Estado de implementación:** **PARCIAL**.
- **Descripción:** Registro de errores de inicialización, advertencias de precalentamiento de shaders y catálogo estructurado de diagnósticos en los adaptadores de estado aislados.
- **Evidencia actual en código:**
  - En `frontend/src/main.js:L284`: `console.warn("precalentar:", e)` si falla la compilación asíncrona de shaders.
  - En `frontend/src/main.js:L731-L734`: `console.error(err)` y mensaje al usuario si falla `iniciar()`.
  - En `frontend/src/cuenta/almacen.js` y `seguridad.js`: bloques `try/catch` silenciosos que evitan exponer claves, verificadores o contraseñas en la consola.
  - En `frontend/src/juego/game-state-adapters.js:L17-L18`, `:L247`: registro estructurado inmutable `errores.push(Object.freeze({ operacion, motivo }))` consultable mediante `getErrores()` sin exponer tokens ni secretos, y sin ejecutarse por frame.
- **Criterios de aceptación:** No existen `console.log` por frame en el bucle `animar()` ni se exponen contraseñas, sales o claves HMAC en consola.
- **Evidencia de pruebas:** `frontend/tests/game-state-recovery.test.js` (verificación de `getErrores()`).

---

### CU-019 — Validar seguridad
- **Actor principal:** Administrador / Desarrollador (`ACT-004`).
- **Estado de implementación:** **IMPLEMENTADO** (Suite automatizada de pruebas criptográficas y de integridad en Vitest + auditoría de código).
- **Descripción:** Ejecución de verificaciones locales autorizadas sobre derivación PBKDF2, firmas HMAC-SHA256, validación de esquemas en `localStorage`, resistencia a inyección XSS en DOM y control de fuerza bruta.
- **Precondiciones:** Entorno local del proyecto (`c:\Estudio\Seguridad-Multimedia`).
- **Flujo principal:**
  1. El desarrollador/auditor ejecuta `npm --prefix frontend test -- --run`.
  2. La suite `frontend/tests/security-account.test.js` verifica criptografía (`PBKDF2`, `HMAC`, comparación constante), rechazo de payloads XSS (`<script>alert(1)</script>`), manejo de JSON corrupto, detección de adulteración de progreso en `localStorage` y bloqueo exponencial por fuerza bruta.
  3. El auditor revisa las superficies DOM (`innerHTML` vs `textContent`) y la configuración de despliegue.
- **Postcondiciones:** Evidencia reproducible de controles defensivos y matriz de riesgos documentada en `docs/security/security-audit.md`.
- **Evidencia de pruebas:** `TC-SEC-001` a `TC-SEC-007` en `frontend/tests/security-account.test.js` (7 pruebas ejecutadas y aprobadas).

---

## 3. Matriz de Trazabilidad (Requisitos → Casos de Uso → Código → Pruebas)

| ID Requisito | Categoría | Descripción | Caso(s) de Uso | Evidencia en Código Fuente | Pruebas Automatizadas / Verificación | Estado |
|---|---|---|---|---|---|---|
| **RF-001** | Funcional | Inicialización del motor 3D, carga de modelos GLB y arranque de partida | CU-001, CU-004, CU-017 | `frontend/src/main.js:L28-L41`, `:L153-L220`, `:L731-L735` | `TC-FSM-001`, `TC-FSM-002`, `TC-FSM-006` (`game-state-characterization.test.js`) | **IMPLEMENTADO** |
| **RF-002** | Funcional | Control del personaje (movimiento, carrera, salto, nado, cámara, pausa) | CU-005, CU-012 | `frontend/src/main.js:L96-L168`, `:L441-L547`, `frontend/src/juego/camara.js:L10-L95`, `frontend/src/interfaz/tactil.js:L17-L122` | `TC-FSM-003`, `TC-FSM-004`, `TC-DOM-004` (`gameplay-domain.test.js`), `/pruebas.html` | **IMPLEMENTADO** |
| **RF-003** | Funcional | Generación y exploración de los 3 biomas (Isla, Montaña Nevada, Desierto Ardiente) | CU-005, CU-014 | `frontend/src/escenario/mundo.js:L16-L506`, `temas.js:L3-L27`, `terreno.js:L14-L42`, `vegetacion.js:L6-L185` | `TC-DATA-001` (`game-data.test.js`), `TC-DOM-004` (`gameplay-domain.test.js`), `/pruebas.html` | **IMPLEMENTADO** |
| **RF-004** | Funcional | Interacción con el NPC Daniel, diálogos, cinemáticas y recolección de 2 ídolos por nivel | CU-006, CU-007, CU-008, CU-013 | `frontend/src/main.js:L299-L326`, `:L594-L625`, `cinematica.js`, `cinematicaPlaya.js`, `datos.js:L7-L62` | `TC-DATA-002`, `TC-DATA-003`, `TC-DATA-004`, `TC-FSM-005`, `TC-DOM-001` | **IMPLEMENTADO** |
| **RF-005** | Funcional | Sistema de combate (puños y 4 armas), IA de mercenarios, daño, frío, muerte y derrota diferida (`POL-FSM-001`) | CU-009, CU-010, CU-011 | `frontend/src/juego/combate.js:L1-L68`, `frio.js:L1-L39`, `suministros.js:L1-L120`, `personajes/enemigo.js:L12-L271`, `main.js:L352-L389` | `TC-FSM-007`, `TC-DOM-002`, `TC-DOM-003`, `game-state-coordinator.test.js` (46), `game-state-recovery.test.js` (30) | **IMPLEMENTADO** |
| **RF-006** | Funcional | Activación del portal/vehículo al completar objetivos, transición de nivel y escena final de victoria en la cabaña | CU-008, CU-014, CU-015 | `frontend/src/escenario/portal.js:L6-L103`, `casa.js:L4-L85`, `main.js:L329-L347`, `:L392-L413` | `TC-DOM-001`, `game-state.test.js` (105), `/pruebas.html` | **IMPLEMENTADO** |
| **RF-007** | Funcional | Registro de cuentas locales, inicio de sesión y modo invitado | CU-002, CU-003 | `frontend/src/cuenta/cuenta.js:L33-L92`, `pantalla.js:L11-L85` | `TC-SEC-005`, `TC-SEC-006`, `TC-SEC-007` (`security-account.test.js`) | **IMPLEMENTADO** |
| **RF-008** | Funcional | Guardado y recuperación de progreso (nivel, victorias y mejor tiempo) | CU-016 | `frontend/src/cuenta/cuenta.js:L95-L133`, `almacen.js:L36-L52` | `TC-SEC-004`, `TC-SEC-006`, `TC-SEC-007` (`security-account.test.js`) | **IMPLEMENTADO** |
| **SEC-001** | Seguridad | Derivación criptográfica `PBKDF2-SHA256` (150 000 iteraciones, sal de 16 bytes) y separación de verificador y clave HMAC | CU-002, CU-003, CU-019 | `frontend/src/cuenta/seguridad.js:L10-L33` | `TC-SEC-001`, `TC-SEC-002`, `TC-SEC-003` (`security-account.test.js`) | **IMPLEMENTADO** |
| **SEC-002** | Seguridad | Firma y verificación de integridad `HMAC-SHA256` sobre el progreso almacenado en `localStorage` | CU-003, CU-016, CU-019 | `frontend/src/cuenta/seguridad.js:L35-L47`, `cuenta.js:L73-L78`, `:L95-L108` | `TC-SEC-004`, `TC-SEC-006` (`security-account.test.js`) | **IMPLEMENTADO** |
| **SEC-003** | Seguridad | Validación estricta de entradas, prevención de XSS (`textContent`), prevención de Prototype Pollution y bloqueo exponencial por fuerza bruta | CU-002, CU-003, CU-019 | `frontend/src/cuenta/almacen.js:L8-L40`, `cuenta.js:L21-L26`, `:L52-L68`, `pantalla.js:L1-L85` | `TC-SEC-005`, `TC-SEC-006` (`security-account.test.js`) | **IMPLEMENTADO** |
| **SEC-004** | Seguridad | Gestión de sesión por pestaña en `sessionStorage` y degradación segura a modo invitado | CU-003, CU-017 | `frontend/src/cuenta/almacen.js:L6`, `:L50-L52`, `cuenta.js:L28-L31`, `:L120-L132` | `TC-SEC-006`, `TC-SEC-007` (`security-account.test.js`) | **IMPLEMENTADO** (Con riesgo inherente client-side documentado) |
| **RNF-001** | No Funcional | Rendimiento 3D adaptativo: perfiles de calidad (`alta`/`media`/`baja`), `InstancedMesh` para vegetación, recorte por frustum de personajes, precalentamiento de shaders y resolución dinámica | CU-001, CU-005 | `frontend/src/interfaz/dispositivo.js:L33-L62`, `juego/detalle.js:L20-L76`, `escenario/vegetacion.js:L12-L34`, `main.js:L280-L286`, `:L417-L428` | Herramienta de medición `/rendimiento.html` (`frontend/src/herramientas/rendimiento.js`) | **IMPLEMENTADO** |
| **RNF-002** | No Funcional | Modularidad y separación de responsabilidades | Todos | Estructura en `escenario/`, `personajes/`, `juego/`, `interfaz/`, `cuenta/`, `audio/`, `herramientas/` | Build de producción Vite (`49 módulos transformados`) | **IMPLEMENTADO** (`main.js` mantiene acoplamiento de orquestación documentado en `ADR-001`) |
| **RNF-003** | No Funcional | Testabilidad determinista de reglas de estado, datos, dominio y seguridad | Todos | `frontend/tests/*.test.js` (8 archivos, 215 pruebas automatizadas) + `/pruebas.html` | `npm --prefix frontend test -- --run` (215 passed) | **IMPLEMENTADO** |
| **RNF-004** | No Funcional | Compatibilidad multiplataforma (escritorio con ratón/teclado, móviles/tabletas táctiles y equipos ARM/Raspberry Pi) | CU-001, CU-004, CU-005 | `frontend/src/interfaz/dispositivo.js`, `tactil.js`, `responsivo.css` | Inspección de código y media queries responsivas | **IMPLEMENTADO** |
