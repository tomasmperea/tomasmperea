# Valija — contexto del proyecto

App de planificación de viajes. Consolida en un solo lugar toda la información de un viaje, que hoy queda
repartida entre las distintas plataformas de servicios donde se contrató cada cosa.

**App publicada:** https://claude.ai/code/artifact/136a6d7e-9952-4edb-b6d3-11f6e69c8cb4
**Rama de trabajo:** `claude/travel-planning-app-mvp-jag9be`

## Estructura

| Ruta | Qué es |
|---|---|
| `app/valija.html` | La app completa. Un solo archivo, sin build ni framework. |
| `app/parts/` | Piezas en desarrollo, antes de integrarse a `valija.html`. |
| `docs/PRD.md` | Alcance, limitaciones conocidas y métricas. |
| `docs/roadmap.md` | Cuatro iteraciones con la pregunta que responde cada una. |
| `docs/backlog.md` | Historias con criterios de aceptación. |
| `docs/briefs/` | Brief de la iteración en curso. Es el contrato de trabajo. |
| `docs/design/` | Especificaciones de diseño. |
| `docs/qa/` | Casos de prueba y reportes de validación. |
| `docs/arquitectura.md` | Notas técnicas. |

## Regla de coordinación

Varios agentes trabajan en paralelo sobre este repo. **Un archivo tiene un solo dueño por iteración.**

Nadie edita `app/valija.html` salvo el rol de integración. El trabajo en paralelo se entrega en `app/parts/`
como piezas autónomas, y se integra en un paso posterior. Un agente que necesita cambiar algo en
`valija.html` lo describe en su entrega en lugar de editarlo.

## Sistema de diseño

Ya está definido en `app/valija.html` y no se reinventa. Se usan los tokens existentes.

**Color.** Tinta azul noche, fondo gris azulado, azul de señalética como acento, ámbar de tablero de salidas
para destacados. Verde, ámbar y rojo semánticos, separados del acento. Todos los colores salen de variables
CSS declaradas en `:root`, nunca literales. Cada token se redefine para tema oscuro en dos bloques: por
preferencia del sistema y por elección explícita del usuario.

**Tipografía.** Bricolage Grotesque para títulos, Public Sans para texto, DM Mono para datos: códigos IATA,
horarios, códigos de reserva y cantidades.

**Metáfora visual.** El mundo del viaje físico. Los viajes son etiquetas de equipaje con banda de color. Las
reservas son tarjetas de embarque con troquelado. Se mantiene esa línea.

**Mobile primero.** El contenedor es de 460px máximo. Se diseña para el pulgar, no para el mouse.

## Convenciones de código

- Vanilla JavaScript, sin frameworks. La única dependencia externa es jsPDF por CDN con versión fija.
- Funciones de render puras: reciben estado y devuelven HTML.
- Todo lo que viene de datos pasa por `esc()` antes de ir al HTML.
- La capa de datos está aislada en el objeto `Store`. Nada fuera de `Store` sabe si los datos vienen de la
  base compartida o de `localStorage`.
- Las capacidades de plataforma se piden con `claude.use()` y **siempre** se maneja el caso en que devuelve
  `null`. La app tiene que funcionar sin ellas.
- Foco visible en todo lo interactivo. Se respeta `prefers-reduced-motion`.

## Idioma

La interfaz habla español rioplatense, en segunda persona del singular con voseo. "Cargá", "pegá", "tenés".

Los mensajes de error dicen qué pasó y qué hacer. Nunca piden disculpas ni culpan al usuario.

Los nombres de campos en la interfaz son los que usa un viajero, no los del modelo de datos. Se dice "código
de reserva", no "confirmation".

## Qué significa terminado

Una entrega está lista cuando cumple los criterios de aceptación del brief de la iteración, funciona en un
teléfono, y funciona igual en tema claro y oscuro.
