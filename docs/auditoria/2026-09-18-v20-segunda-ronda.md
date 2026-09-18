# Auditoría — v20, segunda ronda (commit `dce53f3bcb1111da288d81cf39b130dc2d34e1fd`)

**Audita:** rol `auditor` · **Fecha:** 2026-09-18 · **Puntúa contra:** `docs/auditoria/rubrica.md`
**Árbol verificado quieto:** `git status --porcelain` vacío y `HEAD` en `dce53f3bcb1111da288d81cf39b130dc2d34e1fd`,
comprobado al empezar y al terminar de escribir este archivo.

## Veredicto: NO PUBLICAR (como cierre de iteración) — 79/100

Sube de 73 a 79. El hallazgo central del veto anterior —la brecha del entorno real, no declarada— está
resuelto de verdad: la declaración es clara, no está maquillada, y no llama "terminada" a la iteración.
Pero al arreglarlo se introdujo un defecto nuevo, chico y con la misma forma que el problema que se estaba
cerrando: **el propio guion que tiene que confirmar la brecha declarada quedó con texto que le dice al PM
"son tres pruebas" y "las tres andan", cuando ahora hay cuatro y la cuarta es justamente la que importa.**
Es el mismo patrón de "la documentación que queda describiendo el estado anterior" (trampa #4 del
proyecto), esta vez en el documento que se tocó específicamente para evitar repetir esa trampa.

No es un hallazgo del tamaño del anterior — se arregla con dos líneas y un reordenamiento, no con una
sección nueva — pero es real, tiene una vía concreta de causar que el PM nunca corra la prueba que cierra
la iteración, y por eso no llega a 85 todavía.

