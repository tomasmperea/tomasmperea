# Auditoría — v20, tercera ronda (commit `3a9354c0d205b16c9f0342cbbe51f4dedc971037`)

**Audita:** rol `auditor` · **Fecha:** 2026-09-18 · **Puntúa contra:** `docs/auditoria/rubrica.md`
**Árbol verificado quieto:** `git status --porcelain` vacío y `HEAD` en `3a9354c0d205b16c9f0342cbbe51f4dedc971037`,
comprobado al empezar y al terminar de escribir este archivo.

## Veredicto: NO PUBLICAR (por un hilo) — 83/100

Sube de 79 a 83. Los dos hallazgos reales de la segunda ronda están resueltos de verdad, no en apariencia:

- **El orden y el conteo del guion** se arreglaron reescribiendo el archivo entero, no parchando: ahora dice
  "son cuatro pruebas" en la intro, la Prueba 4 queda al final marcada como la nueva, y la tabla final
  cuenta las cuatro. Verificado leyendo el archivo completo.
- **La ambigüedad de "aparece cerrada"**, que yo había anotado como mejora no bloqueante y el entregador
  trató como bloqueante con razón: el paso nuevo le pide al PM confirmar primero que arriba hay **un solo
  botón** ("Subir el PDF") antes de mirar la caja. **Verifiqué esto leyendo el código, no el reporte**: la
  condición que cambió sólo diverge entre el código viejo y el nuevo cuando `sinImagenes === true` y
  `sinPdf === false`, y ese es EXACTAMENTE el único estado en el que `pickerHtml()` (`app/valija.html:9258`)
  devuelve un solo botón con ese texto. En cualquier otro estado (cero botones, o tres) la caja se hubiera
  visto cerrada con el código viejo también, y el nuevo paso 3 lo detecta y le dice al PM que pare. La
  discriminación es correcta, no aproximada.

