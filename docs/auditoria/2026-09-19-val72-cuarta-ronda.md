# Auditoría VAL-72 — cuarta ronda ("las pistas dejan de perderse cuando son lo único que hay")

**Commit auditado:** `a33653f4decbd3500c06acc0c96d2f6b5921b2e6` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío, mismo hash antes y
después) · **Publicado:** no — `VALIJA_VERSION` sigue en `"24"`. Rondas anteriores:
`2026-09-19-val72.md` (57), `-segunda-ronda.md` (51), `-tercera-ronda.md` (70).

## Veredicto: NO PUBLICAR — 59/100

**No sale ni como candidato.** El piso de 70 vale sólo cuando la única dimensión floja es la 1 por no poder
probar en el teléfono. Acá hay dos defectos reproducibles **en node, sin teléfono**, y los dos los introdujo o
los destapó el último commit — el que se hizo justamente para cerrar la ronda.

Los cuatro puntos de "qué falta para 85" de la tercera ronda están atendidos, y tres de los cuatro bien. Pero
el arreglo del punto nuevo (defecto 1 del atacante: "las pistas se perdían") **quitó una guarda sin mirar qué
más protegía**, y eso volvió a producir la misma forma de falla que ya vetó esta historia dos veces: el
destino que la persona escribió desaparece del prompt y en su lugar la app le afirma al modelo algo falso
sobre los datos de la persona.

Es la trampa 5 de mi encargo en miniatura, y la regla que este proyecto ya tiene escrita con factura pagada:
*"una guarda que devuelve convierte cualquier sorpresa en su propio diagnóstico"* — acá pasó lo simétrico, se
**sacó** la guarda de salida y lo que salía por ella pasó a caer en una rama que afirma.

---

## Los gestos del reporte, y qué prueba cubre cada uno

La auditoría arranca por el reporte, no por el diff.

| Gesto con el que el PM vio el síntoma | Prueba que lo ejercita | Cubierto |
|---|---|---|
| Crear un viaje "Europa", cargar vuelos MAD/CDG/FCO, tocar "Armar la lista" | `val72-las-reservas-mandan.js` (motor sacado del HTML) + `valija-bloque-b.js` (navegador, toca los botones) | Sí |
| Viaje con destino escrito y reserva en el punto de partida (lo agregaron las auditorías 1 y 2) | `val72` bloque `HOTEL_EN_ORIGEN` / `OTRAS` | Sí para el fixture literal; **no** para las variantes que encontré abajo |
| Importar reservas y que el motor las use | `importar-*.js`, `motores-desde-html.js` | Sí (no es el eje de esta historia) |

Ningún gesto quedó sin prueba. El problema de esta ronda no es cobertura de gestos: es que los fixtures no
cubren datos que la app acepta sin chistar.

---

## Hallazgos vivos, por gravedad

### BLOQUEANTE 1 · El destino escrito desaparece, y la app afirma que nadie lo escribió

Cuando una **pista** (alojamiento, traslado o auto) tiene un texto que normaliza igual que el destino escrito
a mano, el `vistos[k]` de `sumar` se come la entrada `escrito-a-mano`, `lugares` queda vacío, y la rama nueva
de `lineaDestinos` declara al modelo que **la persona no escribió ningún destino**.

Reproducido con el motor sacado de `app/valija.html`:

```js
trip  = { destination:"Bariloche" }
items = [ { type:"transfer", to:"Bariloche", start:"2027-06-30" } ]
```

| | Línea que recibe el modelo |
|---|---|
| **Antes** (`2923d8a`) | `- Destino: Bariloche` |
| **Ahora** (`a33653f`) | `- Destino: la persona no escribió ninguno y no hay vuelos cargados. Hay además "Bariloche" (traslado, …). Una dirección no dice si está en el destino o en el lugar de donde se sale … fijate en las fechas … antes de tomarla como destino.` |

Dos cosas mal, y la segunda es peor que la primera:

1. **La afirmación es falsa.** La persona sí escribió "Bariloche". `lineaDestinos` no puede saber si escribió
   un destino: sólo sabe si sobrevivió a la deduplicación. Es la regla de "el mensaje no inventa una causa",
   aplicada al prompt.
