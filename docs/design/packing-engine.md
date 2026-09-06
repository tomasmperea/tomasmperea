# Motor de equipaje — cómo funciona, cómo se extiende, cómo se integra

**Épica:** VAL-30, VAL-31, VAL-32, VAL-33 · **Escribe:** motor de sugerencias · **Estado:** listo para integrar

Este documento describe `app/parts/packing-engine.js`, probado en `app/parts/packing-engine.test.js`
(45 casos, `node app/parts/packing-engine.test.js`). El motor es JavaScript puro: no toca el DOM, no pide
red, no depende de nada externo. Recibe datos y devuelve datos, para que la lógica pueda mudarse al servidor
en la iteración 2 sin reescribirse.

No repite lo que ya está documentado en los comentarios del propio archivo (que son extensos y son la fuente
de verdad si algo acá queda desactualizado). Esto es la puerta de entrada: qué hace, por qué está armado así,
y qué necesita `app/valija.html` para usarlo. Para el diseño de pantallas que consume este motor, ver
`docs/design/valija-inteligente.md`.

---

## 1 · Las tres capas

El motor es híbrido a propósito: nunca depende por completo de la IA.

1. **Reglas locales determinísticas** (`buildPackingList`, capa 1). Funciona siempre, sin conexión.
   Documentación según si el viaje es internacional, ropa por cantidad calculada desde la duración, higiene,
   electrónica, salud, y ajustes por tipo de viaje y por lo ya cargado en el viaje (auto alquilado, vuelo
   internacional, trekking). Es la única capa obligatoria: si las otras dos fallan o no están, esta sola ya
   arma una lista usable.

2. **Ajuste por destino con IA** (`enrichWithDestination`, capa 2, VAL-33). Agrega hasta `MAX_AI_ITEMS`
   ítems específicos del lugar y la época (tipo de enchufe, amplitud térmica, temporada de lluvias), cada
   uno con su justificación. El motor no llama a `claude.use` ni a ningún cliente de IA: recibe una función
   `ask(prompt) -> objeto` y la app le pasa la implementación real. Así se prueba con `node`, sin red y sin
   mocks de plataforma.

3. **Aprendizaje del historial** (`learnFromHistory`, capa 3, VAL-32). Mira las listas guardadas de viajes
   anteriores del mismo tipo. Un ítem agregado a mano en dos viajes del mismo tipo pasa a sugerirse solo; uno
   descartado dos veces deja de sugerirse. Corre siempre, sin red y sin IA — es la capa que hace que la lista
   mejore con el uso sin pedirle nada a la persona.

`generatePackingList(input)` es la entrada que corre las tres. Si `input.ask` no es una función, salta
directo a devolver la lista de las capas 1 y 3 — nunca lanza por culpa de la IA. `buildPackingList(input)`
corre sólo las capas 1 y 3 (sirve para pruebas y para regenerar sin tocar la capa de IA).

### Degradación de la capa de IA

`enrichWithDestination` nunca lanza. Devuelve siempre una lista válida, con `capaInteligente.estado` en uno
de cuatro valores:

| Estado | Cuándo | Qué ve la persona |
|---|---|---|
| `ok` | la IA respondió con al menos un ítem válido | lista base + ítems del destino |
| `vacio` | la IA respondió pero no tenía nada seguro para agregar | lista base, sin aviso de error (no hay nada que reintentar) |
| `no-disponible` | la app no pasó `ask` (sin conexión, sin capacidad de plataforma) | lista base + aviso `ia-no-disponible` |
| `error` | `ask` lanzó una excepción o la promesa se rechazó | lista base + aviso `ia-fallo` |

