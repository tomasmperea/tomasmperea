# Auditoría — Iteración 3: Adjuntar, ronda 2 (VAL-58, VAL-59, VAL-60; VAL-57 recortada y documentada)

# VEREDICTO: PUBLICAR COMO CANDIDATO — 85 / 100

**Fecha:** 15 de septiembre de 2026 · **Escribe:** auditor · **Alcance:** HEAD `c41f5fd`
(`Saldar la deuda de prueba y escribir cómo se comprueba en el teléfono`) en
`claude/travel-planning-app-mvp-jag9be`, que incluye por transitividad `58ca080` (la
documentación del recorte) y todo lo ya integrado en `f1dabd7`.

**Justo en el umbral, y lo digo sin maquillarlo en ninguna dirección.** 85 es el mínimo
que exige la rúbrica, no un margen cómodo. Publicar acá significa lo que la rúbrica
define como "candidato": todo lo verificable desde este entorno está verificado, y el
único hueco que queda es el entorno real, declarado con guion de pruebas. **No** significa
"terminado" en el sentido de `CLAUDE.md` — eso exige además la prueba en el teléfono, con
resultado escrito, y de eso no hay nada todavía. La dimensión 1 sigue topeada en 20/30
porque nada de esto corrió en el Artifact publicado ni en un teléfono: es el límite real
de este entorno, no un defecto de esta entrega puntual, y no lo puedo levantar auditando
desde acá.

Los dos commits que se me pidió re-auditar resuelven, de forma verificable y no sólo
declarada, los dos hallazgos centrales de la ronda 1:

1. **La decisión de cerrar sin VAL-57 dejó de vivir sólo en la cabeza de quien la tomó.**
   Está en el brief (tabla de arriba, con la recomendación del PO en contra anotada), en
   el roadmap (qué se entregó, y que la iteración cierra sin responder su propia
   pregunta) y en el backlog (VAL-57 con sus criterios replanteados, primera de la
   iteración 4). Los tres documentos dicen lo mismo entre sí y con lo que hace el código.
2. **La promesa incumplida de `tier-del-modelo.js` ya no es una promesa: es un hecho, y lo
   comprobé yo, no lo creí.** Corrí el arnés, reconstruí el control negativo declarado
   (`quick` en vez de `complex`) y además probé un caso que nadie me pidió: qué pasa si
   la señal nunca llega. En los tres casos el comportamiento es el correcto — ver el
   detalle abajo.

