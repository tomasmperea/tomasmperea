# Auditoría VAL-72 — tercera ronda de confirmación, sobre `4ee1935` (v30)

**Commit auditado:** `4ee1935b378cf8ace1550cca3156f68bc6772e5a` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío antes y
después de auditar, sin tocar nada; `HEAD=4ee1935`). **Delta puntuado:** `06f7d25..4ee1935`.
Ronda anterior: **46/100 · NO PUBLICAR.**

## Veredicto: **NO PUBLICAR — 84/100**

Sube de 46 a 84. El hallazgo central de la ronda anterior —seis tipos de reserva, no cinco;
`type:"note"` nunca llegaba al modelo; y la tercera afirmación falsa, "cuatro de los cinco"— está
cerrado, verificado por mí antes de tocar nada, y cerrado bien: no con un sexto `filter` (que habría
dejado caer al séptimo) sino con una rama genérica que manda cualquier tipo sin bloque propio, y un
arnés que dejó de tener su propia lista de tipos a mano.

**No llega a 85, y no es por el teléfono.** Ataqué las tres cosas que se me pidió atacar con
desconfianza, y la tercera —"¿queda algún otro lugar del código con una lista de tipos escrita a
mano que pueda quedarse corta igual?"— volvió a encontrar algo, la cuarta vez que se pregunta y la
cuarta vez que aparece: `describeReservation` (packing-engine.js:2477) tiene su propio diccionario
de etiquetas por tipo, hoy sin `transfer` ni `note`, y es alcanzable con datos reales de hoy, no
sólo en teoría (§3.3). Además, la rama genérica que cierra esta ronda protege con `yaResumidos`,
que es exactamente el mismo patrón de lista escrita a mano que el commit dice haber erradicado —
sólo que ahora, si se desincroniza, el síntoma no es que algo desaparezca sino que se **duplica**
(§3.1). Los dos son defectos de calidad interna y de diseño, no de falta de teléfono, así que la
excepción de 70 puntos para "candidato" no aplica acá — la rúbrica es explícita en que esa excepción
vale **sólo** cuando lo único flojo es la dimensión 1.

---

## 1 · El hallazgo central de la ronda anterior — verificado antes de tocar nada

| # | Afirmación de la entrega | Cómo lo verifiqué | Resultado |
|---|---|---|---|
| 1 | La app tiene 6 tipos de reserva, no 5 | `grep -n "TYPES = {" -A8 app/valija.html` (línea 936): `flight, stay, car, transfer, act, note` | **Cierto** |
| 2 | `type:"note"` no llegaba al resumen que ve el modelo | Reproduje contra `06f7d25` (commit anterior): armé una nota sola con `pe.summarizeReservationsForAI(EUROPA, [nota])` → `[]`, y `destinationPrompt` decía "(todavía no hay reservas cargadas)" | **Cierto, reproducido en el commit viejo** |
| 3 | El arreglo no es un sexto `filter` sino una rama genérica que cubre cualquier tipo sin bloque propio | Lectura de `packing-engine.js:1860-1882` (idéntica en `app/parts/` y en el HTML, ver §2) | **Cierto, y lo até con un tipo inventado (`crucero`) que el motor no conoce** — ver §3 |
| 4 | El arnés dejó de tener su lista de tipos a mano y ahora la lee de `TYPES` | `git show 4ee1935 -- app/pruebas/val72-las-reservas-mandan.js`: `TIPOS_DE_LA_APP` sale de parsear `const TYPES = {...}` del HTML, y `sinCubrir` compara contra `LEE` | **Cierto** |
| 5 | El número falso ("cuatro de los cinco") se sacó, no se corrigió | `docs/design/packing-engine.md` diff: el párrafo viejo se reemplaza por texto sin ningún conteo escrito a mano, más una nota explícita de por qué se sacó | **Cierto** |

