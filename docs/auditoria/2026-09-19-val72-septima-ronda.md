# Auditoría VAL-72 — séptima ronda ("el número decía «ahí» y calculaba otra cosa", v26)

**Commit auditado:** `215db8d3158f81d114c040b561abeeb5d2b1f4dc` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío, `HEAD` en el
mismo hash al empezar y al terminar) · **Sello:** `VALIJA_VERSION = "26"`, y el "26" existe en un solo árbol.
Rondas anteriores: 57 · 51 · 70 · 59 · 51 · 54.

## Veredicto: NO PUBLICAR — 56/100

**No sale, ni como candidato.** El piso de 70 vale sólo cuando la única dimensión floja es la 1 por no poder
probar en el teléfono. Acá hay **dos afirmaciones falsas nuevas o no cerradas dentro de la misma línea del
prompt**, las dos reproducidas en Chromium **tocando `#pk-build`**, ninguna de las dos dependiente del visor
del teléfono, y ninguna de las dos con una prueba que las mire.

**Lo que esta ronda hizo bien, y es lo mejor de las siete.** El BLOQUEANTE 1 de la ronda 6 está cerrado de
verdad y lo confirmé por el gesto: el viaje con tren a Lisboa ya no dice "11 días ahí". La decisión de
producto que me pidieron atacar —no volver a la guarda, informar el tiempo **y de dónde sale el próximo
vuelo**— **es mejor que las dos salidas que yo había propuesto**, y la defiendo abajo. El arnés nuevo falla
**5 veces** contra el build anterior, o sea que mide en vez de describir. Los tres bloqueantes viejos
resisten mis propios sabotajes (12, 3 y 2 fallas). La ciudad repetida está arreglada para la forma
reportada. El sello subió. El encabezado mentiroso del backlog se corrigió y la corrección explica por qué
mentía. Y la entrega **falsificó su propia afirmación de la ronda anterior**, sola, antes de que se lo
pidieran: eso vale y lo cuento a favor.

**Y lo que la vuelve a voltear es la misma mecánica, por sexta vez seguida.** El arreglo de "la línea no
puede afirmar lo que el dato no dice" resolvió el caso reportado y dejó **otros dos** dentro de la misma
oración, con la misma forma exacta: el prompt afirma un hecho sobre el viaje que sale de un dato ausente, no
de un dato leído. Y el mecanismo escrito para que esto no vuelva a pasar **asegura algo falso sobre la app** y
por eso prohíbe justo el fixture que los habría visto.

---

## Los gestos del reporte, y qué prueba cubre cada uno

| Gesto con el que la persona ve la línea | Prueba que lo ejercita | Cubierto |
|---|---|---|
| Crear "Europa", cargar MAD/CDG/FCO, tocar **Armar la lista** | `val72-las-reservas-mandan.js` + `valija-bloque-b.js` (navegador, toca `#pk-build`) | **Sí**, y lo reataqué por el gesto |
| Ida y vuelta con hora de llegada | `IDA_Y_VUELTA_CON_END` / `lineaIV3` | **Sí** |
| Vuelo a Madrid + tren a Lisboa + vuelta desde LIS (bloqueante ronda 6) | `POR_TIERRA`, nuevo | **Sí**, y falla contra el build anterior |
| Ciudad por la que se pasa dos veces | `DOS_VECES`, nuevo | **Sí** para el número; **no** para el rótulo (ver MODERADO 7) |
| **Cargar un vuelo dejando «Llega» vacío** (el campo es opcional en el formulario) | **ninguna** | **NO** — BLOQUEANTE 1 |
| **Un vuelo importado sin origen, seguido de otro** | **ninguna** (`SIN_ORIGEN` sólo cubre el primer vuelo) | **NO** — BLOQUEANTE 2 |

Los dos gestos sin cubrir son los dos hallazgos bloqueantes. No es casualidad: el mecanismo nuevo
**prohíbe** escribir el primero de esos dos fixtures. Ver SEVERO 3.

---

## Hallazgos vivos, por gravedad

### BLOQUEANTE 1 · La frase de cierre del aviso sigue siendo falsa. La ronda 6 la marcó, se reescribió, y es falsa en otro caso que el formulario invita a producir

La ronda 6 encontró *"El último de la lista no lo dice porque no hay vuelo después"* y demostró que es falsa
en la ida y vuelta. La reescritura dice:

```
Un lugar sin tiempo es que no hay vuelo después desde el cual medirlo.
```

Es falsa en cuanto **un vuelo se carga sin hora de llegada**, que es lo que hace casi todo el mundo:
`REQUIRED.flight` es `start, from, to, confirmation, provider` — **`end` no está** — y en el formulario el
campo se dibuja `<div class="f">`, sin la clase `req` que marca lo obligatorio. Un vuelo sin "Llega" es una
reserva completa para la app, no una reserva a medias.

