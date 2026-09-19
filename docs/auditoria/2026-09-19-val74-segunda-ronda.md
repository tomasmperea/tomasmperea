# Re-auditoría VAL-74, segunda ronda — cierre del veto de 38

**Commit auditado:** `dd64eeafdeb535f7dbac5694309945628febf898` · **Árbol:** limpio (`git status --porcelain`
vacío, antes y después de auditar) · **Publicado:** no (`VALIJA_VERSION` sigue en 23, sin bump en esta ronda,
consistente con que no se publicó nada nuevo).

## Veredicto: CANDIDATO — 84/100

Sube de 38 a 84. Queda **un punto por debajo del piso de "terminado" (85)**, y por la razón correcta según
`CLAUDE.md`: lo único que resta es el entorno real (medir con el modelo del teléfono), y eso está declarado
por escrito, con guion accionable para el PM. No hay ningún hallazgo verificable-acá que haya quedado sin
verificar. **Se puede publicar como candidato; para "terminado" falta la ronda del PM.**

No es 85 en vez de 84 por una razón concreta que detallo abajo: encontré un residuo real del mismo defecto
de método que causó el veto original — más chico, no cruza el tope en ningún escenario que probé, pero sí
demuestra que "ahora se mide, no se estima" no es 100% cierto todavía.

---

## Lo que pedían atacar, uno por uno

### 1. "Buscá el caso peor de nuevo, con lo que se te ocurra"

Reproduje primero el caso que rompía la v1 (motivo real de una frase, cupo 561): ahora entra. 3.000
propuestos con el motivo real que usé en la primera ronda entran 465 y la lista queda en 256.957 bytes,
coincide con lo que reportás.

Después probé cuatro escenarios nuevos, buscando romperlo por otro lado:

| Caso | Insumo | Ítems admitidos | Bytes reales finales | ¿Se pasa? |
|---|---|---|---|---|
| A | 5.000 propuestos, motivo mínimo (1 char), para maximizar CANTIDAD de ítems | 838 | 260.236 | no, pero a 1.908 bytes del tope |
| B | 2.000 propuestos, motivo de 280 caracteres acentuado, en el borde exacto del recorte | 409 | 256.791 | no |
| C | 2.000 propuestos, nombre y motivo en el tope exacto, acentuados | 540 | 258.040 | no |
| D | lista base **ya pasada de tope** (340.565 bytes) + 1 ítem más | — | — | **admite 0 ítems**, confirmado abajo |

Ninguno cruza el tope. Pero el caso A me llevó a algo que sí es un hallazgo real:

**`pesoGuardadoDeItem` mide la forma final del ítem, pero no es exactamente la forma final.** Compara lo
que asume contra lo que `makeItem()` realmente escribe (`packing-engine.js:1198-1215`, llamado desde
`enrichWithDestination`):

| Campo | Lo que asume `pesoGuardadoDeItem` | Lo que escribe `makeItem` de verdad |
|---|---|---|
| `regla` | `null` (4 bytes: `null`) | `"destino"` (9 bytes: `"destino"`) |
| `orden` | `0` (1 byte) | `orderOf(categoria, 800+i)`, un número real de hasta 4 dígitos |

Medí el sesgo exacto, ítem por ítem, sobre el caso A (script en el scratchpad de esta sesión): **8,00 bytes
de más por ítem, siempre en la misma dirección** (la real pesa más que la asumida). Con 838 ítems admitidos,
son 6.704 bytes — **el 81,8% del margen de seguridad de 8.192 bytes**, consumidos en silencio por dos campos
que el propio comentario de la función dice que se arman "en su forma final" y no es cierto para estos dos.

No llegó a cruzar el tope porque el peso mínimo de un ítem (con nombre y motivo casi vacíos) es ~283 bytes,
así que el máximo de ítems que entran en una lista (~900) queda por debajo del punto en el que este sesgo de
8 bytes/ítem se come el margen entero (~1.024 ítems). Es un margen real, pero mucho más fino que el que el
número "8.192" sugiere — quedó ahí por casualidad aritmética, no por diseño. Un futuro cambio que agregue un
campo más al ítem guardado, o que use `regla` con un valor más largo (por ejemplo si algún día se guarda
también el `id` de la regla), corre ese punto de quiebre más cerca.