`git diff --stat fbc7e95 dce53f3` confirma que `app/valija.html` **no cambió una sola línea** entre las dos
rondas: el único cambio en `app/` es el comentario corregido de `tier-del-modelo.js` y el arnés nuevo. No
hizo falta repetir los 18 arneses de la ronda anterior — ya corrieron sobre este mismo `valija.html` y nada
lo tocó. Sí volví a correr `tier-del-modelo.js` (42/42, confirmado) y el arnés nuevo, por ser lo que cambió.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **24** | La brecha ahora está declarada con precisión quirúrgica: dice qué se probó (Chromium de escritorio, los cuatro estados), qué no cubre, y qué falta para cerrar. Es exactamente el nivel 20-30 de la rúbrica. No llega a 30 porque el mecanismo pensado para levantar esa brecha —la prueba 4 del guion— tiene el defecto de abajo, que pone en riesgo que la verificación real efectivamente ocurra. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | Sin cambios respecto a la ronda anterior: no aplica causa raíz nueva, y la heredada sigue sólida y sin tocar. |
| 3 | Honestidad de lo verificado | 15 | **12** | La sección nueva del brief es un ejemplo de cómo se declara una brecha: sin adjetivos que la suavicen, con la fecha, con la causa exacta. Pero el mismo commit deja en el archivo que se supone que opera esa honestidad (`docs/qa/v19-como-lo-compruebo-en-el-telefono.md`) una frase que la contradice de hecho: "Son tres pruebas" arriba de todo, cuando el propio commit le agregó una cuarta. Un documento no puede declarar una brecha en un lugar y borrarla de hecho en otro. |
| 4 | Cumplimiento del contrato | 15 | **10** | Los cuatro puntos del veto de 73 están atendidos en forma: brecha declarada, guion extendido, no se llama terminada, comentario corregido, arnés agregado. Pero el criterio real que closes la iteración —"el PM confirma la prueba 4"— queda en riesgo por el defecto del guion: si el PM sigue el hábito de "son tres pruebas, ya las hice", puede no llegar a la cuarta. El punto 2 del veto ("el guion") está cumplido a medias: existe, pero no está armado para garantizar que se corra. |
| 5 | Calidad interna | 15 | **10** | El arnés nuevo (`el-script-parsea.js`) está bien hecho: corre en milisegundos, tiene control negativo real (el mismo código sin backticks parsea), y la decisión de sacar el buscador de backticks-en-comentarios está bien justificada y verificada abajo. Pero el documento QA quedó con tres descuidos: la intro no cuenta cuatro pruebas, la tabla final ("Las tres andan") tampoco, y la Prueba 4 se insertó en el archivo ANTES de la Prueba 3 en vez de después — el orden de lectura ya no coincide con la numeración. |
| 6 | Diseño y decisiones de producto | 10 | **9** | Sin cambios de fondo respecto a la ronda anterior. La decisión de sacar el chequeo de 154 avisos y quedarse con la prueba de parseo real está bien argumentada y es la correcta (ver abajo). |
| **Total** | | **100** | **79** |

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "Entre `fbc7e95` y `dce53f3` el único cambio en `app/` es el comentario y el arnés nuevo" | `git diff --stat fbc7e95 dce53f3` | **Cierto**: `app/pruebas/el-script-parsea.js` (nuevo), `app/pruebas/tier-del-modelo.js` (7 líneas, el comentario), `app/valija.html` **no aparece en el diff** |
| "`tier-del-modelo.js` volvió a correr en verde (42)" | Corrí `node app/pruebas/tier-del-modelo.js` | **Cierto**, 42 pasaron, 0 fallaron |
| El comentario stale de `tier-del-modelo.js:370` fue corregido y describe el estado actual | Leí el diff y el archivo resultante | **Cierto**, y además admite adentro el propio error ("Este comentario decía lo contrario... lo agarró la auditoría") |
| El arnés nuevo agarra el error exacto del 18/09 y tiene control negativo | Corrí `node app/pruebas/el-script-parsea.js` | **Cierto**: reconstruye el caso mínimo con backtick dentro del comentario dentro del template literal, confirma que se rechaza, y confirma que el mismo código SIN el backtick parsea |
| El arnés corre rápido y sin navegador sobre el bloque de 489.885 caracteres | Corrí el arnés y medí | **Cierto**: termina en bien menos de un segundo, sin abrir ningún navegador; `new Function` sólo compila, no ejecuta nada del script, así que no hay riesgo de efectos secundarios |
| La brecha del brief está declarada sin maquillaje | Leí `docs/briefs/adjuntar.md:482-521` | **Mayormente cierto**: la sección "⚠️ Este cambio NO está verificado" es clara y no está diluida. Observación menor: el encabezado de la sección de arriba, `## Cierre de la iteración 3 — 18/09`, sigue sonando a cierre consumado hasta que se llega al `⚠️` unas líneas después — no maquilla el contenido, pero un lector que sólo mira encabezados puede quedarse con el título |
| El guion (`docs/qa/...`) quedó consistente con "hay una prueba nueva, es la que falta" | Leí el archivo completo | **Falso**: la línea 5 sigue diciendo "Son tres pruebas" y la tabla final (línea 92) sigue diciendo "Las tres andan" → "anduvo", sin mencionar la cuarta. Además la Prueba 4 quedó insertada en el archivo ENTRE la Prueba 2 y la Prueba 3 (diff: se agregó justo después del cierre de la Prueba 2), así que el orden de lectura es 1, 2, 4, 3 |
| "Sacar el buscador de backticks-en-comentarios fue la decisión correcta" | Leí `el-script-parsea.js` y razoné sobre la semántica de un template literal | **Correcto, y por una razón más fuerte que la que da el propio commit**: un backtick suelto DENTRO de un template literal siempre lo termina, esté o no dentro de lo que parece un comentario. El chequeo de parseo (`new Function`) agarra CUALQUIER backtick que rompa un template literal, no sólo los que están dentro de comentarios — es estrictamente más completo que el buscador de texto que se sacó, no más angosto. El buscador de texto además tenía falsos positivos estructurales (JSDoc con backticks fuera de cualquier template literal) sin forma de distinguir el caso peligroso del inocuo. Sacarlo no fue conformarse: fue reemplazar una heurística ruidosa por la prueba exacta |

## Hallazgo bloqueante (el que explica por qué sigue sin llegar a 85)

**El guion que tiene que confirmar la brecha declarada le dice al PM, dos veces, que son tres pruebas.**

- `docs/qa/v19-como-lo-compruebo-en-el-telefono.md:5`: *"Abrilo en el teléfono. Son tres pruebas."*
- `docs/qa/v19-como-lo-compruebo-en-el-telefono.md:92` (tabla "Qué me mandás"): *"Las tres andan" → "anduvo"*

