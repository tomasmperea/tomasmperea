# Auditoría VAL-72 — sexta ronda ("el error no era el umbral, era rotular")

**Commit auditado:** `64a7434b8e3bb9fb47af16dd4c3c0475d068845a` (el cambio de producto está en
`54ceda2`; `64a7434` sólo agrega dos secciones a `CLAUDE.md`) · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío, `HEAD` en el
mismo hash al empezar y al terminar) · **Publicado:** `VALIJA_VERSION` está en `"25"`; la entrega dice que no
se publicó nada y desde acá no se puede leer el Artifact para confirmarlo.
Rondas anteriores: 57 · 51 · 70 · 59 · 51.

## Veredicto: NO PUBLICAR — 54/100

**No sale, ni como candidato.** El piso de 70 vale sólo cuando la única dimensión floja es la 1 por no poder
probar en el teléfono. Acá hay un defecto **nuevo**, reproducido en node y en Chromium **tocando `#pk-build`**,
que no tiene nada que ver con el visor del teléfono. Y hay una afirmación de la entrega que es falsa y que
pude falsificar mecánicamente.

**Lo que esta ronda hizo bien, y es mucho más que las anteriores.** El bloqueante de la ronda 5 está cerrado
de verdad: corrí el arnés de hoy contra el HTML de la ronda 5 y dio **11 FALLARON**, o sea que las pruebas
nuevas miden contra la versión anterior en vez de describirla. Los tres bloqueantes viejos —los dos de la
ronda 4 y el de la ronda 2— los reataqué **saboteando cada arreglo** y los tres controles se ponen en rojo
(7, 3 y 13 fallas). El severo de la ronda 5 también, con su propio sabotaje (2 fallas). El diagnóstico
—`encadena` es verdadero en todo itinerario que siga un orden— es correcto, es más profundo que las tres
salidas que yo había propuesto, y la decisión de no rotular es mejor que cualquiera de ellas.

**Y lo que la vuelve a voltear es la misma mecánica, por quinta vez seguida.** El arreglo trajo montado un
segundo cambio que el diagnóstico no pedía: se dejó de exigir que los vuelos **encadenen** para calcular el
número. El resultado es que en un viaje con un tramo por tierra en el medio —tren entre ciudades, pasaje
abierto, auto— la app le dice al modelo que la persona pasa once días en una ciudad donde pasa uno. Y la
única aserción que podía haberlo agarrado está muerta porque a su fixture le falta `end`: exactamente el
defecto que este commit vino a cerrar, exactamente la regla que este commit escribió en `CLAUDE.md`.

---

## Los gestos del reporte, y qué prueba cubre cada uno

| Gesto con el que el PM vio el síntoma | Prueba que lo ejercita | Cubierto |
|---|---|---|
| Crear "Europa", cargar los vuelos a MAD/CDG/FCO, tocar **Armar la lista** | `val72-las-reservas-mandan.js` (motor sacado del HTML, fixture ahora **con** `end`) + `valija-bloque-b.js` (navegador, toca `#pk-build`) | **Sí.** El fixture del caso decisivo ya trae la hora de llegada |
| Ida y vuelta simple con hora de llegada (bloqueante de la ronda 5) | bloque `IDA_Y_VUELTA_CON_END`, nuevo | **Sí**, y falla contra el build anterior |
| Viaje con destino escrito y reserva en el punto de partida | `HOTEL_EN_ORIGEN` / `SOLO_TRASLADO` / los tres casos de colisión | **Sí**, reataqué con fixtures propios y con tres sabotajes |
| Viaje con un tramo por tierra o pasaje abierto entre dos vuelos | **ninguna** | **NO** — BLOQUEANTE 1 |
| Cargar el viaje entero importando documentos, sin tipear (la prueba que define el éxito en `docs/briefs/interpretar.md`) | `importar-*.js`, `motores-desde-html.js` | El importador sí; la lista que sale de un viaje importado, sólo en los casos que encadenan |

---

## Hallazgos vivos, por gravedad

### BLOQUEANTE 1 · El número dice "cuánto se queda ahí" y calcula "cuánto falta para el próximo vuelo". No es lo mismo en cuanto hay un tramo por tierra

El commit sacó la guarda `encadena`. El código nuevo es:

```js
var sig = vuelos[k + 1];
var horas = sig ? hoursBetween(f.end, sig.start) : null;
```

