# Auditoría VAL-72 — ronda de confirmación sobre `4bf6d7d`

**Commit auditado:** `4bf6d7d15df6ce674317ed37748d45bdb68bc583` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío,
`HEAD=4bf6d7d` antes y después de auditar). **Delta puntuado:** `4c99a42..4bf6d7d` (esta ronda
NO repite lo ya verificado en la novena ronda sobre `4c99a42`, salvo para confirmar que sigue en
pie). Ronda anterior: **78/100 · CANDIDATO**, con dos puntos pendientes que este commit dice
cerrar.

## Veredicto: **NO PUBLICAR — 49/100**

**No sale ni como candidato.** El delta cierra de verdad los dos comentarios stale que marcó la
novena ronda, pero al extender el mecanismo de fixtures introduce una aserción que **no prueba lo
que dice probar**: la lista `LEE` ahora afirma que el prompt lee `transfer.notes`, y es falso —
`summarizeReservationsForAI` no procesa reservas de tipo `transfer` en absoluto, así que un
traslado (con sus notas, sus fechas, todo) nunca llega a la capa de IA. Es exactamente la trampa 2
del proyecto ("la aserción/simulador escrito de memoria, no leyendo el contrato"), reproducida en
el commit que específicamente respondía al pedido de la auditoría anterior de comparar `LEE`
"campo por campo" contra lo que las funciones leen. Además la lista sigue sin cubrir `act`
(actividad), un tipo de reserva real cuyos campos sí llegan a la IA. Ninguna de las dos cosas es
del entorno del teléfono: las dos se encuentran leyendo código, que es exactamente lo que este
commit se pidió hacer y no hizo del todo. Por la regla de la rúbrica, un puntaje bajo por un motivo
que no es "no se pudo probar en el teléfono" no tiene piso de 70.

También encontré que la afirmación "`tier-del-modelo`... es la tercera vez... anotado en VAL-73
con la tabla de corridas" **no se sostiene**: VAL-73, tal como está escrito en `docs/backlog.md`,
documenta la inestabilidad de `valija-bloque-b.js`, no de `tier-del-modelo.js`. No encontré,
en todo el repo, ninguna tabla de corridas para `tier-del-modelo.js` más reciente que la del
12→14/09 (ya cerrada). Esto no baja el puntaje por sí solo —lo trato como una cita equivocada, no
como una mentira deliberada—, pero sí responde la pregunta que se me hizo: **no, tal como está
descripta, esa intermitencia no está manejada ni documentada donde se dice que está.**

---

## 1 · Lo que el delta cierra de verdad

### Los dos comentarios stale de la novena ronda

Confirmado con `git diff 4c99a42..4bf6d7d -- app/parts/packing-engine.js app/valija.html`: las dos
citas del formato viejo (`"renglón propio por cada escala con su duración"` /
`{"tipo":"escala","ciudad":"GRU","duracionHoras":2}` en `packing-engine.js:1712-1715` y
`{"tipo":"escala"...` en `:1867-1872`, y sus copias en `valija.html`) ahora dicen
`entre-vuelos`/`horasEnTierra`, en las dos copias, idénticas. **Cierto**, cierra el hallazgo 1 de
la novena ronda.

### El `"tipo":"escala"` que queda como historia