Reproducido con el motor sacado del HTML que se publica (fixture construido desde el formulario):

```
- Destinos ...: MAD (vuelo, 7 días ahí) · CDG (vuelo) · FCO (vuelo, 9 días ahí). ...
  Un lugar sin tiempo es que no hay vuelo después desde el cual medirlo.
```

**CDG no tiene tiempo y sí tiene vuelo después** (CDG→FCO, cargado, con fecha). No tiene tiempo porque al
vuelo MAD→CDG le falta la hora de llegada. La frase le dice al modelo que CDG es el final del viaje.

Mismo resultado con un dato roto (llegada posterior a la salida del próximo vuelo): `horas <= 0` tampoco
pone número, y la frase vuelve a explicar una ausencia con una causa que no es la que pasó.

**Es la trampa 4 del encargo dentro del prompt**, que es el peor lugar donde puede estar, y es la **misma
frase** que la ronda 6 marcó como SEVERO 3. El caso reportado se cerró; la clase de error no.

**Ninguna prueba mira esta frase.** No hay una sola aserción sobre el texto del aviso más allá de
`/movió por tierra/`.

### BLOQUEANTE 2 · Con el origen del próximo vuelo vacío, la app afirma un tramo por tierra que no está en los datos

`encadena` es falso por **dos motivos distintos** que el código trata como uno:

```js
var encadena = !!(sig && f.to && sig.from && norm(f.to) === norm(sig.from));
```

- el próximo vuelo sale de **otra** ciudad → hubo tramo por tierra. Es el caso que este commit vino a contar.
- el próximo vuelo **no tiene origen cargado** → no se sabe nada. La app acepta ese dato a propósito: el
  contrato del importador dice "o vacío", `missingFields` sólo lo muestra en pantalla y nunca bloquea el
  guardado, y el arnés tiene `SIN_ORIGEN` escrito justamente para declararlo.

Reproducido **tocando `#pk-build` en Chromium**, sembrando el viaje en `localStorage` y leyendo el prompt que
recibió `claude.use("sample").json()`:

```
- Destinos ...: MAD (vuelo, 9 días hasta el próximo vuelo, que sale de otro lado) · FCO (vuelo, 10 días ahí).
  ... Donde dice «hasta el próximo vuelo, que sale de otra ciudad», la persona se movió por tierra en el
  medio y ese tiempo no fue todo en ese lugar.
```

La app **no sabe** de dónde sale ese vuelo y le dice al modelo que la persona se movió por tierra. Es
textualmente *"El mensaje de error no inventa una causa"* y *"Nunca concluir de un dato lo que se puede
determinar leyendo"*, las dos reglas propias del proyecto, en la misma línea que esta ronda vino a arreglar.

**Y es nuevo de este commit por un camino nuevo.** El build v24 y anteriores no ponían número acá (la guarda
`encadena` lo tapaba, por el motivo equivocado pero con el resultado seguro); la v25 decía "ahí" (mal); la
v26 dice "sale de otro lado" y lo explica como tramo por tierra. La salida segura —la que esta misma función
eligió para todo lo demás— es no poner número cuando no se puede saber de dónde sale el próximo vuelo.

**Ninguna prueba lo mira.** `SIN_ORIGEN` pone el `from` vacío en el **primer** vuelo, donde afecta a `casa`,
nunca en el vuelo **siguiente**, que es donde vive esto.

### SEVERO 3 · El mecanismo de fixtures asegura algo falso sobre la app, y por eso prohíbe el fixture que habría visto el BLOQUEANTE 1

```js
const sinEnd = vuelos.filter(v => !/\bend:/.test(v) && !/to:"\s*"/.test(v));
ok(sinEnd.length === 0, ... "todos traen «end», que es el campo cuya ausencia tapó el defecto dos rondas seguidas");
```

y el mensaje del filtro dice: *"fixtures de vuelo SIN «end», **que la app siempre escribe**"*. `CLAUDE.md`
repite la idea: *"falla si un vuelo de prueba no trae los campos que el formulario escribe"*.

**Es falso.** `end` no está en `REQUIRED.flight` y el campo "Llega" no lleva la clase `req`. La app **no**
escribe siempre `end` en un vuelo: lo escribe si la persona lo completa.

Y el efecto es el contrario del buscado. `CLAUDE.md` ya tenía escrita la regla correcta —*"Si un campo es
opcional, tiene que haber un caso con y un caso sin"*— y el mecanismo nuevo **impide el caso «sin»**: hoy no
se puede agregar al arnés un vuelo con "Sale" cargado y "Llega" vacío sin poner el arnés en rojo. Lo comprobé:
agregué ese fixture a una copia del archivo y da `1 FALLARON`.