Antes era `var horas = encadena ? hoursBetween(f.end, sig.start) : null;`. Mientras los vuelos encadenan
—el destino de uno es el origen del siguiente— las dos cosas coinciden y el número es un dato. Cuando no
encadenan, el número deja de ser un dato y pasa a ser una inferencia, y la línea la presenta como hecho.

**Reproducido tocando `#pk-build` en Chromium**, con el `Store` de la app, sembrando el viaje en
`localStorage` y leyendo el prompt que efectivamente recibió `claude.use("sample").json()`:

Viaje: vuela a Madrid el 1/4, **tren a Lisboa el 3/4**, once días en Lisboa, vuelve desde LIS el 13/4.

```
- Destinos, sacados de los vuelos ya cargados, que son lo que manda: MAD (vuelo, 11 días ahí). Al lado de
  cada lugar va cuánto tiempo pasa ahí antes del próximo vuelo. Usalo para saber qué es una parada de verdad
  y qué es un cambio de avión: unas horas en un aeropuerto no piden nada, unos días sí. El último de la lista
  no lo dice porque no hay vuelo después. Hay además "Lisboa Oriente" (traslado, 2027-04-03T09:00 a
  2027-04-03T19:00). Una dirección no dice si está en el destino o en el lugar de donde se sale (...) así que
  fijate en las fechas y en el resto del viaje antes de tomarla como destino.
```

**La misma oración afirma once días en Madrid y muestra el tren a Lisboa del día 3.** Y no es empate: la
mitad que miente es la que el prompt declara "lo que manda", y la mitad que dice la verdad es la que el
prompt le pide al modelo que dude. La app invierte el viaje de la persona.

Las otras dos formas, con el mismo resultado:

| Viaje | Línea de hoy (v25) | Línea del build anterior |
|---|---|---|
| Entra por MAD, sale por BCN (pasaje abierto) | `MAD (vuelo, 11 días ahí)` | `MAD (vuelo)` |
| Vuela a FCO, alquila auto, vuelve desde MXP | `FCO (vuelo, 11 días ahí)` | `FCO (vuelo)` |
| Tren entre ciudades | `MAD (vuelo, 11 días ahí)` | `MAD (vuelo)` + la pista del tren |

**Es nuevo de este commit.** El build anterior no ponía número en ninguno de los tres.

**Por qué ningún arnés lo ve, y por qué eso es el hallazgo.** El arnés tiene el control exacto, escrito para
esto:

```js
const SIN_ESCALA = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00" },
  { type:"flight", from:"BCN", to:"FCO", start:"2027-04-06T10:00" }
];
...
ok(!/ahí\)/.test(lineaMulti), "y ninguno informa tiempo, porque no se encadenan");
```

Tres cosas, y las tres importan:

1. **El motivo que da la aserción es falso sobre el código de hoy.** "Porque no se encadenan" describe la
   versión anterior. El código ya no mira si encadenan.
2. **La aserción pasa por omisión.** Le agregué `end` a esos dos vuelos —sólo eso, nada más— y el arnés dio
   **1 FALLARON**, en esa línea. Es la misma mecánica que volteó la ronda 5, en el mismo archivo, en un
   bloque que este commit editó.
3. **Ningún otro control protege la guarda.** Saboteé el código **restaurando** `encadena` —o sea, aplicando
   el arreglo que hace falta— y el arnés quedó **entero en verde**. Un arnés que no distingue la versión con
   guarda de la versión sin guarda no puede defender ninguna de las dos.

**Y el razonamiento que sostiene el cambio tiene una premisa falsa.** El commit dice: *"el tiempo es un
número que ya teníamos"*. El número que ya teníamos estaba **condicionado a que encadenaran**. Sacarle la
condición no es reusar un número: es calcular otro y llamarlo igual. El comentario interno lo dice bien
—`horasHastaElProximoVuelo`, *"Horas entre llegar acá y salir en el próximo vuelo"*— y el texto que ve el
modelo lo dice mal: `N días **ahí**`. La palabra "ahí" es la afirmación, y es la que no tiene respaldo.

**Qué NO es este hallazgo.** La decisión de producto —no rotular, dar el número, que decida el modelo— es
correcta y está bien argumentada, es mejor que las tres salidas que le propuse en la ronda 5, y cierra el
bloqueante anterior de verdad. Lo que falla es una línea: el número tiene que seguir saliendo sólo cuando el
destino de un vuelo es el origen del siguiente, o tiene que decir de dónde sale el próximo vuelo.

### SEVERO 2 · "Se revisaron TODOS los fixtures (...) El barrido no destapó nada más" es falso