2. **El destino escrito quedó degradado a pista, con una advertencia que le pide al modelo que NO lo tome
   como destino.** O sea: una reserva volvió a desplazar el destino escrito. Es la misma forma de falla del
   veto de 57/100, por un camino nuevo.

Reproduce igual con `car.address`, con `stay.address`, y con diferencias de acento/mayúscula/espacios
(`"Córdoba"` vs `"cordoba"`, `"  MADRID "` vs `"madrid"`), porque `norm()` saca acentos, baja a minúsculas y
recorta. **Control:** con una pista distinta del destino escrito (`"Villa La Angostura"`) la línea sale bien
(`- Destino: Bariloche (escrito-a-mano) …`), así que el hallazgo es de la colisión y no del arreglo entero.

**Y la mitad de abajo también miente:** con un vuelo cargado **sin `to`** más un hotel, la línea dice *"y no
hay vuelos cargados"* teniendo un vuelo cargado. `REQUIRED.flight` sólo genera alertas de "qué falta", no
bloquea el guardado, y el contrato del importador dice textual `"start":"YYYY-MM-DDTHH:mm o vacío"`; en todo
`app/valija.html` no hay **un solo** atributo `required`. Un vuelo incompleto es un estado que la app acepta a
propósito.

**Por qué es bloqueante y no una observación:** rompe el criterio de aceptación que agregaron las dos
auditorías anteriores (el destino escrito sobrevive), se reproduce en node sin teléfono, y es una regresión
medida contra el commit inmediatamente anterior.

### BLOQUEANTE 2 · Un vuelo de vuelta sin fecha convierte el aeropuerto de casa en el destino

`porFecha` ordena por `String(start||"")`, así que un vuelo **sin `start`** ordena **primero**. Si el que está
sin fecha es el de vuelta, `casa` pasa a ser el destino real y la regla del vuelo de vuelta descarta la ida.

```js
[ { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T10:00" },
  { type:"flight", from:"MAD", to:"EZE", start:"" } ]      // trip.destination = "España"
```

→ `- Destinos, sacados de los vuelos ya cargados, que son lo que manda: EZE (vuelo). La persona además
escribió "España" … úsalo sólo como contexto, NUNCA por encima de lo de arriba.`

El viaje a España se convierte en un viaje a Buenos Aires, **con la instrucción explícita de ignorar
"España"**. Es palabra por palabra el defecto que el backlog describe como el de 57/100.

Esto **no** es el caso declarado en el arnés. El declarado es "el primer vuelo viene sin `from`", que el
propio commit argumenta como "el lado seguro del error — se manda de más, no de menos". Éste es el lado
inseguro: **se manda de menos y se manda mal**, se pierde el destino verdadero. La declaración existente no lo
cubre.

Control: con la ida sin fecha y la vuelta con fecha, sale `MAD` (bien). Con las dos sin fecha, sale `MAD`
(bien). Sólo falla la combinación de arriba.

### SEVERO 3 · `lineaDestinos` revienta si la lista viene de una versión anterior del motor

El commit cambió

```js
if (!d || !d.lugares || !d.lugares.length) { return "- Destino: " + ((b && b.destino) || "sin especificar"); }
```

por `var partes = (d && d.lugares || []).map(...)`. El `d &&` muestra que quien lo escribió sabía que `d`
puede ser nulo — pero doce líneas más abajo quedó `var d.pistas` sin guarda:

```js
var pistas = (d.pistas || []).map(...)   // d es null → TypeError
```

Verificado ejecutando: `destinationPrompt({ base:{ destino:"Bariloche", … } })` →
`TypeError: Cannot read properties of null (reading 'pistas')`. Antes de este commit devolvía
`- Destino: Bariloche`.

**No es alcanzable desde la app hoy** — lo comprobé: los dos únicos llamadores (`runGenerate` línea 7924 y
`planListUpdateAsync` → `enrichWithDestination`) pasan siempre una lista recién armada por `buildPackingList`,
y `mergeLists` hace `Object.assign({}, fresh, …)`, así que `base` sale siempre del `fresh`. Por eso es severo
y no bloqueante. Pero el comentario de `destinationPrompt`, veinticinco líneas más abajo en el mismo archivo,
dice textual *"si la lista viene de una versión anterior del motor, el bloque no se arma"*: el archivo declara
que ese escenario existe, y esta función dejó de sobrevivirlo.

