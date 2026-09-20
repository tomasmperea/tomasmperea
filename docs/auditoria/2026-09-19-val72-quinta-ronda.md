# Auditoría VAL-72 — quinta ronda ("una escala deja de ser un destino, con su duración a la vista")

**Commit auditado:** `e79385590ecb03b076c693105ebf923820212917` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío, `HEAD` en el mismo
hash al empezar y al terminar) · **Publicado:** no. `VALIJA_VERSION` está en `"25"`, que es un número nuevo.
Rondas anteriores: `2026-09-19-val72.md` (57), `-segunda-ronda.md` (51), `-tercera-ronda.md` (70),
`-cuarta-ronda.md` (59).

## Veredicto: NO PUBLICAR — 51/100

**No sale, ni como candidato.** El piso de 70 vale sólo cuando la única dimensión floja es la 1 por no poder
probar en el teléfono. Acá hay un defecto reproducible **en node y en un navegador de escritorio, tocando el
botón**, que no tiene nada que ver con el visor del teléfono.

Los dos bloqueantes de la cuarta ronda están **cerrados de verdad**: los reataqué desde cero con fixtures
nuevos y además saboteé cada arreglo para comprobar que su prueba se pone en rojo cuando el arreglo se
revierte. Los dos severos y los tres moderados también están atendidos, uno de ellos a medias. Eso es trabajo
real y está acreditado abajo.

Pero el commit que cierra la ronda **introdujo un defecto nuevo, y esta vez en el camino más transitado de la
app**: un viaje de ida y vuelta con la hora de llegada cargada le dice al modelo que su único destino es un
lugar donde se cambia de avión.

Es, por cuarta ronda consecutiva, la misma mecánica: el commit que viene a cerrar la auditoría rompe algo
nuevo. Y la pregunta que me pidieron atacar —"¿hay un viaje donde esto vuelva a dar mal?"— tiene respuesta, y
es peor que la que se anticipó.

---

## Los gestos del reporte, y qué prueba cubre cada uno

La auditoría arranca por el reporte del PM, no por el diff.

| Gesto con el que el PM vio el síntoma | Prueba que lo ejercita | Cubierto |
|---|---|---|
| Crear "Europa", cargar los vuelos a MAD/CDG/FCO, tocar **Armar la lista** | `val72-las-reservas-mandan.js` (motor sacado del HTML) + `valija-bloque-b.js` (navegador, toca `#pk-build`) | **Sólo con el fixture sin `end`.** Con la hora de llegada cargada, que es lo que la app escribe por su propio formulario, el caso no está cubierto y falla — ver BLOQUEANTE 1 |
| Viaje con destino escrito y reserva en el punto de partida | `val72` bloques `HOTEL_EN_ORIGEN` / `OTRAS` / los tres casos de colisión nuevos | Sí, reataqué con 15 fixtures propios |
| Cargar el viaje entero importando documentos, sin tipear nada (prueba que define el éxito de la iteración, `docs/briefs/interpretar.md`) | `importar-*.js`, `motores-desde-html.js` | El importador sí; **la lista que sale de un viaje importado, no** — y el importador llena `end`, que es el campo que dispara el bloqueante |

---

## Hallazgos vivos, por gravedad

### BLOQUEANTE 1 · Con la hora de llegada cargada, el destino del viaje pasa a ser "un lugar donde se cambia de avión"

El commit marca como escala todo par de vuelos encadenados cuya espera se pueda **medir**. La guarda elegida
es `medible = horas != null && horas > 0`. Medible no es lo mismo que corta, y nada más mira la duración.

Reproducido **tocando el botón** `#pk-build` en Chromium, con el `Store` de la app y leyendo el prompt que
efectivamente recibió `claude.use("sample").json()`
(`/tmp/.../scratchpad/gesto2.js`, adjunto al final):

Viaje "Madrid", dos vuelos, EZE→MAD y MAD→EZE. **El viaje más común que existe en esta app.**