O sea: la regla se convirtió en aserción, que es lo correcto, pero **se convirtió la versión equivocada de la
regla**, y la versión equivocada es la que deja sin cubrir el BLOQUEANTE 1. Hoy el arnés tiene **cero**
fixtures de vuelo con salida cargada y llegada vacía. Es la forma más común de un viaje tipeado a mano.

### SEVERO 4 · "Gana la estadía más larga" no es lo que hace el código, y puede tirar una estadía verdadera

El commit y el backlog dicen *"Gana la estadía más larga, que es la que decide qué hay que llevar"*. El
código compara `horasHastaElProximoVuelo`, que **sólo es una estadía cuando `tiempoEsAca` es verdadero**.
Cuando es falso es otra cosa: el tiempo hasta un vuelo que sale de otro lado. La comparación mezcla las dos
magnitudes, que es exactamente el error que esta ronda vino a arreglar, un nivel más abajo.

Reproducido **por el gesto**, con un viaje posible: Madrid diez días, salto a Roma, vuelta a Madrid, tren a
Lisboa, vuelo a casa desde LIS.

```
- Destinos ...: MAD (vuelo, 11 días hasta el próximo vuelo, que sale de LIS) · FCO (vuelo, 10 h ahí).
```

Los **10 días reales en Madrid** —primer paso, `tiempoEsAca` verdadero, el dato más fuerte que la app tiene
sobre ese viaje— se pierden, porque 11 > 10 y el 11 no es una estadía. Sin el merge, la línea diría
`MAD (vuelo, 10 días ahí)`, que es cierto: acá el arreglo de la ciudad repetida deja el resultado **peor**
que antes.

No es una afirmación falsa —la línea dice algo verdadero— pero es información verdadera descartada por una
comparación entre dos cosas que no son la misma, y la descripción del cambio en dos documentos dice otra cosa
que lo que el código hace.

### MODERADO 5 · El mecanismo se esquiva de cuatro formas, cubre un solo tipo de reserva y un solo archivo

Me pidieron atacarlo. Escribí cinco fixtures de vuelo sin hora de llegada útil sobre una **copia** del arnés.
**Cuatro pasaron sin que el mecanismo los viera:**

| Esquive | ¿Lo ve? |
|---|---|
| `{ type:"flight", ..., meta:{origen:"importado"} }` — una llave anidada rompe `[^{}]*` | **No** |
| `{ type:'flight', ... }` — comillas simples | **No** |
| `{ type:"flight", ..., end:"" }` — el campo existe y está vacío | **No** |
| `{ type:"flight", ..., end:"2027-08-01" }` — fecha pelada en `end` (sólo se revisa `start`) | **No** |
| `mkVuelo("EZE","MAD","...")` — constructor; se ve el literal de adentro, no las llamadas | Sí, por casualidad |

Además: **sólo mira `type:"flight"`**. No revisa `stay` (check-out), `car` (devolución) ni `transfer`
(desde), que es la otra mitad de lo que `CLAUDE.md` enumera. Y **sólo lee `__filename`**: los otros ocho
arneses con fixtures no están cubiertos por nada.

**Lo bueno, y lo verifiqué:** apliqué el mismo criterio a mano sobre **todo** `app/pruebas/` y hoy no hay
ninguna violación — 42 fixtures de vuelo, todos con `end` y sin fecha pelada; los 6 `stay` con `end`, los
2 `car` con `end`, los 5 `transfer` con `from`. La brecha es latente, no viva.

### MODERADO 6 · El aviso cita una frase que la salida nunca emite

El aviso dice *«hasta el próximo vuelo, que sale de otra ciudad»*. La línea nunca escribe eso: escribe
*"que sale de LIS"*, *"que sale de BCN"* o *"que sale de otro lado"*. La instrucción que le explica al modelo
cómo leer el dato se refiere a un literal que no existe en el dato.

### MODERADO 7 · El rótulo del lugar fusionado no tiene control

Saboteé el merge para que **no** copie `tiempoEsAca` ni `proximoVueloDesde` del ganador: **el arnés queda
entero en verde**. `DOS_VECES` afirma el número (`> 200`) y no afirma la palabra. Es la forma exacta del
defecto de la ronda 6 —el número bien, la palabra mal— en el código nuevo de esta ronda, sin control.

Para comparar, los que **sí** tienen control (sabotajes míos sobre copias del HTML):

| Sabotaje | Resultado |
|---|---|
| volver a descartar el duplicado (comportamiento viejo) | 1 FALLARON |
| que gane el número más corto | 1 FALLARON |
| `encadena = !!sig` (rotular siempre "ahí") | 3 FALLARON |
| `proximoDesde:""` siempre | 1 FALLARON |
| cambiar el texto del aviso | 1 FALLARON |
| **el merge no copia el rótulo** | **verde** |
| `cuantoTiempo` fija `"2 h"` en su rama corta | **verde** (viene de la ronda 6, sin cambios) |

### MODERADO 8 · Código muerto y un comentario que quedó describiendo el mecanismo anterior