### SEVERO 4 · El `@returns` de `destinosDelViaje` sigue describiendo el diseño volteado — en las dos copias

El encabezado grande sí está reescrito y está bien. Pero el JSDoc inmediatamente pegado a la función, que es
el que describe el **contrato**, no se tocó (`app/valija.html:2998`, `app/parts/packing-engine.js:1621`,
idénticos):

```js
/** Los destinos del viaje, en orden de firmeza, con de dónde salió cada uno.
    @returns {{lugares:Array, deReservas:boolean}} */
```

- *"en orden de firmeza"* es el resto de la jerarquía de cinco niveles. Hoy `lugares` nunca mezcla firmezas:
  o trae vuelos, o trae la única entrada `escrito-a-mano`.
- **El `@returns` omite `pistas`**, que es el campo que esta historia agregó y el eje entero del diseño de dos
  cajones. Es el mismo campo cuya pérdida fue el defecto 1 que este commit vino a arreglar.

El encargo pedía explícitamente verificar que no quedara ninguna otra descripción vieja. Quedó ésta, en las
dos copias, en la misma función, a dos líneas del comentario que se reescribió para arreglar exactamente esto.
El comentario de `lineaDestinos` que se me pidió mirar aparte sí está bien: describe el problema del PM y la
solución actual, y no afirma nada que el código no haga.

### MODERADO 5 · `las-dos-copias.js` cerró menos de lo que su propio comentario dice que cerró

El hueco que señalé en la tercera ronda está **cerrado para las constantes**, y lo verifiqué con sabotaje
propio: cambiar `MARGEN_LISTA_BYTES` sólo en el HTML da **2 FALLARON**. El control negativo propio también
prueba lo que dice.

Pero el comentario del arnés afirma que la cabecera se compara *"es un bloque contra otro"*, y no es eso: se
compara una **lista filtrada de líneas** que matcheen `^\s*(var|const|let)\s+NOMBRE\s*=`, comparada como
conjunto. Falsificado con dos sabotajes:

| Sabotaje aplicado sólo al HTML | Resultado del arnés |
|---|---|
| Cambiar `"lista base de 28 ítems"` → `"999 ítems"` en el comentario de cabecera del motor | **verde** |
| Intercambiar el orden de `MAX_NOMBRE_IA` y `MAX_MOTIVO_IA` | **verde** |
| Cambiar el valor de `MARGEN_LISTA_BYTES` | 2 FALLARON (bien) |

O sea: **los comentarios de la cabecera del motor pueden divergir entre las dos copias y el arnés dice
verde**, y una declaración multilínea (hoy no hay ninguna ahí, mañana puede haberla) sólo compararía su
primera línea. Justo la familia de defecto — una explicación que quedó vieja — que esta misma ronda vino a
arreglar. El hueco es más chico que antes; lo que sobra es la afirmación.