| | Línea que recibe el modelo |
|---|---|
| **Sin** hora de llegada | `- Destinos, sacados de los vuelos ya cargados, que son lo que manda: MAD (vuelo). …` |
| **Con** hora de llegada | `- Destinos … : MAD (escala de 320 h). Los que dicen «escala» son lugares donde se cambia de avión: fijate en las horas antes de tratarlos como un destino, porque dos horas en el aeropuerto no piden nada y un día entero sí. …` |

El único destino del viaje queda descrito como una escala, y el prompt le pide explícitamente al modelo que
**dude de tratarlo como destino**. No hay ningún otro lugar en la lista al que pueda caer.

Y el caso que define el éxito de la historia, con el mismo gesto:

```
- Destinos … : MAD (escala de 101 h) · CDG (escala de 118 h) · FCO (vuelo). Es un viaje multidestino: …
  Los que dicen «escala» son lugares donde se cambia de avión: fijate en las horas …
```

Cinco días en Madrid y cinco en París, presentados como escalas. El aviso de multidestino sobrevive —eso se
cuidó y está bien— pero dos de las tres ciudades quedaron con el rótulo que el propio arnés declara como la
condición de fallo.

**No es un caso de borde. Es el caso por defecto.** `end` no es un campo exótico:

- `app/valija.html:8652` — el formulario manual de una reserva de vuelo tiene `<label for="i_end">Llega</label>`.
- `app/valija.html:9384` — la pantalla de revisar lo importado, lo mismo: `<label>Llega</label>`.
- `app/valija.html:4708` — al modelo del importador se le pide textual que lo llene: *"Si aparecen dos fechas
  con hora, una después de la otra, lo habitual es que la primera sea la salida y la segunda la llegada."*

O sea: **la prueba que define el éxito de la iteración en el brief** —"cargar un viaje entero, con vuelo,
alojamiento y auto, sin tipear ningún dato a mano"— pasa por el importador, el importador llena `end`, y ése
es exactamente el camino roto.

**Por qué el arnés no lo vio, y por qué eso es el hallazgo y no una casualidad.** El control que el commit
agregó es:

```js
ok(!/escala/.test(linea), "y sus tres ciudades no quedaron marcadas como escalas");
```

`linea` sale del fixture `VUELOS` del principio del archivo, que tiene `start` y **no tiene `end`**. El control
pasa porque al fixture le falta un campo que la app llena sola, no porque el código lo impida. Es palabra por
palabra la regla que este proyecto ya tiene escrita con factura pagada: *"un escenario que espera que todo
salga bien puede pasar porque el sabotaje no se aplicó"*. Acá el sabotaje es el dato real, y no llegó.

**Y el razonamiento que sostiene el arreglo no cierra.** El comentario del código y el backlog dicen, con las
mismas palabras: *"La diferencia real entre las dos cosas es **cuánto dura**, así que la marca se pone sólo
cuando la duración **se puede calcular**"*. La premisa pide usar la duración; la conclusión usa la
**mensurabilidad**, que es otra cosa. El propio arnés lo demuestra sin querer: su caso `PARADA_LARGA` de 98 h
—que el arnés llama "parada", no escala— y el Madrid real de 101 h reciben exactamente el mismo rótulo. Si el
criterio funcionara, esos dos casos tendrían que separarse, y no se separan.

Verificado además en el motor extraído del HTML (`/tmp/.../scratchpad/escala.js`, 14 fixtures):

| Fixture | Resultado |
|---|---|
| Europa EZE·MAD·CDG·FCO **sin** `end` | `MAD (vuelo) · CDG (vuelo) · FCO (vuelo)` — bien |
| Europa **con** `end` | `MAD (escala de 101 h) · CDG (escala de 118 h) · FCO (vuelo)` — **mal** |
| `end` sólo en el primero | `MAD (escala de 101 h) · CDG (vuelo) · FCO (vuelo)` — **mal** |
| Ida y vuelta simple con `end` | `MAD (escala de 320 h)`, único destino — **mal** |
| Ida y vuelta con alojamiento y `end` | igual — **mal** |
| Seis ciudades encadenadas, un día cada una | `A1 … A5` las cinco marcadas escala — **mal** |
| Escala corta real EZE·GRU·MAD, 2 h | `GRU (escala de 2 h) · MAD (vuelo)` — bien |
| Horas negativas (`end` posterior al `start` siguiente) | no se marca — bien, lado seguro |
| Horas exactamente 0 | no se marca — bien |
| `end` presente y siguiente sin `start` | no se marca — bien |
| `end` basura no parseable | no se marca — bien |
| Multidestino sin encadenar | ninguna marca, multidestino intacto — bien |