El PM ya hizo esta rutina una vez (v19: tres gestos, y avisó "anduvo"). Si vuelve a este mismo documento y
lee "son tres pruebas" arriba de todo y "las tres andan" al final, tiene una vía real de completar el
ritual que ya conoce —los tres gestos de siempre— y mandar "anduvo" sin haber tocado la Prueba 4, que es la
ÚNICA razón por la que este documento se tocó hoy. Estructuralmente la Prueba 4 sí está en el archivo (con
su propio encabezado, entre la Prueba 2 y la Prueba 3), así que alguien que lo lea de punta a punta la va a
encontrar — pero el texto que enmarca el documento (la intro y el resumen final) activamente dice lo
contrario, y es exactamente el texto que alguien que "ya sabe cómo es esto" tiende a mirar primero.

No es un hallazgo del calibre del anterior — no hay ninguna afirmación falsa sobre qué se verificó, y el
brief en sí (`docs/briefs/adjuntar.md`) es honesto y preciso — pero es el mismo tipo de error (un texto que
describe un estado que el propio commit dejó atrás) en el documento operativo que decide si la próxima
ronda del PM efectivamente cierra la iteración o la vuelve a dejar a medias sin que nadie lo note.

## Observación menor, no puntuada

**Prueba 4, la ambigüedad de "aparece cerrada".** La condición que cambió (`sinImagenes` fuera de la
condición que abre la caja) sólo se diferencia del código anterior cuando la vista está efectivamente en
`sinImagenes === true` (el modelo no acepta imágenes) y `sinPdf === false` (el PDF sí funciona) — que es,
por lo que el propio commit documenta, el estado permanente del teléfono del PM. Si por cualquier motivo
esa combinación no fuera la que tiene el teléfono en el momento de la prueba (por ejemplo, si `sinImagenes`
pasara a `false`), la caja **también** aparecería cerrada por defecto — con el código viejo tanto como con
el nuevo — y "aparece cerrada" no probaría nada sobre este cambio puntual. El guion no le pide al PM
confirmar el estado (por ejemplo: "arriba sólo se ofrece 'Subir el PDF', sin 'Sacar foto' ni 'Galería'")
antes de mirar la caja. Dado que el propio equipo ya estableció con el PM que esa condición es permanente
en su plataforma, el riesgo de un falso positivo es bajo en la práctica — no bajo lo suficiente como para
no mencionarlo, pero sí bajo lo suficiente como para no bloquear por esto solo.

## Qué falta para llegar a 85 (concreto, barato)

1. **`docs/qa/v19-como-lo-compruebo-en-el-telefono.md:5`**: cambiar "Son tres pruebas" por "Son cuatro
   pruebas".
2. **Misma tabla, línea 92**: cambiar "Las tres andan" → "anduvo" por algo que mencione las cuatro, o que
   liste explícitamente qué significa "anduvo todo".
3. **Reordenar el archivo** para que la Prueba 4 quede después de la Prueba 3 (orden de lectura = orden de
   número), o renumerarla como Prueba 3 y correr la foto a Prueba 4 — cualquiera de las dos cierra la
   inconsistencia. Lo que no puede quedar es 1, 2, 4, 3.
4. *(Opcional, refuerza la Prueba 4 pero no es bloqueante)* Agregar un paso que confirme el estado antes de
   mirar si la caja está cerrada: "arriba tiene que ofrecerse sólo 'Subir el PDF', sin cámara ni galería".
5. *(Opcional, cosmético)* Renombrar el encabezado `## Cierre de la iteración 3 — 18/09` a algo que ya
   anticipe que es candidata, para que no dependa de que el lector llegue hasta el `⚠️` de más abajo.

## Lo que nadie puede verificar desde acá

Igual que en la ronda anterior, y sin cambios: no pude leer el HTML que sirve el Artifact publicado (la URL
devuelve un shell de plataforma, no el `<script>` embebido), así que no puedo confirmar desde acá que lo
publicado sea `dce53f3` ni que diga v20. Y sigue sin existir, porque no puede existir desde acá, ninguna
confirmación de que la caja de pegar el texto se comporta en el visor del teléfono del PM como se comporta
en Chromium de escritorio. Los pasos para que el PM lo confirme son, ahora, exactamente la Prueba 4 del
guion — una vez corregidos los puntos 1 a 3 de arriba para que no se salte por costumbre.