**Esto es exactamente lo que pedían que buscara** — "que no haya quedado otra estimación escondida" — y hay
una, chica, con margen de sobra en la práctica, pero real: dos campos del ítem final siguen siendo un valor
supuesto, no medido.

### 2. "Que el recorte a 80/280 no rompa nada de lo que ya andaba"

Revisé los dos únicos call-sites de `recortar()` (`packing-engine.js:1683-1684`): están **exclusivamente**
dentro de `parseDestinationItems`, sobre `x.nombre`/`x.motivo` que vienen del JSON del modelo. Los motivos de
las reglas base (`BASE_RULES`, `packing-engine.js:656-849`, 20 a 90 caracteres) y los motivos del historial
(VAL-32, "Lo agregaste a mano en N viajes...") se arman por otro camino (`buildPackingList`) y nunca pasan
por `recortar`. No hay riesgo de que un motivo de regla se recorte de más — confirmado leyendo el código, no
supuesto.

También verifiqué el corte en el borde, con y sin espacios, con acentos (`val74-recortar2.js` en el
scratchpad): motivo de 280 exactos queda en 280; de 281 sin espacios queda en 280 (con "…"); nombre de 81 sin
espacios queda en 80. El off-by-one que ustedes mismos encontraron está bien cerrado, en todos los bordes que
probé, incluso con texto acentuado.

### 3. "El mensaje nuevo de `writeErr`: si sigue inventando algo, o si es tan vago que no sirve"

```
"No se pudo guardar. Puede ser que estés mirando una valija que no es tuya, o que esto ya no entre por tamaño"
```

No inventa una causa única: dice qué pasó ("no se pudo guardar") y ofrece las dos causas reales sin elegir,
que es justo lo que la base no distingue con ese código. Cumple la regla de `CLAUDE.md` de no inventar causa.
No es tan vago como para no servir: a diferencia del "no se pudo sincronizar" genérico, esta persona sabe que
hay dos cosas concretas para revisar, no una excusa de red.

De paso verifiqué que no quedó ningún OTRO lugar del código con el mensaje viejo colgado: hay un uso de
"Tenés acceso de sólo lectura" en `app/valija.html:6728`, pero es un caso distinto y correcto — el tooltip
del botón deshabilitado cuando `Store.canWrite` es `false`, que se decide en el sondeo de escritura inicial
(`meta/probe`, un documento fijo y chico, sin relación con el tamaño de ningún documento real) — no es un
resto del bug, es un uso legítimo del mismo texto en un contexto donde sí es cierto.

### 4. "Lo declarado: ¿alcanza con declararlo o hay que medirlo antes de publicar?"

