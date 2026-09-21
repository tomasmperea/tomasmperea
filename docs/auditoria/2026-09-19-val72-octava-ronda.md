# Auditoría VAL-72 — octava ronda ("sale la anotación de tiempo")

**Commit auditado:** `0aa1ae119d6732022d8e0ecaa8086f5156beb087` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío,
`HEAD=0aa1ae1` antes y después de auditar). **Publicado:** no — `VALIJA_VERSION` vale `"27"` en el
único árbol; lo servido en el Artifact sigue declarado como v23 (no pude reconfirmarlo yo mismo, ver
"Lo que nadie puede verificar desde acá", punto 3). Rondas anteriores: 57, 51, 70, 59, 51, 54, 56.

## Veredicto: NO PUBLICAR — 36/100

**No sale ni como candidato.** El piso de 70 vale sólo cuando lo único flojo es el teléfono. Acá hay un
defecto reproducible en Node, sin teléfono, que además golpea exactamente el caso que dio origen a esta
historia (el reporte original del PM: un multidestino a Europa).

Esta ronda es distinta: el PM tomó una decisión de alcance (sacar la anotación de tiempo) confiando en que
"el modelo ya recibe el dato" por otro camino del mismo prompt (`summarizeReservationsForAI`). Verifiqué esa
premisa antes de mirar el resto del código, como se me pidió, y **es falsa exactamente en los dos casos
vecinos que costaron las tres rondas anteriores.**

---

## 1 · La decisión, auditada antes que el código

**Pregunta:** ¿el modelo ya recibe ese dato en todos los casos donde la anotación lo daba? ¿Sacarla pierde
información en algún viaje?

**Respuesta: no sólo pierde información — manda información falsa, y la manda con el sello de "no lo
adivines, mirá acá".** El dato "crudo" en el que se apoya la decisión (`summarizeReservationsForAI`, línea
1783-1792 de `app/parts/packing-engine.js`) marca como `"tipo":"escala"` a **cualquier par de vuelos
consecutivos donde el primero llega adonde sale el segundo**, sin ningún umbral de duración. Es exactamente
el defecto del **primer intento** que esta historia ya vetó ("rotular por encadenamiento"), reencarnado en
una función distinta (VAL-44, preexistente) que nadie volvió a mirar con esa pregunta.

Lo reproduje en Node, extrayendo el motor de `app/valija.html` (el mismo mecanismo que usa el propio arnés),
sobre las fixtures que el propio commit usa para probar que los casos anteriores siguen cerrados:

**Caso 1 — el que volteó la quinta ronda (ida y vuelta EZE→MAD→EZE, `IDA_Y_VUELTA_CON_END`):**

```
$ node -e '... pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:IDA_Y_VUELTA_CON_END })) ...'
  - {"tipo":"vuelo","desde":"2027-04-01T08:00","hasta":"2027-04-01T23:30","origen":"EZE","destino":"MAD",...}
  - {"tipo":"vuelo","desde":"2027-04-15T10:00","hasta":"2027-04-16T06:00","origen":"MAD","destino":"EZE",...}
  - {"tipo":"escala","ciudad":"MAD","duracionHoras":322.5}
```

El **único destino del viaje** (13,4 días en Madrid) queda etiquetado `"tipo":"escala"` — la palabra que en
español no significa otra cosa que "parada técnica, no destino". Es literalmente el síntoma que vetó la
quinta ronda, con la etiqueta movida de un campo a otro.

**Caso 2 — el "caso que define el éxito de la historia" (multidestino Europa, `VUELOS`, el reporte
original del PM del 19/09):**

```
- Destinos ...: MAD (vuelo) · CDG (vuelo) · FCO (vuelo). Es un viaje multidestino: lo que sugieras tiene
  que servir para TODOS esos lugares ... Ojo con las escalas ... No lo adivines — abajo tenés ...
  - {"tipo":"escala","ciudad":"MAD","duracionHoras":105.5}
  - {"tipo":"escala","ciudad":"CDG","duracionHoras":123}
```

Dos de las tres ciudades del multidestino —Madrid (4,4 días) y París (5,1 días)— quedan marcadas como
"escala" en el mismo prompt que dos líneas antes dice "es un viaje multidestino, tiene que servir para
TODOS esos lugares" y "no lo adivines, mirá el renglón de escala". Es el defecto del primer intento de esta
historia (marcar las tres ciudades de un multidestino como trasbordo), otra vez, en el caso que el propio
arnés llama "el caso que define el éxito".