Es la afirmación central de la parte metodológica de la entrega, y está en el commit y en el backlog.
La falsifiqué mecánicamente: le agregué `end` a **los 19 fixtures de vuelo** del archivo y corrí el arnés.
Falla exactamente **uno**, y es `SIN_ESCALA`, el del BLOQUEANTE 1.

El barrido del resto sí es cierto y lo comprobé por mi cuenta: los traslados tienen `from`, los alojamientos
`end`, los autos `end`, y no queda ninguna fecha pelada en ningún arnés
(`grep -nE '(start|end):\s*"[0-9]{4}-[0-9]{2}-[0-9]{2}"' app/pruebas/*.js` no devuelve nada). Los `transfer`
sin `from` que aparecen en los arneses del importador son respuestas del modelo, no datos que la app escriba,
y ahí el contrato dice explícitamente que un campo puede venir vacío: están bien.

O sea: el barrido se hizo, cubrió casi todo, y dejó afuera justo el fixture que sostenía la aserción del
cambio de esta ronda. Eso no es un descuido menor — es la diferencia entre "revisé casi todo" y "el barrido
no destapó nada más".

### SEVERO 3 · La frase de cierre del aviso es falsa en las dos formas de viaje más comunes

`- ... El último de la lista no lo dice porque no hay vuelo después.`

| Viaje | Último de la lista | ¿Dice el tiempo? |
|---|---|---|
| Ida y vuelta EZE→MAD, MAD→EZE | MAD (el único) | **Sí**: `MAD (vuelo, 13 días ahí)` |
| Europa con vuelo de regreso: MAD · CDG · EZE | CDG | **Sí**: `CDG (vuelo, 8 días ahí)` |
| Multidestino sin regreso: MAD · CDG | CDG | No |

El vuelo de vuelta se descarta de la lista de destinos pero **sí** se usa para calcular el tiempo del lugar
anterior, así que en todo viaje con regreso cargado el último de la lista informa su tiempo y la frase
miente. Es la trampa 4 de mi encargo —documentación que quedó describiendo otra cosa— dentro del propio
prompt, que es el peor lugar donde puede estar: el modelo la lee como si fuera parte del dato.

### MODERADO 4 · Con las fechas invertidas, el destino del viaje pasa a ser tu propia casa

Me pidieron atacar este caso y tiene respuesta. Viaje EZE→MAD cargado con fecha 10/4 y MAD→EZE con fecha 1/4
—las dos fechas al revés, que es un error de tipeo de un campo, o un importador que leyó mal el orden—:

```
- Destinos, sacados de los vuelos ya cargados, que son lo que manda: EZE (vuelo, 8 días ahí).
```

El orden por fecha pone primero el MAD→EZE, así que `casa` pasa a ser MAD, el último vuelo llega a MAD, se
descarta por ser "casa", y **queda EZE —Buenos Aires— como único destino del viaje**, con ocho días.
Madrid desaparece.

**No es nuevo de este commit**: el build anterior daba `EZE (escala de 194 h)`, igual de mal. Lo anoto igual
porque me lo preguntaron, porque no está declarado en ningún lado, y porque el `ordenConfiable` que la ronda
4 introdujo cubre el vuelo **sin** fecha y no cubre el vuelo con fecha **equivocada**, que es el caso
vecino — la pregunta 1 de la regla que este commit acaba de escribir.

### MODERADO 5 · El primer paso por una ciudad se queda con el número, y los diez días después no se ven

`vistos` deduplica por lugar y gana la primera aparición. Viaje EZE→MAD (conexión de 2 h) → CDG → MAD
(diez días) → EZE:

```
- Destinos ... : MAD (vuelo, 2 h ahí) · CDG (vuelo, 2 días ahí). ... unas horas en un aeropuerto no piden nada
```

Madrid, donde la persona pasa diez días, le llega al modelo como dos horas, y el aviso le dice explícitamente
que dos horas no piden nada. Tampoco es nuevo —el build anterior decía `MAD (escala de 2 h)`, con el mismo
efecto— pero el cambio de esta ronda no lo tocó y no está declarado.

### MODERADO 6 · `VALIJA_VERSION` = "25" en tres commits con tres líneas de destino distintas

| Commit | Sello | Qué dice la línea de destino |
|---|---|---|
| `a2fcf5c` | 25 | sin marca de escala |
| `e793855` | 25 | `MAD (escala de 320 h)` |
| `54ceda2` | 25 | `MAD (vuelo, 13 días ahí)` |

