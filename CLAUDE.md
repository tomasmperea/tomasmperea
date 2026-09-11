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

El botón de la cabecera cicla entre automático, claro y oscuro, y la elección se guarda en el dispositivo.
Automático no estampa atributo y sigue al sistema. Cualquier color nuevo tiene que existir en los tres
bloques o va a fallar en uno de los tres estados.

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

## Cómo se prueba

Dos errores llegaron a la app publicada por probar mal, no por programar mal. Los dos son el mismo patrón:
una prueba que valida lo que suponemos en vez de lo que pasa.

**Empezá por el gesto, no por el evento.** Si la función se usa tocando un botón, la prueba toca el botón.
Disparar a mano el evento interno que ese botón debería producir saltea justamente el tramo donde vive el
bug. Los botones de importar quedaron muertos en el teléfono y ninguna prueba lo vio, porque todas
disparaban el evento del campo de archivo sin tocar nunca el botón.

Antes de dar por buena una función, preguntá: ¿qué toca la persona, y mi prueba toca eso?

**Un simulador replica el contrato, no lo que creemos.** Cuando algo se prueba contra una pieza de la
plataforma que no está disponible acá, el simulador se escribe leyendo el contrato, no de memoria. El primero
que escribimos copió una suposición equivocada sobre cómo se leen los datos, así que las pruebas pasaban
mientras la app se veía vacía. Queda `app/parts/db-mock.js` como referencia de cómo se hace.

**Lo que no se pudo verificar se dice.** Este entorno bloquea el repositorio de librerías externas, así que
nada que dependa de esa descarga se puede dar por funcionando. Se declara pendiente de la app publicada, con
los pasos para comprobarlo.

## Qué significa terminado

Una entrega está lista cuando cumple los criterios de aceptación del brief de la iteración, funciona en un
teléfono, y funciona igual en tema claro y oscuro.

**Y cuando pasó la auditoría.** Ninguna entrega se publica sin puntaje del rol `auditor`, y menos de 85
sobre 100 no se publica. La rúbrica está en `docs/auditoria/rubrica.md` y cada auditoría queda escrita en
`docs/auditoria/`. No hay excepción por urgencia: el arreglo urgente mal verificado ya costó tres
iteraciones seguidas en el mismo bug.

## La palabra "verificado"

Tiene una sola definición en este proyecto: **probado en el entorno donde la persona lo usa.** Para Valija,
eso es el Artifact publicado, abierto desde el teléfono.

Todo lo demás son sustitutos, y cada uno tiene una brecha conocida:

| Dónde se probó | Qué NO prueba |
|---|---|
| `node` sobre un módulo | Nada del DOM, del visor ni del gesto |
| Chromium de escritorio con el archivo local | El visor del teléfono, sus permisos y su sandbox |
| El Artifact publicado, en una computadora | El navegador y el visor del teléfono |
| El Artifact publicado, en el teléfono | Nada: es el entorno real |

Una entrega puede apoyarse en un sustituto. Lo que no puede hacer es **llamarlo verificado**. Se dice dónde
se probó, qué queda sin cubrir y cómo comprobarlo. Declarar una brecha nunca es una mala nota; afirmar sin
respaldo sí.

## Antes de dar algo por resuelto

Tres preguntas, en este orden. Si alguna no tiene respuesta, la entrega no está lista:

1. **¿Qué toca la persona, y mi prueba toca eso?**
2. **¿Qué otra causa explicaría el mismo síntoma, y qué hice para descartarla?** Dos hipótesis vivas exigen
   un experimento que las separe antes de tocar código. Si acá no se puede correr, se le pregunta al PM.
3. **¿Qué estoy afirmando que no comprobé?** Eso va escrito en la entrega, no en la cabeza.