```js
var repetido = !!vistos[k];
vistos[k] = true;
```

`repetido` no se usa en ninguna parte. Y con eso `vistos` quedó **de sólo escritura** dentro de
`destinosDelViaje`: su única lectura es la variable muerta. La deduplicación ahora la hace el recorrido de
`lugares`. El comentario grande de más abajo sigue titulado *"EL DESTINO ESCRITO NO PASA POR `vistos`"* y
explica el cuidado contra un mecanismo que ya no decide nada. Es chico, y es la trampa 4 otra vez.

### Lo que ataqué y resultó sano (no cuenta en contra, cuenta como cobertura)

- **`sumar` no puede duplicar un lugar.** La clave es `norm(lugar)` y el merge siempre retorna. Verificado
  con 14 fixtures propios y con `dDos.lugares.filter(...).length === 1`.
- **`sumar` no puede mezclar dos lugares distintos.** Sólo las entradas con `horas != null` entran al merge,
  y sólo los vuelos llevan `horas`; los vuelos se procesan antes que alojamientos, traslados y autos. Una
  pista nunca fusiona ni es fusionada. Leído y comprobado.
- **`sumar` no puede perder un lugar.** Las claves de `vistos` y las de `lugares` son el mismo conjunto en
  las dos versiones del código; el cambio es equivalente salvo por el merge.
- **Normalización.** `" mad "` como origen del próximo vuelo encadena bien con `MAD`.
- **Datos rotos.** Llegada posterior a la salida del próximo, `end` vacío, `end` basura, `horas` negativas:
  ninguno pone número, ninguno lanza. Lado seguro, correcto.
- **Aeropuertos distintos de la misma ciudad** (GRU → CGH): la línea nueva lo cuenta bien, y ése es el caso
  donde la decisión de producto se luce.
- **`VUELVE_AL_MEDIO`**: EZE queda como destino con "4 días ahí". Es alcance declarado desde la ronda 4, no
  es nuevo.
- **Fechas invertidas**: siguen dando EZE como destino. **Está declarado** en el arnés y en el backlog con su
  razón, y la razón es correcta: un MAD→EZE→MAD es lo que carga alguien que vive en Madrid. Declararlo suma.

---

## Afirmaciones verificadas

