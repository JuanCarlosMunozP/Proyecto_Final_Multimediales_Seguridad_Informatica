# Máquina de estados del videojuego

**Versión:** 0.1
**Estado:** Análisis preliminar
**Referencia:** main.js, commit 50dd8f9

## 1. Propósito

Documentar el ciclo de vida del videojuego
antes de extraer una FSM independiente.

## 2. Estados identificados

| Estado | Responsabilidad |
|---|---|
| cargando | Inicialización de recursos |
| inicio | Espera de inicio de partida |
| jugando | Actualización del gameplay |
| pausa | Suspensión temporal |
| cinematica | Secuencia narrativa |
| victoria | Finalización exitosa |
| derrota | Finalización por derrota |

## 3. Evidencias de código

- main.js:62 inicializa el estado.
- main.js:131 asigna pausa.
- main.js:157 reanuda juego o cinematica.
- main.js:208 asigna jugando.
- main.js:214 asigna inicio.
- main.js:320 asigna cinematica.
- main.js:404 asigna estado desde resultado.
- main.js:681 ejecuta requestAnimationFrame.
- main.js:728 ejecuta renderer.render.

## 4. Riesgos arquitectónicos

### FSM-001
Las transiciones se realizan mediante
asignaciones distribuidas en main.js.

### FSM-002
La pausa depende de contexto adicional,
incluyendo la cinematica activa.

### FSM-003
Las transiciones no poseen un contrato
centralizado de validación identificado.

## 5. Propuesta

Introducir una máquina de estados finitos
con transiciones explícitas.

Separar:
- Estado actual.
- Eventos de transición.
- Condiciones.
- Efectos secundarios.
- Adaptadores de interfaz.

## 6. Restricciones

- Preservar el comportamiento actual.
- No modificar el bucle de renderizado todavía.
- No introducir dependencias innecesarias.
- Crear pruebas de transición.
- Mantener compatibilidad con las cinemáticas.

## 7. Pendientes

- Analizar cada función que cambia estado.
- Verificar condiciones y efectos secundarios.
- Construir tabla formal de transiciones.
- Definir eventos.
- Elaborar ADR-002.
- Aprobar estrategia de migración.
