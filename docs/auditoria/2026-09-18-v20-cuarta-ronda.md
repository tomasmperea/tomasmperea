# Auditoría — v20, cuarta ronda (commit `ff1ecc45d65155f910eac4e79ee36eed35cdfac4`)

**Audita:** rol `auditor` · **Fecha:** 2026-09-18 · **Puntúa contra:** `docs/auditoria/rubrica.md`
**Árbol verificado quieto:** `git status --porcelain` vacío y `HEAD` en `ff1ecc45d65155f910eac4e79ee36eed35cdfac4`,
comprobado al empezar y al terminar de escribir este archivo.

## Veredicto: PUBLICAR COMO CANDIDATA — 90/100

Cruza el piso. El único hallazgo que quedaba del 83 —la fila del cartel de Android perdida al reescribir el
guion— está resuelto, y resuelto mejor de lo que pedí: no sólo volvió la fila, sino que se le agregó el
párrafo que explica qué es, por qué se pide, qué no se puede mirar desde acá y que sigue sin conclusión.
Sin ese párrafo la fila pedía una captura sin decir para qué; con él, el PM entiende por qué se le sigue
preguntando por algo que no se resolvió hace un día.

`git diff --stat dce53f3 ff1ecc4 -- app/` da vacío: sin cambios en `app/` desde la segunda ronda, confirmado.
Comparé además el archivo completo contra la versión pre-reescritura (`dce53f3:docs/qa/v19-...md`, que
tengo guardada de la ronda anterior) y no encontré ninguna otra pérdida.

**"Publicar como candidata" y "dar la iteración por terminada" siguen siendo dos cosas distintas** (rúbrica,
sección "el candado"). Este veredicto es sobre la primera. La segunda sigue esperando una sola cosa, ya
declarada sin maquillaje en el propio brief: que el PM corra la Prueba 4 en su teléfono.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **25** | Sin cambios respecto a la ronda anterior: la brecha sigue declarada con precisión y el mecanismo para cerrarla discrimina el estado correcto (verificado contra el código en la ronda pasada). No llega a 30 porque, correctamente, la prueba en el teléfono todavía no ocurrió. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | Sin cambios: no aplica causa raíz nueva en esta ronda. |
| 3 | Honestidad de lo verificado | 15 | **14** | La fila perdida se restituye con su motivo explícito, sin minimizar. Y el commit hace algo que vale la pena reconocer: documenta la causa del propio error de proceso ("un diff línea por línea... lo pedí en el encargo y no lo apliqué yo mismo") en vez de sólo arreglar el síntoma. Es honestidad sobre el PROCESO, no sólo sobre el producto — la rúbrica no lo pide explícitamente, pero es exactamente el tipo de admisión que la rúbrica premia en otros lugares. No llega a 15 porque sigue siendo, en el fondo, una corrección de un hallazgo ajeno más que una verificación propia previa al commit. |
| 4 | Cumplimiento del contrato | 15 | **14** | El único pedido pendiente de la ronda anterior —restituir la fila sin perder nada más— se cumplió íntegro, verificado con diff completo contra ambas versiones anteriores. |
| 5 | Calidad interna | 15 | **14** | Cambio mínimo y quirúrgico (6 líneas), sin tocar nada que no hiciera falta tocar. El párrafo nuevo es corto y dice lo que tiene que decir sin inventar una causa para el cartel de Android, que es justamente la regla que este proyecto ya aprendió a las malas. |
| 6 | Diseño y decisiones de producto | 10 | **9** | Sin cambios de fondo. |
| **Total** | | **100** | **90** |

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "Sin cambios en `app/` desde `dce53f3`" | `git diff --stat dce53f3 ff1ecc4 -- app/` | **Cierto**, salida vacía |
| "Es la única cosa que cambió desde el 83" | `git diff --stat 3a9354c ff1ecc4` | **Cierto**: sólo `docs/qa/v20-como-lo-compruebo-en-el-telefono.md` (6 líneas) más mi propio archivo de la tercera ronda, que pasó de no trackeado a comiteado (no es un cambio de la entrega, es la auditoría anterior quedando en el árbol) |
| La fila volvió y trae el motivo | Leí el diff completo y el archivo resultante | **Cierto**: vuelve la fila a la tabla "Qué me mandás", y debajo un párrafo que dice que no es de la app, que no se puede mirar desde acá, que sigue sin conclusión y que no se lo llama defecto |
| No se perdió nada más al restituir la fila | `diff` línea por línea del archivo actual contra la versión pre-reescritura (`dce53f3:docs/qa/v19-como-lo-compruebo-en-el-telefono.md`) | **Cierto**: no encontré ninguna otra fila, paso o dato del guion original que falte |
| El párrafo nuevo no inventa una causa para el cartel de Android | Leí el texto agregado | **Cierto**: dice explícitamente "no es de la app... no tengo cómo mirarlo desde acá... no lo estoy llamando defecto" — exactamente la regla de "el mensaje de error no inventa una causa" que este proyecto tiene escrita |

## Lo que nadie puede verificar desde acá

Sin cambios respecto a las rondas anteriores: no puedo confirmar desde este entorno que el Artifact
publicado sirva `ff1ecc4`, ni que la Prueba 4 se comporte en el visor del teléfono del PM como se comportó
en el sustituto. El guion para que el PM lo confirme —`docs/qa/v20-como-lo-compruebo-en-el-telefono.md`— ya
está completo: cuatro pruebas en orden, la discriminación del estado correcto, y ahora también la fila del
cartel de Android con su motivo. No falta ninguna pieza documental para pedirle la ronda al PM; sólo falta
que la corra.