`packing-engine.js:1786` ("EL TIEMPO ENTRE DOS VUELOS, sin llamarlo escala. Esto **decía**
`tipo:"escala"`...") está en pretérito, explica por qué el campo viejo estaba mal y no se presenta
como el estado actual. Leí el párrafo completo: no hay ninguna frase en presente que lo contradiga.
**Correcto como está** — no es la trampa 4, es historia bien marcada.

### Las dos aserciones de saneo (VAL-44), atacadas con sabotaje real

Repliqué el sabotaje yo mismo, no confié en la descripción: parcheé `sanitizeNotesForAI` en una
copia de `valija.html` para que dejara de reemplazar los patrones de contacto (sólo recorta a 240
caracteres) y corrí `val72-las-reservas-mandan.js` contra esa copia:

```
· el control: una nota con un dato sensible NO llega
  FALLA el número de tarjeta no llega al modelo
  FALLA ni el teléfono
  2 FALLARON
```

**Las dos aserciones son reales, no decorativas**: fallan si `sanitizeNotesForAI` deja de sanear.
Esto es exactamente lo que se pidió atacar y resistió el ataque.

### Las dos copias del motor

No confié en `las-dos-copias.js` sin repetirlo con mi propia extracción (distinta de la que usa
el arnés: la mía toma el segundo `"use strict";` de `packing-engine.js`, después del wrapper UMD,
en vez del primero). Con la extracción corregida:

```
len html body: 118355
len parts body: 118355
equal: True
```

**Idénticas, byte a byte**, confirmado independientemente. (Mi primer intento, con el primer
`"use strict"`, dio "equal: False" — era un error de mi propio script, no del código; lo dejo
anotado porque es la clase de error que este proyecto pide no dar por sentado.)

---

## 2 · El hallazgo nuevo y central: `LEE` afirma algo que el código no hace

Se me pidió puntualmente: *"Abrí `destinosDelViaje` y `summarizeReservationsForAI` y comparala
campo por campo. Si falta alguno, es un hallazgo."* Lo hice.

**`destinosDelViaje`** (línea 1627): lee `to`/`from`/`start`/`end` de `flight`,
`address`/`start`/`end` de `stay`, `to`/`start`/`end` de `transfer`, `address`/`start`/`end` de
`car`. Coincide con lo que `LEE` ya tenía antes de este commit (esa parte no cambió y sigue
correcta).

**`summarizeReservationsForAI`** (línea 1767): leí la función entera.

```js
items.filter(i => i.type === "flight")...   // desde, hasta, origen, destino, notas
// entre-vuelos: calculado de pares de flight, no lee un campo nuevo de reserva
items.filter(i => i.type === "stay")...     // desde, hasta, noches, notas
items.filter(i => i.type === "car")...      // desde, hasta, días, notas
items.filter(i => i.type === "act")...      // fecha, título, notas
```

**No hay ningún `items.filter(i => i.type === "transfer")` en toda la función.** Confirmé con
`grep -n "\.notes\b" app/parts/packing-engine.js`: las únicas cinco apariciones de `.notes` en
el pipeline de IA son `trip.notes`, `f.notes` (flight), `s.notes` (stay), `c.notes` (car) y
`a.notes` (act). `transfer` no aparece nunca.

Lo comprobé también de forma empírica, no sólo leyendo:

```js
// trip con UNA sola reserva, un traslado con nota
CON_NOTAS = [{ type:"transfer", from:"Atocha", to:"Centro",
               start:"2027-04-02T09:00", end:"2027-04-02T10:00",
               notes:"Sale del anden 4" }]
pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:CON_NOTAS }))
→ "Reservas del viaje ...: (todavía no hay reservas cargadas)"
```

**No es sólo que la nota no llega: la reserva entera no llega.** Un viaje con un traslado cargado
—con proveedor, código de reserva, fecha, notas, todo— le dice a la capa de IA que no hay ninguna
reserva. Ningún otro tipo de reserva tiene este comportamiento.

Y sin embargo, este mismo commit agregó `transfer: [..., "notes"]` a la lista `LEE`
(`app/pruebas/val72-las-reservas-mandan.js`), y el arnés reporta:

```
ok    transfer.notes: 1 con valor y 7 sin
```

**Ese `ok` es falso positivo.** La aserción sólo comprueba que existe un fixture de `transfer` con
`notes` y uno sin, en el código fuente del propio arnés (por regex sobre el texto del archivo) —
nunca comprueba que ese campo llegue a ningún lado. Es la aserción "de creencia, no de lectura" que
`CLAUDE.md` describe punto por punto, ocurrida en el commit que cita esa misma lección en su propio
comentario dos bloques más arriba.

**El propio fixture `CON_NOTAS` de este commit tiene un traslado con nota** (`"Sale del andén 4"`)
y las tres aserciones que le siguen sólo comprueban `lavandería` (alojamiento), `ventanilla`
(vuelo) y `tanque lleno` (auto) — **nunca `"andén 4"`**. No hay ningún comentario que explique por
qué el cuarto caso, el que el propio commit agregó, no tiene su aserción. No puedo saber si fue
notado y omitido en silencio o si no se comprobó; cualquiera de las dos es un hallazgo.

**Y `LEE` sigue sin tener una entrada para `act`**, aunque `summarizeReservationsForAI` lee
`start`, `title` y `notes` de cada actividad y los manda al modelo (`tipo:"actividad"`). Corrí
`grep -n 'type:"act"' app/pruebas/val72-las-reservas-mandan.js` — cero resultados. No hay un solo
caso, con o sin, para ningún campo de `act` en este arnés. Es el mismo hueco que la novena ronda
encontró para toda la función, cerrado a medias: se cerró para tres de los cinco tipos que la
función procesa (`flight`, `stay`, `car`), no se tocó `act`, y se declaró cerrado para `transfer`
sin que sea cierto.

## 3 · Documentación que también quedó mintiendo, y nadie la tocó

`docs/design/packing-engine.md:217-246` documenta, en presente ("Qué recibe ahora", "Cómo se arma
el resumen"), el contrato de `summarizeReservationsForAI` con una tabla que dice:

```
| escala | ciudad (...) y duración en horas, con un decimal |
...
"se agrega una entrada {tipo:"escala", ciudad, duracionHoras}"
```

Ese formato no existe desde `4c99a42` (v28), anterior a este commit. Es la misma trampa 4 que la
novena ronda encontró en dos comentarios de código, ahora en un documento de diseño que ninguna de
las dos rondas tocó. La misma tabla, además, **no tiene ninguna fila para `traslado`** —
consistente con que el código nunca lo procesó, pero nunca declarado como decisión: no hay ninguna
frase que diga "los traslados no se resumen para la IA, y esto es a propósito porque...". Es una
omisión, no una decisión documentada.

## 4 · Sobre `tier-del-modelo.js` — lo que se pidió que atacara con desconfianza

Corrí el arnés **cinco veces seguidas** en esta ronda:

```
run 1: 42 pasaron, 0 fallaron
run 2: 42 pasaron, 0 fallaron
run 3: 42 pasaron, 0 fallaron
run 4: 42 pasaron, 0 fallaron
run 5: 42 pasaron, 0 fallaron
```

No até el flake. Pero la pregunta que se me hizo no era si el flake existe — es si "está anotado en
VAL-73 con la tabla de corridas" es cierto. **Leí `docs/backlog.md` completo en la sección VAL-73**
(líneas 584-624): es enteramente sobre `valija-bloque-b.js` ("el plan se recalcula al ENTRAR a la
valija"), con una tabla de corridas que compara con/sin VAL-72 — de ese arnés, no de
`tier-del-modelo.js`. `grep -rn "tier-del-modelo" docs/backlog.md` no da ningún resultado. La única
intermitencia documentada de `tier-del-modelo.js` en todo el repo está en
`app/pruebas/LEEME.md:159-176`, fechada 12/09 y marcada **"RESUELTA el 14/09"**, con un solo
incidente (una de siete corridas), no tres.

**Entonces: no, no alcanza como manejo.** No porque el flake sea grave —con la evidencia que tengo
(cinco corridas verdes, causa histórica conocida y parcialmente corregida) no parece serlo— sino
porque la cita concreta que se me dio para verificar ("anotado en VAL-73 con la tabla de corridas")
es falsa, y el propio protocolo que el proyecto se escribió para este caso exacto ("correrlo cinco
veces guardando la salida completa... buscar la línea con FALLA") **no se siguió esta vez**: según
el propio mensaje, la salida de la corrida que falló "no se capturó", que es lo mismo que pasó el
12/09 y por lo que existe ese protocolo. Además, revisé el código actual de `tier-del-modelo.js`:
de los `waitForTimeout` fijos que la auditoría del 12/09 identificó como sospechosos, sólo tres
(líneas 303/318/330 en ese momento) se reemplazaron por esperas de señal real. Hoy el archivo sigue
teniendo esperas fijas sin señal (`waitForTimeout(1500)` en la línea 431, `900`/`300`/`500` en
454/459/461, `800` en 480) — el mismo patrón, en otras aserciones del mismo arnés, nunca migradas.
No digo que esto cause el 41/42: digo que la causa histórica del arnés sigue viva en el archivo, y
que "no se reproduce" con datos perdidos no es lo mismo que "está manejado".

No es bloqueante por sí solo para esta ronda —`tier-del-modelo.js` no lo tocó este delta—, pero la
cita incorrecta sí pesa en honestidad, y la falta de captura de la corrida que falló es la misma
falla de proceso que el 12/09, otra vez.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| Los dos comentarios stale de la novena ronda quedaron corregidos, en las dos copias | `git diff 4c99a42..4bf6d7d` sobre ambos archivos | **Cierto** |
| El `"tipo":"escala"` que queda en `packing-engine.js:1786` es historia, no afirma el estado actual | Lectura completa del bloque | **Cierto** |
| Las dos aserciones nuevas de saneo (tarjeta, teléfono) fallan si `sanitizeNotesForAI` deja de sanear | Sabotaje propio sobre una copia de `valija.html`, corrida del arnés | **Cierto**, 2 FALLA como se espera |
| Las dos copias del motor siguen idénticas | Extracción y comparación propias en Python (independiente del arnés) | **Cierto**, 118.355 caracteres, iguales |
| `LEE` cubre lo que `destinosDelViaje` lee | Lectura completa de la función, campo por campo | **Cierto**, sin cambios de esta ronda |
| `LEE` cubre lo que `summarizeReservationsForAI` lee | Lectura completa + `grep ".notes\b"` + prueba empírica propia | **Falso** — `transfer` no se procesa en absoluto (ninguna reserva de ese tipo llega, no sólo las notas), y `act` no tiene ninguna entrada en `LEE` |
| "Sumé `notes` a los cuatro tipos" (flight, stay, transfer, car) | Corrida del arnés + lectura de `summarizeReservationsForAI` | **Parcialmente falso**: la nota de un traslado nunca llega a la IA pase lo que pase; sólo tres de los cuatro tipos citados funcionan de verdad |
| El fixture `CON_NOTAS` con traslado está cubierto por una aserción | Lectura de las tres aserciones que siguen al fixture | **Falso** — no hay aserción para el caso de traslado, sin explicación |
| `docs/design/packing-engine.md` describe el formato actual de `summarizeReservationsForAI` | Lectura de la tabla líneas 217-246 | **Falso** — describe `tipo:"escala"`/`duracionHoras`, formato reemplazado desde v28; tampoco menciona `traslado` |
| "`tier-del-modelo` es la tercera vez... anotado en VAL-73 con la tabla de corridas" | Lectura completa de `docs/backlog.md` § VAL-73, `grep -rn "tier-del-modelo" docs/backlog.md`, lectura de `app/pruebas/LEEME.md` | **Falso** — VAL-73 es sobre `valija-bloque-b.js`; la única intermitencia documentada de `tier-del-modelo.js` es un incidente de 12/09, marcado resuelto el 14/09 |
| `tier-del-modelo.js` sigue en verde | 5 corridas propias, `NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js` | **Cierto**, 42/42 las cinco veces |
| Los `waitForTimeout` fijos sospechosos del 12/09 fueron reemplazados por espera de señal | `grep -n "waitForTimeout\|waitForSelector\|waitForFunction" app/pruebas/tier-del-modelo.js` | **Parcialmente falso** — sólo 3 de las esperas fijas se migraron; quedan varias sin señal real (líneas 429, 431, 454, 459, 461, 480) |
| Los nueve arneses + `packing-engine.test.js` declarados en verde | Corridos uno por uno con `NODE_PATH=/opt/node22/lib/node_modules` | **Cierto**, todos los números coinciden (`las-dos-copias`, `val72-las-reservas-mandan`, `motores-desde-html` 39, `valija-bloque-b` 111, `hallazgos-qa-bloque-b` 31, `val63-cambia-el-viaje`, `val74-sin-tope-de-ocho`, `el-script-parsea`, `packing-engine.test.js` 69) |
| `VALIJA_VERSION = "28"`, único árbol | `grep VALIJA_VERSION app/valija.html`, `git status --porcelain` vacío | **Cierto** |
| Árbol quieto | `git status --porcelain` vacío, `HEAD=4bf6d7d` antes y después | **Cierto** |
| "Lo publicado sigue siendo v23" | No lo intenté reconfirmar esta ronda (no cambió desde la novena) | **No verificable desde acá**, como en todas las rondas anteriores |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | Sin cambios respecto de la novena ronda: sustituto fiel (motor extraído del HTML real), brecha del teléfono declarada. Nada de este delta tocó DOM ni visor. |
| 2 | Diagnóstico de causa raíz | 15 | **7** | El arreglo de `escala`→`entre-vuelos` de la ronda anterior sigue intacto y bien fundado (no tocado por este commit, confirmado por `git diff`). Pero el trabajo propio de esta ronda —extender `LEE`— se hizo agregando `notes` a los cuatro tipos que ya estaban, sin comprobar que la función efectivamente procesara cada uno: exactamente "se dio por buena la primera hipótesis" (que los cuatro se comportan igual) sin el experimento de un minuto que lo habría descartado. |
| 3 | Honestidad de lo verificado | 15 | **4** | El fixture con traslado se agregó y su aserción correspondiente no, sin ninguna nota que lo explique — silencio donde tendría que haber una declaración. La cobertura de `act` sigue faltando y no se menciona como pendiente. Y la cita sobre `tier-del-modelo`/VAL-73 no se sostiene contra el propio backlog. A favor: los comentarios stale se cerraron con precisión, el `"tipo":"escala"` histórico está bien escrito, y las aserciones de saneo son reales y se declararon como tales. |
| 4 | Cumplimiento del contrato | 15 | **6** | De los dos puntos que este commit prometía cerrar, el primero (comentarios) está bien cerrado. El segundo (extender el mecanismo a `summarizeReservationsForAI`) se cumple en la forma pero no en el fondo: el propósito del mecanismo es que ningún campo que el motor lee quede sin caso con/sin, y hoy hay un campo marcado como cubierto que no se lee (`transfer.notes`) y un tipo entero sin ningún caso (`act`). |
| 5 | Calidad interna | 15 | **6** | A favor: las dos copias siguen idénticas (verificado de forma independiente), las dos aserciones de saneo resisten sabotaje real, los nueve arneses corren limpios. En contra: una aserción que pasa sin probar lo que dice probar es peor que un comentario stale — dijo "está bien" sobre algo que está mal, y es justamente la categoría de error que "pruebas que prueban lo que dicen probar" (la propia definición de esta dimensión en la rúbrica) existe para atrapar. Suma un documento de diseño desactualizado que ninguna ronda tocó. |
| 6 | Diseño y decisiones de producto | 10 | **7** | La decisión de fondo de VAL-72 (sacar el rótulo, dejar el número crudo) sigue siendo la correcta y no se tocó. Resta por `docs/design/packing-engine.md`, que documenta un contrato que ya no es cierto y omite sin explicación que los traslados no llegan a la capa de IA — una decisión de alcance que debería estar escrita y no lo está. |
| | **Total** | **100** | **49** | **NO PUBLICAR.** El único hueco de la dimensión 1 es el entorno; los otros cinco bajan por hallazgos de lectura de código, que es exactamente lo que la rúbrica dice que no tiene piso de 70. |

---

## Lo que falta para llegar a 85, en orden

1. **Hacer que `summarizeReservationsForAI` procese `transfer`**, con el mismo patrón que
   `flight`/`stay`/`car`/`act` (tipo, fechas, notas saneadas — sin `confirmation`, `phone` ni
   `address`, igual que los demás). O, si la decisión de producto es que los traslados
   deliberadamente no se resuman para la IA, **escribirlo explícitamente** en
   `docs/design/packing-engine.md` y sacar `notes` de la entrada `transfer` en `LEE` (porque
   entonces ese campo no es uno que la función lea). Cualquiera de las dos cierra el hallazgo
   central de esta ronda, pero la primera es la que cumple lo que VAL-44 promete ("todo lo que ya
   cargué", no "todo salvo los traslados").
2. **Agregar la aserción que falta para el traslado del fixture `CON_NOTAS`** (o, si se opta por
   el punto 1 en su variante de "no se manda", agregar el control negativo que confirme que NO
   llega, con la razón escrita al lado — nunca silencio).
3. **Sumar `act` a `LEE`**, con `start`, `title` y `notes`, cada uno con su caso con y sin, leyendo
   la función como hizo el resto de la extensión de esta ronda.
4. **Actualizar `docs/design/packing-engine.md:217-246`** al formato `entre-vuelos`/`horasEnTierra`
   y agregar (o declarar la ausencia de) la fila de `traslado`.
5. **Corregir o retractar la cita de `tier-del-modelo`/VAL-73.** Si la intermitencia reciente es
   real, documentarla donde corresponde (no en VAL-73, que es de otro arnés) con su propia tabla de
   corridas y salida capturada, siguiendo el protocolo que ya existe en `app/pruebas/LEEME.md`. Si
   se quiere cerrar el tema de fondo, terminar de migrar los `waitForTimeout` fijos que quedaron
   (líneas 429, 431, 454, 459, 461, 480) a esperas de señal real, como se hizo con las tres de
   septiembre.
6. Recién con 1-4 resueltos y verificados (no sólo declarados), volver a probar el caso de éxito de
   VAL-72 (Europa MAD/CDG/FCO) para confirmar que nada de esto lo rompió, y entonces sí, el paso que
   ya estaba pendiente desde la novena ronda: **probar en el teléfono** el criterio central de la
   historia.

---

## Lo que nadie puede verificar desde acá

1. **Cómo interpreta el modelo real un renglón `entre-vuelos`.** Sin cambios respecto de la novena
   ronda: sigue siendo la premisa central de VAL-72 y sigue sin poder probarse sin el modelo real.
   **Pasos para el PM:** una vez publicado, cargar el viaje Europa (EZE→MAD día 1, MAD→CDG día 6,
   CDG→FCO día 11), tocar "Armar la lista", y confirmar que las sugerencias tratan a Madrid y
   a París como destinos, no como escalas.
2. **Si un traslado con notas de verdad influye en la valija sugerida, una vez que el hallazgo
   central de esta ronda se corrija.** Hoy no hace falta probarlo en el teléfono porque el defecto
   se puede confirmar por completo desde acá (ya lo hice); pero una vez arreglado, conviene que el
   PM cargue un traslado con una nota relevante ("llevamos las bicis plegadas") y confirme en
   `ValijaTier.log()` o en el propio prompt (si hay forma de inspeccionarlo) que la nota llegó.
3. **El visor del teléfono en sí** — nada de esta ronda tocó DOM, permisos ni sandbox; sigue siendo
   la única razón por la que la dimensión 1 no puede subir de 18.
4. **Si lo publicado en el Artifact sigue siendo la v23.** No lo reconfirmé esta ronda (no cambió
   desde la novena, y dado que esta entrega no llega a candidato, no hay nada nuevo que pedirle al
   PM que pruebe todavía).

---

## Archivos revisados

- `git diff 4c99a42..4bf6d7d` completo, los tres archivos de código y el uno de auditoría que trae
- `app/parts/packing-engine.js` (`destinosDelViaje`, `summarizeReservationsForAI`,
  `sanitizeNotesForAI`, `lineaDestinos`, `destinationPrompt`, líneas 1543-2018) y su copia en
  `app/valija.html`
- `app/pruebas/val72-las-reservas-mandan.js` completo, corrido y con sabotaje propio
- `app/pruebas/tier-del-modelo.js` (grep de esperas, 5 corridas propias)
- `app/pruebas/LEEME.md` (sección de intermitencia conocida)
- `docs/backlog.md` (VAL-44 completo, VAL-73 completo, VAL-75 parcial para contexto)
- `docs/design/packing-engine.md` (§4, líneas 148-260)
- `docs/auditoria/2026-09-19-val72-novena-ronda.md` (para no repetir lo ya cerrado)