Las tres preguntas que me pidieron atacar tienen respuesta: **sí, un `end` cargado en un multidestino real lo
convierte en escala**; las **horas negativas y las fechas invertidas están bien resueltas** (caen del lado
seguro); y **tres vuelos con `end` sólo en el primero** marcan el primero y dejan bien los otros dos. El
problema no está en los bordes que se revisaron: está en el centro.

**Qué no es este hallazgo.** No es que la idea esté mal. Informar en vez de decidir, y no inventar un umbral
de horas, es el criterio correcto y está bien argumentado. Lo que informa hoy no es un dato: es una categoría
(`escala`) aplicada a algo que no lo es, en la línea que le dice al modelo cuál es el destino del viaje.

### SEVERO 2 · La otra mitad de la línea sigue afirmando lo que no mira

El punto 2 de "lo que falta para 85" de la cuarta ronda decía: *"'no hay vuelos cargados' tiene que salir de
si hay ítems `type:'flight'`"*. Se arregló **una** de las dos ramas que dicen esa frase.

`app/parts/packing-engine.js:1909-1913` (idéntico en el HTML):

```js
if (!d.deReservas) {
  return "- Destino: " + partes.join(", ") +
         ". Lo escribió la persona al crear el viaje; no hay ningún vuelo cargado que lo confirme." +
         lineaPistas;
}
```

`d.hayVuelos` existe, está calculado, y se usa ocho líneas más arriba en la rama hermana. Acá no se consulta.

Reproducido con dos fixtures propios:

```js
trip  = { destination:"Bariloche" }
items = [ { type:"flight", from:"EZE", to:"", start:"2027-04-01" }, { type:"transfer", to:"Bariloche" } ]
```

→ `hayVuelos = true`, y la línea dice **"no hay ningún vuelo cargado que lo confirme"**. Falso.

La consecuencia es menor que la del bloqueante —el destino escrito gana, que es lo correcto— pero es la misma
afirmación sin respaldo que esta ronda vino a sacar, viva a ocho líneas de donde se sacó. Y el reporte afirma
"cada mitad sale ahora de su dato", que es cierto para una rama y falso para la otra.

### MODERADO 3 · El backlog y el comentario describen un criterio que el código no implementa

Los dos dicen que la marca se pone "sólo cuando la duración se puede calcular" y presentan eso como lo que
separa una escala de una parada. No lo separa (ver BLOQUEANTE 1). Es la trampa 4 de mi encargo —la
documentación que quedó describiendo otra cosa— en su versión más difícil de ver: no quedó vieja, nació
describiendo una intención en lugar del comportamiento.

Tampoco está declarado en ningún lado qué pasa **con** `end` cargado. `grep -rn "escala" docs/` no devuelve
una sola línea sobre eso.

### Observaciones (no cuentan para el puntaje)

- La definición de escala que reusa el commit es la que ya estaba en `summarizeReservationsForAI`
  (`packing-engine.js:1798-1804`). Lo verifiqué y el commit dice la verdad cuando afirma que es la misma
  regla. Lo que cambió es dónde se usa: ahí era un ítem más de una lista de detalle, acá reemplaza la
  identidad del destino en la línea que manda.
- `act` (actividad) sigue sin participar ni como destino ni como pista, igual que en las rondas 3 y 4.
- Ningún fixture de los 30 que tiré tiró una excepción: `trip` nulo, `items` nulo, `items` con `null` adentro,
  `destination` numérico, `end` basura. La función es robusta a datos rotos.