Aclaración a favor: el backlog lo describe con la palabra correcta ("compara también **las declaraciones** de
la cabecera"). La afirmación de más está sólo dentro del arnés.

### MODERADO 6 · El sello de versión no distingue este árbol del que ya se probó

`VALIJA_VERSION` vale `"24"` en `11f7cdf`, `e313e4c`, `9ab4b35`, `2923d8a` y `a33653f` — **cinco árboles, tres
comportamientos distintos de la línea de destino, un solo sello.** La regla de "Publicar no es haber
publicado" pide que el sello que se le pide mirar al PM en pantalla identifique el build. Si esto se publica y
el PM reporta "v24", no hay forma de saber cuál de los cinco probó. Hay que moverlo antes de publicar, no
después.

### Observaciones (no cuentan para el puntaje, quedan anotadas)

- **Una escala aparece como destino en firme.** `EZE→GRU→MAD` da
  `Destinos … : GRU (vuelo) · MAD (vuelo). Es un viaje multidestino: lo que sugieras tiene que servir para
  TODOS esos lugares`. El motor ya sabe detectar escalas —`summarizeReservationsForAI` arma
  `{tipo:"escala"}` cuando `a.to === b.from` con espera real— y `destinosDelViaje` no usa ese dato. Es
  preexistente a este commit y no está declarado.
- **Cargar sólo el vuelo de vuelta** (`MAD→EZE`, único vuelo) deja `EZE` como destino: `vuelos.length > 1` no
  se cumple. Es el alcance conocido de la regla, del lado seguro.
- `act` (actividad) sigue sin participar ni como destino ni como pista, igual que en la ronda 3.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| Ocho arneses en verde (`las-dos-copias`, `val72`, `motores-desde-html` 39, `hallazgos-qa-bloque-b` 31, `tier-del-modelo` 42, `val63`, `val74`, `el-script-parsea`) | Corridos uno por uno con `NODE_PATH=/opt/node22/lib/node_modules` y ruta absoluta | **Cierto**, los ocho, con los números exactos |
| "el comentario stale ya no está" | Leído el encabezado completo en las dos copias | **Cierto para el encabezado grande, falso para el JSDoc** — ver hallazgo 4 |
| No quedan otras descripciones viejas en `docs/` | `grep -rn "jerarquía\|en firme\|orden de firmeza"` en `docs/`, `valija.html`, `packing-engine.js` | **Cierto en `docs/`**; el único resto vivo está en el JSDoc del código |
| "el conteo falso está corregido en el backlog, con el motivo y la regla" | Lectura de la sección VAL-72 | **Cierto** — dice ocho, con la regla "el arnés dice cuántas son cada vez que corre" |
| No quedan cifras a mano sin comprobar en la sección VAL-72 | Lectura completa de la sección | **Cierto** — las cifras que quedan (561, 1.269, 345.595, 262.144) son de VAL-74, no de VAL-72, y salen de arneses |
| "`las-dos-copias` cierra el hueco de las constantes" | Sabotaje propio de un tope sólo en el HTML | **Cierto** — 2 FALLARON |
| "el recorte del UMD revienta si no encuentra el marcador" | Lectura de `cuerpoDelModulo` | **Cierto** — `throw` explícito |
| "los dos controles prueban lo que dicen" | Leídos y corridos | **Cierto**, pero prueban menos de lo que el comentario afirma — ver hallazgo 5 |
| "compara la cabecera como un bloque contra otro" | Sabotaje de un comentario y de un reordenamiento | **Falso** — los dos pasan en verde |
| "las dos copias del motor dicen lo mismo" | Comparación propia, `diff -u` sobre el cuerpo completo de las dos copias, sin blancos | **Cierto** — la única diferencia es el `});` del UMD y la nota de integración final de `adjuntos-engine.js` |
| "un viaje realmente vacío sigue diciendo «sin especificar»" | Reproducido | **Cierto** |
| "el hotel llega al modelo aunque no haya destino escrito" | Reproducido con `destination:""` | **Cierto** para ese fixture; falso cuando el texto de la pista colisiona con el destino escrito — hallazgo 1 |
| "un primer vuelo sin `from` deja entrar el aeropuerto de casa, del lado seguro" | Reproducido | **Cierto**, y está declarado. **Pero la declaración no cubre** el caso del vuelo de vuelta sin `start`, que es el lado inseguro — hallazgo 2 |
| "ninguna reserva en el punto de partida desplaza el destino escrito" | Reataque desde cero: traslado / alojamiento / auto en el origen, solos y juntos, sin vuelos | **Cierto para esos**; **falso** por los dos caminos nuevos de los hallazgos 1 y 2 |
| El PM aprobó el recorte de alcance el 20/09 | Lectura de `docs/backlog.md` | **Registrado** con fecha y con las tres salidas que se le ofrecieron. No es verificable desde el repo que la conversación ocurrió; se toma como lo declara el PO |
| VAL-73: "1 falla en 8 corridas, con timeout del navegador" | Corrí `valija-bloque-b.js` una vez: 111/111 | **Consistente**, no contradicho. No lo marco bloqueante — ver abajo |
| Nada publicado | `grep VALIJA_VERSION` → `"24"` | **Cierto**, y el sello no distingue este árbol — hallazgo 6 |
| Árbol quieto | `git status --porcelain` vacío, `HEAD` = `a33653f` antes y después | **Cierto** |

### Sobre VAL-73, que el encargo pidió explícitamente

**No cambio de opinión: no es bloqueante.** Lo corrí una vez más, 111/111. La tabla de VAL-73 está bien
medida y — esto es lo que la salva — dice sin adornos *"lo que estos números NO permiten decir"*: que una
falla en ocho contra cero en tres no distingue nada. Esa honestidad es exactamente lo que la rúbrica premia.
Sigue siendo deuda de prueba P3, no un freno a esta historia.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Sustituto fiel (motor extraído del HTML real, no de `parts/`) más un arnés de navegador que toca los botones. La brecha del teléfono está declarada en el commit y en el backlog, sin una sola vez la palabra "verificado" usada de más. No baja de 20 y no sube de 20. |
| 2 | Diagnóstico de causa raíz | 15 | **9** | La regla de los dos cajones (comparabilidad por tipo de dato) se sostiene y la reataqué sin poder voltearla por su propio eje. Pero el diagnóstico del defecto que este commit vino a arreglar quedó a medio camino: la causa no era "la línea cortaba antes de las pistas", era que `sumar` puede comerse la entrada `escrito-a-mano` por deduplicación. Se arregló el tramo visible y la causa real quedó viva, produciendo dos afirmaciones falsas nuevas. Sacar una guarda sin preguntar qué más protegía es la misma familia de error que el proyecto ya tiene facturada. |
| 3 | Honestidad de lo verificado | 15 | **11** | Muy buena en lo que importa: la brecha del teléfono, el alcance declarado de la regla del vuelo de vuelta, el defecto 2 declarado y **no** arreglado con una suposición, la corrección del conteo falso con su regla, y la tabla de VAL-73 con lo que sus números no permiten decir. Declarar todo eso suma y lo cuento. Baja por una afirmación que falsifiqué corriendo un sabotaje —"compara la cabecera como un bloque contra otro"— y porque "el resto del ataque no encontró nada" se afirma sobre un juego de fixtures que no incluía la colisión ni el vuelo sin fecha. |
| 4 | Cumplimiento del contrato | 15 | **6** | El caso que define el éxito (Europa → MAD·CDG·FCO) se cumple, verificado. El caso que define que no se rompió nada —el destino escrito sobrevive a las reservas— **vuelve a fallar** por dos caminos nuevos, los dos reproducibles en node. No es una baja por el teléfono: es el criterio que agregaron las dos auditorías anteriores, incumplido otra vez. Y la línea del prompt afirma hechos sobre los datos de la persona que la función no puede saber. |
| 5 | Calidad interna | 15 | **7** | A favor, y verificado por mi cuenta: las dos copias son idénticas byte a byte salvo el UMD; el arnés creció con casos reales; los controles negativos existen y funcionan. En contra: el `@returns` sigue describiendo el diseño volteado y omite `pistas`, en las dos copias, en la función que ya recibió tres vetos; una guarda quitada dejó un `TypeError` latente que el propio archivo declara posible; y el arnés nuevo afirma más cobertura de la que tiene. Tres defectos de calidad interna verificables, ninguno relacionado con el teléfono. |
| 6 | Diseño y decisiones de producto | 10 | **6** | El criterio de comparabilidad está bien argumentado y generaliza; el recorte de alcance quedó con fecha, con las tres opciones y con la decisión del PM, que es como corresponde y suma. Baja porque el texto nuevo del prompt resuelve "no tengo un encabezado" escribiendo una afirmación categórica —"la persona no escribió ninguno y no hay vuelos cargados"— sobre dos cosas que la función no observa. Cuando no se sabe, se dice que no se sabe: eso ya está escrito en `CLAUDE.md`. |
| | **Total** | **100** | **59** | **NO PUBLICAR, y tampoco como candidato.** Dos bloqueantes reproducibles sin teléfono, uno de ellos una regresión medida contra el commit anterior y de la misma forma que el veto de 57/100. |

---

## Lo que falta para llegar a 85, en orden

1. **Que una pista no pueda borrar el destino escrito.** El `vistos` de `sumar` es compartido entre los dos
   cajones, y por eso una pista que normaliza igual que `trip.destination` se come la entrada
   `escrito-a-mano`. Lo que hace falta decidir primero es qué corresponde: que el destino escrito entre igual
   (y la pista se muestre o no), o que entre y la pista se omita por redundante. Cualquiera de las dos está
   bien; lo que no puede quedar es `lugares` vacío con un destino escrito vivo. **Con fixture nuevo en el
   arnés:** destino escrito + traslado/auto/alojamiento con el mismo texto, en las tres variantes de
   acento/mayúscula/espacio.
2. **Que la línea no afirme lo que no observa.** "la persona no escribió ninguno" tiene que salir de
   `trip.destination`, y "no hay vuelos cargados" de si hay ítems `type:"flight"` — no de si sobrevivieron al
   filtro `i.to`. Si no se sabe, la línea lo dice.
3. **El vuelo de vuelta sin `start`.** Un vuelo sin fecha no puede definir cuál es "el primero". Lo mínimo
   honesto es no aplicar la regla de descarte cuando el primero o el último no tienen `start` —se manda de
   más, que es el lado seguro que el propio commit eligió para el caso hermano— y declararlo. Con su caso en
   el arnés, que hoy no existe.
4. **El `@returns` de `destinosDelViaje`**, en las dos copias: que nombre `pistas` y que deje de decir "en
   orden de firmeza". Es la corrección más chica de la lista y la que el encargo de esta ronda pidió
   explícitamente comprobar.
5. **La guarda de `lineaDestinos`**: `(d && d.pistas || [])`, para que coincida con la guarda que ya tiene
   `partes` dos líneas más arriba.
6. **Corregir el comentario de `las-dos-copias.js`** para que diga lo que compara: las líneas de declaración
   de la cabecera, no el bloque entero. Los comentarios de la cabecera del motor siguen sin compararse y eso
   va declarado (o se cierra, que tampoco es caro).
7. **Mover `VALIJA_VERSION`** antes de publicar, para que el sello que se le pide mirar al PM identifique el
   build y no cinco árboles distintos.
8. Recién entonces, publicar como candidato y pedirle al PM el guion de abajo.

Los puntos 1 a 3 son cambios de lógica con su prueba; 4 a 7 son de minutos. Nada de esto exige otro rediseño.

---

## Lo que nadie puede verificar desde acá

Esta sección no está vacía, y ninguno de estos puntos es una formalidad.

1. **Que la lista que sale sea mejor, y no sólo que el prompt esté bien armado.** Todo lo que verifiqué
   termina en el texto que se le manda al modelo. Qué hace el modelo del teléfono con "Destinos … MAD · CDG ·
   FCO … es un viaje multidestino" no lo sabe nadie acá. **Pasos:** publicar, abrir en el teléfono, crear un
   viaje "Europa" con los tres vuelos, tocar **Armar la lista**, y mirar si los ítems hablan de las tres
   ciudades o siguen hablando de "Europa" en genérico.
2. **El caso que define que no se rompió nada, en el aparato.** Un viaje a Bariloche con el destino bien
   escrito y **un traslado al Aeropuerto de Ezeiza**, sin vuelos. **Pasos:** cargarlo, tocar Armar la lista, y
   mirar que sugiera para la montaña y no para Buenos Aires. En node da bien; en el teléfono nadie lo miró.
3. **Los dos bloqueantes, con datos reales del PM.** Necesito saber de él dos cosas que no puedo deducir:
   (a) ¿alguna vez escribe en el campo "hasta" de un traslado, o en la dirección de un auto, **sólo el nombre
   de la ciudad** que también puso como destino del viaje? (b) ¿le llegan reservas importadas de vuelo **sin
   fecha de salida**? Si la respuesta a cualquiera de las dos es sí, el bloqueante correspondiente ya le pasó
   o le va a pasar. Una pregunta cuesta un minuto.
4. **Cuál build está probando.** Mientras `VALIJA_VERSION` siga en `"24"`, cualquier reporte del PM que diga
   "v24" es ambiguo entre cinco árboles. Antes de pedirle una ronda: leer el archivo que sirve el Artifact,
   buscar en él una cadena que exista sólo en esta versión (`"la persona no escribió ninguno"` sirve), y
   confirmar que el sello en pantalla coincide con el que se le pide mirar.
5. **El visor del teléfono en sí.** Nada de esta ronda tocó DOM, permisos ni sandbox, así que la brecha no
   creció — pero sigue entera, y es la única razón por la que la dimensión 1 no puede pasar de 20 desde acá.

---

## Nota sobre el árbol

Verificado quieto: `git status --porcelain` vacío y `HEAD` en `a33653f` al empezar y al terminar. No llegó
ningún commit encima mientras se puntuaba.