Lo que se declaró en `docs/backlog.md` (diff de esta ronda, línea ~567 en adelante): que no se midió con el
modelo real cuántos ítems devuelve sin tope, con el criterio explícito para el guion del PM ("si ahora
sugiere veinte cosas y cinco son ruido, es peor que ocho buenas"). Esto es justo lo que la regla de
`CLAUDE.md` pide — escrito en la entrega, no en la cabeza — y resuelve el hallazgo de honestidad de la
primera ronda.

**Alcanza con declararlo, no hace falta medirlo antes de publicar como candidato**, por la razón que la
propia rúbrica ya resolvió en su "candado": esto es exactamente el hueco que el entorno real tiene que
cerrar, no algo verificable acá. `lote-modelo-real.js` ya está caveado en el propio proyecto como "sigue sin
probarse que el modelo del visor del teléfono conteste igual — es otro modelo" (`docs/briefs/adjuntar.md`),
así que correrlo acá daría un número que no representa al modelo real y podría dar falsa confianza — sería
peor que no correrlo. Sí recomiendo, como mejora antes de publicar (no como bloqueo), correr
`lote-modelo-real.js` con el prompt nuevo igual, aunque sea con el modelo de este entorno: un dato parcial,
bien etiquetado como "no es el modelo del teléfono", es mejor que ningún dato, y le da al PM algo con qué
comparar cuando mida en el suyo.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **22** | El sustituto (Node, motor extraído del HTML publicado) ahora sí mide lo que la base mide — bytes UTF-8 reales, con el mismo criterio que ya usaba `adjuntos-engine.js` — y el arnés ejercita motivos reales, el borde del recorte y una lista ya pasada de tope, no sólo el camino feliz. Sigue sin verificarse en el teléfono, y sigue sin verificarse cuánto devuelve el modelo real sin tope — pero las dos cosas están declaradas, no escondidas. No llega a 30 porque yo mismo encontré un sesgo de método (regla/orden asumidos, no medidos) que el arnés no cubre y que, aunque no cruza el tope hoy, es el mismo tipo de error que causó el veto, en miniatura. |
| 2 | Diagnóstico de causa raíz | 15 | **13** | La causa de fondo (estimar en vez de medir, y medir en caracteres en vez de bytes) está bien diagnosticada, bien corregida, y verificada con el caso exacto que la rompía. El piso de 1 también se corrigió correctamente a "negativo, no admite nada" — lo comprobé: una lista pasada de tope admite CERO ítems nuevos. No es 15 porque quedó un residuo de la misma causa (estimar regla/orden) sin identificar ni probar — nadie lo buscó, lo encontré yo en esta ronda. |
| 3 | Honestidad de lo verificado | 15 | **14** | El backlog declara explícitamente lo que no se midió, con un criterio concreto para el guion del PM, sin que se lo pidieran dos veces — esto es justo lo que se le pidió corregir de la primera ronda y lo corrigió bien. El commit y el código son autocríticos y precisos con los números (345.595/262.144, 32% arriba, coincide con lo que yo mismo reproduje). No es 15 porque el comentario de `pesoGuardadoDeItem` dice "se arma la forma final y se mide: no se estima" y no es exactamente cierto para `regla` y `orden` — una afirmación un poco más fuerte de lo que el código hace. |
| 4 | Cumplimiento del contrato | 15 | **14** | Los cuatro puntos que la primera auditoría pidió como "para llegar a 85" están hechos: medir no estimar (con el matiz de arriba), bytes no caracteres, tope de largo, mensaje de error corregido, arnés con el caso real. El único criterio original de la historia que sigue sin cumplirse (medir con `lote-modelo-real.js`) está declarado como pendiente para el entorno real, que es donde corresponde. |
| 5 | Calidad interna | 15 | **13** | Las dos copias del motor siguen idénticas — lo verifiqué byte a byte otra vez, no sólo confié en el arnés. Corrí `val74-sin-tope-de-ocho` (30/30 aserciones), `motores-desde-html` (39/39), `valija-bloque-b` (111/111), `adjuntar-documento` (81/81) y `hallazgos-qa-bloque-b` (31/31): todo en verde, sin regresión, coincide con lo reportado. El off-by-one de `recortar()` está genuinamente resuelto, probado en el borde con acentos. Resta el sesgo de 8 bytes/ítem de `pesoGuardadoDeItem`, que es el único cabo suelto de calidad que encontré. |
| 6 | Diseño y decisiones de producto | 10 | **8** | Corregir el mensaje de error ofreciendo las dos causas sin elegir, en vez de adivinar, es la decisión correcta y bien argumentada — reconocer que `invalid_argument` significa dos cosas distintas en este sistema y no fingir que se sabe cuál, en vez de inventar una tercera versión del mensaje. La declaración de la brecha de calidad del prompt (veinte cosas con cinco de ruido) muestra que se entendió el riesgo de producto que señalé en la primera ronda, no sólo el técnico. |
| | **Total** | **100** | **84** | **CANDIDATO.** Falta 1 punto para "terminado", y el hueco que falta es exactamente el que exige el teléfono, declarado con guion. Se puede publicar como candidato. |

---

## Afirmaciones verificadas en esta ronda

| Afirmación | Verificación | Resultado |
|---|---|---|
| "561 el número que yo mismo publiqué ... 345.595 bytes contra 262.144: 32% arriba" | Reproducido independientemente con motivo real de una frase en español | **Cierto** — mi propia medida en la primera ronda dio 378.700/44%; con el motivo específico de esta ronda, coincide con el 32% que reportan |
| "3.000 propuestos con motivos de una frase entran 465, lista en 256.957 bytes" | Corrí `val74-sin-tope-de-ocho.js` | **Cierto**, exacto |
| "El arnés nuevo me encontró un off-by-one en `recortar`" | Probé los bordes (280/281/80/81 caracteres, con y sin espacios, con acentos) | **Cierto**, y verifiqué que quedó bien cerrado en todos los bordes que probé, no sólo en el que ustedes probaron |
| "Ya no hay estimación escondida" | Comparé `pesoGuardadoDeItem` contra `makeItem` campo por campo, y medí el sesgo acumulado en un caso adversarial | **Falso en un residuo chico**: `regla` y `orden` siguen siendo un valor asumido (`null`/`0`), no el real. Sesgo medido: 8,00 bytes/ítem, hasta 81,8% del margen de 8.192 en el peor caso que armé — nunca cruza el tope en mis pruebas, pero la afirmación de "se mide, no se estima" no es 100% exacta |
| "Una lista pasada de tope informa bytes libres negativos y no admite nada" | Construí una lista de 340.565 bytes y pedí un ítem más | **Cierto**: `bytesLibresDeLista` da -86.613, y `enrichWithDestination` sumó 0 ítems |
| "El recorte a 80/280 no rompe los motivos de las reglas base" | Leí los dos call-sites de `recortar()`: sólo dentro de `parseDestinationItems` | **Cierto**, los motivos de reglas base e historial nunca pasan por esa función |
| "El mensaje nuevo de `writeErr` no inventa una causa" | Leí el texto y el comentario que lo justifica | **Cierto**, ofrece las dos causas reales sin elegir una |
| "12 arneses en verde" | Corrí `val74-sin-tope-de-ocho` (30/30), `motores-desde-html` (39/39), `valija-bloque-b` (111/111), `adjuntar-documento` (81/81), `hallazgos-qa-bloque-b` (31/31) | **Cierto** en los cinco que corrí; no encontré ninguna cifra falsa |
| "Lo que no se midió queda declarado en el backlog" | Leí el diff de `docs/backlog.md` | **Cierto**, y el texto incluye un criterio concreto y accionable para el guion del PM, no sólo la mención de que falta |
| Las dos copias del motor siguen idénticas | Diff byte a byte de la extracción de `app/valija.html` contra `app/parts/packing-engine.js` | **Cierto** |

---

## Lo que falta para llegar a 85

Uno solo, y es chico:

1. **Medir o eliminar el sesgo de `pesoGuardadoDeItem`.** La forma más simple: en vez de asumir `regla:null`
   y `orden:0`, pasarle a `pesoGuardadoDeItem` los valores reales que `enrichWithDestination` va a usar
   (`"destino"` y el `orden` real de `orderOf(categoria, 800+i)`), o directamente medir el ítem ya armado con
   `makeItem` antes de decidir si entra, en vez de una función separada que reconstruye una aproximación de
   la forma final. Es un cambio chico, ya está la infraestructura (`bytesSerializados`) para hacerlo bien.

No hace falta nada más para el puntaje de candidato. Para "terminado" (85 más la prueba en el teléfono, por
`CLAUDE.md`), falta la ronda del PM.

## Lo que nadie puede verificar desde acá

Esto no cambió respecto de la primera ronda, y sigue sin estar vacío:

1. **Cuántos ítems y de qué largo devuelve el modelo real del teléfono del PM**, con el prompt "sin llenar
   por llenar". Ya está declarado como pendiente en el backlog con un criterio concreto. Pasos: publicar,
   entrar a un viaje con reservas cargadas, tocar "Armar la lista" o "Rehacer la lista", y mirar cuántos
   ítems entraron y si algún motivo se ve cortado con "…" (señal de que tocó el tope de 280). Si aparecen
   muchos ítems con motivos genéricos o varios cortados, es la señal de "veinte cosas con cinco de ruido" que
   el propio backlog pide vigilar.
2. **Si el sesgo de 8 bytes/ítem que encontré en esta ronda alguna vez importa en la práctica.** Con el
   límite actual de ~900 ítems por lista no cruza el tope en ningún caso que probé, pero si el PM llega a ver
   una lista con varios cientos de ítems de destino (poco probable en el uso normal, pero el "máximo técnico
   posible" es justamente para no asumir), vale la pena que quien mire el guardado en ese momento confirme
   que entró bien.