- `valija-bloque-b.js` me dio **106/3 en la primera corrida** (timeout de 30 s de un `locator.innerText`) y
  111/0 en las tres siguientes. Es el arnés inestable de VAL-73, ya medido y declarado. No lo cuento en
  contra; lo dejo anotado porque la afirmación "111 en verde" fue cierta en 3 de mis 4 corridas.

---

## Afirmaciones verificadas

| Afirmación de la entrega | Cómo la verifiqué | Resultado |
|---|---|---|
| Los nueve arneses en verde, con sus números | Corridos uno por uno, `NODE_PATH=/opt/node22/lib/node_modules`, ruta absoluta del HTML | **Cierto** para ocho, con los números exactos (`motores-desde-html` 68+101+39, `hallazgos-qa` 31, `tier` 42). `valija-bloque-b`: 111 en 3 de 4 corridas, 106/3 en una, por el timeout ya declarado de VAL-73 |
| "Una pista ya no borra el destino escrito", en las tres variantes | Reataque desde cero con 15 fixtures propios: traslado / auto / alojamiento con el mismo texto, acento, mayúscula, espacios, tres pistas iguales a la vez, `são paulo` vs `Sao Paulo`, destino numérico, destino sólo espacios | **Cierto**, en los 15. `lugares` nunca quedó vacío con un destino escrito vivo |
| "Y una pista DISTINTA se sigue mandando" | Fixture propio con `Villa La Angostura` y con hotel+traslado en el origen | **Cierto** — la pista sale con sus fechas y su advertencia |
| El arreglo del bloqueante 1 tiene un control que puede fallar | **Sabotaje propio**: devolví el destino escrito al registro compartido, sólo en el HTML | **Cierto** — 6 FALLARON |
| "El vuelo de vuelta sin `start` ya no se come el destino" | Fixtures propios: `start:""`, `start:"   "`, `start:null`, sin la clave, ida sin fecha, las dos sin fecha, vuelta a mitad de viaje, primer vuelo sin `from`, sólo el vuelo de vuelta | **Cierto** en todos. MAD nunca se pierde |
| "Con las dos fechas puestas el descarte sigue funcionando" | Fixture propio + **sabotaje**: volví `casa` a `vuelos.length > 1` sólo en el HTML | **Cierto** — el control da 2 FALLARON |
| "El `@returns` nombra `pistas` y `hayVuelos` y no dice «en orden de firmeza»" | `grep -n "orden de firmeza"` en `valija.html`, `packing-engine.js` y `docs/` | **Cierto** — cero ocurrencias; el `@returns` documenta los cuatro campos |
| "`lineaDestinos` tiene la guarda `(d && d.pistas \|\| [])` y hay prueba" | Leído el código + **sabotaje**: quité el `d &&` sólo en el HTML | **Cierto** — el arnés da 1 FALLARON con la guarda quitada |
| "Cada mitad de la frase sale ahora de su dato" | Fixtures propios con un vuelo cargado sin `to`, con y sin destino escrito | **Cierto para la rama sin destinos, FALSO para la rama del destino escrito** — SEVERO 2 |
| "`las-dos-copias` compara la cabecera ENTERA y los tres sabotajes son su control" | Corrí **seis** sabotajes: los tres declarados (tope, número dentro de un comentario, constantes dadas vuelta) más tres míos (comentario **dentro** de una función, línea del `@returns`, la lógica de `medible`) | **Cierto, y hace más de lo que dice**: los seis dan FALLA, el árbol limpio da 0. La afirmación que falsifiqué en la ronda 4 ya no está |
| "Las dos copias del motor son idénticas" | Comparación propia: extraje los dos cuerpos del HTML y los dos de `parts/`, `diff -u` | **Cierto** — 8 líneas de diff en packing (el `});` del UMD) y 35 en adjuntos (el UMD + la nota de integración), nada más |
| "`VALIJA_VERSION` pasó a `25` con la regla escrita al lado" | `grep -n VALIJA_VERSION app/valija.html` y lectura del comentario | **Cierto** — `"25"`, y la regla ("antes de publicar se sube; si lo que está arriba ya tiene este número, no se publica encima") está escrita en el bloque de arriba |
| "Se marca que es escala, se dan las horas, y no hay umbral inventado" | Lectura del código + 14 fixtures | **Cierto que no hay umbral.** Y ése es el problema: sin umbral ni ningún otro criterio de duración, la marca cae sobre destinos reales — BLOQUEANTE 1 |
| "La marca se pone sólo cuando la duración se puede calcular" | Fixtures con `end` cargado | **Cierto como descripción del código, falso como criterio**: separar medible de no medible no separa una escala de una parada |
| "El caso que define el éxito de la historia no se rompió" | Reproducido **tocando `#pk-build`** en Chromium, con y sin `end` | **Cierto sin `end`, FALSO con `end`** — BLOQUEANTE 1 |
| "Ninguna reserva en el punto de partida desplaza el destino escrito" | Reataque desde cero, sin mirar la ronda anterior | **Cierto** — no encontré ningún camino |
| "No se publicó nada" | `grep VALIJA_VERSION` → `"25"`, número nuevo, y el commit no publica | **Cierto** |
| Árbol quieto | `git status --porcelain` vacío y `HEAD` en `e793855` al empezar y al terminar | **Cierto** |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **14** | Base 20: sustituto fiel —motor sacado del HTML publicado, más arneses de navegador que tocan los controles— con la brecha del teléfono declarada en el commit y en el backlog, sin usar "verificado" de más ni una vez. Bajo 6 porque el sustituto dejó de ser fiel justo donde decide: el fixture que certifica el caso que define el éxito omite `end`, un campo que el formulario de la app pide con la etiqueta "Llega" y que el importador tiene instrucción explícita de llenar. Es la versión parcial de la resta por "el simulador se escribió de memoria en vez de leyendo el contrato": el dato de prueba contradice el dato que la app escribe. |
| 2 | Diagnóstico de causa raíz | 15 | **8** | Los dos bloqueantes de la ronda anterior: reproducidos, causa identificada correctamente (el registro `vistos` compartido; el orden por fecha que un vuelo sin fecha rompe) y arreglo probado con control que yo mismo saboteé. Eso es trabajo de 15. Baja por el defecto nuevo: el razonamiento que lo sostiene es un salto —"la diferencia es cuánto dura, así que se marca cuando se puede medir"— y la segunda hipótesis, que encadenar más medir tampoco distingue un destino de una escala, no se probó nunca. El control que la habría destapado pasó por un fixture incompleto. |
| 3 | Honestidad de lo verificado | 15 | **10** | Alta, y la cuento a favor sin descuento: el commit dice "NO probado en el teléfono del PM", el backlog escribe sin adornos que la primera versión de la marca rompió el caso que define el éxito, el alcance del descarte sin fechas está declarado, la regla del sello quedó escrita, y el encargo me pidió atacar justo la decisión más frágil en vez de defenderla. Declarar una brecha nunca baja el puntaje y acá sube. Baja por dos afirmaciones sin respaldo: "cada mitad sale ahora de su dato", cierta en una rama y falsa en la otra; y el criterio de la escala presentado como resuelto sin decir qué pasa con `end` cargado, que es el caso frecuente. |
| 4 | Cumplimiento del contrato | 15 | **6** | A favor, verificado uno por uno: la jerarquía "las reservas mandan" se sostiene, el multidestino a Europa sigue nombrando las tres ciudades y sigue avisando que es multidestino, y los dos criterios que agregaron las auditorías 1 y 2 —el destino escrito sobrevive a cualquier reserva— se cumplen en los 15 fixtures con los que los reataqué. En contra: el viaje de ida y vuelta, que es la forma más común de todas, le entrega al modelo su único destino rotulado como lugar de trasbordo y con la instrucción de dudar de él; y el camino que el brief define como la prueba de éxito de la iteración —cargar todo importando, sin tipear— es justamente el que llena `end`. No es una baja por el teléfono: se reproduce tocando el botón en un navegador de escritorio. |
| 5 | Calidad interna | 15 | **8** | A favor, todo verificado por mi cuenta y no por lectura: las dos copias son idénticas salvo el UMD; `las-dos-copias` ahora atrapa los seis sabotajes que le tiré, tres de ellos nuevos, y su comentario ya no promete de más; los tres arreglos de la ronda anterior tienen control que se pone en rojo cuando reviero el arreglo; el `@returns` quedó bien en las dos copias; el sello subió con su regla al lado. En contra: el control del caso decisivo pasa por omisión del fixture, que es el patrón que este proyecto tiene documentado como causa de un falso verde; una afirmación falsa sobrevive a ocho líneas de donde se sacó su gemela; y el backlog describe un criterio que el código no implementa. |
| 6 | Diseño y decisiones de producto | 10 | **5** | El principio es el correcto y está bien defendido: informar en vez de decidir, sin umbral de horas inventado, porque dónde está el corte es una opinión. Y preservar el aviso de multidestino cuando hay escalas fue la decisión acertada, tomada después de romperlo y documentada. Baja porque la implementación decide igual, y con la palabra más cargada que hay: "escala" no es un dato, es una categoría, y se la aplica a cualquier par encadenado con espera medible, incluidas las 320 horas que una persona pasa en Madrid. La línea que resulta le pide al modelo que dude del único destino del viaje. Cuando no se puede distinguir, corresponde dar el dato crudo —llegás el 2, salís el 15— y no ponerle nombre. |
| | **Total** | **100** | **51** | **NO PUBLICAR, y tampoco como candidato.** Un bloqueante reproducible en node y en navegador de escritorio, tocando el control, sobre la forma de viaje más común de la app. |