| Afirmación de la entrega | Cómo la verifiqué | Resultado |
|---|---|---|
| Los nueve arneses en verde, con sus números | Corridos uno por uno, `NODE_PATH=/opt/node22/lib/node_modules`, ruta absoluta del HTML | **Cierto, con los números exactos**: `motores-desde-html` 39, `valija-bloque-b` **111/0**, `hallazgos-qa-bloque-b` 31, `tier-del-modelo` 42, y `las-dos-copias`, `val72`, `val63`, `val74`, `el-script-parsea` todos en verde |
| "Las dos copias del motor son idénticas" | **Comparación propia**: extraje la región del HTML y el cuerpo del UMD de `parts/`, `diff` byte a byte | **Cierto.** `packing-engine`: sólo una línea en blanco de más y el salto final. `adjuntos-engine`: igual. **Cero diferencias de código.** No me apoyé en `las-dos-copias.js` |
| "El bloqueante de la ronda 6 está cerrado" | Fixture `POR_TIERRA` propio **y el gesto en Chromium tocando `#pk-build`** | **Cierto.** `MAD (vuelo, 11 días hasta el próximo vuelo, que sale de LIS)`. Ya no afirma "ahí" |
| "Las pruebas nuevas miden en vez de describir" | Corrí el arnés **de hoy** contra el HTML de `64a7434` | **Cierto** — **5 FALLARON**, las cinco aserciones nuevas |
| "Le puse `end` a `SIN_ESCALA` y la aserción falló con el motivo falso a la vista" | Leí el fixture y la aserción en el commit | **Cierto.** `SIN_ESCALA` ahora trae `end` en los dos vuelos y el motivo dejó de decir "porque no se encadenan" |
| Los bloqueantes de las rondas 2 y 4 siguen cerrados | **Sabotajes propios sobre copias del HTML**: (a) alojamiento de vuelta al cajón en firme; (b) destino escrito de vuelta por `vistos`; (c) `ordenConfiable = vuelos.length > 1` | **Cierto** — 12, 3 y 2 FALLARON. Los tres controles son reales |
| El bloqueante de la ronda 5 sigue cerrado | **Sabotaje propio**: `encadena = !!sig` (rotular siempre) | **Cierto** — 3 FALLARON |
| "Ciudad repetida: gana la estadía más larga, con prueba" | Fixture propio (conexión 2 h + 10 días) por el gesto, y dos sabotajes | **Cierto para la forma reportada** (MAD informa 10 días). **Falso como descripción general**: compara `horasHastaElProximoVuelo`, no estadías, y puede tirar una estadía verdadera — SEVERO 4 |
| "«El último de la lista no lo dice» era falso, reescrito" | Fixtures propios con vuelo sin hora de llegada y con dato roto | **Reescrito sí; sigue siendo falso** en otro caso alcanzable — BLOQUEANTE 1 |
| "El arnés lee su propio archivo y falla si un fixture de vuelo no trae `end` o tiene fecha pelada" | Cinco esquives sobre una copia del arnés | **Cierto para el caso simple, esquivable de cuatro formas** — MODERADO 5 |
| "…los campos que el formulario escribe" / "«end», que la app siempre escribe" | `REQUIRED` en `valija.html:1428` y el formulario de vuelo en `:8708` | **FALSO.** `end` no es obligatorio para un vuelo ni en `REQUIRED` ni en la clase `req` del campo "Llega" — SEVERO 3 |
| "No elegí ninguna de tus dos salidas: se conservan los dos casos" | 22 fixtures propios + 5 por el gesto en Chromium | **Cierto y es la mejor decisión de las tres.** Ver la sección de diseño |
| "`VALIJA_VERSION` a 26" | `grep` del sello y recorrido por los diez commits de VAL-72 | **Cierto**, y el "26" está en un solo árbol |
| "Saqué el `✅ entregada en v24` del backlog" | `grep 'entregada en v24' docs/backlog.md` | **Cierto** — la única aparición que queda es la frase que explica por qué era falso |
| "`CLAUDE.md` suma la cuarta pregunta y la nota del mecanismo" | Diff de `CLAUDE.md` | **Cierto**, y la cuarta pregunta es la correcta. No alcanza — ver abajo |
| **"Lo publicado es la v23. Los cuatro `grep` lo confirman"** | **Intenté leerlo**: `curl` al link del Artifact devuelve el shell de 20 KB sin la app; el host de contenido `136a6d7e-….frame.claudeusercontent.com` devuelve **404**; `claude.ai/api/frame/136a6d7e-…` devuelve **403** sin credenciales | **NO VERIFICADO.** No puedo reproducir la lectura desde acá. Lo que **sí** comprobé: los cuatro resultados descritos son **internamente consistentes** con el rango de commits `831ba3e..d6700d8`, que tiene `VALIJA_VERSION = "23"`, cero `destinosDelViaje`, cero `sacados de los vuelos` y sí `cambioQueMueveLaValija`. Es plausible y está bien escrito; no es verificable acá |
| Árbol quieto | `git status --porcelain` vacío y `HEAD` en `215db8d` al empezar y al terminar | **Cierto** — no llegó ningún commit mientras se puntuaba |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **14** | Base 20: sustituto fiel —motor extraído del HTML que se publica, más el gesto en Chromium tocando `#pk-build` con el `Store` de la app— y la brecha del teléfono declarada en el commit sin llamarle "verificado" a nada. El método mejoró otra vez: 5 fallas contra el build anterior. Bajo 6 porque el sustituto volvió a fallar en el lugar donde decidía, y esta vez **quedó fijado por escrito**: el fixture que habría visto los dos bloqueantes —un vuelo con "Sale" y "Llega" vacío— no existe, y el mecanismo nuevo lo **prohíbe** apoyándose en algo falso sobre el formulario. Es la resta por "el simulador se escribió de memoria" aplicada al dato, agravada porque ahora la memoria equivocada es una aserción. Y la afirmación que sostiene que el PM está a salvo —"lo publicado es la v23"— no se puede reproducir acá. |
| 2 | Diagnóstico de causa raíz | 15 | **9** | La causa del bloqueante de la ronda 6 está bien encontrada, bien separada en dos mitades ("el número estaba bien, la palabra estaba mal") y probado que el arreglo la elimina: 5 fallas contra el build anterior y 3 con el sabotaje del rótulo. Eso es trabajo de 15. Baja porque la misma pregunta que resolvió el caso reportado no se le hizo al código nuevo: `encadena` es falso por **dos** motivos y el arreglo trata uno solo; el merge compara dos magnitudes distintas como si fueran una. Las dos son "la segunda hipótesis que explica la misma condición y no se separó", en el código escrito esta ronda. |
| 3 | Honestidad de lo verificado | 15 | **10** | Lo más alto de las siete rondas y lo cuento a favor sin descuento: la entrega **falsificó su propia afirmación** de la ronda anterior en el commit y en el backlog, en mayúsculas y sin adornos; declaró "NO probado en el teléfono del PM"; declaró las fechas invertidas como no resueltas con la razón por la que no son determinables; corrigió un encabezado que mentía y explicó por qué mentía; y trajo la lectura del Artifact en vez de suponerla. Declarar una brecha nunca baja el puntaje y acá sube. Baja por tres afirmaciones sin respaldo: "gana la estadía más larga" (no es lo que hace el código), "«end», que la app siempre escribe" (falso contra `REQUIRED` y contra el formulario), y "el arnés falla si un fixture no trae los campos que el formulario escribe" (esquivable de cuatro formas, y un solo tipo de reserva). |
| 4 | Cumplimiento del contrato | 15 | **9** | A favor, verificado uno por uno con fixtures propios y con ocho sabotajes: las tres reglas de VAL-72 se cumplen —un vuelo manda, el multidestino manda todos, el destino escrito nunca queda contradicho—, Europa sigue nombrando las tres ciudades con su aviso, la ida y vuelta dice "ahí", el tramo por tierra ya no miente, la ciudad repetida informa la estadía larga en la forma reportada, y los cuatro bloqueantes anteriores resisten el sabotaje. En contra: la línea que esta historia existe para producir sigue afirmando dos cosas que el dato no dice, en dos formas de viaje alcanzables, y las dos se reproducen acá tocando el botón. No es una baja por el teléfono. |
| 5 | Calidad interna | 15 | **8** | A favor, todo comprobado por mí: las dos copias del motor son idénticas byte a byte salvo una línea en blanco; los nueve arneses dan los números afirmados; cinco de mis siete sabotajes sobre el código nuevo y los tres sobre los arreglos viejos ponen el arnés en rojo; el comentario del código describe el diseño nuevo con precisión, incluida la parte que costó el veto anterior. En contra: el mecanismo nuevo codifica una regla falsa y se esquiva de cuatro formas; el rótulo del merge no tiene control; `repetido` es código muerto y `vistos` quedó de sólo escritura con un comentario que todavía lo explica como si decidiera; y dos documentos describen el merge como algo que no hace. |
| 6 | Diseño y decisiones de producto | 10 | **6** | **La decisión que me pidieron atacar se sostiene, y es mejor que las dos salidas que yo había propuesto.** Volver a la guarda (mi salida a) callaría un dato real en un viaje común, y el texto largo (mi salida b) por sí solo no distingue el caso en que el tiempo sí es tiempo ahí. Conservar los dos y nombrar de dónde sale el próximo vuelo informa más y afirma menos, está argumentado con lo que se descartó, y en el caso GRU→CGH la línea cuenta algo verdadero que ninguna versión anterior podía contar. Eso es trabajo de producto de verdad. Baja porque "informar en vez de decidir" exige que lo informado sea cierto: con el origen vacío la app informa un tramo por tierra que no sabe, la frase de cierre explica una ausencia con una causa equivocada, y el aviso cita un literal que la salida no emite. |
| | **Total** | **100** | **56** | **NO PUBLICAR, ni como candidato.** Dos afirmaciones falsas en la línea del prompt, reproducidas acá tocando el control, ninguna cubierta por una prueba, y el mecanismo escrito para evitarlas prohíbe el fixture que las habría visto. |