No encontré una autopuntuación entregada junto con estos dos commits para contrastar (no
hay tabla propia en `docs/briefs/adjuntar.md` ni en ningún reporte de entrega nuevo). Si
existe en otro lugar y no la vi, no pude contrastarla.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Sin cambios respecto de la ronda 1: sustituto fiel (Chromium/Playwright, gestos reales, sin disparo de eventos internos — reverifiqué que los 11 arneses siguen tocando controles y no `dispatchEvent`), con la brecha declarada sin excepción, ahora también como sección fija del brief. Nada corrió en el Artifact publicado ni en el teléfono. Banda "20" de la rúbrica, ni más ni menos — no hay forma de subir esto desde acá. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | H1 y H5 siguen intactos desde la ronda 1 (no tocados por estos dos commits, confirmado por `git diff f1dabd7 c41f5fd -- app/valija.html` vacío). Suma la deuda de `tier-del-modelo.js`: causa identificada con precisión ("es el mismo patrón que ya tumbó otro arnés"), reproducida y con arreglo-elimina-la-falla probado por control negativo, que reconstruí yo mismo. Sube un punto respecto de la ronda 1 porque el único faltante que quedaba — la ambigüedad de H5 sin un paso concreto asignado — ahora tiene ese paso, primero en la lista del brief. Resta uno porque H2 sigue siendo una decisión de producto declarada, no una causa auditada como tal (sin cambios). |
| 3 | Honestidad de lo verificado | 15 | **14** | Las tres afirmaciones que la ronda 1 marcó como falsas o desactualizadas ("Estado: en definición", el riesgo del CDN descrito como si siguiera decidiendo, la promesa de `tier-del-modelo.js` sin cumplir) están corregidas y, en el caso de la promesa, el brief además cita textualmente el hallazgo de la auditoría anterior contra sí mismo ("La auditoría del 14/09 lo había marcado como promesa incumplida... Tenía razón"). Eso es honestidad ejemplar. Resta un punto por una imprecisión nueva, no grave: el paso 3 de "lo que sólo se puede comprobar en el teléfono" dice "el registro dice `resumen.llamadas`", pero `ValijaTier.resumen()` no devuelve un campo así — devuelve un objeto con una clave por tarea/tier, cada una con su propio `.llamadas`. No es una afirmación falsa sobre algo verificado, es una instrucción menos precisa de lo que aparenta. |
| 4 | Cumplimiento del contrato | 15 | **14** | Contra el contrato ya recortado y ahora explícito (VAL-58/59/60 son el alcance vigente de esta entrega, con VAL-57 formalmente movido a la iteración 4 por una decisión declarada, no escondida): VAL-58 y VAL-59 cumplidos punto por punto; VAL-60 cumplido en lo que depende de la app, con el único gap — si un modelo real de verdad contesta el lote en una sola llamada — declarado como no verificable desde acá y con pasos para el teléfono. H4/VAL-62 quedó abierto a propósito y con su propia historia de backlog, no como una promesa rota. Resta un punto porque, aun con el recorte bien declarado, VAL-57 seguía siendo parte del alcance original de la iteración 3 según el propio roadmap ("VAL-57 a VAL-60") y no se construyó. |
| 5 | Calidad interna | 15 | **14** | Los tres motores siguen byte a byte idénticos a `app/parts/` — no hubo ningún cambio en `app/valija.html` ni en `app/parts/` entre `f1dabd7`, `58ca080` y `c41f5fd` (`git diff --stat` vacío en esos archivos), así que la comparación de la ronda 1 sigue vigente sin necesidad de repetirla. Los 11 arneses dan los mismos números declarados (verificados de nuevo por mí, ver abajo). La deuda de prueba de `tier-del-modelo.js` está genuinamente saldada, no sólo declarada: verifiqué que la nueva espera no afloja la exigencia con un experimento que nadie pidió (ver abajo). Resta un punto por lo mismo que en la ronda 1: el control negativo de la condición de carrera en `adjuntar-documento.js` sigue sin replicarse por nadie, declarado como tal, sin cambios en estos dos commits. |
| 6 | Diseño y decisiones de producto | 10 | **9** | La decisión de cerrar sin VAL-57 pasó de escondida a un caso ejemplar de decisión declarada: está en el brief con la recomendación del PO en contra anotada explícitamente, en el roadmap con el resultado ("cierra sin responder su propia pregunta") y en el backlog con el replanteo argumentado ("no es tecnología, es jerarquía"). H4 tiene el mismo tratamiento. Resta un punto por la misma imprecisión de dimensión 3: el paso 3 de la lista telefónica asume acceso a la consola del navegador en el celular del PM sin decir cómo se llega ahí, lo cual no encaja con "mobile primero, para el pulgar" del propio sistema de diseño del proyecto. |
| | **Total** | **100** | **85** | |

---

## Lo que verifiqué, con el comando y el resultado

### Los 11 arneses, corridos de nuevo por mí contra el HTML real de HEAD `c41f5fd`

| Arnés | Aserciones declaradas | Resultado real |
|---|---|---|
| `motores-desde-html.js` | 68+101+39 = 208 | **208 en verde**, confirmado (`NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/motores-desde-html.js`) |
| `importar-botones.js` (normal) | 12 | **12 en verde**, confirmado (con la ruta del HTML como argumento) |
| `importar-botones.js` (`bloquear`) | 12 | **12 en verde**, confirmado |
| `adjuntar-documento.js` | 81 | **81 en verde**, confirmado |
| `tarjeta-y-lote.js` | 77 | **77 en verde**, confirmado |
| `cruce-adjunto-huerfano.js` | 4 | **4 en verde**, confirmado |
| `cruce-archivo-dos-reservas.js` | 4 | **4 en verde**, confirmado |
| `cruce-huerfano-al-fallar.js` | 5 | **5 en verde**, confirmado |
| `importar-arranque.js` | 59 | **59 en verde**, confirmado |
| `importar-sin-imagenes.js` | 45 | **45 en verde**, confirmado |
| `tier-del-modelo.js` | 42 | **42 en verde**, ver detalle abajo |