Si nada de esto se publicó, no pasó nada. Si algo salió, el sello dejó de identificar el build y la captura
del PM diciendo "v25" no va a decir cuál probó. La regla del propio proyecto —*"antes de publicar se sube; si
lo que está arriba ya tiene este número, no se publica encima"*— pide subir a 26 antes de esta publicación,
o confirmar leyendo el Artifact que no hay ningún v25 arriba. Desde acá no se puede leer el Artifact.

### MODERADO 7 · El backlog describe un comportamiento que el código no tiene

*"no se rotula nada: **se dice cuánto se queda en cada lugar**"*. No es lo que hace: dice cuánto falta para el
próximo vuelo, salga de donde salga. Ni el backlog, ni el comentario del código, ni el mensaje del commit
mencionan que se dejó de exigir que los vuelos encadenen. El comentario explica muy bien por qué `encadena`
no sirve **para rotular** y después lo usa como si también justificara no calcular con él. Son dos cosas
distintas y la segunda no está dicha en ningún lado.

Además, el encabezado `### VAL-72 ... — ✅ entregada en v24` sigue marcando la historia como entregada
mientras lleva seis rondas de veto. Si v24 está arriba, el teléfono del PM hoy corre la versión que las
rondas 4 y 5 vetaron. No lo puedo comprobar desde acá; queda anotado para el PO.

### Observaciones (no cuentan para el puntaje)

- **`hoursBetween` depende de la zona horaria del aparato si alguna fecha llega sin hora.**
  `hoursBetween("2027-04-02","2027-04-02T02:00")` da **2 h en este entorno (UTC)** y **5 h con
  `TZ=America/Argentina/Buenos_Aires`**: `Date.parse` lee una fecha pelada como UTC y una con hora como local.
  **Hoy no hay camino que escriba una fecha pelada** —lo comprobé: un `<input type="datetime-local">` con
  `value="2027-04-02"` devuelve `""`, y los dos caminos de escritura (formulario manual y pantalla de revisar
  lo importado) son `datetime-local`; `buildFlightPatch` no toca `start` ni `end`—, así que la afirmación de
  `CLAUDE.md` es **cierta**. Lo dejo escrito porque es un número que este entorno calcula distinto del
  teléfono, y porque el día que entre un dato viejo de la base compartida no va a haber aviso.
- Redondeos, todos revisados: 0 h y horas negativas no ponen número (lado seguro, correcto); `end` basura
  tampoco; 0,4 h → `0.4 h`; 23,9 h → `23.9 h`; 25 h y 30 h → `1 día`; 98 h → `4 días`; 200 días → `200 días`.
  Legible y sin sorpresas. La banda de 24 a 35 h se lee "1 día", que es lo más parecido a la verdad que se
  puede decir con una palabra.
- Ningún fixture de los ~40 que tiré lanzó una excepción: `trip` nulo, `items` nulo, `null` adentro del array,
  `end` basura, `start` vacío. La función sigue siendo robusta a datos rotos.
- `act` (actividad) sigue sin participar ni como destino ni como pista, igual que en las rondas 3, 4 y 5.
- El sabotaje de `cuantoTiempo` en su rama de menos de 24 h (devolver `"2 h"` fijo) deja el arnés **en verde**:
  el único número corto que se afirma es justamente 2 h. Control débil, consecuencia chica.

---

## Afirmaciones verificadas