Nota de proceso: es la cuarta ronda seguida en que el commit que cierra la auditoría introduce un defecto
nuevo. Los hallazgos anteriores se cierran bien —esta vez con controles que yo pude sabotear, que es lo que
faltaba antes—, pero lo que se agrega encima no recibe el mismo ataque que lo que se arregla. El fixture del
caso decisivo lo muestra: se lo escribió una vez, hace varias rondas, y nadie volvió a preguntarle si todavía
se parecía a lo que la app escribe.

---

## Lo que falta para llegar a 85, en orden

1. **Que el rótulo de escala no caiga sobre un destino real.** Hay tres salidas y las tres son defendibles;
   lo que no se puede es dejar la de ahora:
   - **(a) No rotular.** Dar el dato crudo en la línea —`MAD (vuelo, llegás 2/4 04:00, salís 6/4 09:00)`— y
     que el modelo saque la conclusión. Es el criterio que la función ya aplica a las pistas, y no exige
     decidir nada.
   - **(b) Rotular con un umbral, y decir que es una convención.** Un corte explícito (24 h, el que sea),
     escrito como decisión de producto con su porqué, no es un umbral "inventado": es una convención
     declarada, que es distinto de una opinión escondida.
   - **(c) Usar un dato que ya está.** Si hay un alojamiento con fechas que se solapan con la espera, no es
     una escala. La app ya tiene ese dato.
   **Sea cual sea, el fixture del caso de Europa tiene que llevar `end`**, porque la app lo llena.