`git diff f1dabd7 c41f5fd --stat` confirma que sólo se tocaron `app/pruebas/tier-del-modelo.js`,
`docs/auditoria/2026-09-14-iteracion-3.md`, `docs/backlog.md`, `docs/briefs/adjuntar.md` y
`docs/roadmap.md`. **`app/valija.html` y `app/parts/` no cambiaron una línea** desde `f1dabd7`, así
que la comparación byte a byte de los motores que hice en la ronda 1 sigue siendo válida sin
necesidad de repetirla — no la repetí, y lo digo para que quede claro que no es "verificado de
nuevo", es "sigue siendo cierto porque nada de lo que medía cambió".

### `tier-del-modelo.js`: los tres experimentos, no sólo el que se pidió

**1. Corrida normal contra `app/valija.html` real:** 42 pasaron, 0 fallaron. Confirmado.

**2. El control negativo declarado, reconstruido por mí (no le creí al reporte):**

```
cp app/valija.html /tmp/t3-quick.html
sed -i 's/equipaje:"complex"/equipaje:"quick"/' /tmp/t3-quick.html
node app/pruebas/tier-del-modelo.js /tmp/t3-quick.html
```

Resultado: **40 pasaron, 2 fallaron**, y las dos fallas son exactamente las declaradas:
`todas las llamadas del equipaje piden "complex": ["quick"]` y
`y el recálculo pide "complex": ["quick"]`. Ni una falla de más, ni una de menos.

**3. El experimento que nadie pidió, porque la pregunta real de esta ronda era "¿la espera
nueva se puede tragar una falla de verdad?"** Si la señal (`window.__CALLS__` con una
entrada de equipaje) nunca llega, `waitForFunction(...).catch(()=>{})` traga el error de
tiempo agotado silenciosamente — eso, leído aislado, *parece* justo el patrón de la
trampa 1 del proyecto. Así que rompí la señal de verdad: comenté la llamada real al
motor de equipaje (`sed` sobre la línea 7179 de `app/valija.html`, reemplazando la
llamada a `askJson(sample, "equipaje-destino", TIER.equipaje, prompt)` por
`Promise.resolve(null)`, de forma que ninguna llamada se dispare nunca) y corrí el arnés
contra esa copia.

Resultado: la corrida tardó los 15 segundos completos del `timeout` de la espera y
**después falló donde tiene que fallar**: `la capa inteligente del equipaje se consultó
(0)`. No se colgó, no pasó en falso, no ocultó nada — el `.catch(()=>{})` sólo evita que
Playwright aborte por una excepción de timeout; la aserción de abajo, que mide el array
real de llamadas, sigue siendo la que decide. **La espera nueva no afloja la exigencia.**
Esto confirma con un caso más duro que el declarado en el commit que la corrección es
real, no cosmética.

(Nota menor, no una falla nueva del commit: en la corrida rota, la aserción
`todas las llamadas del equipaje piden "complex": []` dio **ok** porque `[].every(...)`
es verdadero al vacío — es una debilidad preexistente de cómo está escrita esa aserción
en particular, no algo que introdujo `c41f5fd`, y no cambia el resultado porque la
aserción anterior, la que cuenta llamadas, ya detectó la falla real.)

### Los dos commits de documentación, leídos contra el código y entre sí

- `docs/briefs/adjuntar.md`: `**Estado:** cerrado el 14/09 con alcance recortado`, con
  tabla `Qué se entregó y qué no` arriba de todo. Coincide con `docs/roadmap.md`
  (`## Iteración 3 — Adjuntar (entregada, con alcance recortado)`, con la sección
  `**NO entregado: VAL-57.**`) y con `docs/backlog.md` (`### VAL-57 · ... — P0, PRIMERA
  DE LA PRÓXIMA`). Los tres documentos cuentan la misma historia con las mismas palabras
  clave ("no responde su propia pregunta", "recomendación en contra del PO").