| Afirmación de la entrega | Cómo la verifiqué | Resultado |
|---|---|---|
| Los nueve arneses en verde con sus números | Corridos uno por uno, `NODE_PATH=/opt/node22/lib/node_modules`, ruta absoluta del HTML | **Cierto, con los números exactos**: `motores-desde-html` 39, `valija-bloque-b` **111/0**, `hallazgos-qa-bloque-b` 31, `tier-del-modelo` 42, y `las-dos-copias`, `val72`, `val63`, `val74`, `el-script-parsea` todos en verde. Esta vez `valija-bloque-b` me dio 111 en la primera corrida |
| "Las dos copias del motor son idénticas" | Comparación propia: extraje el cuerpo del UMD de `parts/` y la región del HTML, `diff` byte a byte | **Cierto.** `packing-engine`: 6 líneas de diff, todas el `});` del cierre del UMD. `adjuntos-engine`: 33, el UMD más la nota de integración. Ninguna diferencia de código |
| "El bloqueante de la ronda 5 está cerrado" | Corrí el arnés **de hoy** contra el HTML de `e793855` | **Cierto** — 11 FALLARON. Las pruebas nuevas miden contra el build anterior, no lo describen |
| Los dos bloqueantes de la ronda 4 siguen cerrados | **Sabotaje propio, sobre copias del HTML**: (a) devolví el destino escrito al registro `vistos`; (b) volví `ordenConfiable` a `vuelos.length > 1` | **Cierto** — 7 FALLARON y 3 FALLARON. Los controles son reales |
| El bloqueante de la ronda 2 sigue cerrado | **Sabotaje propio**: devolví el alojamiento al cajón en firme | **Cierto** — 13 FALLARON |
| "El severo: la rama `!deReservas` consulta `hayVuelos`, con su prueba" | Fixture propio (destino escrito + vuelo sin `to`) + **sabotaje**: le saqué el `d.hayVuelos ?` | **Cierto** — la línea dice *"los vuelos cargados no dicen adónde llegan, así que nada lo confirma"*, y el sabotaje da 2 FALLARON |
| "Ida y vuelta con hora de llegada ya no queda rotulada" | Fixture propio + gesto en Chromium | **Cierto** — `MAD (vuelo, 13 días ahí)`, sin la palabra "escala" y sin EZE |
| "El caso que define el éxito no se rompió" | Fixture de Europa **con** `end`, y tocando `#pk-build` | **Cierto** — `MAD (vuelo, 4 días ahí) · CDG (vuelo, 5 días ahí) · FCO (vuelo)`, con el aviso de multidestino intacto |
| "Se revisaron TODOS los fixtures contra los campos que la app escribe. El barrido no destapó nada más" | Le agregué `end` a los 19 fixtures de vuelo del archivo y corrí el arnés | **FALSO** — 1 FALLARON, en `SIN_ESCALA`. SEVERO 2 |
| "No se rotula nada: se dice cuánto se queda en cada lugar" | 22 fixtures propios construidos desde el formulario + 3 formas de viaje con tramo por tierra | **Falso como descripción**: dice cuánto falta para el próximo vuelo, salga de donde salga. BLOQUEANTE 1 |
| "El tiempo es un número que ya teníamos" | Lectura del diff: la versión anterior calculaba `horas` sólo si `encadena` | **Falso** — el número que había estaba condicionado; el nuevo no. Es otro número con el mismo nombre |
| "Ninguna fecha queda pelada porque los campos son `datetime-local`" | Los dos formularios en el HTML + prueba en Chromium de qué devuelve un `datetime-local` con `value="2027-04-02"` + `buildFlightPatch` | **Cierto.** El input devuelve `""` y `CAMPOS_COMPLETABLES` no incluye `start` ni `end` |
| "Los traslados tienen Desde, los alojamientos check-out, los autos devolución" | `grep` sobre todos los arneses y `app/pruebas/fixtures/` | **Cierto** — los únicos `transfer` sin `from` son respuestas del modelo, donde el contrato admite vacío |
| "`VALIJA_VERSION` está en 25 y no se publicó nada" | `grep -n VALIJA_VERSION` + recorrido del sello por los nueve commits de VAL-72 | **El sello es cierto (25). Que no se haya publicado, no verificado**: desde acá no se puede leer el Artifact. Y 25 lo comparten tres commits con tres líneas de destino distintas — MODERADO 6 |
| Árbol quieto | `git status --porcelain` vacío y `HEAD` en `64a7434` al empezar y al terminar | **Cierto** — no llegó ningún commit mientras se puntuaba |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **15** | Base 20: sustituto fiel —motor sacado del HTML que se publica, más un arnés de navegador que toca `#pk-build`— con la brecha del teléfono declarada en el commit y en el backlog, sin llamar "verificado" a nada. Y el método mejoró de verdad: el arnés nuevo falla 11 veces contra el build anterior, o sea que mide en vez de describir. Bajo 5 porque el sustituto volvió a dejar de ser fiel en el único lugar donde decidía: el fixture que sostiene la aserción del cambio de esta ronda sigue sin `end`, en el mismo archivo y en un bloque que este commit editó. Es la resta por "el simulador se escribió de memoria" aplicada al dato en vez de al simulador. |
| 2 | Diagnóstico de causa raíz | 15 | **9** | La causa del bloqueante de la ronda 5 está bien encontrada y es más profunda que las tres salidas que yo había propuesto: `encadena` es verdadero en todo itinerario ordenado, así que el error no era el umbral sino rotular. Y está probado que el arreglo la elimina —11 fallas contra el build anterior—. Eso es trabajo de 15. Baja porque el arreglo trajo montado un segundo cambio que el diagnóstico no pedía: dejar de exigir que encadenen para **calcular**. La segunda hipótesis —"¿el número sigue significando lo mismo sin la guarda?"— no se probó nunca, y la respuesta es que no. |
| 3 | Honestidad de lo verificado | 15 | **9** | Alta y la cuento a favor sin descuento: "NO probado en el teléfono del PM" escrito en el commit; el backlog dice sin adornos que los dos intentos propios fueron peores que el problema; se explica por qué el arnés no vio el defecto anterior en vez de taparlo; se toma la nota del auditor y se escribe en `CLAUDE.md` con la tabla de los cuatro defectos propios. Declarar una brecha nunca baja el puntaje y acá sube. Baja por una afirmación falsa y verificable —"el barrido no destapó nada más"—, por la premisa "el tiempo es un número que ya teníamos" que no se sostiene, y porque el cambio de comportamiento más consecuente del commit (sacar la guarda) no está declarado en ningún lado. |
| 4 | Cumplimiento del contrato | 15 | **7** | A favor, verificado uno por uno con fixtures propios y con sabotajes: las tres reglas de VAL-72 se cumplen —un vuelo manda, el multidestino manda todos, el destino escrito nunca queda contradicho—, el caso de Europa sigue nombrando las tres ciudades y avisando que es multidestino, la ida y vuelta ya no queda rotulada, y los tres bloqueantes anteriores resisten el sabotaje. En contra: la línea que esta historia existe para producir afirma un hecho falso sobre el viaje de la persona en cuanto hay un tramo por tierra o un pasaje abierto, y lo hace en la mitad que el prompt declara "lo que manda" mientras la verdad queda en la mitad que le pide dudar. No es una baja por el teléfono: se reproduce en Chromium tocando el botón. |
| 5 | Calidad interna | 15 | **8** | A favor, todo comprobado por mí y no por lectura: las dos copias son idénticas salvo el cierre del UMD y la nota de integración; los nueve arneses dan los números exactos que se afirman; cinco sabotajes sobre arreglos anteriores ponen el arnés en rojo; `cuantoTiempo` es chica, pura y documentada; el nombre interno `horasHastaElProximoVuelo` dice la verdad. En contra: el arnés no distingue la versión con guarda de la versión sin guarda —restauré `encadena` y quedó entero en verde—; la aserción que debía protegerla da un motivo que el código ya no implementa; el backlog describe un comportamiento que no existe; y el sello `25` lo comparten tres árboles con tres comportamientos distintos. |
| 6 | Diseño y decisiones de producto | 10 | **6** | La decisión es la correcta y está bien defendida: no rotular, dar el número, que decida el modelo, con el mismo criterio que ya se usa con las pistas y con el destino escrito. Descartar las tres salidas que le propuso la auditoría y encontrar una cuarta mejor es trabajo de producto de verdad, y está argumentado con lo que se descartó, que es lo que la rúbrica pide. Baja porque "informar en vez de decidir" exige que lo que se informa sea cierto, y la palabra "ahí" es una afirmación que el dato no respalda en cuanto los vuelos no encadenan. Y porque el aviso cierra con una frase que es falsa en las dos formas de viaje más comunes. |
| | **Total** | **100** | **54** | **NO PUBLICAR, ni como candidato.** Un defecto nuevo reproducible acá, tocando el control, más una afirmación de la entrega que pude falsificar. |