2. **Arreglar el fixture antes que el código.** `VUELOS` en `val72-las-reservas-mandan.js` tiene que tener
   `end` en los tres vuelos, y el control `ok(!/escala/.test(linea), …)` tiene que poder fallar. Si se hace
   primero eso, el arnés muestra el bloqueante solo y el arreglo se valida contra él.
3. **Un caso nuevo en el arnés para el viaje de ida y vuelta con `end`**, que hoy no existe en ninguna forma.
   Es la forma de viaje más común y no está cubierta.
4. **La rama `!d.deReservas` de `lineaDestinos`**, que tiene que consultar `d.hayVuelos` como ya hace su
   hermana. Con su prueba: destino escrito + un vuelo cargado sin `to`.
5. **Corregir el backlog y el comentario del código** para que digan lo que el código hace, no lo que se quiso
   que hiciera. Si queda algún caso donde el rótulo puede caer mal, va declarado.
6. **Revisar el fixture de cada control que declara un caso de éxito**, no sólo el de Europa, contra los
   campos que la app efectivamente escribe. El patrón que falló acá puede estar en otros.
7. Recién entonces, publicar como candidato y pedirle al PM el guion de abajo.

Los puntos 2 a 4 son de minutos. El 1 es una decisión de producto que hay que tomar antes de escribir código,
no mientras.

