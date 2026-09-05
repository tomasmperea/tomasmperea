# Cómo trabaja el equipo

Valija se construye con un equipo de agentes especializados que trabajan en paralelo, coordinados por el
Product Owner. Este documento explica el proceso, para que cualquiera pueda retomarlo o sumar un rol nuevo.

## Los roles

Cada rol está definido en `.claude/agents/`. La definición incluye qué hace, qué entrega, sus reglas
innegociables y cómo se lo evalúa.

| Rol | Archivo | Dueño de |
|---|---|---|
| Diseñador UX/UI | `ux-designer.md` | `docs/design/`, `app/parts/*-ui.html` |
| Desarrollador de lógica | `logic-dev.md` | `app/parts/*-engine.js` y sus pruebas |
| Desarrollador frontend | `frontend-dev.md` | `app/valija.html` |
| QA | `qa-tester.md` | `docs/qa/` |
| Analista de producto | `product-analyst.md` | Métricas e instrumentación |

El Product Owner no está en esa lista porque no es un agente: es quien escribe el brief, reparte el trabajo,
valida las entregas y decide qué se integra.

## La regla que hace posible el paralelismo

**Un archivo tiene un solo dueño por iteración.**

Es la única regla que impide que el trabajo en paralelo se destruya a sí mismo. Sin ella, dos agentes
editando `app/valija.html` al mismo tiempo producen un archivo roto, y el tiempo ahorrado se pierde
resolviendo conflictos.

De ahí se desprende la estructura de `app/parts/`: el trabajo en paralelo se entrega como piezas autónomas y
un solo rol las integra después. Un agente que necesita un cambio en un archivo ajeno lo describe en su
entrega en lugar de hacerlo.

## El ciclo de una iteración

1. **El PO escribe el brief** en `docs/briefs/`. Contiene el problema, la hipótesis, las decisiones de
   producto ya tomadas y los criterios de aceptación. Es el contrato: todo se valida contra eso.

2. **Se reparte el trabajo en paralelo.** Diseño, lógica y análisis arrancan a la vez porque no comparten
   archivos. Cada uno recibe el brief, las convenciones del proyecto y su rol.

3. **El PO valida cada entrega** contra los criterios de aceptación. Una entrega que no cumple vuelve con el
   motivo, no se arregla por izquierda.

4. **La integración es secuencial.** El rol de frontend toma las piezas validadas y las integra. Va después,
   nunca en paralelo.

5. **QA prueba lo integrado** y reporta hallazgos con pasos para reproducir. No arregla lo que encuentra.

6. **El PO decide qué se corrige antes de publicar** y qué queda para la iteración siguiente.

## Qué se paraleliza y qué no

Se paraleliza lo que no comparte archivos ni depende de un resultado previo: diseño, lógica de negocio,
análisis, documentación.

No se paraleliza la integración, que es por definición el punto donde todo converge. Tampoco tiene sentido
paralelizar QA contra algo que todavía no existe.

La tentación de lanzar más agentes en paralelo choca contra esto: el límite no es cuántos agentes se pueden
lanzar, es cuántos flujos de trabajo genuinamente independientes tiene la iteración.

## Por qué el contexto compartido vive en un archivo

`CLAUDE.md` tiene las convenciones del proyecto: sistema de diseño, reglas de código, idioma de la interfaz.
Cada agente lo lee al arrancar.

Sin eso, cada encargo tendría que repetir las convenciones, y bastaría con olvidarse una vez para que un
agente invente su propia paleta de colores o escriba la interfaz en un español que no es el del producto.

## Sumar un rol nuevo

Se agrega un archivo en `.claude/agents/` con el mismo formato que los existentes: qué hace, cuándo se lo
usa, qué entrega, sus reglas innegociables y cómo se lo evalúa. Y se le asigna la propiedad de sus archivos,
sin pisar la de otro rol.

Un rol nuevo recién queda disponible en la sesión siguiente a su creación.