**Control (caso que sí funciona):** el tramo por tierra (`POR_TIERRA`, ronda 6) no produce ningún `"tipo":
"escala"` falso, porque el traslado corta la cadena de vuelos consecutivos. Y el caso original de VAL-44
(BUE→GRU→MAD, escala real de 2 h) sí es correcto. El defecto es específico de: (a) ida y vuelta con un solo
destino, y (b) multidestino con vuelos consecutivos que encadenan.

**Por qué ninguna prueba lo agarra:** las aserciones del commit sobre `IDA_Y_VUELTA_CON_END` y `VUELOS`
sólo miran la línea `^- Destino` (`.split("\n").find(l => /^- Destino/.test(l))`), nunca el bloque de
`Reservas del viaje` de más abajo. El único control que sí mira ese bloque (`promptEsc`, línea 402-405 del
arnés) se corre sobre `CON_ESCALA` — el caso de la escala real de 2 h — y de ahí se concluye, sin probar los
otros dos fixtures contra el mismo bloque, que "el prompt trae el renglón de escala con su duración" en
general. Es la trampa 5 de `CLAUDE.md` casi literal: una segunda hipótesis (¿esta lógica reutilizada tiene
el mismo defecto que la que se está sacando?) que nunca se probó, a pesar de que la cuarta ronda ya había
dejado anotada, como observación sin puntuar, que esta misma función "arma `{tipo:'escala'}` cuando `a.to
=== b.from`" sin usar ningún umbral.

**Conclusión de este punto:** la decisión de sacar la anotación está mal tomada tal como se ejecutó. No
porque el principio ("no le resumas al modelo un dato que ya tiene") esté mal — es un buen principio — sino
porque no se verificó que el dato que ya tiene sea correcto, y no lo es para los dos casos que motivaron las
tres rondas anteriores.

---

## 2 · Los cuatro casos que voltearon las rondas 5, 6 y 7

| Caso | Línea `- Destino` | Bloque de reservas | Estado |
|---|---|---|---|
| Ida y vuelta con hora de llegada (ronda 5) | Correcta: `MAD (vuelo)`, sin "ahí" ni "escala" | **Falsa**: `{"tipo":"escala","ciudad":"MAD","duracionHoras":322.5}` | **No cerrado** — ver punto 1 |
| Tramo por tierra en el medio (ronda 6) | Correcta: sin "días ahí" | Correcta: sin escala falsa (el traslado corta la cadena) | Cerrado |
| Vuelo del medio sin hora de llegada (ronda 7) | Correcta: los tres destinos entran igual, sin "no se pudo medir" | **Falsa** (mismo defecto que el multidestino de arriba): `{"tipo":"escala","ciudad":"MAD","duracionHoras":157}` | **No cerrado** |
| Ciudad repetida | El código de deduplicación por "estadía más larga" se retiró junto con la anotación (correcto: ya no hay nada que fusionar). Verificado que no quedan referencias muertas (`grep -n "DOS_VECES\|yaEsta\|horasHastaElProximoVuelo\|tiempoEsAca\|proximoVueloDesde\|cuantoTiempo"` → sólo comentarios históricos en pasado, ningún código vivo) | — | Cerrado, sin código muerto |

No hay frases huérfanas de la anotación vieja: busqué `horasHastaElProximoVuelo`, `tiempoEsAca`,
`proximoVueloDesde`, `cuantoTiempo`, "días ahí", "se pudo medir", "movió por tierra" en
`packing-engine.js`, `valija.html`, el arnés y `docs/backlog.md`; todas las apariciones vivas están en
comentarios narrando la historia en pasado, ninguna en código ejecutable ni afirmando el diseño actual.

**Hallazgo menor sin puntuar aparte:** la deduplicación que antes conservaba la estadía más larga para un
lugar visitado dos veces ahora simplemente descarta el segundo avistamiento (`if (vistos[k]) return;`, sin
comparar nada). Verifiqué que hoy no tiene efecto visible porque `lineaDestinos` ya no lee `desde`/`hasta`
de `lugares` — pero es un cambio de comportamiento no declarado en el comentario de `sumar`, que hoy no dice
nada sobre qué pasa con la segunda aparición.

---

## 3 · Los bloqueantes de las rondas 2 y 4

Verificado leyendo el `destinosDelViaje` actual (`app/parts/packing-engine.js:1627-1764`):

- **Ronda 2** (alojamiento en el origen desplazando el destino escrito): sigue resuelto. `stay`, `transfer`
  y `car` entran siempre como `pista` (`firme:false`); sólo `vuelo` puede ser `firme`. El refactor de esta
  ronda tocó `sumar` (sacó el parámetro `extra` y la lógica de fusión) pero no tocó la distinción
  firme/pista, que es otro tramo del código.
- **Ronda 4, bloqueante 1** (una pista podía comerse el destino escrito por el `vistos` compartido): sigue
  resuelto — el destino escrito se arma en un bloque separado (líneas 1748-1753) que no pasa por `vistos`,
  intacto en este commit.
- **Ronda 4, bloqueante 2** (vuelo de vuelta sin fecha comiéndose el destino real): sigue resuelto —
  `ordenConfiable` exige que todos los vuelos tengan `start`, intacto en este commit.

`sumar` efectivamente perdió el quinto argumento (`extra`) y toda la lógica de fusión de duplicados
asociada a la anotación de tiempo — es el cambio esperado de esta ronda, no una regresión de los
bloqueantes 1/2 de la ronda 4, que viven en otro tramo de la función y no se tocaron.

---

## 4 · El mecanismo de fixtures (campo con / campo sin)

Corrí `node app/pruebas/val72-las-reservas-mandan.js` con `NODE_PATH=/opt/node22/lib/node_modules`: verde,
y el bloque "de cada campo que el motor lee hay un caso con y un caso sin" pasa para los 4 tipos de reserva
(`flight`: from/to/start/end; `stay`: address/start/end; `transfer`: to/start/end; `car`:
address/start/end). Leí el mecanismo (líneas 522-545): el diccionario `LEE` está escrito a mano pero
declara explícitamente de dónde sale ("de leer la función, no de recordar el formulario"), y lo comprobé
contra `destinosDelViaje`: los cuatro campos por tipo son efectivamente los que la función lee (directamente
o vía `sumar`, que usa `item.start`/`item.end` de forma genérica). `transfer.from` no está en la lista, y es
correcto que no esté: `destinosDelViaje` no lee `transfer.from` en ningún punto (confirmado con
`grep '"transfer"'`, una sola aparición).

**Atacándolo:** intenté encontrarle un hueco pidiendo que declarara una regla falsa como se hizo en la ronda
anterior ("`end`, que la app siempre escribe"). No lo hace — la regla que aplica ahora es neutral ("con y
sin", no "siempre"), así que no hereda ese defecto. El mecanismo en sí está bien escrito.

**Pero su alcance es angosto de una forma relevante para el hallazgo 1:** sólo cubre los campos que lee
`destinosDelViaje`, no los que lee `summarizeReservationsForAI` — que es exactamente la función con el
defecto que encontré. Ningún mecanismo de este arnés exige un caso "con escala real" y un caso "con
encadenamiento sin escala real" para esa función. Es un hueco de cobertura, no un defecto del mecanismo en
sí.

---

## 5 · Las dos copias del motor

No confié en `las-dos-copias.js` sin repetir la comparación por mi cuenta. Extraje el cuerpo de
`PackingEngine` de `app/valija.html` (desde `"use strict";` después del wrapper `(function (root,
factory)...)` hasta el `\n});` final) y el cuerpo equivalente de `app/parts/packing-engine.js`, y los
comparé con Python, carácter por carácter:

```
lens 116873 116873
equal: True
```

**Idénticos, byte a byte, comparación independiente.** También corrí `node app/pruebas/las-dos-copias.js`:
verde, incluyendo sus propios controles de sabotaje (un tope cambiado, un comentario cambiado, dos
constantes invertidas, una función divergente a mano) — los cuatro se detectan.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "el modelo ya recibe ese dato por otro lado" (premisa de la decisión) | Reproducido en Node contra `IDA_Y_VUELTA_CON_END` y `VUELOS`, las fixtures del propio arnés | **Falso** para esos dos casos — ver punto 1 |
| "el control sostiene la decisión entera" | Leído: sólo corre contra `CON_ESCALA` (escala real de 2h), nunca contra los dos casos donde la premisa falla | **Insuficiente para lo que afirma** |
| Los cuatro casos de las rondas 5/6/7 siguen cerrados | Repro uno por uno en Node | **Dos cerrados** (tramo por tierra, ciudad repetida), **dos no** (ida y vuelta, multidestino) — mismo síntoma que antes, ahora en el bloque de reservas |
| No queda código muerto de la anotación vieja | `grep` de los 6 identificadores/frases retirados en todo el árbol | **Cierto** — sólo quedan en comentarios narrando historia pasada |
| Bloqueantes de rondas 2 y 4 siguen cerrados | Lectura de `destinosDelViaje` actual | **Cierto**, los tres intactos |
| El mecanismo de fixtures (campo con/sin) sigue siendo honesto | Leído y atacado buscando una regla-creencia | **Cierto**, sin ese defecto; alcance angosto (no cubre `summarizeReservationsForAI`) |
| Las dos copias del motor son idénticas | Comparación independiente en Python, byte a byte | **Cierto**, 116.873 caracteres |
| `las-dos-copias`, `val72`, `motores-desde-html` (39), `valija-bloque-b` (111), `hallazgos-qa-bloque-b` (31), `tier-del-modelo` (42), `val63`, `val74`, `el-script-parsea` en verde | Corridas una por una con `NODE_PATH=/opt/node22/lib/node_modules` | **Cierto**, todos los números coinciden |
| `VALIJA_VERSION` en `"27"`, único árbol, nada publicado | `grep VALIJA_VERSION app/valija.html` → `"27"`; `git status --porcelain` vacío | **Cierto** |
| "Lo publicado sigue siendo la v23" | Intenté leer el archivo que sirve el Artifact (`curl` a la URL pública) | **No verificable desde acá** — el link resuelve a la shell SPA de claude.ai (21.764 B, HTML de plantilla, cero coincidencias de `VALIJA_VERSION` ni `destinosDelViaje`), no al contenido real del archivo servido. Tomo la afirmación del reporte como no reconfirmada por mí, no como falsa. |
| Árbol quieto | `git status --porcelain` vacío, `HEAD=0aa1ae1` antes y después | **Cierto** |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | Mismo patrón que rondas anteriores: sustituto fiel (motor extraído del HTML real), brecha del teléfono declarada sin usar la palabra "verificado" de más. No sube porque nada de esta ronda tocó DOM ni visor; no baja más porque la brecha nueva que encontré no es del entorno — es reproducible en Node. |
| 2 | Diagnóstico de causa raíz | 15 | **0** | La decisión completa se apoyó en UNA verificación (el caso de escala real de 2h) y se generalizó sin probar los dos casos vecinos —ida y vuelta, multidestino real— que son justamente los que motivaron las tres rondas anteriores. Es la trampa 5 de `CLAUDE.md` aplicada a una decisión de producto, no sólo a una línea de código: "se dio por buena la primera hipótesis" es literal acá. |
| 3 | Honestidad de lo verificado | 15 | **5** | El commit y el backlog declaran con precisión todo lo demás (qué se probó, qué no, los ocho arneses verdes con sus números exactos). Pero presentan "el modelo ya sabía que San Pablo era una escala de dos horas... todo lo construido repetía un dato que ya tenía" como una conclusión general, verificada con un control que sólo cubre el caso favorable. Es una afirmación sin el respaldo que se le atribuye, sobre la premisa central de la decisión. |
| 4 | Cumplimiento del contrato | 15 | **3** | El criterio "el caso que define el éxito: un viaje Europa con MAD/CDG/FCO tiene que sugerir para esas tres ciudades" queda en riesgo directo: dos de esas tres ciudades llegan al modelo etiquetadas `"tipo":"escala"` en el mismo prompt. No es un criterio que dependa del teléfono para fallar: falla en Node. |
| 5 | Calidad interna | 15 | **7** | A favor: pruebas verdes y verificadas con números exactos, dos copias idénticas confirmadas de forma independiente, el mecanismo de fixtures campo-con/campo-sin es honesto y bien escrito. En contra: el arnés tiene un hueco de cobertura justo en el punto que rompe la decisión (nunca compara el bloque completo de reservas contra los fixtures de ida-y-vuelta y multidestino), y ese hueco es el mismo tipo de "escenario que pasa porque no se le aplicó el ataque completo" que este proyecto ya tiene facturado. |
| 6 | Diseño y decisiones de producto | 10 | **3** | El principio ("no le resumas al modelo un dato que ya tiene, puede mentir; el crudo no") es sólido y está bien argumentado en abstracto. Pero la decisión se le presentó al PM con un solo ejemplo demostrado (GRU, escala real) y no con los dos casos de riesgo conocido, que estaban documentados en las rondas anteriores del mismo backlog. Una decisión de recorte de alcance vale más cuando se prueba contra el peor caso conocido antes de proponerla, no después. |
| | **Total** | **100** | **36** | **NO PUBLICAR, y no sale como candidato.** La dimensión floja no es la 1: es que la premisa central de la decisión de esta ronda es demostrablemente falsa en Node, en el caso que originó toda la historia. |

---

## Hallazgos vivos, ordenados por gravedad

1. **(Bloqueante)** El dato "crudo" en el que se apoya la decisión de sacar la anotación
   (`summarizeReservationsForAI`, `app/parts/packing-engine.js:1783-1792` y su copia idéntica en
   `valija.html`) etiqueta `"tipo":"escala"` a cualquier par de vuelos consecutivos que encadenen, sin
   umbral de duración — el mismo defecto del primer intento que esta historia ya vetó. Reproducido:
   - Ida y vuelta EZE-MAD-EZE: `{"tipo":"escala","ciudad":"MAD","duracionHoras":322.5}` sobre el único
     destino del viaje (13,4 días).
   - Multidestino Europa (el caso reportado originalmente por el PM): `{"tipo":"escala","ciudad":"MAD",
     "duracionHoras":105.5}` y `{"tipo":"escala","ciudad":"CDG","duracionHoras":123}` sobre dos de las tres
     ciudades del multidestino, en el mismo prompt que dice "es un viaje multidestino... no lo adivines,
     mirá el renglón de escala".
   Esto no es "perder información": es mandar información falsa y señalarla como autoridad.

2. **(Bloqueante, causa raíz)** La decisión se tomó sin probar los dos casos vecinos —ida y vuelta,
   multidestino real— contra el dato en el que se apoya, a pesar de que ambos estaban documentados en el
   propio backlog de rondas anteriores como los casos que voltearon la 5ª y que definen el éxito de la
   historia.

3. **(Severo, honestidad)** "El modelo ya sabía que San Pablo era una escala de dos horas... todo lo
   construido repetía un dato que ya tenía" se presenta como conclusión general verificada, cuando el único
   control que la respalda corre sobre el caso favorable.

4. **(Menor)** La deduplicación de un lugar visitado dos veces perdió su lógica de "gana la estadía más
   larga" sin declarar qué pasa ahora con la segunda aparición (hoy: se descarta en silencio). Sin efecto
   visible verificado porque `lineaDestinos` no usa esos campos, pero el comentario de `sumar` no lo dice.

---

## Lo que falta para llegar a 85, en orden

1. **Decidir qué hacer con la detección de escala de `summarizeReservationsForAI` antes de tocar nada más.**
   Hoy es la única fuente de verdad que el prompt le señala al modelo sobre "escala vs. destino real", y
   tiene el mismo defecto que la lógica que esta historia acaba de sacar. No alcanza con parchear
   `destinosDelViaje` de nuevo: el defecto vive en la función que queda como autoridad.
2. **Agregar al arnés la prueba que falta:** correr `IDA_Y_VUELTA_CON_END` y `VUELOS` (no sólo `CON_ESCALA`)
   contra el bloque completo de reservas, no sólo contra la línea `- Destino`, con una aserción que falle si
   aparece `"tipo":"escala"` sobre el único destino del viaje o sobre una ciudad con una estadía de más de
   un día en un multidestino real.
3. **Volver a plantear la decisión al PM con estos dos repros a la vista.** La premisa con la que decidió
   ("el modelo ya tiene el dato") no era completa; puede seguir eligiendo sacar la anotación, pero con la
   detección de escala corregida primero, o eligiendo otra salida con esta información nueva.
4. Recién entonces, publicar como candidato con el guion de abajo para el teléfono.

---

## Lo que nadie puede verificar desde acá

1. **Qué hace el modelo real del teléfono al recibir un renglón `"tipo":"escala"` sobre una ciudad que la
   línea de arriba llama destino multidestino.** No sé si lo ignora, si pesa más que la línea `- Destino`, o
   si arma sugerencias de "escala corta" (poco equipaje, nada de ropa) para una ciudad donde la persona se
   queda cuatro días. **Pasos para el PM:** publicar, cargar un viaje "Europa" con vuelos EZE→MAD (día 1),
   MAD→CDG (día 6), CDG→FCO (día 11), tocar "Armar la lista", y mirar si los ítems sugeridos son específicos
   de Madrid y de París por igual, o si faltan justo para esas dos ciudades como si fueran escalas.
2. **El visor del teléfono en sí** — nada de esta ronda tocó DOM, permisos ni sandbox; la brecha sigue
   entera y es la única razón por la que la dimensión 1 no puede subir de 18 desde acá.
3. **Si lo publicado en el Artifact sigue siendo realmente la v23.** Intenté confirmarlo yo mismo
   (`curl` a la URL del Artifact) y sólo obtuve la shell de la aplicación de claude.ai (21.764 B, sin
   `VALIJA_VERSION` ni `destinosDelViaje`), no el archivo que efectivamente sirve la app al navegador. No
   puedo reconfirmar ni contradecir la afirmación del reporte con las herramientas de este entorno; queda
   como no verificada por mí, no como falsa.