---

## Lo que nadie puede verificar desde acá

Esta sección no está vacía y ninguno de sus puntos es una formalidad.

1. **Qué hace el modelo del teléfono con la palabra "escala".** Todo lo que verifiqué termina en el texto que
   sale hacia el modelo. Que un modelo que lee "MAD (escala de 320 h)" en la línea del destino termine
   armando una valija para Madrid igual, o no, no lo puede saber nadie en este entorno. Esto **no** salva el
   bloqueante —la línea afirma algo falso sobre el viaje de la persona, y eso se corrige acá— pero sí es la
   única forma de medir cuánto daño hace. **Pasos:** una vez arreglado y publicado, cargar el viaje a Madrid
   con "Llega" completo, tocar **Armar la lista** y mirar si los ítems hablan de Madrid.
2. **El caso que define el éxito, en el aparato.** Crear "Europa", cargar los tres vuelos **con la hora de
   llegada**, tocar **Armar la lista**, y mirar si los ítems nombran Madrid, París y Roma o siguen hablando
   de "Europa" en genérico. Con la hora de llegada, subrayado: sin ella se está probando otro código.
3. **Una pregunta al PM que cuesta un minuto y ahorra una ronda.** Cuando carga un vuelo, ¿completa el campo
   "Llega", o lo deja vacío? De eso depende si el bloqueante ya le pasó o le va a pasar. Y la segunda, que
   sigue abierta de la ronda anterior: ¿alguna vez escribe en el «hasta» de un traslado sólo el nombre de la
   ciudad que también puso como destino del viaje?
4. **Cuál build está probando.** `VALIJA_VERSION` está en `"25"` y es un número que no estuvo en ningún árbol
   anterior, así que esta vez el sello sirve. Antes de pedirle una ronda: leer el archivo que sirve el
   Artifact, buscar en él una cadena que exista sólo en esta versión (`"los vuelos cargados no dicen adónde
   llegan"` sirve), confirmar que el sello en pantalla dice v25 y que el link compartido no está fijado a una
   versión anterior. Son cuatro `grep`, ninguno es una opinión.
5. **El visor del teléfono en sí.** Nada de esta ronda tocó DOM, permisos ni sandbox, así que la brecha no
   creció. Sigue entera, y es la única razón por la que la dimensión 1 no puede pasar de 20 desde acá.

---

## Cómo reproducir lo de arriba

Los tres scripts que escribí para esta auditoría viven en el scratchpad de la sesión, fuera del repo, y no
tocan nada del árbol:

- `ataque.js` — 26 fixtures sobre los dos bloqueantes de la ronda 4, reatacados desde cero.
- `escala.js` — 14 fixtures sobre la marca de escala, incluidos los de ida y vuelta con `end`.
- `gesto.js` / `gesto2.js` — Playwright: siembra el viaje en `localStorage`, abre `#/trip/t1/valija`,
  **toca `#pk-build`** y lee el prompt que recibió `sample.json()`. Es el gesto, no el evento.

Los seis sabotajes de `las-dos-copias` y los tres de los arneses de VAL-72 se aplicaron sobre copias del HTML
en el scratchpad, nunca sobre `app/valija.html`.

## Nota sobre el árbol

Verificado quieto: `git status --porcelain` vacío y `HEAD` en `e793855` al empezar y al terminar. No llegó
ningún commit encima mientras se puntuaba. No modifiqué ningún archivo del repo fuera de este documento.