Diferencia con la ronda 5: +3. Los hallazgos anteriores se cerraron bien y con controles que yo pude
sabotear; lo que agrega el mismo commit vuelve a no recibir ese ataque.

---

## Lo que falta para llegar a 85, en orden

1. **Que el número salga sólo cuando los vuelos encadenan, o que diga de dónde sale el próximo vuelo.**
   Las dos salidas son defendibles y las dos son una línea:
   - **(a)** Volver a condicionar el cálculo: `var encadena = !!(sig && f.to && sig.from && norm(f.to) === norm(sig.from));`
     y `var horas = encadena ? hoursBetween(f.end, sig.start) : null;`. Cuando no encadena no se dice nada,
     que es el lado seguro y el que ya eligió esta función para todo lo demás.
   - **(b)** Dejar el cálculo y arreglar el texto: `MAD (vuelo, 11 días hasta el próximo vuelo, que sale de LIS)`.
     Informa más y no afirma nada falso.
   Sea cual sea, **va con su fixture**: `SIN_ESCALA` tiene que tener `end` en los dos vuelos y el caso del
   tramo por tierra tiene que existir en el arnés, que hoy no existe en ninguna forma.
2. **Arreglar el fixture antes que el código**, como en la ronda anterior y por el mismo motivo: con `end`
   puesto en `SIN_ESCALA`, el arnés muestra el bloqueante solo y el arreglo se valida contra él. Y la aserción
   tiene que dejar de dar un motivo —"porque no se encadenan"— que hoy no es cierto.