Diferencia con la ronda 6: **+2**. Los hallazgos anteriores se cerraron bien y con controles que pude
sabotear, la decisión de producto es la correcta, y la honestidad subió. Lo que no se movió en siete rondas
es la mecánica: el arreglo no recibe el mismo ataque que recibió el defecto.

---

## Las tres cosas que me pidieron mirar con desconfianza

### 1 · El mecanismo de fixtures: ¿se puede esquivar? ¿cubre los otros tipos? ¿y los otros arneses?

**Sí, se esquiva** — cuatro de mis cinco intentos pasaron (MODERADO 5). **No cubre los otros tipos** de
reserva: sólo `type:"flight"`, y sólo `start` para la fecha pelada. **No cubre los otros arneses**: lee
`__filename` y nada más; hoy los otros ocho están limpios, lo comprobé aplicándoles el mismo criterio a mano,
así que la brecha es latente.

**Pero el problema grave no es ninguno de esos tres.** El mecanismo **asegura algo falso**: que la app
siempre escribe `end` en un vuelo. No lo hace. Y al asegurarlo, deja fuera del arnés el fixture que habría
destapado el BLOQUEANTE 1. Un mecanismo que convierte una creencia equivocada en una aserción es peor que la
disciplina que reemplaza, porque ahora la creencia se defiende sola. **Es el mismo error que costó tres
iteraciones en septiembre**, un piso más arriba: un arnés escrito desde una hipótesis sólo puede darle la
razón a quien lo escribió.

Un mecanismo escrito leyendo el contrato saldría de `REQUIRED` —que ya está en el archivo, como dato— y
diría: *todo campo de `REQUIRED[tipo]` tiene que estar en cada fixture de ese tipo; todo campo que la
pantalla ofrece y `REQUIRED` no exige tiene que tener **al menos un fixture con y al menos uno sin***. Eso es
la regla que `CLAUDE.md` ya tiene escrita, y es la que habría exigido el fixture que falta.

### 2 · ¿Alcanza la cuarta pregunta de `CLAUDE.md`, o sigue siendo disciplina para acordarse?