## 2 · Las nueve corridas declaradas en verde — todas corrí, todas coinciden

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/las-dos-copias.js               → verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val72-las-reservas-mandan.js    → verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/motores-desde-html.js           → 39 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/valija-bloque-b.js              → 111 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/hallazgos-qa-bloque-b.js        → 31 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js              → 42 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val63-cambia-el-viaje.js        → verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val74-sin-tope-de-ocho.js       → verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/el-script-parsea.js             → verde
```

(El "39 + 69 del motor suelto" del mensaje de commit: `motores-desde-html.js` corre contra el motor
embebido en el HTML y da 39; no corrí por separado un segundo conteo de 69 porque el arnés no lo
expone como corrida independiente. No lo cuento como falso — es una cifra de otra suite que no vive
en un comando propio — pero lo anoto como **no verificado por mí**, no como confirmado.)

**Las dos copias del motor**, con `las-dos-copias.js`: cabecera idéntica, 68 funciones comparadas,
0 divergencias reales (la única "de más" es `clearNewFlags`, que el propio arnés explica como cola
del UMD que no va al HTML). El control de sabotaje sobre `recortar` lo detecta. Confirma la
afirmación de que `app/parts/packing-engine.js` y el motor embebido en `valija.html` son bytes
idénticos donde importa.

## 3 · Las tres cosas que se me pidió atacar con desconfianza

### 3.1 · La rama genérica: ¿duplica, filtra mal, o el saneo no la cubre de verdad?

**El saneo sí la cubre, y lo comprobé rompiéndolo, no leyéndolo.** Reemplacé el cuerpo de
`sanitizeNotesForAI` por una versión que no redacta nada, en una copia del HTML, y corrí
`summarizeReservationsForAI` sobre una nota con un número de tarjeta:

```
sabotaje aplicado: sanitizeNotesForAI ya no redacta nada
[{"tipo":"note","fecha":"","titulo":"Pagar","notas":"tarjeta 4111 1111 1111 1111"}]
CON SABOTAJE: el numero de tarjeta SE FILTRA
```

Sin el sabotaje, la prueba `el camino nuevo pasa por el mismo saneo que los otros cinco` pasa
porque el número no aparece. Con el sabotaje, aparece. La aserción depende de verdad del saneo:
control válido.

**No manda campos sensibles ni el objeto entero.** Leí la rama genérica (`packing-engine.js:1876-1882`):
arma un objeto nuevo con sólo `tipo`, `fecha`, `titulo` y `notas` saneadas — nunca pasa `x` entero
ni lee `confirmation`, `phone` ni `address`. No hay filtración de forma por ese lado.

**Pero SÍ puede duplicar, si el código alrededor se desincroniza — y esto no lo prueba el arnés.**
La rama genérica se protege con:

```js
var yaResumidos = { flight:true, stay:true, car:true, transfer:true, act:true };
```

Esta lista es, en sí misma, el mismo patrón que el commit dice haber dejado atrás: una lista de
tipos escrita a mano, mantenida en un lugar distinto de donde se declaran los bloques propios (los
cinco `.filter(i => i.type === "...")` de arriba). Hoy coincide con esos cinco, así que no hay
duplicación. Pero si mañana alguien agrega un séptimo tipo con su propio bloque (como se hizo con
`transfer` en la ronda 2, o como se haría con cualquier tipo nuevo) y **se olvida de sumarlo acá**
—que es exactamente el error que esta historia cometió tres veces con listas de tipos—, el resultado
no es que el tipo desaparezca: es que **aparece dos veces**. Lo comprobé sacando `act` de
`yaResumidos` en una copia y dejando su bloque propio intacto:

```
sabotaje aplicado: 'act' sacado de yaResumidos
[{"tipo":"actividad", ...},{"tipo":"act", ...}]
DUPLICADO: la actividad aparece dos veces
```

El arnés no tiene ningún caso que ejercite esto — ninguna prueba falla si `yaResumidos` se
desincroniza de los bloques propios. Es un riesgo latente, no un defecto vivo hoy (los seis tipos
actuales están cubiertos), pero es la misma clase de fragilidad que motivó todo este round, ahora
un nivel más adentro del código en vez de resuelta.

### 3.2 · La lectura de `TYPES` desde el HTML: ¿rompe con un formato distinto, y ruidoso o silencioso?

Reformateé `TYPES` en una copia del HTML poniendo `label:` en una línea aparte para `flight` (JS
igual de válido, formato distinto):

```
FALLA la app declara 5 tipos de reserva: stay, car, transfer, act, note
...
1 FALLARON
```
`process.exit(1)` confirmado por separado (sin pipe, para no medir el exit code de `tail`).

**Falla ruidosamente, no pasa en verde con cero tipos.** La aserción `TIPOS_DE_LA_APP.length >= 6`
es la que lo atrapa. Es un mecanismo frágil ante reformateos (depende de que la clave y `{label:`
estén en la misma línea), pero el punto que importaba —¿se puede colar un formato distinto sin que
nadie se entere?— tiene respuesta: no, se entera.

### 3.3 · ¿Queda otro lugar con una lista de tipos a mano que se quede corta igual?

Sí, y no es teórico. Busqué objetos con las mismas seis claves (`grep -n '{ *flight *:'`) y aparecen
sólo dos en `packing-engine.js`: `yaResumidos` (§3.1) y esto, sin tocar en este commit:

```js
// línea 2477
var LABEL = { flight:"el vuelo", stay:"el alojamiento", car:"el auto", act:"la actividad" };
```

Le faltan `transfer` y `note` — los mismos dos tipos que costaron esta historia. La usa
`describeReservation`, que cita la reserva que motivó un ítem nuevo en `explainNewItem`. Con un
tipo sin entrada, cae al genérico `"la reserva"` en vez de decir "el traslado" o "la nota".

No es sólo alcanzable en teoría: `findFactSource` resuelve algunos hechos (`hasWaterActivity`,
`hasWorkActivity`, `hasTrekking`, `hasSnow`) **sin filtrar por tipo**, buscando la palabra clave en
el título/notas/proveedor de cualquier ítem del viaje. Una nota que diga "llevar aletas, vamos a
hacer snorkel" o un traslado cuyas notas mencionen una palabra de `WORK_RE` puede ser la fuente que
cita `describeReservation`, y hoy diría "la reserva" en vez de "la nota" o "el traslado". Es un
defecto real, pre-existente (no lo introdujo este commit) y de severidad baja —degrada a un texto
genérico, no pierde datos ni los manda mal—, pero es la cuarta vez que se pide exactamente esta
pregunta y la cuarta vez que aparece algo. No lo tocó esta ronda.

## 4 · El caso de éxito de la propia historia, después del arreglo

Corrí `val72-las-reservas-mandan.js` completo (no sólo el bloque nuevo): el multidestino a Europa
sigue dando MAD/CDG/FCO, Bariloche con traslado en el origen sigue sugiriendo para Bariloche, la
jerarquía tipo-de-viaje sigue funcionando, y los dos casos de ida y vuelta siguen sin agregar la
casa como destino. Nada de lo que esta ronda tocó rompió el caso que la historia vino a resolver.

## 5 · Documentación y coordinación

- `docs/design/packing-engine.md`: el párrafo viejo con el conteo falso se reemplazó por texto que
  no tiene ningún número escrito a mano y explica por qué se sacó. Coincide con lo que el código
  hace hoy. Verificado leyendo el diff completo, no sólo el resumen del commit.
- `docs/backlog.md`: agrega la tabla de las dos veces que se repitió el mismo error en esta
  historia (arreglar un cajón sin mirar el vecino). Es exacta: coincide con los commits `4bf6d7d`
  (ronda 2, traslado sí / alojamiento no) y `06f7d25` (confirmación, traslado sí / nota no).
- Un archivo, un dueño: el commit sólo toca `packing-engine.js`, su copia en `valija.html`, el
  arnés de VAL-72, y los dos documentos de esta historia. Nada de `docs/` en bloque, nada de otro
  agente pisado. `git status` antes y después, limpio.

## 6 · Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntos | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Todo se probó en Node, contra el motor extraído del HTML (verificado byte-idéntico). Es el sustituto más fiel disponible para una función pura sin DOM ni gesto, y la brecha está declarada sin adornos: "NO probado en el teléfono del PM". No hay nada publicado todavía que probar (sigue siendo v23, §7). |
| 2 | Diagnóstico de causa raíz | 15 | **15** | Reprodujo el síntoma contra el commit anterior, identificó la causa exacta (rama sin cubrir, no un caso puntual) y probó que el arreglo la elimina con un tipo que el motor no conoce (`crucero`), que es justo lo que distingue una causa de una instancia. |
| 3 | Honestidad de lo verificado | 15 | **15** | Retracta explícitamente la afirmación falsa de la ronda anterior, dice por qué era falsa, declara sin rodeos qué no se probó. Nada mezclado con lo verificado. |
| 4 | Cumplimiento del contrato | 15 | **15** | Los criterios de aceptación originales de VAL-72 (jerarquía de destino, multidestino, no-regresión de Bariloche) siguen cumpliéndose, reverificados por mí. El hallazgo que cierra esta ronda no era un criterio de aceptación incumplido sino un hallazgo de auditoría, y se cerró. |
| 5 | Calidad interna | 15 | **10** | Pruebas reales (verificadas con sabotaje), docs consistentes, un archivo un dueño. Pero el propio arreglo reintroduce el patrón que dice haber erradicado (`yaResumidos`, con riesgo de duplicación silenciosa si se desincroniza) y dejó sin tocar una segunda instancia real y alcanzable del mismo defecto (`describeReservation.LABEL`), pese a que se pidió explícitamente barrer la clase. |
| 6 | Diseño y decisiones de producto | 10 | **9** | La decisión de sacar el número falso en vez de "corregirlo", y de resolver con una rama genérica en vez de un sexto `filter`, está bien argumentada y con el trade-off explícito. Resta 1 porque el propio título del commit reclama "el arreglo de clase, no el de instancia" y la clase queda barrida a medias (§3.3). |

**Total: 84/100.**

### Por qué no aplica el piso de 70 (candidato)

La rúbrica es explícita: el piso de 70 vale **"sólo si lo único flojo es la dimensión 1"**, y
cualquier baja por un motivo que no sea la falta de entorno real la anula. Acá bajan también la 5 y
la 6, y las dos por motivos que no tienen nada que ver con el teléfono: una lista de tipos a mano
reintroducida en el propio arreglo, y una segunda instancia real del defecto que la historia entera
viene persiguiendo. Así que esto no es "candidato a 70": es **NO PUBLICAR**, sin la salida de
70 puntos, hasta que se cierren esos dos puntos.

---

## 7 · Lo publicado, y lo que no pude verificar yo mismo

El reportero afirma que lo publicado sigue siendo v23, sin VAL-72 ni el arreglo de esta ronda, leído
del archivo que sirve el Artifact. **No pude reproducir esa lectura desde acá.** Intenté:

```
curl -s "https://claude.ai/code/artifact/136a6d7e-9952-4edb-b6d3-11f6e69c8cb4" | grep VALIJA_VERSION
```

y sólo obtuve el shell genérico de la SPA de claude.ai (21.764 bytes, sin ningún `VALIJA_VERSION`
ni marca del código de la app): no es el archivo servido, es la página contenedora. El método de los
cuatro `grep` que el proyecto exige para confirmar "publicado" necesita leer el contenido real que
sirve el Artifact, y este entorno no me da esa lectura. **Lo anoto como testimonio del reportero, no
como verificado por mí.** Si de verdad sigue en v23, no hay nada que pedirle al PM todavía sobre
esta ronda específicamente — coincide con lo que dice el commit.

## 8 · Qué falta para llegar a 85, en orden

1. **Cerrar `describeReservation.LABEL` (packing-engine.js:2477) igual que se cerró
   `summarizeReservationsForAI`.** Las dos formas válidas: agregar `transfer` y `note` a mano (y
   entonces sumar un caso con y un caso sin para cada uno, como exige el mecanismo que esta misma
   ronda instaló), o —mejor, porque es la misma lección que ya se aprendió acá arriba— derivarla de
   `TYPES` en vez de mantenerla aparte. Agregar un caso donde una nota o un traslado sea la fuente
   citada (vía `hasWaterActivity`/`hasWorkActivity`/etc., que no filtran por tipo) y confirmar que
   ya no dice "la reserva" genérico.
2. **Sacarle la fragilidad a `yaResumidos`, no sólo declararla.** Que se derive de la misma lista
   que arma los cinco bloques propios (o de `TYPES`), en vez de ser un tercer lugar donde hay que
   acordarse de sumar un tipo nuevo. Agregar el control que falta: un caso que saque un tipo
   conocido de la guarda dejando su bloque propio intacto, y que la prueba falle si el resultado
   sale duplicado — el mismo tipo de control negativo que ya existe para `sanitizeNotesForAI`.
3. **Repetir el barrido de la clase sobre el archivo entero**, no sólo sobre la función que reportó
   la auditoría anterior: grep de estructuras con las seis claves de tipo, confirmar que no queda
   una tercera, y dejarlo escrito en el commit (qué se buscó, qué se encontró, qué no).
4. Recién entonces, publicar, confirmar con los cuatro `grep` contra el archivo real que sirve el
   Artifact (no contra el shell de la SPA) que la versión nueva está arriba, y pedirle al PM la
   prueba del brief: un viaje con sólo una nota cargada, que la sugerencia de equipaje ya no diga
   "todavía no hay reservas cargadas".

## 9 · Lo que nadie puede verificar desde acá

- **Que lo publicado sea efectivamente v23 y no otra cosa.** Ver §7: mi único intento de leerlo
  devolvió el contenedor de la SPA, no el archivo. Pasos para el PM o para quien tenga el acceso que
  falta acá: abrir el link del Artifact, ver el archivo servido (no la vista renderizada) y buscar
  `VALIJA_VERSION` y una cadena propia de este commit (por ejemplo `"Y TODO LO DEMÁS"` o
  `yaResumidos`); si no aparecen, sigue siendo v23 y no hay nada que probar todavía sobre esta
  ronda específica.
- **Que el modelo razone bien sobre una nota o un traslado cuando le llegan por la rama genérica.**
  Esta ronda prueba que el dato **llega** al prompt; no prueba qué hace el modelo con un `tipo`
  fuera de los cinco que conocía antes (`"note"` hoy; cualquier tipo futuro después). El brief de
  esta historia es explícito: "lo que se afirme sobre el razonamiento del motor se prueba contra un
  modelo real o se declara sin probar" (`app/pruebas/lote-modelo-real.js`). No corrió esta ronda, y
  el commit no afirma nada sobre el razonamiento — sólo sobre que el dato llega — así que no hay una
  afirmación sin respaldo acá, pero si se quiere confirmar que las sugerencias con una nota sola
  tienen sentido, ese es el camino, y sólo se puede correr con acceso a un modelo real.
- **El gesto en el teléfono**, como siempre: cargar sólo una nota en un viaje, pedir la valija
  inteligente, y confirmar en pantalla que ya no dice "todavía no hay reservas cargadas". Nada de
  esto tiene sustituto además del dispositivo real, una vez que haya algo publicado para probar.

## 10 · Sobre el proceso, ya que se preguntó

Van doce rondas y las últimas tres las abrí tirando de una afirmación que no cerraba, no leyendo el
diff línea por línea primero. No es casualidad, y no creo que el problema sea sólo "mirá el caso
vecino" — eso ya está escrito y esta ronda lo hizo mejor que las dos anteriores: agregó un tipo
inventado como control de clase, algo que las rondas 2 y 3 no habían hecho.

Lo que sigo viendo, y es estructural: **cada ronda barre la clase respecto de la función que señaló
la auditoría anterior, no respecto del archivo.** La instrucción que se repite en este proyecto es
"¿qué otro lugar comparte la causa?", y la respuesta que se da es siempre local a la función que
está tocando esa ronda — che, corrijo `summarizeReservationsForAI` y reviso si `summarizeReservationsForAI`
tiene otro hueco, no si el archivo tiene otro `summarizeReservationsForAI` disfrazado en otra
función. `yaResumidos` y `describeReservation.LABEL` son el mismo patrón (un objeto con las seis
claves de tipo, mantenido a mano) a 600 líneas de distancia en el mismo archivo, y ninguno de los
dos se buscó por patrón — el primero porque es nuevo y nadie lo ataca en la misma ronda que lo
escribe (la regla que ya está en CLAUDE.md sobre "el arreglo no recibe el mismo ataque que el
defecto"), el segundo porque nadie hizo el grep de la forma, sólo de la función.

Así que si la pregunta es "sigo entregando de a un arreglo por ronda sin barrer la clase": no
exactamente — esta ronda sí barrió la clase de **la función que tocó**. Lo que no barrió es la clase
de **el archivo**. La diferencia práctica: antes de cerrar una ronda que dice "arreglo de clase",
correr un grep de la FORMA del bug (acá: `{ tipo1:, tipo2:, ...}` con las claves de `TYPES`) sobre
todo el archivo, no sólo confirmar que la función tocada ya no lo tiene. Es un paso mecánico, no una
promesa de acordarse — y este proyecto ya sabe, por los fixtures, que las promesas de acordarse no
alcanzan.