3. **Un control que distinga la versión con guarda de la versión sin guarda.** Hoy no existe: restaurar
   `encadena` deja todo en verde. Si el arreglo es (a), ése es su control negativo.
4. **Sacar o corregir la frase "El último de la lista no lo dice porque no hay vuelo después"**, que es falsa
   en la ida y vuelta y en el multidestino con regreso. Con su prueba: hoy ninguna la mira.
5. **Corregir el commit, el comentario y el backlog** para que digan que el número es el tiempo hasta el
   próximo vuelo y no el tiempo de estadía, y para que la salida de `encadena` quede declarada.
   Y sacar el `✅ entregada en v24` del encabezado de VAL-72 mientras siga bajo veto.
6. **Declarar los dos casos que no se van a resolver ahora**, en el backlog y no en la cabeza de nadie: las
   fechas invertidas que convierten tu casa en el destino, y la ciudad que aparece dos veces y se queda con
   el número de la primera. Los dos son anteriores a este commit y ninguno está escrito.
7. **Subir `VALIJA_VERSION` a 26** antes de publicar, o leer el Artifact y confirmar que no hay ningún v25
   arriba. Tres árboles con el mismo sello y tres líneas de destino distintas hacen que la captura del PM no
   sirva para identificar qué probó.
8. Recién entonces, publicar como candidato y pedirle al PM el guion de abajo.

Los puntos 1 a 5 son de minutos. Ninguno depende del teléfono.

---

## Lo que nadie puede verificar desde acá

Ninguno de estos puntos es una formalidad y esta sección no está vacía.

1. **Qué hace el modelo del teléfono con el número.** Todo lo que verifiqué termina en el texto que sale
   hacia el modelo. Que un modelo que lee `MAD (vuelo, 13 días ahí)` arme efectivamente una valija para trece
   días en Madrid —y no para una escala— no lo puede saber nadie en este entorno. **Pasos, una vez arreglado
   y publicado:** cargar la ida y vuelta a Madrid con "Llega" completo, tocar **Armar la lista**, y mirar si
   los ítems hablan de Madrid y de dos semanas.
2. **El caso del tramo por tierra, en el aparato.** Crear un viaje, cargar el vuelo a Madrid **con la hora de
   llegada**, un traslado Madrid→Lisboa a los dos días, y el vuelo de vuelta desde LIS. Tocar **Armar la
   lista**. Si la lista habla de trece días en Madrid y no menciona Lisboa, el BLOQUEANTE 1 llegó al usuario.
   Con el arreglo puesto, la línea no tiene que decir ningún número.
3. **Qué está publicado hoy.** El backlog dice `✅ entregada en v24`. Si v24 está arriba, el PM tiene en el
   teléfono la versión que las rondas 4 y 5 vetaron. Antes de pedirle cualquier prueba: leer el archivo que
   sirve el Artifact, buscar en él una cadena que exista sólo en la versión nueva —`" ahí)"` junto a
   `"cuánto tiempo pasa ahí antes del próximo vuelo"` sirve—, confirmar que el sello en pantalla coincide, y
   confirmar que el link compartido no está fijado a una versión anterior. Son cuatro `grep` y ninguno es una
   opinión.
4. **Dos preguntas al PM que cuestan un minuto cada una y ahorran una ronda.** (a) En sus viajes, ¿alguna vez
   se mueve entre ciudades sin vuelo —tren, micro, auto— y lo carga como traslado? De eso depende si el
   bloqueante ya le pasó o le va a pasar. (b) La de la ronda anterior, todavía sin respuesta: ¿escribe en el
   «hasta» de un traslado el nombre de la ciudad que también puso como destino del viaje?
5. **El visor del teléfono en sí.** Nada de esta ronda tocó DOM, permisos ni sandbox, así que la brecha no
   creció. Sigue entera, y es la única razón por la que la dimensión 1 no puede pasar de 20 desde acá.
