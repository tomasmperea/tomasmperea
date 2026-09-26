# v36 — el resultado de la ronda del PM

**Fecha:** 26/09/2026 · **Build:** v36, Artifact Versión 30 · **Historia:** VAL-80

**Resultado textual del PM:** *"ya probé VAL-80 con el guión completo y esta OK"*.

Los cinco pasos de `docs/qa/v36-guion.md`, en su teléfono:

| | Qué contestaba | Resultado |
|---|---|---|
| 1 | `SUECIA` en Destino (IATA): quedan las seis letras y aparece el cartel | OK |
| 2 | Guarda sin bloquear y dice que va como pista | OK |
| 3 | Con `SUECIA`, el motivo de la lista habla de Noruega | OK |
| 4 | Con `ARN`, el motivo habla de Suecia | OK |
| 5 | El cartel en tema oscuro explícito | OK |

## Qué cierra esto

**El paso 3 era la hipótesis de la historia, y el aparato la confirmó.** Los arneses comprobaban qué texto le
llega al modelo —que dejó de llegarle «SUEC manda»—, no qué hace el modelo con él. Que razonara mejor con
«Noruega + pista SUECIA» estaba declarado como hipótesis sin comprobar. El PM lo comprobó.

**El par de los pasos 3 y 4 es lo que cierra el reporte original del 22/09**: el PM veía que la app le seguía
sugiriendo Noruega después de cargar un vuelo a Suecia. No era que ignorara el vuelo: el vuelo le llegaba
mutilado. Ahora, con un código el vuelo manda; sin código el destino escrito vuelve a mandar y el lugar viaja
igual como pista.

## La auditoría

`docs/auditoria/2026-09-24-val80.md`: 84/100, candidato, sin bloqueantes. Nombró dos huecos de honestidad y de
arnés, que se cerraron en `6079260` antes de publicar. La distancia hasta 85 era el entorno real, y el
entorno real contestó. No se vuelve a auditar: una auditoría por entrega, no una cadena.

## VAL-80 queda TERMINADA

Criterios cumplidos, andando en el teléfono, e igual en claro y oscuro.

**Lo que sigue abierto y no es de esta historia:** que el campo acepte nombres de ciudad es VAL-66; que la
banda de la etiqueta abrevie a tres letras es VAL-81.
