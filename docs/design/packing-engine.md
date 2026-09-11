# Motor de equipaje — cómo funciona, cómo se extiende, cómo se integra

**Épica:** VAL-30, VAL-31, VAL-32, VAL-33 (iteración 1) y VAL-43, VAL-44, VAL-45, VAL-46 (iteración 2,
bloque B: "la valija razona sobre el viaje completo") · **Escribe:** motor de sugerencias · **Estado:** listo
para integrar

Este documento describe `app/parts/packing-engine.js`, probado en `app/parts/packing-engine.test.js`
(68 casos, `node app/parts/packing-engine.test.js`). El motor es JavaScript puro: no toca el DOM, no pide
red, no depende de nada externo. Recibe datos y devuelve datos, para que la lógica pueda mudarse al servidor
en la iteración 2 sin reescribirse.

No repite lo que ya está documentado en los comentarios del propio archivo (que son extensos y son la fuente
de verdad si algo acá queda desactualizado, con una excepción anotada en la sección 8). Esto es la puerta de
entrada: qué hace, por qué está armado así, y qué necesita `app/valija.html` para usarlo. Para el diseño de
pantallas que consume este motor, ver `docs/design/valija-inteligente.md`.

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
   uno con su justificación. Desde esta entrega también:
   - **ve las reservas del viaje y las notas del viaje** (VAL-44, resumidas y sin datos sensibles —
     sección 4), y puede razonar
     sobre combinaciones puntuales que ninguna regla anticipó: una escala larga, un alojamiento sin
     lavandería en un viaje largo, una actividad con equipo propio;
   - **puede proponer sacar ítems** que no apliquen a ese destino puntual (VAL-43 — sección 6), nunca
     aplicando la propuesta ella misma, y con un piso que el código hace cumplir: la documentación de
     identidad no se saca nunca por esta vía, aunque el modelo lo pida.

   El motor no llama a `claude.use` ni a ningún cliente de IA: recibe una función `ask(prompt) -> objeto` y
   la app le pasa la implementación real. Así se prueba con `node`, sin red y sin mocks de plataforma.

3. **Aprendizaje del historial** (`learnFromHistory`, capa 3, VAL-32). Mira las listas guardadas de viajes
   anteriores del mismo tipo. Un ítem agregado a mano en dos viajes del mismo tipo pasa a sugerirse solo; uno
   descartado dos veces deja de sugerirse. Corre siempre, sin red y sin IA — es la capa que hace que la lista
   mejore con el uso sin pedirle nada a la persona.

`generatePackingList(input)` es la entrada que corre las tres. Si `input.ask` no es una función, salta
directo a devolver la lista de las capas 1 y 3 — nunca lanza por culpa de la IA. `buildPackingList(input)`
corre sólo las capas 1 y 3 (sirve para pruebas y para regenerar sin tocar la capa de IA).

Ningún ítem se repite entre capas, sea cual sea la combinación: eso es VAL-45, sección 5.

### Degradación de la capa de IA

`enrichWithDestination` nunca lanza. Devuelve siempre una lista válida, con `capaInteligente.estado` en uno
de cinco valores:

| Estado | Cuándo | Qué ve la persona |
|---|---|---|
| `sin-ajuste` | estado inicial de una lista recién armada por `buildPackingList`, antes de que corra la capa de IA | lista base, sin aviso (todavía no se intentó el ajuste) |
| `ok` | la IA respondió con al menos un ítem para agregar, o al menos una propuesta válida de sacar | lista base + ítems del destino y/o sugerencias de sacar |
| `vacio` | la IA respondió pero no tenía nada seguro para agregar ni para sacar (incluye el caso en que todo lo que propuso sacar era crítico y quedó filtrado) | lista base, sin aviso de error (no hay nada que reintentar) |
| `no-disponible` | la app no pasó `ask` (sin conexión, sin capacidad de plataforma) | lista base + aviso `ia-no-disponible` |
| `error` | `ask` lanzó una excepción o la promesa se rechazó | lista base + aviso `ia-fallo` |

En los cinco casos la lista de las capas 1 y 3 queda intacta. El prompt de la capa de IA
(`destinationPrompt`) lleva instrucción explícita de no inventar: *"Si no estás seguro de un dato del
destino o de la reserva, NO lo incluyas. Es preferible una lista más corta que un dato inventado."* — y
`parseDestinationItems` descarta cualquier ítem de la respuesta que no traiga `nombre` y `motivo` no vacíos,
así que un modelo que devuelve basura, texto plano, o un JSON con forma rara nunca ensucia la lista (ver la
prueba "respuesta basura de la IA: no rompe nada").

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
- **`critico`** (opcional, booleano) — VAL-43. Marca un ítem como piso: ninguna capa lo puede sacar
  automáticamente, ni siquiera la capa de IA cuando lo propone. Hoy sólo lo llevan `doc.dni` y
  `doc.pasaporte`. Ver sección 6.

Para agregar un hecho nuevo del viaje (por ejemplo "hay una boda"), se agrega una entrada a `FACTS` con su
`label` y su `test(ctx)`, y después se puede usar en `when:{ facts:["hasWedding"] }` de cualquier regla. Un
hecho nuevo también queda automáticamente disponible para VAL-46 (sección 7): `findFactSource` sólo sabe
mapear los hechos que ya tiene declarados en su propio `switch`, así que si el hecho nuevo tiene que citar la
reserva que lo motivó al avisar que la lista quedó vieja, hay que sumarle también un `case` ahí. Sin eso, el
ítem nuevo igual aparece, pero sin la reserva puntual entre paréntesis.

