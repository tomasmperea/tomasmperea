# Auditoría — v20, cierre de la iteración 3 (commit `fbc7e952ef268947e479a66c4d0b399c9b0f1fac`)

**Audita:** rol `auditor` · **Fecha:** 2026-09-18 · **Puntúa contra:** `docs/auditoria/rubrica.md`
**Árbol verificado quieto:** `git status --porcelain` vacío y `HEAD` en `fbc7e952ef268947e479a66c4d0b399c9b0f1fac`, comprobado al empezar y al terminar de escribir este archivo.

## Veredicto: NO PUBLICAR (como cierre de iteración) — 73/100

No es un rechazo al contenido del cambio: el código es correcto, los 18 arneses corren en verde (los
verifiqué, no los repetí de memoria) y la resolución de VAL-57 está honestamente escrita. El veto es por
una sola cosa, pero es exactamente la que la rúbrica pesa el doble: **este commit trae código nuevo
(la condición que colapsa `pegar el texto`) que nunca tocó el teléfono, y en ningún lado del reporte se
dice eso.** El brief cierra la iteración 3 en tiempo pasado apoyado en una validación de teléfono que es
real — pero es la validación de la v19, de ANTES de este cambio. Sumale una documentación que quedó
describiendo el comportamiento viejo (trampa #4 del proyecto) y calidad interna se resiente también.

Con la declaración de la brecha agregada y el guion de teléfono para el PM, esto pasa de 73 a candidato
publicable en minutos — no hace falta reescribir nada del código.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | El defecto de fondo (guarda de `file.bytes`) y los tres gestos ya están genuinamente verificados en el teléfono del PM (heredado de v19, confirmado leyendo `docs/qa/v19-como-lo-compruebo-en-el-telefono.md` y el propio mensaje del PM citado). Pero el ÚNICO código nuevo de este commit —la condición que colapsa `.imp-more`— se probó sólo con Playwright/desktop (sustituto) y **esa brecha no está declarada en ningún lado**: ni en el commit, ni en `docs/briefs/adjuntar.md`, ni hay un guion de teléfono nuevo para el PM. Por la regla de la rúbrica, sustituto sin declarar = 10 para esa porción; se pondera contra la parte sí verificada. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | No aplica causa raíz nueva: el motor de adjuntos no se tocó (verificado con `git diff --stat 4a8cb40 fbc7e95` — sólo cambian pruebas, `valija.html` en la porción del `<details>`+versión, backlog y brief). La causa del defecto de cuatro rondas ya estaba determinada y escrita en la ronda anterior, y se hereda intacta. |
| 3 | Honestidad de lo verificado | 15 | **9** | Fuerte en varios frentes: admite el error propio (backtick roto), declara `doc_repl` y el cartel de Android sin inventar causas, y escribe la contradicción de VAL-57 completa. Pero comete exactamente lo que el proyecto ya pagó: envuelve un cambio no verificado dentro de una sección titulada "cierre de la iteración", apoyado en una prueba de teléfono que no cubre ese cambio, sin decir "esto no se probó en el teléfono todavía". Eso no es mentir, pero es la brecha que "se dice", no que "se omite" — y acá se omitió. |
| 4 | Cumplimiento del contrato | 15 | **11** | El pedido textual del PM ("que esté colapsado... con esto la iteración 3 quedaría finalizada") está implementado correctamente en el código y en los cuatro estados que corresponden. Pero el propio criterio de "terminado" del proyecto (`CLAUDE.md`: "funciona en un teléfono") no está cumplido para este cambio puntual, y el brief lo redacta como si el cierre ya estuviera completo. |
| 5 | Calidad interna | 15 | **11** | Los arneses tocados están bien: no aflojaron aserciones (los cambié yo mismo a `false` y les agregué dos aserciones nuevas, verificado línea por línea abajo), y los dos arneses que escribían en `#im_text` sin gesto ahora tocan el resumen primero. Pero queda un comentario desactualizado en `app/pruebas/tier-del-modelo.js:370` ("ahí la vía de pegar el texto ya viene desplegada") que describe el comportamiento ANTERIOR al cambio de este mismo commit — la trampa #4 del proyecto, en una versión chica. Motor embebido sin cambios, confirmado por `motores-desde-html.js` en verde. |
| 6 | Diseño y decisiones de producto | 10 | **10** | La reversión de VAL-57 está bien argumentada (con el motivo real: `sinImagenes` es permanente, no ocasional, en esta plataforma), la contradicción con el backlog está escrita entera dentro de la propia historia, con recomendación del PO y a un `####` de distancia de que cualquiera que abra VAL-57 la vea antes de tocar nada. Nada escondido. |
| **Total** | | **100** | **73** |

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "18 arneses en verde" | Corrí una muestra representativa: `motores-desde-html.js` (39/39), `importar-sin-imagenes.js` (49/49), `importar-arranque.js` (59/59), `tier-del-modelo.js` (42/42), `valija-bloque-b.js` (111/111), `importar-botones.js` ("Todo en verde", toca los botones reales, no dispara eventos). Todos coinciden exacto con los números declarados. | **Cierto**, en la muestra corrida |
| "El motor de adjuntos no se tocó en este commit" | `git diff --stat 4a8cb40 fbc7e95` | **Cierto**: sólo cambian pruebas, la sección del `<details>`+versión de `valija.html`, `docs/backlog.md` y `docs/briefs/adjuntar.md` |
| "Cambié `open===true` a `open===false` y AGREGUÉ verificación, no la saqué" | Leí el diff completo de `importar-sin-imagenes.js` | **Cierto**: además de invertir la aserción, agregó que el aviso siga ofreciendo la vía (`/pegá el texto/i`) y que el resumen esté presente y a un toque (`.imp-more summary`, y un click+assert de que se abre) |
| "Dos arneses escribían en `#im_text` sin abrir el acordeón, y ahora tocan el resumen primero" | Leí el diff de `tier-del-modelo.js` y `importar-sin-imagenes.js` | **Cierto**: se agregó `pegarTexto()` que hace `click` en `.imp-more summary` antes de `fill`, y las tres llamadas que antes escribían directo ahora pasan por esa función |
| "VAL-57 queda con la contradicción escrita entera adentro de la historia" | Leí `docs/backlog.md:358-407` | **Cierto**, y bien ubicada: encabezado `####` con ⚠️, dentro del bloque de la propia historia, antes de la siguiente (`VAL-62`). Un agente que lea VAL-57 de arriba a abajo se topa con la advertencia antes de poder "reabrir la caja" |
| El árbol servido del Artifact tiene `v20` y el cambio publicado | Intenté leer el Artifact publicado | **No pude verificarlo desde acá**: el HTML que sirve `claude.ai/code/artifact/...` es un shell de React que carga el contenido por API, no un archivo estático con el `<script>` embebido — un `curl` sólo trae el envoltorio (18 KB), no el `VALIJA_VERSION` ni el resto. Esto no es una brecha del entregable: es una brecha de este entorno de auditoría, y queda declarada como tal más abajo |
| El comentario nuevo dentro del template literal no rompe la sintaxis | Extraje el `<script>` más grande del HTML y lo pasé por `new Function(...)` | **Parsea sin error**. No encontré ningún otro comentario con backticks *dentro* de una cadena de plantilla (los backticks que sí aparecen en comentarios `//`/`/* */` del resto del archivo están todos fuera de template literals, son JS-comment-con-código-entre-backticks normal, no texto embebido en HTML) |
| El aviso sigue ofreciendo la vía de pegar cuando la caja queda colapsada | Leí `avisoCapsHtml()` (`app/valija.html:9300-9303`) | **Cierto**: con `sinImagenes` dice "pegá el texto del correo acá abajo: eso funciona siempre", y el `<summary>` del acordeón colapsado dice explícitamente "Pegar el texto del correo" (no el genérico "en cambio") |

## Hallazgo bloqueante

**El comentario de `app/pruebas/tier-del-modelo.js:370` quedó mintiendo.** Dice:

```js
// Vista sin imágenes: ahí la vía de pegar el texto ya viene desplegada.
```

Eso era cierto hasta este mismo commit. Después de este commit, en la vista sin imágenes la caja arranca
**colapsada** — es el cambio que se está auditando — y por eso la línea de arriba ahora necesita
`pegarTexto()` para tocar el resumen primero. El comentario nunca se actualizó. Es exactamente la trampa
#4 del proyecto ("la documentación que quedó mintiendo"): no rompe nada hoy porque el código de al lado ya
está corregido, pero el próximo que lea ese comentario para entender por qué existe `pegarTexto()` se va a
confundir con una frase que contradice la línea siguiente.

## Lo que falta para llegar a 85 (en orden)

1. **Declarar la brecha de entorno real para el cambio de este commit**, en `docs/briefs/adjuntar.md`,
   junto al párrafo de cierre: una línea que diga que la caja colapsada se probó con Playwright/desktop y
   todavía no en el teléfono del PM.
2. **Agregar el guion de teléfono correspondiente** (puede ser un párrafo corto agregado a
   `docs/qa/v19-como-lo-compruebo-en-el-telefono.md`, o un archivo nuevo `v20-...`): abrir Importar con una
   reserva sin imágenes reconocibles, confirmar que la caja de "Pegar el texto del correo" aparece
   colapsada y que un toque en el resumen la abre.
3. **No cerrar la iteración 3 como terminada hasta tener esa confirmación escrita.** Se puede publicar como
   candidato (la rúbrica lo permite con la brecha declarada); "terminada" es una palabra más fuerte y el
   propio `CLAUDE.md` la ata a la prueba en el teléfono.
4. **Corregir el comentario de `tier-del-modelo.js:370`** para que describa el estado actual (colapsada,
   se abre tocando el resumen) en vez del estado anterior al cambio.
5. *(Barato, no bloqueante pero vale la pena)* No hay ningún arnés que sólo chequee que el `<script>`
   principal de `valija.html` parsea como JS válido, independiente de un navegador. El bug del backtick que
   este mismo commit relata ("rompió la app entera") lo destapó un arnés de Playwright completo, que es
   lento y no apunta a la causa. Un chequeo de una línea —extraer el script más grande del HTML y correrlo
   por `new Function(...)`, como hice para esta auditoría— corre en milisegundos y señala exactamente esto
   antes que cualquier otra prueba. Agregarlo como primer paso de cualquier corrida de arneses (o como un
   arnés nuevo, chico) evita que la próxima vez dependa de que alguien lo note por casualidad.

## Lo que nadie puede verificar desde acá

- **Si el Artifact publicado sirve efectivamente el código de este commit (v20).** No pude leerlo: la URL
  del Artifact devuelve un shell de la plataforma, no el HTML con el `<script>` embebido, así que ni
  `VALIJA_VERSION` ni el resto se pueden confirmar con `curl` desde este entorno. Pasos para el PM (o para
  quien publique): abrir el link del Artifact, mirar el chip que dice "v" al lado de "Valija" en la
  cabecera, y confirmar que dice **v20**. Si dice otra cosa, no está publicado todavía y no hay nada que
  pedirle a nadie.
- **Que la caja colapsada de "Pegar el texto del correo" se comporta igual en el visor del teléfono que en
  Playwright/Chromium de escritorio.** Es la brecha central de este veto. Pasos exactos para el PM:
  1. Abrir el link del Artifact en el teléfono, confirmar que dice v20 (paso anterior).
  2. Entrar a un viaje y tocar **Importar**.
  3. Si la vista no reconoce imágenes en este dispositivo (el mismo caso que ya probó con el PDF), fijarse
     si la caja "Pegar el texto del correo" aparece **cerrada** (sólo el título, sin el cuadro de texto
     debajo).
  4. Tocarla una vez y confirmar que se abre con un solo toque.
  5. Si aparece abierta de entrada, o si hace falta más de un toque, sacar captura y avisar.
- **Que el gesto de tocar el `<summary>` de un `<details>` no tiene ninguna fricción particular en el
  visor de Android** (por ejemplo, zona de toque chica, o algún comportamiento del sistema que intercepte
  el tap). El elemento no es nuevo en la app —ya existía como acordeón antes de este commit—, así que el
  riesgo es bajo, pero "riesgo bajo" no es lo mismo que "probado", y el proyecto ya pagó tres iteraciones
  por confundir esas dos cosas.

## Diferencia con la autopuntuación

No vi ninguna autopuntuación de quien entregó (no se incluyó una tabla de rúbrica en el reporte de la
tarea). No corresponde calcular la diferencia de 15 puntos de la rúbrica por falta de dato — se deja
anotado como observación: la próxima entrega debería traer su propia autopuntuación explícita contra las
seis dimensiones, como pide el punto 1 de "Cómo se usa" en `docs/auditoria/rubrica.md`.