- La numeración del backlog: `grep -n "^## Iteración" docs/backlog.md docs/roadmap.md`
  muestra una sola "Iteración 4" y una sola "Iteración 5" en cada archivo, y coinciden
  entre sí (Avisar / Acompañar y mapas). El corrimiento que describía el commit está
  arreglado y no quedó ningún rastro de la numeración vieja en `docs/PRD.md`.
- VAL-62 en el backlog cita `docs/qa/2026-09-14-iteracion-3.md` (H4) con la misma
  descripción textual (`presupuestoDeLaBase()`, "no se llama desde ningún lugar de
  `valija.html`") — coincide.
- La sección `VAL-57 · REPLANTEADA` del brief y la entrada de VAL-57 en el backlog usan
  los mismos criterios, sin contradecirse entre sí ni con el `paso-cero-leer-una-foto.md`
  que citan (el archivo existe, lo confirmé).
- `git show 58ca080 --stat` y `git show c41f5fd --stat`: cada commit toca archivos
  nombrados explícitamente, nunca `docs/` como directorio — cumple la regla de
  coordinación del proyecto que ya se rompió dos veces.

### La lista "Lo que sólo se puede comprobar en el teléfono" del brief

Está en `docs/briefs/adjuntar.md`, no en un mensaje de tarea — eso ya es lo que pedía la
ronda 1. Evaluando los seis puntos uno por uno contra "¿son pasos sin traducción, con qué
mirar y qué significa si sale mal?":

- **Puntos 1, 2 y 4 (selector mudo, foto de cámara real, tarjeta de embarque real):**
  gesto concreto ("Tocá X, elegí Y, esperá Z segundos"), qué mirar explícito, y qué
  significa el resultado en cada sentido. Son ejecutables por el PM sin traducción.
- **Punto 3 (VAL-60 con un lote real):** el gesto de subir los documentos es claro, pero
  el paso de verificación ("abrí la consola: el registro dice `resumen.llamadas`") tiene
  dos problemas. Primero, abrir la consola del navegador en un teléfono no es un gesto
  accesible sin depuración remota desde una computadora — no encaja con "mobile primero,
  para el pulgar" del sistema de diseño del propio proyecto, y el brief no lo aclara.
  Segundo, leyendo el código (`app/valija.html` líneas 1062-1075), `ValijaTier.resumen()`
  no expone un campo `resumen.llamadas`: devuelve un objeto con una entrada por
  combinación de tarea y tier, y **cada entrada** tiene su propio `.llamadas`. El PM que
  siga el paso al pie de la letra va a escribir `ValijaTier.resumen().llamadas` en la
  consola y obtener `undefined`, no un número para comparar contra "si dice 1" o "si dice
  3". No es una afirmación falsa sobre algo que se dice verificado — es una instrucción
  menos verificable de lo que aparenta serlo.
- **Puntos 5 y 6 (visor de PDF con página dibujada, tema oscuro y tipografías reales):**
  son más una declaración de brecha ("acá el CDN está bloqueado, así que sólo corrió la
  variante sin previsualización") que un paso a seguir — no dicen qué gesto hacer ni qué
  significa si sale mal, a diferencia de los puntos 1, 2 y 4. No es cosmético (la
  información es real y útil), pero es más débil que el resto de la lista.

**Conclusión sobre este punto:** la lista es real y mayormente accionable, no es un
gesto cosmético — pero no todos sus puntos alcanzan el mismo estándar. El punto 3 en
particular necesita reescribirse antes de dárselo al PM tal cual está, porque como está
escrito hoy no es ejecutable sin traducción por alguien que no leyó el código de
`ValijaTier`.

---

## Lo que falta para llegar a más de 85 (esto ya es un candidato publicable; esto es para subir el margen)

Como el total es exactamente 85, cualquiera de estos ítems que quede sin hacer y se
descubra un problema nuevo en otro lado puede volver a bajar del umbral. En orden:

1. **Corregir el paso 3 de "Lo que sólo se puede comprobar en el teléfono"** en
   `docs/briefs/adjuntar.md`: decir cómo se llega a una consola en el teléfono del PM (o
   reemplazar el paso por uno que no la necesite), y usar el nombre de campo real
   (`ValijaTier.resumen()` devuelve un objeto por tarea/tier, no `resumen.llamadas`).
2. **Replicar el control negativo de la condición de carrera en `adjuntar-documento.js`**,
   que sigue declarado y no verificado desde la ronda 1 — o, si de verdad no se puede
   forzar de forma determinística en este entorno, decirlo también en la lista del brief
   como algo que sólo se puede comprobar en el teléfono, en vez de dejarlo sólo en la
   auditoría.
3. **La prueba en el Artifact publicado y en el teléfono**, con resultado escrito. Esto no
   sube el puntaje de esta auditoría (dimensión 1 seguirá en 20 mientras se mida desde
   acá), pero es lo único que convierte "candidato publicado" en "iteración terminada"
   según `CLAUDE.md`.

---

## Lo que nadie puede verificar desde acá, con los pasos exactos para el PM

Esta sección reproduce y corrige la lista que ya está en `docs/briefs/adjuntar.md`,
porque verificarla era parte del encargo de esta ronda. Los pasos 1, 2 y 4 los confirmé
tal cual están escritos; el paso 3 lo doy con la corrección que arriba señalo como
pendiente, para que sea usable ya mismo aunque el brief todavía no se corrija:

1. **El aviso de "selector de archivos mudo" después de una selección que sí funcionó
   (H5).** Abrí una reserva, tocá "Archivo" en el bloque "Documento", elegí un PDF o una
   foto real y esperá sin tocar nada más, al menos 3 segundos. Si aparece el cartel ámbar
   "No se abrió el selector de archivos..." **a pesar de que el documento quedó
   adjuntado** (la fila del archivo visible), el arreglo no alcanzó en el visor real y hay
   que dejar de decidirlo por temporizador. Si no aparece, se cierra sin tocar nada más.

2. **VAL-58, la recompresión de una foto de cámara real.** Sacá una foto de una tarjeta de
   embarque o voucher con la cámara del teléfono en el momento, adjuntala y abrí el visor.
   Si la imagen sale negra, vacía o rota, es el tope de área del canvas o el formato HEIC
   de la cámara — no el tope de tamaño, y el mensaje de error en pantalla va a estar
   equivocado sobre la causa. Si se ve bien, se cierra.

3. **VAL-60, si un modelo real de verdad manda un lote en una sola llamada.** Subí tres o
   cuatro documentos reales de una y esperá el resultado. Esto **no se puede comprobar
   mirando la pantalla**: hace falta abrir la consola de JavaScript del navegador del
   teléfono (en Android, conectando el teléfono a una computadora con Chrome y usando
   `chrome://inspect`; en iPhone, conectándolo a una Mac y usando el inspector de Safari —
   ninguna de las dos formas es un gesto en el propio teléfono) y escribir
   `ValijaTier.resumen()`. El resultado es un objeto con una entrada por tarea; buscá la
   que dice `"tarjeta-lote"` (o el nombre de tarea equivalente que uses realmente) y mirá
   su campo `llamadas`. Si dice 1, la iteración ahorró lo que prometía. Si dice más de 1,
   el modelo no está honrando el formato de lote pedido y hay que ajustar el prompt antes
   de dar VAL-60 por cerrado.

4. **VAL-59 con una tarjeta de embarque real.** Con un vuelo ya cargado a mano, importá la
   tarjeta de embarque real de ese vuelo. Tiene que ofrecer completar el vuelo existente,
   no crear uno nuevo. Si crea uno nuevo, el matcheo no funciona con datos reales aunque
   funcione con los sintéticos de las pruebas.

5. **El visor de PDF con la página dibujada.** Declarado, no es un paso con gesto: en este
   entorno el CDN de `pdf.js` está bloqueado, así que todo lo que se probó fue la variante
   sin previsualización. Abrir un PDF real y confirmar que la página se dibuja (o que, si
   no se dibuja, al menos el documento se puede descargar igual) es autocontenido en el
   teléfono y no se probó en ningún sustituto.

6. **Tema oscuro y tipografías reales**, en la tira del documento y en el visor de las
   pantallas nuevas. Cambiá el tema a oscuro desde el botón de la cabecera y repetí los
   pasos 1 y 2 en ese modo. Si algún token de color se ve mal (texto sobre fondo del mismo
   tono, por ejemplo) es un defecto no cubierto por ningún test de este repo, porque todos
   corrieron mayormente en claro.