En los cuatro casos la lista de las capas 1 y 3 queda intacta. El prompt de la capa de IA
(`destinationPrompt`) lleva instrucción explícita de no inventar: *"Si no estás seguro de un dato del
destino, NO lo incluyas. Es preferible una lista más corta que un dato inventado."* — y `parseDestinationItems`
descarta cualquier ítem de la respuesta que no traiga `nombre` y `motivo` no vacíos, así que un modelo que
devuelve basura, texto plano, o un JSON con forma rara nunca ensucia la lista (ver la prueba "respuesta
basura de la IA: no rompe nada").

---

## 2 · Cómo se agrega una regla nueva

Las reglas de la capa 1 son datos, no código. Agregar una regla es agregar una entrada a `BASE_RULES`
(dentro de `packing-engine.js`), no escribir un `if` nuevo:

```js
{ id:"ropa.malla", nombre:"Malla", categoria:"ropa",
  when:{ any:[{ tripTypes:["playa"] }, { facts:["hasWaterActivity"] }] },
  cantidad:{ fixed:2 },
  motivo:"Dos, para no ponerte una mojada al día siguiente." }
```

Campos de una regla:

- **`id`** (obligatorio, único) — identificador estable para trazabilidad. Convención `categoria.nombre-corto`.
- **`clave`** (opcional) — clave normalizada del ítem. Si falta, se calcula con `slug(nombre)`. Sólo hace
  falta declararla a mano si dos nombres distintos tienen que caer en la misma clave, o viceversa.
- **`nombre`** (obligatorio) — cómo se llama para el viajero.
- **`categoria`** (obligatoria) — una de `CATEGORIES`: `documentacion`, `ropa`, `calzado`, `higiene`,
  `electronica`, `salud`, `destino`, `otros`.
- **`when`** (opcional; sin `when` la regla aplica siempre) — condición declarativa, evaluada por
  `matchesCondition(cond, ctx)`. Operadores disponibles: `international`, `tripTypes`, `notTripTypes`,
  `minDays`, `maxDays`, `facts` (todos), `anyFacts` (alguno), `notFacts` (ninguno), `all`, `any`, `not`,
  `test` (función). Se combinan libremente, ver los ejemplos ya en `BASE_RULES`.
- **`cantidad`** (opcional) — `undefined` (sin cantidad, ej. "DNI"), un número fijo, `{fixed:N}`, o
  `{perDay|everyDays, extra, min, max}` para que la cantidad salga de la duración del viaje. `computeQty`
  resuelve el número final y avisa si se topeó (`calc.capped`).
- **`motivo`** (obligatorio) — texto, o función `(cantidad, ctx, calc) => texto`. Cada ítem con cantidad
  tiene que explicar de dónde sale (criterio de aceptación de VAL-30); `validateRules()` rechaza una regla
  sin motivo.

Para agregar un hecho nuevo del viaje (por ejemplo "hay una boda"), se agrega una entrada a `FACTS` con su
`label` y su `test(ctx)`, y después se puede usar en `when:{ facts:["hasWedding"] }` de cualquier regla.

**Control de calidad del catálogo.** `validateRules(rules)` corre sobre `BASE_RULES` (o sobre cualquier
array que se le pase) y devuelve la lista de problemas: ids repetidos, claves repetidas, reglas sin nombre,
sin motivo, o con una categoría que no existe en `CATEGORIES`. Vacía significa catálogo sano. La prueba del
catálogo se apoya en esta función en vez de recorrer `BASE_RULES` por su cuenta — es la misma verificación
que corre el motor, no una reimplementada en la prueba (ver más abajo, "corrección durante esta entrega").

---

## 3 · El modelo de datos de la lista guardada

Documento completo en el bloque de comentarios al principio de `packing-engine.js` (líneas 25-132). Resumen
de lo que hace falta para integrar:

**Un documento por viaje:** `trips/{tripId}/packing/lista`. Cuelga del viaje igual que
`trips/{tripId}/items/{itemId}`, así hereda sus permisos.

**Los ítems van en un OBJETO indexado por clave normalizada, no en un array:**

```js
{
  version: 2,
  tripId: "abc123",
  tipoViaje: "playa",              // playa|ciudad|montana|trabajo|aventura|mixto
  creadaEn, generadaEn, actualizadaEn,   // ISO

  base: {                          // sobre qué se calculó, para poder explicarlo
    destino, desde, hasta, dias, noches, diasConocidos,
    internacional, internacionalConocido,
    internacionalFuente,           // vuelos|destino|explicito|desconocido
    internacionalDetalle,
    tipoViajeFuente,                // elegido|sugerido
    tipoViajeMotivo,
    hechos: { hasFlight, hasRentalCar, hasStay, hasInternationalFlight,
              hasTrekking, hasWaterActivity, hasWorkActivity, hasSnow }
  },

  capaInteligente: { estado, en, nota, clima },   // ver tabla de la sección 1
  aprendizaje: { muestra, promovidos:[{clave,nombre,veces}], suprimidos:[...] },
  avisos: [{ codigo, texto }],
  conteo: { total, empacados, descartados, pendientes, resueltos, pct },  // ver sección 4

  items: {
    "remera": {
      clave: "remera",             // igual a la llave del objeto, a propósito: motor y
                                    // UI tienen que usar exactamente la misma
      nombre: "Remeras",
      categoria: "ropa",
      cantidad: 6,                 // número o null si no aplica
      motivo: "5 días más una de repuesto.",
      origen: "regla",             // regla|destino|historial|manual
      estado: "pendiente",         // pendiente|empacado|descartado
      empacadoEn: null,
      regla: "ropa.remeras",       // qué regla lo puso, para trazabilidad
      cantidadEditada: false,
      nota: "",
      orden: 1009,
      agregadoEn, actualizadoEn
    }
  }
}
```

**Por qué un objeto y no un array.** La base de datos compartida hace merge recursivo de objetos anidados
en una escritura parcial, pero reemplaza los arrays enteros. Con un objeto, marcar un ítem escribe sólo esa
rama y dos personas marcando cosas distintas al mismo tiempo no se pisan; con un array, el último en escribir
borra el trabajo del otro. Ver `stateUpdatePatch()` para el parche parcial listo para `db.doc(...).update()`.

**Tres estados, no un booleano.** `pendiente` (no lo tocó), `empacado`, `descartado`. Un booleano
colapsaría "todavía no lo toqué" con "decidí que no va", que son señales distintas — la segunda es el único
insumo del aprendizaje de VAL-32.

**Precedencia del origen.** Un ítem puede venir de más de una capa (una regla base y también el historial,
por ejemplo). Se acredita siempre a la capa de menor precedencia: `regla < destino < historial < manual`
(`ORIGEN_PRECEDENCIA`, `lowestOrigin()`). Acreditarle al historial lo que una regla ya ponía haría que la
métrica de aprendizaje mida mejor de lo que es.

**Garantías al regenerar** (`mergeLists`, usada por `buildPackingList` cuando recibe `input.previous`):

1. Un ítem descartado nunca vuelve a estado pendiente.
2. El origen de un ítem ya presente no se pisa con uno de mayor precedencia.
3. Lo empacado sigue empacado, con su `empacadoEn` original.
4. Los ítems propios y los ya empacados/descartados sobreviven aunque la regla que los ponía deje de
   aplicar (por ejemplo, al cambiar el tipo de viaje elegido).

**Clave normalizada** (`slug()`): minúsculas, sin acentos, en singular por heurística, separada por guiones.
No busca ser gramaticalmente perfecta (algunos plurales irregulares del castellano quedan raros, ej.
"dientes" → `dient`), busca ser determinística: la misma entrada de texto siempre cae en la misma clave, que
es lo que hace que el umbral de dos apariciones del historial se cumpla alguna vez. Por eso las pruebas
calculan las claves esperadas con `E.slug("Nombre del ítem")` en vez de escribirlas a mano: si el heurístico
cambia, motor y pruebas se mueven juntos.

---

## 4 · El contador de progreso — qué mide y por qué

`packingProgress(list)` devuelve cinco números, no sólo un porcentaje, porque la interfaz necesita
`empacados` y `descartados` por separado para dibujar una barra de dos tramos, y `pendientes` para el texto
"faltan 18":

```js
resueltos = empacados + descartados
total     = todos los ítems, descartados incluidos
pct       = resueltos / total
```

**Decisión de producto, no un detalle de la fórmula.** El porcentaje mide cuánto de la lista la persona ya
**resolvió**, no cuánto entra en el bolso. Descartar es una decisión tomada, tan resuelta como empacar —
por eso `total` incluye los descartados en vez de restarlos, y por eso `pct` sube igual con un descarte que
con un ítem empacado. Ejemplo con 28 ítems, 2 empacados y 1 descartado:
`{ total:28, empacados:2, descartados:1, pendientes:25, resueltos:3, pct:11 }`.

Si el descarte no moviera el progreso (fórmula anterior de esta entrega: `total` excluía los descartados y
`pct` sólo contaba lo empacado), la persona deja de descartar y en cambio marca como empacado lo que no va a
llevar, sólo para sacarse el pendiente de encima. Ahí se pierden dos cosas a la vez: el dato de descarte,
que es el único insumo del aprendizaje de VAL-32, y la confiabilidad de lo que dice estar empacado. La
fórmula tiene que premiar la conducta que se quiere, no la que es más fácil de calcular.

Es correcto, y va a parecer raro la primera vez que se vea en producción, que alguien con 20 descartes sobre
28 ítems tenga 71% de progreso: resolvió 20 decisiones y le quedan 8 por tomar. El porcentaje mide cuánto
falta **decidir**, no cuánto hay dentro del bolso — la interfaz muestra los números crudos (`empacados`,
`descartados`, `pendientes`) al lado del porcentaje, precisamente para que nadie confunda una cosa con la
otra. Ver `docs/design/valija-inteligente.md`, sección 3.3, para cómo se traduce esto a la barra de dos
tramos.

---

## 5 · Nota de integración — qué necesita `app/valija.html`

Este módulo no se edita desde acá; esto es la lista de lo que el rol de integración tiene que hacer con él.

1. **Cargarlo.** `packing-engine.js` es UMD: en Node exporta con `module.exports`, en el navegador expone
   `window.PackingEngine`. Como la convención del proyecto es un solo archivo sin build, hay que pegar el
   módulo entero dentro del `<script>` de `valija.html` (no un `<script src>` a un archivo local).

2. **Llamarlo.** La entrada es `PackingEngine.generatePackingList({ trip, items, tipoViaje, history,
   previous, ask, now })`, que devuelve una `Promise` con el documento completo listo para guardar. `trip` e
   `items` son el viaje y sus reservas tal como ya los maneja `Store`; `history` son los documentos de
   packing de viajes anteriores (`Store.packingOf` de cada viaje, filtrados por los que ya existan);
   `previous` es el documento ya guardado de este viaje, si se está regenerando; `ask` es
   `(prompt) => sample.json(prompt, {modelTier:"complex"})` cuando `claude.use("sample")` resolvió, o
   `undefined`/`null` si no — el motor ya contempla ese caso.

3. **Guardarlo.** Persistir el documento completo con `db.doc('trips/'+tripId+'/packing/lista').set(list)`
   (o el equivalente en `localStorage` si no hay `db`) tras generar o regenerar. Para marcar un solo ítem sin
   reescribir la lista entera, usar `PackingEngine.stateUpdatePatch(clave, estado)` con `.update(...)` — está
   pensado exactamente para que dos personas marcando ítems distintos al mismo tiempo no se pisen.

4. **Todo lo demás es UI pura sobre el documento:** `itemList(list)` / `groupByCategory(list)` para mostrar,
   `packItem` / `dismissItem` / `resetItem` / `setQty` / `addManualItem` / `removeManualItem` para las
   acciones de la persona (todas puras: devuelven un documento nuevo, no mutan el que reciben — hay que
   guardar el resultado). El detalle de qué pantalla usa cada función está en
   `docs/design/valija-inteligente.md`, sección 5.

No hace falta ninguna dependencia nueva. El módulo entero es JavaScript vainilla.

---

## 6 · Cómo correr las pruebas

```
node app/parts/packing-engine.test.js
```

45 casos, sin frameworks. Cada caso se declara con `test(nombre, fn)`; `fn` puede ser sincrónica o async
(la capa de IA se prueba con funciones `ask` async simuladas, sin red). El arnés imprime cada caso con `ok`
o `FALLA` y el mensaje del assert que falló, y termina con el resumen y el código de salida: `0` si los 45
casos pasan, `1` si falla al menos uno (antes de esta entrega el proceso llamaba a `process.exit()` de forma
tal que, en el escenario donde toda la corrida terminaba sin lanzar una excepción no capturada, el código de
salida podía no reflejar `failed > 0`; ahora el código de salida se fija con `process.exitCode` una sola vez,
al final de `main()` y en el `catch` de nivel superior, así que un tablero en rojo nunca reporta verde).

Las pruebas cubren los criterios de aceptación de VAL-30 (duración, internacional/nacional, tipo de viaje,
regeneración sin duplicar), VAL-31 (marcar/desmarcar, descartar, ítems propios, agrupar por categoría) y
VAL-32 (promoción y supresión por historial, con muestra de un viaje, de dos, y de otro tipo que no
contamina). VAL-33 (capa de destino) también está cubierta, aunque es P1.

---

## 7 · Corrección hecha durante esta entrega

Esta entrega retoma un trabajo a mitad de camino: el motor ya tenía aplicadas dos correcciones de modelo de
datos del Product Owner (ítems con tres estados en vez de un booleano; lista guardada como objeto indexado
por clave en vez de array) pero las pruebas habían quedado escritas contra la API anterior. Se reescribió
`packing-engine.test.js` completo contra la API real (nombres de campo en español, `items` como objeto,
`E.itemsArray()` para iterar, `E.packItem`/`dismissItem`/`resetItem` en vez de un `setPacked`/`setDismissed`
que no existían, `E.ORIGEN` en vez de un `E.SOURCE` que tampoco existía). No se tocó lógica del motor para
que las pruebas pasaran.

La única prueba que sí obligó a tocar el motor fue la del contador de progreso, y no por un defecto: fue un
cambio de decisión del Product Owner tomado durante esta misma entrega (sección 4 de este documento).

No se encontraron bugs reales en el motor más allá de eso. Dos aclaraciones sobre comportamientos que
parecían raros al principio y resultaron ser diseño correcto, no defectos:

- **`suggestTripType` con un destino que tiene pistas de dos tipos a la vez propone "mixto".** Un viaje a
  "Madrid" con motivo "Congreso de cardiología" empata entre la pista de ciudad ("madrid") y la de trabajo
  ("congreso"), y el motor devuelve `mixto` con una razón que nombra las dos familias. Es intencional
  (comentario en el propio código: "dos familias fuertes a la vez: es un viaje mixto"), no un error de
  clasificación.
- **La singularización de `slug()` no es gramaticalmente perfecta** (por ejemplo "Cepillo y pasta de
  dientes" → `cepillo-y-pasta-de-dient`, "Gorro y guantes de abrigo" → `gorro-y-guant-de-abrigo`). Es
  heurística a propósito, documentada como tal en el código: lo que importa es que sea determinística, no
  que sea gramatical. Las pruebas calculan las claves con `slug()` en vez de hardcodearlas para no depender
  de un detalle de implementación que puede seguir afinándose.

**Nota para el rol de diseño / integración, no para editar acá:** `docs/design/valija-inteligente.md`,
sección 5.6 ("Cálculo de la barra de progreso"), documenta que `conteo.total` **excluye** los descartados y
que la UI tiene que sumar `conteo.total + conteo.descartados` a mano para el ancho completo de la barra. Con
el cambio de la sección 4 de este documento, eso ya no hace falta: `conteo.total` ahora incluye todo, y
`conteo.empacados` / `conteo.descartados` / `conteo.pendientes` se usan directamente. Esa sección quedó
desactualizada por el cambio de fórmula y la tiene que actualizar quien sea dueño de ese archivo.