**No alcanza, y esta misma ronda lo demuestra dos veces.**

La cuarta pregunta —*¿qué condición saqué, y qué caso la necesitaba?*— es la correcta y habría frenado el
defecto de la ronda 6. Pero **los dos bloqueantes de hoy no salieron de sacar una condición: salieron de
agregar una rama**. La pregunta mira lo que se quita y esta vez el error estuvo en lo que se puso. La
pregunta que faltaba acá es la simétrica: *la condición nueva, ¿es falsa por un solo motivo?* `encadena` es
falso por dos y el código escribió un solo texto para los dos.

Y la nota "una regla que se pueda convertir en aserción se convierte" es correcta como principio; la
aplicación concreta convirtió la versión equivocada de la regla (punto 1). Convertir mal es peor que no
convertir.

**Mi idea 2 —correr cada fixture de vuelo con y sin `end` y exigir que alguna aserción cambie— no se
implementó, y es exactamente la que habría encontrado el BLOQUEANTE 1**, porque habría obligado a que el
arnés supiera qué dice la línea cuando falta la hora de llegada. La idea 3 tampoco. Lo que se hizo va en la
dirección correcta y se quedó en el escalón de abajo.

### 3 · La lectura del Artifact

**No la puedo verificar y la reporto como no verificada.** Lo intenté: el link del Artifact devuelve el shell
de 20 KB sin la app; el host de contenido devuelve 404; la API devuelve 403 sin credenciales. Ningún `grep`
mío toca el archivo que sirve el Artifact.

**Lo que sí puedo decir:** los cuatro resultados descritos son consistentes entre sí y con un árbol real de
este repositorio (`831ba3e..d6700d8`, `VALIJA_VERSION = "23"`, sin `destinosDelViaje`, sin
`sacados de los vuelos`, con `cambioQueMueveLaValija`). Y **está bien escrito** en el backlog: dice la fecha,
dice el método, dice qué encontró y saca la conclusión correcta —el PM no tiene ninguna versión vetada—, sin
extenderla a nada más. Como redacción, es lo que pide la regla "Publicar no es haber publicado".

Dos cosas para que nadie se confunda después: **quien lo leyó es la única persona que lo leyó**, así que la
afirmación vale lo que vale ese testimonio y conviene que el PM la confirme con el sello en pantalla; y
**"23" también está en cinco árboles distintos** de este repo, así que el sello por sí solo no identifica el
build — sólo lo hacen los otros tres `grep` juntos, que es justamente por lo que se hicieron cuatro.

---

## Lo que falta para llegar a 85, en orden

1. **Que el número no salga cuando no se sabe de dónde sale el próximo vuelo.** Es una condición en la
   misma línea: si `sig` existe pero `sig.from` está vacío, no hay número y no hay frase. Es el lado seguro,
   el mismo que esta función eligió para el vuelo sin origen, para la fecha faltante y para el dato roto.
   **Con su fixture**: un segundo vuelo sin `from`, que hoy no existe en ningún arnés.
2. **Arreglar la frase de cierre del aviso para que sea cierta, o sacarla.** Hoy explica una ausencia con
   una causa. Puede decir qué pasó sin inventar por qué: *"Un lugar sin tiempo es que no se pudo medir"*.
   **Con su fixture**: un vuelo con "Sale" cargado y "Llega" vacío, seguido de otro vuelo. Ese fixture hoy
   **no se puede escribir** sin poner el arnés en rojo, así que el punto 3 va antes o junto con éste.
3. **Arreglar el mecanismo para que salga de `REQUIRED` y no de una creencia.** Exigir los campos
   obligatorios de cada tipo, y para los opcionales exigir **un caso con y un caso sin**, que es la regla que
   `CLAUDE.md` ya tiene escrita. Extenderlo a `stay`, `car` y `transfer`, y revisar `end` además de `start`
   para la fecha pelada. Y que la aserción deje de afirmar que la app siempre escribe `end`.
4. **Decidir qué gana cuando una ciudad se repite, comparando magnitudes comparables.** Lo defendible es que
   una estadía verdadera (`tiempoEsAca`) le gane a un tiempo que no es estadía, y recién entre iguales que
   gane el más largo. Sea cual sea la decisión, **con su control sobre el rótulo**: hoy sabotear la copia de
   `tiempoEsAca` deja el arnés en verde.
5. **Corregir el commit y el backlog** para que digan lo que el merge hace —gana el mayor
   `horasHastaElProximoVuelo`— en vez de "gana la estadía más larga". Y que el aviso cite el literal que la
   línea realmente emite.
6. **Sacar `repetido`, que no se usa, y actualizar el comentario de `vistos`**, que sigue explicando un
   mecanismo que ya no decide nada.
7. Recién entonces, publicar como candidato y pedirle al PM el guion de abajo. Los puntos 1 a 6 son de
   minutos y ninguno depende del teléfono.