Pero al reescribir el archivo entero se perdió una fila que sí estaba verificada y viva: el guion anterior
le pedía al PM avisar si veía el cartel de Android "Memoria insuficiente para completar la operación
anterior" — un síntoma que el propio `docs/briefs/adjuntar.md` sigue listando como **abierto, sin
conclusión, todavía por resolver** (línea 530: *"visto el 17/09. Sin conclusión, no es defecto
declarado"*). Esa fila no está en ningún lado del `v20-como-lo-compruebo-en-el-telefono.md` nuevo. Es un
hallazgo chico —una fila de tabla, un arreglo de una línea— pero es exactamente lo que se pidió cazar en
esta pasada ("que el guion reescrito no haya perdido nada de lo que ya estaba verificado"), y apareció.

`git diff --stat dce53f3 3a9354c -- app/` da vacío, confirmado. No hizo falta repetir arneses.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **25** | La brecha sigue declarada con precisión, y ahora el mecanismo para cerrarla (Prueba 4) discrimina de verdad el estado que hace falta, verificado contra el código y no sólo contra el reporte. No llega a 30 porque, correctamente, la prueba en el teléfono todavía no ocurrió — es candidata, no terminada. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | Sin cambios: no aplica causa raíz nueva en esta ronda. |
| 3 | Honestidad de lo verificado | 15 | **12** | El commit es transparente sobre su propio error ("el patrón de la documentación que describe el estado anterior, cometido en el artefacto que se editó para evitarlo") y no infla nada. Resta por la fila perdida del cartel de Android: un ítem que el propio brief sigue marcando abierto quedó fuera del canal que se supone que lo recolecta, sin que se lo mencione ni se decida conscientemente sacarlo. |
| 4 | Cumplimiento del contrato | 15 | **11** | De los tres pedidos de esta pasada, dos están completamente resueltos y verificados (que el guion no perdiera lo verificado — parcialmente, ver el hallazgo — y que la discriminación de la prueba 4 sea real). El pedido explícito "que el guion reescrito no haya perdido nada" no se cumple del todo: perdió la fila del cartel de Android. |
| 5 | Calidad interna | 15 | **12** | La reescritura es prolija, el paso a paso es más claro que antes, y el detalle de las capturas se consolidó bien en una nota general sin perder significado. La única baja es la fila desaparecida de la tabla "Qué me mandás". |
| 6 | Diseño y decisiones de producto | 10 | **9** | Sin cambios de fondo respecto a la ronda anterior. |
| **Total** | | **100** | **83** |

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "Ningún cambio en `app/` en esta ronda" | `git diff --stat dce53f3 3a9354c -- app/` | **Cierto**, salida vacía |
| El guion reescrito cuenta cuatro pruebas desde la intro y en la tabla final | Leí `docs/qa/v20-como-lo-compruebo-en-el-telefono.md` completo | **Cierto**: "Son cuatro pruebas" en la línea 5, tabla final dice "Las cuatro andan" → "anduvieron las cuatro" |
| Las cuatro pruebas quedaron en orden 1, 2, 3, 4 | Mismo archivo | **Cierto**, la Prueba 4 está al final, marcada "← ESTA ES LA NUEVA" |
| Todas las referencias del repo apuntan al archivo nuevo | `grep -rln "v19-como-lo-compruebo" . --include=*.md` fuera de `docs/auditoria/` | **Cierto**: ninguna referencia viva (fuera de los informes de auditoría históricos, que correctamente citan el nombre que tenía el archivo en el momento en que se escribieron) |
| El paso 3 de la Prueba 4 discrimina el estado correcto, no cualquier "un solo botón" casual | Leí `pickerHtml()` en `app/valija.html:9258-9284` y razoné la tabla de verdad de `sinImagenes`/`sinPdf` contra la condición del `<details>` (`app/valija.html:9319`) | **Cierto**: el único estado donde el código viejo y el nuevo producen resultados distintos (`sinImagenes=true`, `sinPdf=false`) es también el único estado donde `pickerHtml()` devuelve exactamente un botón de texto "Subir el PDF". Cualquier otro estado da cero botones o tres, y el guion lo detecta y frena la prueba |
| El encabezado del brief ya no se lee a "cierre" antes de la advertencia | Leí `docs/briefs/adjuntar.md:479` | **Cierto**: pasó de `## Cierre de la iteración 3 — 18/09` a `## Iteración 3 — 18/09: el defecto cerrado, la iteración todavía no` |
| La línea 402 del brief ("tres gestos") ya no queda desactualizada | Leí `docs/briefs/adjuntar.md:402-404` | **Cierto**: ahora dice "cuatro gestos... (Eran tres cuando se escribió esta línea; el cuarto se sumó el 18/09...)" — corrige el número y deja explícito por qué cambió, en vez de sólo pisarlo |
| El guion nuevo no perdió nada de lo verificado en las versiones anteriores | `diff` línea por línea contra el archivo viejo (`git show dce53f3:docs/qa/v19-....md`) | **Falso, parcialmente**: se perdió la fila "El teléfono muestra un cartel de 'Memoria insuficiente' → la captura" de la tabla "Qué me mandás". Todo lo demás (los tres gestos, el detalle del renglón gris, la explicación de la causa raíz, el "qué está probado y qué no") se preservó o se consolidó sin perder significado |

## Hallazgo (no bloqueante del todo, pero real)

**La fila del cartel de Android "Memoria insuficiente" desapareció del canal que la recolectaba.**
`docs/briefs/adjuntar.md` sigue listando ese cartel como un ítem abierto ("visto el 17/09. Sin conclusión,
no es defecto declarado" — línea 530, y también en "Lo que sigue abierto", línea 469). El guion viejo tenía
una fila explícita pidiéndole al PM que avisara si lo veía. El guion nuevo no la tiene en ningún lado —
ni en la tabla "Qué me mandás", ni en el `<details>` de abajo. No es un dato inventado ni una verificación
falsa: es una instrumentación que ya estaba viva y quedó afuera sin que nadie lo decida ni lo mencione. Es
menor porque no compromete la confirmación de la Prueba 4 (el objetivo central de esta ronda), pero es
exactamente el tipo de pérdida silenciosa que esta pasada pedía cazar, y apareció.

## Qué falta para llegar a 85 (una línea)

Agregar de nuevo a la tabla "Qué me mandás" de `docs/qa/v20-como-lo-compruebo-en-el-telefono.md` una fila
equivalente a la que tenía el archivo viejo:

```
| El teléfono muestra un cartel de "Memoria insuficiente" | la captura |
```

Con eso, y sin tocar nada más, este candidato cruza el piso.

## Lo que nadie puede verificar desde acá

Sin cambios respecto a la ronda anterior: no puedo confirmar desde este entorno que el Artifact publicado
sirva `3a9354c` ni que la Prueba 4 realmente se comporte así en el visor del teléfono del PM. Los pasos para
que el PM lo confirme son los de `docs/qa/v20-como-lo-compruebo-en-el-telefono.md`, que ahora sí están
completos, en orden, y discriminan el estado correcto — a falta de la fila del cartel de Android.