**Control de calidad del catálogo.** `validateRules(rules)` corre sobre `BASE_RULES` (o sobre cualquier
array que se le pase) y devuelve la lista de problemas: ids repetidos, claves repetidas, reglas sin nombre,
sin motivo, con una categoría que no existe en `CATEGORIES`, o dos reglas que apuntan al mismo ítem por
sinónimo declarado (VAL-45) aunque tengan clave literal distinta. Vacía significa catálogo sano.

---

## 3 · El modelo de datos de la lista guardada

Documento completo en el bloque de comentarios al principio de `packing-engine.js` (líneas 1-167). Resumen
de lo que hace falta para integrar, con los campos nuevos de esta entrega marcados:

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
              hasTrekking, hasWaterActivity, hasWorkActivity, hasSnow },
    reservas: [ /* NUEVO, VAL-44: resumen seguro de reservas, ver sección 4 */ ],
    notasViaje: ""   /* NUEVO, VAL-44: `trip.notes` saneado con `sanitizeNotesForAI`; "" si no hay */
  },

  capaInteligente: { estado, en, nota, clima },   // ver tabla de la sección 1 (ahora 5 estados)
  aprendizaje: { muestra, promovidos:[{clave,nombre,veces}], suprimidos:[...] },
  avisos: [{ codigo, texto }],
  conteo: { total, empacados, descartados, pendientes, resueltos, totalConDescartados, pct },  // sección 8

  items: {
    "remera": {
      clave: "remera",
      nombre: "Remeras",
      categoria: "ropa",
      cantidad: 6,
      motivo: "5 días más una de repuesto.",
      origen: "regla",             // regla|destino|historial|manual
      estado: "pendiente",         // pendiente|empacado|descartado
      empacadoEn: null,
      regla: "ropa.remeras",
      cantidadEditada: false,
      nota: "",
      orden: 1009,
      agregadoEn, actualizadoEn,
      sugerenciaQuitar: { motivo, en },  // NUEVO, VAL-43: sólo presente si la capa de IA propuso sacarlo
      nuevo: true                       // NUEVO, VAL-46: sólo presente en la `listaPropuesta` de planListUpdate
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
por ejemplo). Se acredita siempre a la capa de menor precedencia: `regla < historial < destino < manual`
(`ORIGEN_PRECEDENCIA`, `lowestOrigin()`). Acreditarle al historial o a la IA lo que una regla ya ponía haría
que la métrica de aciertos por capa mida mejor de lo que es. Desde esta entrega, "ya lo ponía" no es sólo la
clave literal: pasa por `canonicalKey()` (VAL-45, sección 5), así "adaptador de enchufe" y "adaptador de
corriente" cuentan como el mismo ítem aunque el texto sea distinto.

**Garantías al regenerar** (`mergeLists`, usada por `buildPackingList` cuando recibe `input.previous`, y por
`planListUpdate` para armar su `listaPropuesta` — sección 7):

1. Un ítem descartado nunca vuelve a estado pendiente.
2. El origen de un ítem ya presente no se pisa con uno de mayor precedencia.
3. Lo empacado sigue empacado, con su `empacadoEn` original.
4. Los ítems propios y los ya empacados/descartados sobreviven aunque la regla que los ponía deje de
   aplicar (por ejemplo, al cambiar el tipo de viaje elegido).
5. **(VAL-45)** Un ítem de la lista anterior no queda duplicado si la nueva generación lo llama distinto:
   la búsqueda del ítem anterior también prueba por clave canónica, no sólo literal.

**Clave normalizada** (`slug()`): minúsculas, sin acentos, en singular por heurística, separada por guiones.
No busca ser gramaticalmente perfecta (algunos plurales irregulares del castellano quedan raros, ej.
"dientes" → `dient`), busca ser determinística: la misma entrada de texto siempre cae en la misma clave, que
es lo que hace que el umbral de dos apariciones del historial se cumpla alguna vez.

---

## 4 · VAL-44 · la capa inteligente ve las reservas

**Qué recibía antes.** Sólo cuatro datos derivados del viaje: destino, fechas, duración y tipo de viaje. No
veía ninguna reserva. Todo lo que no estuviera anticipado en una regla de la capa 1 (auto alquilado, vuelo
internacional, trekking) era invisible para la capa de IA.

**Qué recibe ahora.** Dos cosas, las dos calculadas dentro de `buildPackingList` y guardadas en `base`:
`base.reservas` (el resumen seguro de las reservas) y `base.notasViaje` (las notas del viaje, saneadas).

`base.reservas` es un resumen seguro de las reservas del viaje, armado por
`summarizeReservationsForAI(trip, items)` y calculado **una sola vez**, dentro de `buildPackingList` — es
decir, existe siempre que hay una lista, corra o no la capa de IA después. `destinationPrompt(list)` lo
vuelca al prompt como una línea de JSON por reserva, y le pide al modelo que cite el dato concreto cuando el
motivo salga de una reserva puntual ("tu escala en Lima es de ocho horas"), no una generalidad ("las escalas
largas cansan").

**Cómo se arma el resumen.** Por tipo de reserva, con campos elegidos a mano (no un `Object.assign` del
objeto de reserva completo — ver más abajo por qué eso importa):

| Tipo | Campos que viajan a la IA |
|---|---|
| `vuelo` | fechas/horarios (`desde`, `hasta`), `origen` y `destino` (código IATA en mayúsculas, no ciudad ni dirección), notas saneadas |
| `escala` | ciudad (el código IATA compartido entre dos vuelos consecutivos) y duración en horas, con un decimal |
| `alojamiento` | fechas, noches calculadas, notas saneadas |
| `auto` | fechas, días calculados, notas saneadas |
| `actividad` | fecha, título (recortado a 80 caracteres), notas saneadas |

**Detección de escalas.** No es un campo que traiga la reserva: se infiere comparando vuelos consecutivos
ordenados por fecha de salida. Si el destino de un vuelo coincide con el origen del siguiente y hay una
espera real entre la llegada de uno y la salida del otro (`hoursBetween`, más de cero horas), se agrega una
entrada `{tipo:"escala", ciudad, duracionHoras}`. Es justo el tipo de dato puntual que ninguna regla
genérica podía anticipar.

**Qué NO se manda, y por qué.** El resumen **nunca incluye código de reserva (`confirmation`), teléfono
(`phone`) ni dirección exacta (`address`)** — esos tres campos ni siquiera se leen dentro de
`summarizeReservationsForAI`, porque la función arma cada objeto de salida campo por campo, no copiando el
objeto de entrada entero. Esa es la garantía estructural, no sólo una promesa en un comentario: si mañana el
modelo de datos de una reserva suma un campo nuevo (por ejemplo un costo), **no se filtra solo** a la IA —
alguien tiene que agregarlo a propósito acá, revisando primero si corresponde mandarlo. Esto está verificado
con una prueba explícita ("el resumen de reservas nunca manda datos sensibles, y sí tipo, fechas, ciudades y
notas"), que arma reservas con `confirmation`, `phone` y `address` bien cargados y confirma con
`JSON.stringify` que ninguna de esas tres cadenas aparece en el resumen.

**Las notas del viaje también viajan (`base.notasViaje`).** El brief de VAL-44 pide que la capa inteligente
reciba "actividades y notas del viaje". Las notas de cada reserva viajan dentro de su entrada del resumen;
las del viaje —`trip.notes`, el campo donde la persona escribe presupuesto, ideas y links sueltos— viajan
aparte, en `base.notasViaje`, con **el mismo tratamiento de privacidad** que las de una reserva
(`sanitizeNotesForAI`). `destinationPrompt` las vuelca en un bloque propio, "Notas del viaje", **sólo si no
están vacías**: una lista sin notas no arma esa sección, y una lista guardada por una versión anterior del
motor (sin el campo) tampoco — el prompt sigue funcionando igual. Es justo el caso que el brief usa de
ejemplo: "vamos a bucear dos días y necesito equipo propio" es una actividad que pide equipo propio y que
ninguna regla de la capa 1 podía anticipar. Las capas 1 y 3 ya leían `trip.notes` (entra en el `textBlob` de
`tripContext`, de donde salen los hechos y el tipo de viaje sugerido); desde esta corrección, la capa 2
también.

**Las notas sí viajan, pero saneadas.** El campo `notes` de una reserva es texto libre y es donde alguien
puede pegar un teléfono a mano sin querer. `sanitizeNotesForAI(texto)` (exportada, para poder probarla suelta) reemplaza por
`[dato omitido]` cada dato de contacto que reconoce y recorta el texto a 240 caracteres, antes de que la nota
entre al resumen o al prompt. Los datos de contacto son **datos, no condicionales**: `CONTACT_PATTERNS` es un
array de `{nombre, re}` y agregar una forma nueva es agregar una entrada. Hoy hay dos, y el orden importa
(primero el correo, después los dígitos, porque un correo con números adentro quedaría tapado a medias):

| Patrón | Qué tapa |
|---|---|
| `correo` | una dirección de correo electrónica completa, con dominio compuesto y signos (`Reservas+Soporte@Hotel-Arraial.com.br`) |
| `telefono` | una secuencia de seis dígitos o más con los separadores típicos de un teléfono (espacios, guiones, paréntesis, `+`) |

**Por qué se tapa el correo, si el brief no lo nombra.** El brief lista "códigos de reserva, teléfonos y
direcciones exactas". El correo no está en esa lista literal: taparlo es una decisión de producto tomada por
el Product Owner, con este criterio — un correo es un dato personal de un tercero y no aporta absolutamente
nada para decidir qué llevar en la valija, que es el criterio con el que está escrita la regla entera. Es defensa en profundidad, no la
única barrera: el motivo de fondo por el que las notas sí pueden viajar es que son las que permiten razonar
sobre el viaje ("el depto no tiene lavarropas"); omitirlas enteras tiraría el dato útil junto con el
sensible.

**Hasta dónde llega esta sanitización — qué sigue pasando entero al modelo.** `CONTACT_PATTERNS` cubre las
dos formas más comunes de copiar y pegar un contacto desde un mail de confirmación. Fuera de eso, por una
nota libre todavía pasan sin tocar:

- **Links y URLs.** `https://booking.com/hotel/xyz?token=abc` viaja entero. Un link tipo `wa.me/5491155554444`
  queda tapado sólo a medias, porque lo que matchea es la corrida de dígitos, no la URL: sale
  `wa.me/[dato omitido]`.
- **Usuarios y handles de redes** (`@hotel_arraial`, "IG: hotelarraial"): no tienen forma de correo ni de
  teléfono, pasan tal cual.
- **Un teléfono escrito en palabras** ("once cincuenta y cinco...") o partido en pedazos cortos.
- **Direcciones postales escritas a mano dentro de la nota** ("estamos en Rua das Pedras 45"): el campo
  `address` de la reserva nunca se lee, pero una dirección tipeada dentro de `notes` sí viaja.
- **Nombres de personas** y cualquier otro dato sensible no numérico.

Ninguna de esas formas está arreglada en esta entrega: están declaradas acá para que se decidan como
producto, no para que se descubran en una auditoría. Sigue siendo responsabilidad de la persona no pegar
datos sensibles en un campo de notas libre; el motor cubre los casos más comunes, no todos.

**Límites conocidos de VAL-44: tres datos que el brief pide y que el motor no manda.** El brief pide que la
capa inteligente reciba "tramos de vuelo con horarios y escalas, alojamiento con su tipo y sus notas, auto
con su lugar de retiro, actividades y notas del viaje". Dos de esos datos **no llegan, y no es un olvido**:

1. **El tipo de alojamiento** (hotel, hostel, departamento, casa de familia) **no existe en el modelo de
   datos.** Una reserva de tipo `stay` tiene `provider` (el nombre del alojamiento), `address`,
   `confirmation`, fechas y `notes`; no hay ningún campo que diga de qué clase de alojamiento se trata. No se
   puede mandar lo que no existe. Deducirlo del nombre del proveedor sería adivinar, y adivinar está en
   contra de la regla del prompt ("antes una lista corta que un dato inventado"). Para cumplir este criterio
   hace falta primero un campo nuevo en la reserva, que es un cambio de modelo de datos y de la pantalla de
   carga — fuera del alcance del motor.
2. **El lugar de retiro del auto es el campo `address`**, el mismo que la app rotula "Lugar de retiro". La
   regla de privacidad de esta misma historia prohíbe mandar direcciones exactas al modelo, así que mandarlo
   sería romper una regla del brief para cumplir otra. Lo que sí viaja del auto es el tipo, las fechas de
   retiro y devolución, los días calculados y las notas. Si en algún momento se decide que el modelo tiene
   que saber *dónde* se retira el auto, la salida no es mandar la dirección: es mandar sólo la ciudad o el
   código de aeropuerto, lo que pide un campo nuevo o una extracción que hoy no existe.
3. **Las notas del viaje** sí llegan desde esta corrección (arriba en esta misma sección). Antes no llegaban:
   era el tercer dato faltante de la auditoría.

---

## 5 · VAL-45 · ningún ítem repetido entre capas

**El problema que resuelve.** Con más contexto (VAL-44), la capa de IA tiende a repetir lo que las reglas ya
pusieron, con otro nombre: "adaptador tipo F" cuando la regla del vuelo internacional ya puso "adaptador de
enchufe". Sin una noción de sinónimo, eso duplica el ítem en la lista.

**Los grupos de sinónimos** (`SYNONYM_GROUPS`) son datos, no código: un array de familias, cada una con

- `canon` — el nombre de referencia de la familia (de acá sale la clave canónica, con el mismo `slug()` que
  usa todo el motor),
- `palabras` — lista cerrada de frases que, normalizadas, son ese mismo ítem,
- `patron` (opcional) — una expresión regular, para familias abiertas donde enumerar cada variante es
  imposible (el tipo de enchufe cambia de país en país). El patrón trabaja **sobre la clave ya normalizada**
  (con guiones, no espacios), y está acotado a propósito: el de "adaptador de enchufe" exige que la clave
  hable de enchufe, corriente, toma, clavija, universal, viaje o "tipo-" seguido de una letra, para no
  capturar de más un "adaptador HDMI" o un "adaptador de lente".

`canonicalKey(clave)` resuelve la familia de una clave: primero busca en `SYNONYM_MAP` (un mapa armado una
sola vez, `slug(palabra) -> slug(canon)`, para todas las palabras de todos los grupos más el propio canon);
si no encuentra coincidencia exacta, prueba cada `patron` en orden. Si nada matchea, devuelve la clave tal
cual (un ítem sin sinónimos declarados es su propia familia).

**Cómo se agrega un sinónimo nuevo.** Dos casos:

1. Ya existe la familia (por ejemplo, alguien reporta que "repelente en aerosol" no se está reconociendo
   como "Repelente de mosquitos"): se agrega la frase a `palabras` del grupo existente. No hace falta tocar
   nada más — `findCanonicalMatch`, `verifyNoDuplicateItems`, `mergeLists`, `parseDestinationItems`,
   `addManualItem` y `validateRules` ya consultan `canonicalKey()`.
2. Es una familia nueva: se agrega una entrada `{ canon, palabras }` (o con `patron` si la familia es
   abierta) a `SYNONYM_GROUPS`.

**Precedencia al fusionar.** `ORIGEN_PRECEDENCIA = { regla:0, historial:1, destino:2, manual:3 }`; gana
siempre el número más chico (`lowestOrigin`). Se aplica en tres puntos distintos del código, y los tres
comparan por clave canónica, no literal:

- Al armar la capa 3, un ítem que el historial quiere promover no se agrega si ya existe por sinónimo en lo
  que puso la capa 1 (`findCanonicalMatch(out, e.clave)` en `buildPackingList`).
- Al parsear la respuesta de la IA, un ítem que ya existe -literal o por canónica- en la lista base no
  entra, así nunca se le acredita a "destino" lo que una capa más básica ya puso
  (`parseDestinationItems`).
- Al fusionar en `mergeLists` (regenerar, o al calcular el plan de VAL-46), si el ítem ya existía con otro
  origen, gana el de menor precedencia sin importar qué capa lo trae la nueva generación.

**La verificación exportada.** `verifyNoDuplicateItems(list)` agrupa los ítems de una lista por clave
canónica y devuelve `{ok, duplicados}`: `ok` es falso si algún grupo tiene más de una clave literal distinta.
Hay una prueba que corre esta verificación sobre cualquier lista que arma el motor (`buildPackingList`), así
que un cambio futuro que introduzca un duplicado por sinónimo rompe la prueba, no se descubre en producción.

**Hasta dónde llega, y dónde falla — lo más importante de esta sección.** No hay comparación semántica ni
embeddings: es un diccionario cerrado, declarado a mano.

- Un sinónimo real que no está en `palabras` ni matchea ningún `patron` **no se detecta**. Ejemplo: si el
  catálogo no tiene "repelente" y alguien escribe "espray antimosquitos", esos dos ítems quedan como
  entidades distintas y **sí se duplican** en la lista.
- **No hay tolerancia a errores de tipeo.** "Protectr solar" no cae en la misma clave que "Protector solar"
  salvo que el `slug()` resultante coincida letra por letra con alguna entrada declarada. No hay distancia de
  edición ni comparación difusa de ningún tipo.
- Los `patron` son deliberadamente acotados para no atrapar de más (ver el ejemplo del adaptador arriba); eso
  significa que un ítem legítimo de la misma familia, con una palabra rara ("adaptador para el tomacorriente
  del hotel"), puede quedar afuera del patrón si no contiene ninguna de las palabras clave que el patrón
  exige.
- **`verifyNoDuplicateItems` no es un detector de duplicados semántico genérico.** Sólo confirma que el
  diccionario declarado en `SYNONYM_GROUPS` se respeta. Dos ítems que una persona reconocería como lo mismo,
  pero que el diccionario no vincula, pasan la verificación con `ok:true` y quedan duplicados en la lista sin
  que nada lo detecte.
- **Consecuencia práctica para quien mantenga esto:** cada vez que se agrega una regla base nueva, o que en
  producción aparece un ítem repetido con nombre distinto (por ejemplo porque la IA lo nombró de una forma
  que el catálogo no previó), hay que sumar el sinónimo a mano a `SYNONYM_GROUPS`. No existe ningún mecanismo
  automático que detecte pares nuevos no declarados y avise.
- `validateRules()` sí corre esta misma verificación sobre el propio catálogo de reglas (`BASE_RULES`): si
  dos reglas base apuntan al mismo canónico por accidente, es un error de catálogo que se detecta al correr
  las pruebas, no algo que dependa de que alguien lo note en producción.

---

## 6 · VAL-43 · proponer sacar ítems, con un piso que no se toca

**La decisión de producto: la capa inteligente propone, nunca aplica sola.** El brief de VAL-43 pide que "la
capa inteligente pueda sacar ítems de la lista base", sin fijar el mecanismo. La implementación es más
conservadora que una lectura literal de eso — y es mejor que lo que pedía el brief, no un incumplimiento: es
consistente con dos decisiones de producto que ya estaban tomadas en el brief original de VAL-30 ("la
sugerencia se acepta o se rechaza, no se impone") y con la garantía de VAL-46 de que nada se guarda sin
revisar.

En código, esto significa que `enrichWithDestination` **nunca borra ni cambia el estado de un ítem** por una
propuesta de "quitar". Lo único que hace es agregarle al ítem existente una propiedad
`sugerenciaQuitar: {motivo, en}`, sin tocar su `estado` (que sigue en lo que estuviera: casi siempre
`pendiente`). El ítem sigue en la lista, con todos sus datos, esperando que la persona decida. Aceptar la
propuesta **no necesita una función especial**: es el `dismissItem` de siempre (VAL-31). Rechazarla es
`clearRemovalSuggestion(list, clave)`, que borra sólo la propiedad `sugerenciaQuitar` sin tocar nada más del
ítem.

**Las reglas que `parseDestinationItems` hace cumplir en código, antes de dejar pasar una entrada de
`"quitar"`** (no sólo en el texto del prompt — el prompt también se lo pide al modelo, pero el código no
confía en que lo respete):

1. El nombre que propone la IA tiene que resolver, literal o por sinónimo (`findCanonicalMatch`), a un ítem
   que ya existe en la lista.
2. `isCriticalClave(target)` tiene que ser falso — el piso, ver más abajo.
3. El ítem no puede tener `origen:"manual"`: lo que la persona agregó a mano no lo toca ninguna otra capa.
4. El ítem no puede estar ya `descartado`: no tiene sentido proponer sacar algo que la persona ya sacó.
5. Tiene que traer `motivo` no vacío.
6. Dos entradas de `"quitar"` de la misma respuesta no pueden apuntar al mismo ítem (se descarta la
   repetida).

**El piso — `CRITICAL_CLAVES`.** Se arma una sola vez, recorriendo `BASE_RULES` y juntando las claves de las
reglas que declaran `critico:true` (hoy, sólo `doc.dni` y `doc.pasaporte`: la documentación de identidad).
No es una lista separada que se pueda desincronizar del catálogo: para agregar un ítem crítico nuevo alcanza
con marcar `critico:true` en su regla, en `BASE_RULES`. `isCriticalClave(clave)` respeta sinónimos (compara
por `canonicalKey`), así que si alguna vez se declarara un sinónimo del DNI, también quedaría protegido sin
tocar esta función.

Cualquier otro ítem — la visa, el seguro de viaje, la licencia de conducir, el adaptador de enchufe — **sí**
se puede proponer para sacar si la IA lo justifica con un motivo concreto de ese destino puntual. Sólo la
documentación de identidad queda blindada, tal como pide el brief.

---

## 7 · VAL-46 · la lista se actualiza cuando el viaje crece

**El problema que resuelve.** Alguien genera la lista, después carga un auto alquilado o un vuelo nuevo, y
la lista guardada queda vieja: no tiene la licencia de conducir ni el ítem que corresponde al nuevo tramo.
Regenerar entera resolvería el dato, pero el brief pide algo más chico: detectar que quedó desactualizada y
ofrecer sólo lo que cambió, sin pisar lo que la persona ya venía marcando.

**`planListUpdate(input)`** — sincrónica, corre capas 1 + 3, nunca capa de IA. Recibe
`{list, trip, items, tipoViaje, history, now}`, donde `list` es la lista ya guardada e `items` son las
reservas **actuales** del viaje (después del cambio que se quiere detectar). Devuelve:

```js
{
  desactualizada: boolean,
  nuevos: [{ clave, nombre, categoria, motivo, reserva, origen }],
  motivo: "texto para mostrar",
  listaPropuesta: Object|null   // la lista completa, con los ítems nuevos marcados `nuevo:true`
}
```

Por dentro: reconstruye la lista base fresca con las reservas actuales (`buildPackingList`), la fusiona con
la lista guardada usando la misma `mergeLists` que usa la regeneración normal (por lo tanto hereda sus cinco
garantías, sección 3), y compara por clave canónica qué había antes en `list` (la lista original, **antes**
de la fusión) contra qué hay en la lista fusionada. Todo lo que no estaba antes es "nuevo".

**Cómo se explica cada ítem nuevo (`explainNewItem`).** Si viene de una regla de la capa 1 cuyo `when` pide
un hecho concreto (`facts`/`anyFacts`), se rastrea la **primera** reserva que hizo verdadero ese hecho
(`findFactSource`) y se arma una descripción corta para citarla (`describeReservation`, por ejemplo "el auto
(Hertz)"). Esa descripción **nunca sale hacia la capa de IA** — es un texto para la persona, generado por una
función completamente separada de `summarizeReservationsForAI` (sección 4), y puede usar cualquier dato de
la reserva (proveedor, título) porque no tiene la restricción de privacidad de lo que se manda al modelo. Si
el ítem viene del historial, el motivo es el que ya trae de `learnFromHistory` y `reserva` queda `null`.

**Marca de "nuevo" y cómo se limpia.** `listaPropuesta` trae cada ítem nuevo con `nuevo:true` agregado, sin
tocar ningún otro campo. No se persiste sola: es una propuesta que la app decide si muestra y si aplica. Una
vez que la persona la vio, `clearNewFlags(list)` saca el flag de todos los ítems marcados de una sola pasada
(y es barata cuando no hace falta: si no hay ningún `nuevo:true`, devuelve la misma referencia sin copiar).

**La garantía de que un descarte nunca vuelve.** Dos mecanismos la sostienen, no uno solo:

1. `mergeLists` ya garantiza que el estado de la persona manda: un ítem descartado en `list` sigue
   descartado en la lista fusionada, sin importar si una regla nueva (motivada por la reserva que se acaba
   de cargar) también lo pondría.
2. `planListUpdate` calcula "nuevo" comparando contra la clave canónica de lo que **ya había** en `list`
   (la original). Un ítem que estaba — activo o descartado — nunca se cuenta como nuevo, así que un
   descartado jamás vuelve a aparecer en `nuevos` ni queda marcado `nuevo:true`, aunque el viaje crezca.

**`planListUpdateAsync(input)`** — mismos parámetros más `ask`. Corre `planListUpdate` primero (siempre,
sync) y, si hay `ask` y hay `listaPropuesta`, corre además `enrichWithDestination` (capa 2, VAL-44/VAL-43)
sobre esa lista propuesta, y suma a `nuevos` lo que la IA agregó que no estaba antes por canónica. Si `ask`
no es función o la promesa se rechaza, el plan sale igual con lo de las capas 1 + 3 — la misma degradación
digna de siempre, nunca lanza por culpa de la IA.

**Límite conocido de `planListUpdateAsync`.** Los ítems nuevos que aporta la capa de IA siempre llevan
`reserva:null` en el plan, a diferencia de los que vienen de una regla con un hecho rastreable. El texto de
`motivo` de esos ítems sí puede citar el dato concreto en prosa (porque el prompt de `destinationPrompt` se
lo pide explícitamente, VAL-44), pero el campo estructurado `reserva` queda vacío. Quien construya la
interfaz para mostrar "qué reserva motivó este ítem" tiene que saber que, para los ítems de origen `destino`,
ese dato sólo está adentro del texto de `motivo`, no en un campo aparte.

**Cuál llamar, y cuándo — decisión de quien integra, no del motor.** `planListUpdate` alcanza para detectar
en el momento en que se guarda una reserva, sin esperar red. `planListUpdateAsync` además contempla lo que la
capa inteligente encontraría con el contexto nuevo (por ejemplo, una escala que recién aparece). El motor no
elige por sí solo cuál usar ni cuándo disparar la verificación.

---

## 8 · El contador de progreso — qué mide y por qué

`packingProgress(list)` devuelve seis números:

```js
{ total, empacados, descartados, pendientes, resueltos, totalConDescartados, pct }
```

**Fórmula vigente, verificada contra las pruebas** (grupo "Estado de la lista (VAL-31)" en
`packing-engine.test.js`, que es la que manda si algo acá queda desactualizado — ver la advertencia al
final de esta sección):

```
total               = todos los ítems MENOS los descartados
totalConDescartados = todos los ítems, descartados incluidos
pendientes          = total - empacados
resueltos           = empacados
pct                 = round(empacados / total * 100), con dos casos de borde:
                        - 0 ítems en total y NADA en la lista           -> pct = 0
                        - 0 ítems en total pero SÍ hay ítems (todos
                          descartados)                                  -> pct = 100
```

**Descartar saca al ítem del total.** Si alguien decidió que un ítem no va, dejó de ser parte de su valija:
no tiene que inflar el denominador ni quedar como un pendiente eterno. `totalConDescartados` conserva el
conteo completo, para poder mostrar "tenías 32, sacaste 4" o para poder recuperar un descartado sin perder
de vista cuántos había.

**Por qué descartar igual hace subir el porcentaje, aunque no sume al numerador.** Descartar achica el
**denominador**, no infla el numerador. Ejemplo: una lista de 10 ítems con 1 empacado tiene `pct = 10`
(`round(1/10*100)`). Si después se descartan 5 ítems que no van, sin empacar nada más, el `total` baja a 5 y
`pct` sube a `20` (`round(1/5*100)`) — el mismo ítem empacado ahora "pesa" más porque hay menos por resolver.
Esto es intencional: si descartar no moviera el porcentaje, la persona deja de descartar y en cambio marca
como empacado lo que no va a llevar, sólo para sacarse el pendiente de encima, y ahí se pierde el dato de
descarte que es el único insumo del aprendizaje de VAL-32.

**Caso de borde documentado con una prueba propia:** si se descarta la lista entera, `total = 0`,
`pendientes = 0` y `pct = 100` — la valija "está lista" (no queda nada por decidir), no "en cero". Distinto
de una lista recién creada sin ítems, que si existiera (hoy no pasa: el motor siempre pone al menos la
documentación) daría `pct = 0`.

**Historia de esta fórmula, para quien se encuentre con una versión más vieja de este documento.** Este es
ya el **tercer** criterio que corre en producción para este número, y cambió dos veces con el producto en la
mano, no por error de programación:

1. **Original:** el descartado salía del total y del numerador — el problema era que descartar no movía
   para nada el porcentaje.
2. **Corrección de la iteración 1** (la que describía la versión anterior de este documento): el descartado
   pasaba a contar en el total y en el numerador (`resueltos = empacados + descartados`), para que
   descartar contara como progreso explícitamente.
3. **Corrección de esta entrega (la vigente):** se volvió a sacar el descartado del total — "si decidiste
   que algo no va, dejó de ser parte de tu valija" — pero conservando el efecto de que descartar sigue
   subiendo el `pct`, ahora por reducción del denominador en vez de por suma al numerador. Se agregó
   `totalConDescartados` para no perder el dato de cuántos ítems tuvo la lista alguna vez.

**Advertencia para quien mantenga esto, con dos huecos encontrados al documentar (reportados al Product
Owner, no corregidos en esta entrega — no se tocó código):**

- El comentario JSDoc que antecede a `packingProgress()` dentro de `packing-engine.js` todavía describe la
  fórmula del punto 2 (`resueltos = empacados + descartados`, `total` incluye los descartados). La
  implementación real — la que corren las 68 pruebas en verde — es la del punto 3, la que se documenta acá.
  Ante cualquier duda, la fuente de verdad es `node app/parts/packing-engine.test.js`, no ese comentario.
- `docs/design/valija-inteligente.md`, sección 5.6 ("Cálculo de la barra de progreso"), describe la fórmula
  del punto 2 (`conteo.total` incluye descartados, `pct = resueltos/total` con `resueltos = empacados +
  descartados`). Con el cambio del punto 3, esa sección quedó desactualizada **por segunda vez** y la tiene
  que revisar quien sea dueño de ese archivo: `conteo.total` y `conteo.pendientes` ya excluyen los
  descartados tal como vienen del motor (no hace falta sumar nada a mano), y `conteo.totalConDescartados`
  está disponible si la barra necesita mostrar cuántos ítems tuvo la lista en total.

---

## 9 · Nota de integración — qué necesita `app/valija.html`

Este módulo no se edita desde acá; esto es la lista de lo que el rol de integración tiene que hacer con él.

1. **Cargarlo.** `packing-engine.js` es UMD: en Node exporta con `module.exports`, en el navegador expone
   `window.PackingEngine`. Como la convención del proyecto es un solo archivo sin build, hay que pegar el
   módulo entero dentro del `<script>` de `valija.html` (no un `<script src>` a un archivo local).

2. **Generarla o regenerarla.** La entrada es `PackingEngine.generatePackingList({ trip, items, tipoViaje,
   history, previous, ask, now })`, que devuelve una `Promise` con el documento completo listo para guardar.
   `trip` e `items` son el viaje y sus reservas tal como ya los maneja `Store`; `history` son los documentos
   de packing de viajes anteriores (`Store.packingOf` de cada viaje, filtrados por los que ya existan);
   `previous` es el documento ya guardado de este viaje, si se está regenerando; `ask` es
   `(prompt) => sample.json(prompt, {modelTier:"complex"})` cuando `claude.use("sample")` resolvió, o
   `undefined`/`null` si no — el motor ya contempla ese caso. `list.base.reservas` y `list.base.notasViaje` (VAL-44) se
   calculan solos, adentro; no hay que armar ni pasar nada aparte para eso. `notasViaje` sale de `trip.notes`
   tal como ya lo maneja `Store`: alcanza con que el viaje que se pasa traiga ese campo.

3. **Guardarla.** Persistir el documento completo con `db.doc('trips/'+tripId+'/packing/lista').set(list)`
   (o el equivalente en `localStorage` si no hay `db`) tras generar o regenerar. Para marcar un solo ítem sin
   reescribir la lista entera, usar `PackingEngine.stateUpdatePatch(clave, estado)` con `.update(...)`.

4. **Ofrecer la actualización cuando el viaje crece (VAL-46).** Cada vez que se agrega, edita o borra una
   reserva de un viaje que ya tiene una lista guardada, llamar `PackingEngine.planListUpdate({list, trip,
   items, tipoViaje, history, now})` (o `planListUpdateAsync` con `ask`, si también se quiere que la capa de
   IA reaccione al cambio). Si `plan.desactualizada` es `true`, mostrar `plan.nuevos` (cada uno con su
   `motivo` y, cuando lo tenga, su `reserva`) y ofrecer aplicar: guardar `plan.listaPropuesta` como la nueva
   lista si la persona acepta, no tocar nada si no. No conviene disparar esto en cada tecla — alcanza con al
   guardar la reserva. Una vez que la persona vio la propuesta, limpiar la marca con
   `PackingEngine.clearNewFlags(list)` antes de guardar (el diseño de pantallas en
   `docs/design/valija-inteligente.md` define el momento exacto).

5. **Ofrecer sacar ítems (VAL-43).** Cuando corrió la capa de IA y algún ítem quedó con
   `item.sugerenciaQuitar`, mostrarlo junto al ítem con su motivo. Aceptar la propuesta es el
   `PackingEngine.dismissItem(list, clave)` de siempre (VAL-31); rechazarla es
   `PackingEngine.clearRemovalSuggestion(list, clave)`. Nunca aplicar la sugerencia sola, ni al cargar la
   pantalla ni en ningún otro momento sin que la persona la vea.

6. **Todo lo demás es UI pura sobre el documento:** `itemList(list)` / `groupByCategory(list)` para mostrar,
   `packItem` / `dismissItem` / `resetItem` / `setQty` / `addManualItem` / `removeManualItem` para las
   acciones de la persona (todas puras: devuelven un documento nuevo, no mutan el que reciben — hay que
   guardar el resultado). El detalle de qué pantalla usa cada función está en
   `docs/design/valija-inteligente.md`, sección 5.

No hace falta ninguna dependencia nueva. El módulo entero es JavaScript vainilla.

---

## 10 · Cómo correr las pruebas

```
node app/parts/packing-engine.test.js
```

68 casos, sin frameworks. Cada caso se declara con `test(nombre, fn)`; `fn` puede ser sincrónica o async (la
capa de IA se prueba con funciones `ask` async simuladas, sin red). El arnés imprime cada caso con `ok` o
`FALLA` y el mensaje del assert que falló, y termina con el resumen y el código de salida: `0` si los 68
casos pasan, `1` si falla al menos uno.

Grupos, con su épica:

- **Catálogo de reglas** — sanidad de `BASE_RULES` (`validateRules`).
- **Duración: de un día a treinta**, **Internacional o nacional**, **Tipos de viaje**, **Ajustes por lo que
  ya está cargado en el viaje** — VAL-30.
- **Historial (VAL-32)** — promoción y supresión.
- **Regeneración (VAL-30)** — no duplica, no pierde nada.
- **Capa de destino con IA (VAL-33)** — degradación digna, validación de la respuesta.
- **VAL-44 · la capa inteligente ve el viaje completo** — resumen seguro de reservas, notas del viaje en el
  prompt, sanitización de notas (teléfono y correo), detección de escalas, prompt.
- **VAL-45 · ningún ítem repetido entre capas** — sinónimos, `canonicalKey`, `verifyNoDuplicateItems`,
  convivencia con historial, manual y regeneración.
- **VAL-43 · la capa inteligente puede sacar ítems, con un piso que no se toca** — propuesta sin aplicar,
  piso de documentación de identidad, `clearRemovalSuggestion`.
- **VAL-46 · la lista se actualiza cuando el viaje crece** — `planListUpdate`, `planListUpdateAsync`,
  `clearNewFlags`, garantía de que un descarte nunca vuelve.
- **Estado de la lista (VAL-31)** — marcar, desmarcar, descartar, contador, ítems propios, agrupar.
- **Robustez** — sin argumentos, reservas rotas o incompletas.

---

## 11 · Corrección hecha durante la entrega de la iteración 1 (histórico)

Esta nota describe un trabajo de una entrega anterior (VAL-30 a VAL-33) y se conserva por trazabilidad; no
describe nada de VAL-43 a VAL-46.

Esa entrega retomó un trabajo a mitad de camino: el motor ya tenía aplicadas dos correcciones de modelo de
datos del Product Owner (ítems con tres estados en vez de un booleano; lista guardada como objeto indexado
por clave en vez de array) pero las pruebas habían quedado escritas contra la API anterior. Se reescribió
`packing-engine.test.js` completo contra la API real. No se tocó lógica del motor para que las pruebas
pasaran, con una excepción: el contador de progreso, por un cambio de decisión del Product Owner tomado
durante esa misma entrega (que la sección 8 de este documento ya no describe, porque volvió a cambiar en
esta entrega — ver el punto 2 de la "Historia de esta fórmula" en la sección 8).

Dos aclaraciones sobre comportamientos que parecían raros al principio y resultaron ser diseño correcto, no
defectos, que se mantienen vigentes:

- **`suggestTripType` con un destino que tiene pistas de dos tipos a la vez propone "mixto".** Es intencional
  (comentario en el propio código: "dos familias fuertes a la vez: es un viaje mixto"), no un error de
  clasificación.
- **La singularización de `slug()` no es gramaticalmente perfecta** (por ejemplo "Cepillo y pasta de
  dientes" → `cepillo-y-pasta-de-dient`). Es heurística a propósito: lo que importa es que sea
  determinística, no que sea gramatical.

---

## 12 · Correcciones de la auditoría del bloque B (VAL-44)

Dos huecos encontrados por la auditoría y corregidos acá, cada uno con su prueba nueva en
`packing-engine.test.js` (grupo "VAL-44 · la capa inteligente ve el viaje completo"):

1. **Las notas del viaje no llegaban a la capa 2.** `trip.notes` alimentaba las capas 1 y 3 (vía el
   `textBlob` de `tripContext`) pero se perdía antes del prompt. Ahora se saneia una sola vez en
   `buildPackingList` y queda en `base.notasViaje`, y `destinationPrompt` la vuelca en un bloque propio
   cuando no está vacía. Sección 4. Prueba: *"las notas del viaje llegan al prompt de la capa inteligente,
   saneadas"*.
2. **Un correo pasaba entero al modelo.** `sanitizeNotesForAI` tapaba corridas de dígitos pero no direcciones
   de correo. Ahora los patrones de contacto son un array (`CONTACT_PATTERNS`) y el correo es el primero.
   Decisión de producto del Product Owner, con su motivo escrito en la sección 4. Prueba: *"las notas se
   sanitizan: un correo tampoco pasa al modelo"*.

**Cambios de contrato de esta corrección** (lo único que quien integra tiene que saber): `base` suma el campo
`notasViaje` (string, `""` si el viaje no tiene notas) y el módulo exporta `sanitizeNotesForAI(texto)`.
Ninguna función cambió de firma y ninguna prueba anterior cambió de comportamiento.