---

## Lo que nadie puede verificar desde acá

Esta sección no está vacía y ninguno de sus puntos es una formalidad.

1. **Qué hace el modelo del teléfono con la línea nueva.** Todo lo que verifiqué termina en el texto que sale
   hacia el modelo. Que un modelo que lee `MAD (vuelo, 11 días hasta el próximo vuelo, que sale de LIS)` +
   la pista del tren arme una valija para España **y** Portugal —y no una sola para Madrid— no lo puede saber
   nadie en este entorno. **Pasos, una vez arreglado y publicado:** cargar el vuelo a Madrid con "Llega"
   completo, un traslado Madrid→Lisboa a los dos días y el vuelo de vuelta desde LIS; tocar **Armar la
   lista**; mirar si los ítems mencionan Lisboa o Portugal.
2. **Qué está publicado hoy.** Lo declarado es la v23 y no lo pude reproducir: el Artifact devuelve el shell,
   el host de contenido 404 y la API 403. **Antes de pedirle cualquier prueba al PM:** que abra el link
   compartido en el teléfono y lea el sello en pantalla. Si dice 23, lo declarado se confirma y el PM no
   tiene ninguna versión vetada. Si dice 24 o 25, tiene en la mano una versión que las rondas 4, 5 o 6
   vetaron, y eso cambia la urgencia de todo lo demás.
3. **Que el link compartido no esté fijado a una versión anterior.** Es la otra causa, distinta de "no se
   publicó", que ya pasó en este proyecto el 17/09. Sólo se comprueba desde el aparato del PM.
4. **Tres preguntas al PM que cuestan un minuto cada una y ahorran una ronda.**
   (a) Cuando cargás un vuelo a mano, ¿completás el campo **«Llega»**? De eso depende si el BLOQUEANTE 1 le
   pasa siempre o casi nunca.
   (b) ¿Alguna vez te movés entre ciudades sin vuelo —tren, micro, auto— y lo cargás como traslado? Quedó de
   la ronda 6 sin respuesta y ahora hay una línea nueva escrita para ese caso.
   (c) ¿Escribís en el «hasta» de un traslado el nombre de la ciudad que también pusiste como destino del
   viaje? Quedó de la ronda 5 sin respuesta.
5. **El visor del teléfono en sí.** Nada de esta ronda tocó DOM, permisos ni sandbox, así que la brecha no
   creció. Sigue entera, y es la única razón por la que la dimensión 1 no puede pasar de 20 desde acá.
6. **El número con otra zona horaria.** Este entorno corre en UTC y el teléfono del PM no. `hoursBetween`
   lee una fecha pelada como UTC y una con hora como local. Hoy no hay camino que escriba una fecha pelada
   —los dos formularios son `datetime-local`, comprobado en la ronda 6—, así que no hay defecto vivo; el
   cálculo sigue siendo sensible a la zona y acá eso es invisible por construcción.

---

## Cómo reproducir lo de arriba

Todo vive en el scratchpad de la sesión, fuera del repo. **No modifiqué ningún archivo del repositorio fuera
de este documento**, y ningún sabotaje tocó `app/valija.html`.

- `rig.js` — carga `PackingEngine` desde `app/valija.html`, igual que los arneses del repo.
- `ataque1.js` / `ataque2.js` / `ataque3.js` — 20 fixtures construidos desde el formulario de reservas:
  ida y vuelta, multidestino, tramo por tierra, pasaje abierto, ciudad repetida en sus dos órdenes, vuelo sin
  hora de llegada, vuelo sin origen, origen con mayúsculas y espacios, fechas invertidas, llegada posterior a
  la próxima salida, GRU→CGH, vuelta a casa al medio.
- `gesto7.js` — Playwright: siembra el viaje en `localStorage`, abre `#/trip/t1/valija`, **toca `#pk-build`**
  y lee el prompt que recibió `claude.use("sample").json()`. Confirma `VALIJA_VERSION === "26"` en la página
  cargada. Es el gesto, no el evento.
- `sab.py` / `sab2.py` → diez sabotajes sobre **copias** del HTML: el merge, el sentido de la comparación,
  la copia del rótulo, `encadena`, `proximoDesde`, el texto del aviso, `cuantoTiempo`, el alojamiento en
  firme, el destino escrito por `vistos`, `ordenConfiable`.
- `esquive.js` — copia del arnés con cinco fixtures que esquivan el mecanismo.
- `otros.js` / `otros2.js` — el criterio del mecanismo aplicado a mano a los nueve arneses y a los cuatro
  tipos de reserva.
- `extraer.js` — extracción y `diff` byte a byte de las dos copias de cada motor.

## Nota sobre el árbol

Verificado quieto: `git status --porcelain` vacío y `HEAD` en `215db8d` al empezar y al terminar. No llegó
ningún commit encima mientras se puntuaba.