6. **El número con otra zona horaria.** Este entorno corre en UTC y el teléfono del PM no. Hoy no encontré
   ningún camino que escriba una fecha sin hora, así que no hay defecto vivo — pero el cálculo es sensible a
   la zona y acá eso queda invisible por construcción.

---

## Sobre la regla nueva de `CLAUDE.md`: ¿ataca la causa o el síntoma?

Me lo preguntaron y la respuesta honesta es **las dos cosas a medias, y hay una prueba en este mismo commit**.

Contra los cuatro defectos de la tabla:

| Defecto | ¿Lo habría evitado? |
|---|---|
| El traslado arreglado y el alojamiento intacto | **Sí.** Es exactamente la pregunta 1 |
| La guarda sacada sin preguntar qué más protegía | **No.** La tabla lo nombra, pero ninguna de las tres preguntas lo cubre: las tres miran hacia adelante —casos vecinos, caso de éxito, fixtures— y ninguna pregunta qué condición se **sacó** |
| La escala marcando las tres ciudades de Europa | **Sí.** Es la pregunta 2, y de hecho el arnés ya lo había agarrado |
| La escala marcando el único destino de la ida y vuelta | **Sí.** Es la pregunta 3 |

Y contra el quinto, el de esta ronda: la regla **cubre el caso sobre el papel** —dice literalmente *"Si un
campo es opcional, tiene que haber un caso con y un caso sin"*, que obliga a una versión de `SIN_ESCALA` con
`end`— y **no lo evitó**. El mismo commit que escribió la regla hizo el barrido que la regla pide, lo
declaró completo, y dejó afuera el único fixture que importaba.

Eso es el diagnóstico: **la regla está escrita como disciplina para acordarse, y lo que falló las cinco veces
no fue la memoria, fue que nada obliga.** Las reglas de este proyecto que sí funcionan no piden acordarse:
`las-dos-copias` es un arnés, no un párrafo. Tres cosas que sí atacarían la causa:

1. **Una cuarta pregunta, la que falta:** *¿qué condición saqué, y qué caso la necesitaba?* Es la única que
   comparte el defecto 2 con el de esta ronda, y es la que no está.
2. **Un mecanismo en lugar de una promesa:** que el arnés corra cada fixture de vuelo dos veces, con y sin
   `end`, y falle si alguna aserción cambia de resultado sin estar declarada. El barrido a mano lo hizo una
   persona atenta y falló; esto no puede fallar por distracción. Los 19 fixtures ya están escritos: es un
   `forEach`.
3. **Un constructor de fixtures que salga del formulario.** Mientras un fixture se escriba campo por campo a
   mano, va a faltar un campo. Si sale de una función que conoce los campos de cada tipo de reserva, no puede.

Lo que la regla sí hace bien, y no es poco: **nombra el patrón y lo deja escrito con su factura**. Eso vale.
Lo que todavía no hace es impedirlo, y la evidencia de que no lo impide está en el commit que la introdujo.

---

## Cómo reproducir lo de arriba

Todo vive en el scratchpad de la sesión, fuera del repo, y nada tocó el árbol:

- `ataque6.js` — 22 fixtures sobre la línea de destino, construidos desde el formulario de `valija.html`:
  ida y vuelta, multidestino, escalas de 0,4 h a 200 días, horas negativas, fechas invertidas, `end` basura,
  `end` sólo en el primer vuelo, fecha pelada, duplicados.
- `ataque7.js` — las tres formas con tramo por tierra, corridas contra el HTML de hoy y contra el de
  `e793855` para separar lo nuevo de lo viejo.
- `gesto6.js` — Playwright: siembra el viaje en `localStorage`, abre `#/trip/t1/valija`, **toca `#pk-build`**
  y lee el prompt que recibió `sample.json()`. Es el gesto, no el evento.
- `val72_fix.js` / `val72_allend.js` — el arnés con `end` agregado a `SIN_ESCALA` y a los 19 fixtures de vuelo.
- `sab1..sab8.html` — ocho sabotajes sobre **copias** del HTML: el registro `vistos` compartido,
  `ordenConfiable`, el alojamiento en firme, `cuantoTiempo` en sus dos ramas, la restauración de `encadena`,
  y la rama `!deReservas`. Nunca sobre `app/valija.html`.
- `copias2.js` — extracción y `diff` byte a byte de las dos copias de cada motor.

## Nota sobre el árbol

Verificado quieto: `git status --porcelain` vacío y `HEAD` en `64a7434` al empezar y al terminar. No llegó
ningún commit encima mientras se puntuaba. No modifiqué ningún archivo del repo fuera de este documento.
