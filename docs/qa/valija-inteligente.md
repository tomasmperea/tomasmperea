# QA — Valija inteligente (VAL-30..33)

**Contra qué se valida:** `docs/briefs/valija-inteligente.md` (VAL-34 y VAL-35 fuera de alcance por decisión
del PO: no se prueban ni se reportan como faltantes) y `docs/design/valija-inteligente.md`.

**Cómo se probó:** `app/valija.html` corrido de verdad en Chromium headless (`/opt/pw-browsers/chromium-1194`)
y con Playwright para simular toques (clicks en `data-mark`, `data-dropbtn`, `data-detail`, etc.), no solo
lectura de código. Los datos se sembraron en `localStorage` generando listas reales con
`app/parts/packing-engine.js` desde Node (mismo motor que usa la app, sin reescribir sus reglas). No hay
`claude.use` en este entorno (ni `db` ni `sample`), así que la app corre siempre en modo local con la capa de
IA no disponible — eso es exactamente el camino degradado que pide la consigna, y lo aprovecho para
verificarlo a fondo, pero también significa que **no pude ejercitar en vivo el camino en que la IA sí
responde** (estado 07) ni la escritura contra una base compartida real. Lo marco explícitamente en cada caso.

Cada caso dice si lo **verifiqué corriendo la app** o si lo **inferí leyendo el código** (packing-engine.js no
se re-testea unitariamente, ya tiene 45 pruebas en verde).

---

## 1. Casos de prueba

### VAL-30 · Generar la lista sugerida

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 30.1 | Se elige el tipo de viaje al generar, con un tipo propuesto según destino/duración | Verificado corriendo: viaje "Bariloche, 6 días" propone "Montaña"; viaje sin destino ni pistas propone "Mixto" con motivo explícito | **Pasa** |
| 30.2 | La lista llega agrupada en documentación, ropa, calzado, higiene, electrónica, salud y específicos del destino | Verificado corriendo: las 6 categorías base aparecen con ítems correctos. "Específicos del destino" no se pudo ver en vivo porque requiere que la capa de IA responda `ok`, y no hay `claude.use` en este entorno | **Pasa** (6 de 7 categorías verificadas en vivo; la 7ª sin verificar, ver hallazgo de alcance) |
| 30.3 | Cada ítem con cantidad muestra de dónde sale esa cantidad | Verificado corriendo: "Remeras ×8 — 6 días más una de repuesto", "Ropa interior ×10 — 10 juegos: con 60 días vas a lavar igual", etc. en viajes de distinta duración | **Pasa** |
| 30.4 | La lista base se genera sin conexión a la capa inteligente | Verificado corriendo: con `claude.use` inexistente, la lista base se genera igual, muestra el chip "sin ajuste por destino" y el aviso franco | **Pasa** |
| 30.5 | Generar dos veces no duplica, conserva lo marcado | Verificado corriendo: generé, marqué un ítem como empacado y descarté otro, después usé "Rehacer la lista" (`pk-redo`) — el total de ítems se mantuvo en 30 (no hubo duplicados) y el estado de los dos ítems tocados se conservó | **Pasa** |

### VAL-31 · Marcar lo que ya está en la valija

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 31.1 | Cada ítem se marca como empacado y se puede desmarcar | Verificado corriendo: click en el cuadrado → `pendiente→empacado→pendiente`, confirmado en el dato guardado | **Pasa** |
| 31.2 | Un contador muestra cuánto lleva empacado sobre el total | Verificado corriendo: **no pasa**. Ver Hallazgo B1 (bloqueante) | **No pasa** |
| 31.3 | Se pueden agregar ítems propios que no estaban sugeridos | Verificado corriendo, incluso con nombre con HTML/comillas/`<script>` — se guarda y se muestra escapado, sin ejecutar nada | **Pasa** |
| 31.4 | Se puede descartar un ítem sugerido, distinto de marcarlo como empacado | Verificado corriendo: el descarte cambia el dato correctamente (`estado:"descartado"`), pero el ítem **desaparece de toda la interfaz** sin ningún rastro. Ver Hallazgo B2 (bloqueante) | **Parcial / No pasa en la práctica** |
| 31.5 | El estado sobrevive a cerrar y volver a abrir la app | Verificado parcialmente: los cambios persisten en `localStorage` y sobreviven a navegar entre pestañas/rutas dentro de la misma carga de página. **No pude confirmar una recarga completa del navegador** porque mi arnés de prueba re-siembra `localStorage` en cada `load` (limitación de mi método de prueba, no de la app); el mecanismo de persistencia (`Store.saveLocal`/`loadLocal`) es el mismo que ya usa el resto de la app para viajes y reservas, así que el riesgo es bajo, pero **no lo verifiqué de punta a punta** | **No verificado del todo** (ver nota) |

### VAL-32 · Aprender del historial

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 32.1 | Se consideran las listas de viajes anteriores del mismo tipo | Verificado corriendo: sembré dos viajes "ciudad" (Barcelona, Lisboa) y un tercero (Madrid); el selector de tipo mostró "Ciudad · 2 viajes" | **Pasa** |
| 32.2 | Un ítem agregado a mano en dos viajes del mismo tipo aparece sugerido en el siguiente | Verificado corriendo: agregué "Termo de mate" a mano en los dos viajes previos; al generar el tercero apareció ya sugerido, con motivo "Lo agregaste a mano en 2 viajes de ciudad" y chip "tus viajes" | **Pasa** |
| 32.3 | Un ítem descartado dos veces en el mismo tipo deja de sugerirse | Verificado corriendo: descarté "Auriculares" en los dos viajes previos; en el tercero el ítem **no** aparece en la lista generada (confirmado en el dato: `items.auricular === undefined`) | **Pasa** |
| 32.4 | La lista indica qué ítems vienen del historial y cuáles de las reglas | Verificado corriendo: chips "lista base" vs. "tus viajes" visibles y correctos | **Pasa** |
| 32.5 | Sin historial previo, la lista se genera igual con las reglas base | Verificado corriendo: viaje sin ningún historial genera lista completa sin errores | **Pasa** |

### VAL-33 · Ajustar por destino y época

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 33.1 | La capa inteligente recibe destino, fechas y tipo, y agrega ítems específicos | **No verificado en vivo**: este entorno no tiene `claude.use("sample")`, así que el camino "ok" nunca se ejerce. Inferido por lectura de `runGenerate()` y `enrichWithDestination()`, y por las 45 pruebas unitarias del motor (no las repito) | **No verificado** |
| 33.2 | Cada ítem específico del destino explica por qué está sugerido | Mismo motivo que 33.1: no verificado en vivo | **No verificado** |
| 33.3 | Si la capa falla o no está disponible, la base se muestra igual y se avisa | Verificado corriendo extensamente: chip "sin ajuste por destino", `.notice.warn` no cerrable con el texto exacto del diseño y botón "Probar de nuevo" que reintenta sin perder lo ya guardado | **Pasa** |

### Regresión — las siete funciones existentes

| # | Función | Cómo | Resultado |
|---|---|---|---|
| R1 | Lista de viajes (home) | Código no tocado por la integración; sin colisiones de nombres con lo nuevo (`PK`, `TYPE_LABEL`, `srcChip`, etc. son todos identificadores nuevos) | **Pasa** (inferido + no se detectó ningún error de consola en ninguna corrida) |
| R2 | Itinerario por día | Verificado corriendo: viaje con vuelo + alojamiento se ve agrupado por día, con la tira de Valija arriba del segmentado sin romper el layout | **Pasa** |
| R3 | Panel de pendientes | Verificado corriendo: alertas de "falta el vuelo de vuelta" se siguen viendo igual, con la tira de Valija conviviendo arriba | **Pasa** |
| R4 | Alta y edición de reservas (`sheetItem`) | Código sin cambios; no ejercitado por interacción directa en esta ronda, pero no hay ninguna referencia cruzada con el código de valija que pudiera romperlo | **Pasa** (inferido) |
| R5 | Importador de confirmaciones (`sheetImport`) | Código sin cambios; mismo patrón `claude.use("sample")` que reutiliza `runGenerate`, sin compartir estado | **Pasa** (inferido) |
| R6 | Exportar PDF (`exportPDF`) | Código sin cambios y sin ninguna referencia a `packing`/`PackingEngine`; jsPDF se carga por CDN, que este entorno bloquea, así que no pude generar un PDF real y confirmar el archivo binario, pero el código de la función es idéntico al de antes de esta iteración | **Pasa** (inferido; no se generó un PDF real) |
| R7 | Compartir (`sheetShare`) | Código sin cambios | **Pasa** (inferido) |

### Estados vacíos y extremos

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| E1 | Viaje sin fechas | Verificado corriendo: estado 03 exacto al diseño, bloquea el selector y ofrece "Cargar las fechas" | **Pasa** |
| E2 | Viaje de un día | Verificado corriendo: cantidades razonables ("Remeras ×2 — 1 día más una de repuesto"), sin romper el layout | **Pasa** |
| E3 | Viaje de sesenta días | Verificado corriendo: cantidades acotadas con explicación ("Con 60 días no tiene sentido una por día: 8 y lavás en el viaje"), sin romper el layout ni la performance visible | **Pasa** |
| E4 | Viaje sin ninguna reserva cargada | Verificado corriendo (todos los viajes de prueba de este QA no tenían reservas): la lista se genera igual, sin depender de `items` | **Pasa** |
| E5 | Lista donde se descartó todo | Verificado corriendo: descarté los 30 ítems uno por uno vía la interfaz → la pantalla queda completamente en blanco, sin categorías, sin aviso de "Valija lista". Ver Hallazgo B3 (bloqueante) | **No pasa** |
| E6 | Lista donde se empacó todo | Verificado corriendo: marqué los 30 ítems uno por uno vía la interfaz → el dato queda 100% empacado, pero el encabezado sigue mostrando "0 de 30 · faltan 30" y el aviso "Valija lista" nunca aparece. Ver Hallazgo B1/B4 | **No pasa** |
| E7 | Sólo lectura (`Store.canWrite=false`) | Verificado corriendo (forzando el flag, ya que en modo local `canWrite` es siempre `true`): sin FAB, sin botones de marcar/descartar/agregar, chip "sólo lectura", filas no clicables para el detalle — todo tal como documenta el diseño (estado 10) | **Pasa** |
| E8 | Sin la capa de IA (`claude.use` inexistente) | Verificado corriendo en todos los casos de este QA (es el modo por defecto de este entorno) | **Pasa** (cubre 33.3) |
| E9 | Datos sucios: comillas, `<script>`, ángulos, ampersand en nombre de ítem | Verificado corriendo: se guarda tal cual en el dato, se muestra escapado en pantalla, no se disparó ningún `alert()` ni HTML crudo en el DOM | **Pasa** |
| E10 | Destino vacío | Verificado corriendo: cae a "tu destino" en los textos, sin romper nada. Un detalle heredado (no nuevo de esta feature): el chip de ruta muestra "VIA" (primeras 3 letras del nombre del viaje) en vez de un placeholder tipo "···", igual que en `cardTrip` | **Pasa**, con nota menor |
| E11 | Nombre de viaje/destino larguísimo | Verificado corriendo: el tag del encabezado trunca con recorte de línea, no desborda | **Pasa** |
| E12 | Concurrencia / escritura parcial | Verificado **sólo en modo local**: `Store.savePackingPatch` mezcla por clave correctamente entre escrituras sucesivas de ítems distintos (probé marcar 30 ítems distintos, uno por uno, y los 30 terminaron con su estado propio sin pisarse). **No pude verificar el comportamiento contra la base compartida real** (`claude.use("db")` no existe en este entorno) — en particular, si `.update()` de esa base hace merge profundo de objetos anidados o reemplaza el campo `items` entero. Ver Hallazgo I1 (importante, riesgo no confirmado) | **Parcial** |

---

## 2. Hallazgos

### Bloqueantes

#### B1 — El contador de progreso no se actualiza al marcar o descartar ítems de a uno; solo se corrige regenerando la lista entera

**Qué pasa.** El número "**X** de Y · faltan Z" del encabezado de la valija y de la tira de entrada en la
pantalla del viaje se calculan a partir de `list.conteo`, un campo que se guarda como parte del documento.
Ese campo se recalcula correctamente cuando se genera o regenera la lista completa (`buildPackingList` /
`mergeLists` llaman a `packingProgress`), pero **nunca** se recalcula cuando se marca o descarta un ítem
individual: `PackingEngine.stateUpdatePatch(clave, estado)` solo arma `{items:{clave:{...}}, actualizadaEn}`,
sin tocar `conteo`, y `Store.savePackingPatch` guarda ese parche tal cual. Como `pkProgHtml()` y
`renderPackingEntry()` usan `list.conteo || PackingEngine.packingProgress(list)` — y `list.conteo` siempre
existe una vez generada la lista, aunque esté desactualizado — el `||` nunca cae al recálculo en vivo.

**Cómo reproducirlo.**
1. Abrir un viaje con fechas, generar la lista ("Armar la lista").
2. Anotar el contador del encabezado, por ejemplo "0 de 30 · faltan 30".
3. Tocar el cuadrado de cualquier ítem para marcarlo como empacado.
4. Mirar el mismo contador: sigue diciendo "0 de 30 · faltan 30", sin moverse ni una unidad, mientras que el
   contador de la categoría de ese ítem (ej. "1 de 3") sí cambió correctamente — dos números contradictorios
   en la misma pantalla.
5. Repetir marcando **todos** los ítems uno por uno (lo hice con los 30 de una lista de prueba, vía clicks
   reales en `[data-mark]`): el dato queda 100% correcto (`{"empacado":30}` verificado en el documento
   guardado), pero el encabezado sigue mostrando "0 de 30 · faltan 30" y nunca aparece el aviso "Valija
   lista".
6. Navegar a otra pantalla y volver: el número sigue sin corregirse (no es un problema de re-render, el dato
   persistido está mal).
7. Recién se corrige si se usa "Rehacer la lista" desde la hoja de transparencia (que regenera y recalcula
   `conteo` desde cero).

**Qué debería pasar.** El contador tiene que reflejar el estado real después de cada acción de marcar o
descartar, que es exactamente el gesto principal de esta feature ("tildar rápido", según el diseño). El
diseño (sección 5.6) es explícito: la barra "se dibuja directamente sobre esos números, sin recalcular
denominadores" asumiendo que `conteo` siempre está al día — ese supuesto no se sostiene con la escritura
parcial que el propio diseño (sección 5.2) pide para no pisar ediciones concurrentes.

**Gravedad: bloqueante.** Rompe textualmente el criterio de VAL-31 "Un contador muestra cuánto lleva empacado
sobre el total" para el flujo normal de uso (tocar ítems uno por uno), que es el 100% de las interacciones
reales fuera de "regenerar". Además vuelve invisible el momento de éxito de la iteración 1.5
(`docs/metricas-valija-inteligente.md`, M2: "más de la mitad marcada"), porque la persona nunca ve que avanzó.

---

#### B2 — Descartar un ítem lo hace desaparecer de toda la interfaz, sin ningún rastro ni forma de verlo o recuperarlo

**Qué pasa.** `renderPackingBoard()` arma las categorías con `PackingEngine.groupByCategory(list)`, **sin
pasar `opts`**. `groupByCategory` delega en `itemList(list, opts)`, que filtra los ítems descartados salvo que
se pase explícitamente `{includeDismissed:true}` — y esa opción nunca se pasa en `valija.html`. El resultado:
un ítem descartado deja de existir para cualquier categoría (`cat.items` no lo incluye), así que la fila
compacta con el botón "volver" que describe el diseño (estados 05, 06, 09, 11) **nunca se renderiza**. Si una
categoría entera queda 100% descartada, la categoría completa desaparece de la pantalla (el filtro final de
`groupByCategory` saca las categorías sin ítems).

**Cómo reproducirlo** (probado por tres caminos distintos, los tres con el mismo resultado):
1. Generar una lista.
2. Descartar un ítem, por cualquiera de estos tres caminos:
   - Tocar el círculo de descarte (`data-dropbtn`) de una fila.
   - Deslizar la fila hacia la izquierda más de 70px.
   - Abrir el detalle del ítem (tocar el nombre), elegir el estado "Descartado" y "Guardar".
3. Buscar el ítem en cualquier parte de la pantalla: no está. No hay fila compacta, no hay botón "volver", no
   hay ninguna mención de su nombre en ningún lado de la interfaz (confirmado con una búsqueda de texto sobre
   toda la página).
4. Abrir la hoja de transparencia ("i" del encabezado): explica en general que "lo que descartás también
   cuenta", pero no lista los ítems descartados de este viaje ni ofrece ningún acceso a ellos.
5. Única forma de "recuperarlo" que encontré, y no es una función real: si se vuelve a escribir el nombre
   **exacto** del ítem descartado en "Agregar ítem", `PackingEngine.addManualItem` detecta la misma clave y lo
   revive a "pendiente" (verificado: descarté "DNI", lo reescribí como ítem manual, y el ítem original volvió
   a "pendiente", conservando su motivo original de regla). Esto no es un camino de recuperación deliberado:
   no está documentado en ningún lado de la interfaz, requiere adivinar el nombre exacto que generó la misma
   clave, y la persona no tiene ninguna pista de que el ítem sigue "vivo" bajo el capó.

**Qué debería pasar.** Según el propio diseño (estado 05, 06, 09, 11), un ítem descartado debe seguir visible
como una fila compacta de una línea con un botón "volver", y una categoría con algo descartado debe quedar
abierta aunque no tenga pendientes ("Sólo queda abierta la categoría que tiene algo descartado, porque ahí
sigue habiendo algo que mirar"). La corrección es de una línea: pasar
`PackingEngine.groupByCategory(list, {includeDismissed:true})` en `renderPackingBoard()`.

**Gravedad: bloqueante.** Descartar es, según el propio brief, "información valiosa" que además define el
aprendizaje de VAL-32 — pero desde la interfaz es una acción de un solo sentido, sin confirmación visible de
qué se descartó ni forma de deshacerla. Es exactamente la trampa para el usuario que pedía investigar: alguien
que descarta por error (un dedo de más en un deslizamiento) no tiene ninguna manera de arreglarlo salvo saber
que existe este atajo no documentado.

---

#### B3 — Si se descarta todo el contenido de la lista, la pantalla de la valija queda completamente vacía

**Qué pasa.** Es una consecuencia directa de B2: si absolutamente todos los ítems de todas las categorías
quedan en estado "descartado", `groupByCategory` devuelve un arreglo vacío (todas las categorías se filtran
por no tener ítems visibles) y `renderPackingBoard` renderiza `notices + "" + skeletonCat("")`, es decir,
nada. La única pista de que en algún momento hubo 30 ítems es el encabezado, que además muestra el número
incorrecto por B1.

**Cómo reproducirlo.**
1. Generar una lista.
2. Descartar los 30 ítems, uno por uno, por cualquiera de los caminos de B2.
3. Mirar la pantalla: queda un espacio en blanco entre el aviso de "sin ajuste por destino" y el botón
   "Agregar ítem". Ni una sola categoría, ni una sola fila, y no aparece el aviso de cierre "Valija lista. Los
   30 que descartaste ya quedaron anotados..." que el diseño define para el estado 09.

**Qué debería pasar.** Con `includeDismissed:true` (la corrección de B2) esta pantalla mostraría las 6
categorías colapsadas con sus filas descartadas y el aviso de cierre correspondiente, que es exactamente el
estado 09 que documenta el diseño.

**Gravedad: bloqueante.** Es el caso extremo "una lista donde se descartó todo" que pedía la consigna
explorar, y el resultado es una pantalla que un usuario real interpretaría como rota, sin ningún mensaje de
qué pasó ni qué hacer.

---

#### B4 — El aviso "Valija lista" (estado 09) nunca aparece a través del uso normal, sólo después de regenerar

**Qué pasa.** `complete = c.total>0 && c.pendientes===0` en `renderPackingBoard()` usa el mismo `list.conteo`
afectado por B1. Como ese campo no se actualiza al marcar/descartar, `pendientes` sigue mostrando el valor
original (30, en mis pruebas) aunque los 30 ítems ya estén resueltos de verdad. El resultado es que el mensaje
de cierre de la feature — la recompensa explícita que describe el diseño ("Valija lista. Los N que
descartaste ya quedaron anotados para tu próximo viaje...") — nunca se dispara con el flujo real de uso.

**Cómo reproducirlo.** El mismo que E6: marcar (o descartar) los 30 ítems de una lista uno por uno vía la
interfaz. El dato queda resuelto al 100%, pero no aparece ningún aviso de cierre y las categorías no muestran
el chip "listo" en base al conteo global (aunque cada categoría sí lo calcula bien porque lo hace de forma
independiente, ver B1).

**Qué debería pasar.** Apenas el último ítem pendiente se resuelva (marcado o descartado), debería aparecer
el aviso de cierre del estado 09.

**Gravedad: bloqueante.** Mismo root cause que B1; lo separo porque es un criterio de producto explícito del
diseño (estado 09) y una pieza central de la hipótesis del brief ("la lista se vuelve confiable... y deja de
ser una tarea para volverse una revisión") que hoy no se puede alcanzar sin pasar por "Rehacer la lista".

---

### Importantes

#### I1 — No se pudo verificar si la escritura parcial contra la base compartida real mezcla o reemplaza el campo `items`

**Qué pasa.** El diseño (sección 5.2) y los comentarios del propio código asumen que
`db.doc(...).update({items:{clave:{...}}, actualizadaEn})` mezcla el objeto anidado `items` con lo que ya
había, tocando sólo la clave escrita — así es como se garantiza que "dos personas marcando ítems distintos no
se pisen". El modo local (sin base compartida) sí implementa ese merge a mano y lo verifiqué funcionando
correctamente (marqué 30 ítems distintos, uno por uno, y los 30 terminaron con su estado propio, sin
pisarse entre sí). Pero **este entorno no tiene `claude.use("db")`**, así que la app corre siempre en modo
local y nunca pude ejercitar la escritura contra la base real. Si esa base se comporta como Firestore real
(donde `update({a:{b:1}})` **reemplaza** el campo `a` entero en vez de fusionarlo, salvo que se usen claves de
ruta con punto como `"items.clave.estado"`), esta escritura "parcial" borraría de un saque todos los demás
ítems de la lista compartida cada vez que alguien toca uno solo — el problema de concurrencia opuesto al que
el diseño quiere resolver.

**Cómo reproducirlo / verificarlo.** No lo pude reproducir en este entorno. Para confirmarlo en la app
publicada: abrir el mismo viaje en dos pestañas/dispositivos con acceso de escritura, marcar un ítem distinto
en cada una casi al mismo tiempo, y confirmar que el documento final en la base conserva ambos cambios y el
resto de los ítems intactos (no sólo los dos tocados).

**Gravedad: importante** (no confirmado como bug; lo marco porque es el único punto de este QA donde no pude
cerrar la verificación y el costo de que esté mal es alto — perder ítems de la lista compartida de otra
persona).

---

#### I2 — La fila compacta de un ítem descartado tiene dos controles distintos que hacen lo mismo (latente, no observable hoy por B2)

**Qué pasa.** Leyendo `pkRowHtml()`: para un ítem en estado "descartado" con permiso de escritura, se renderizan
**dos** botones con el mismo atributo `data-mark="{clave}"`: el cuadrado de estado (que muestra un ícono de
"prohibido" pero sigue siendo un `<button>` clicable) y el botón de texto "volver". Ambos, al tocarse,
ejecutan la misma acción (`estado !== "pendiente" ? "pendiente" : ...` → vuelve a pendiente). El diseño
describe la fila compacta con un **único** control explícito ("con botón 'volver'"), sin mencionar que el
cuadrado de estado también sea interactivo ahí.

**Cómo reproducirlo.** No se puede hoy: como la fila descartada nunca se renderiza (B2), este código es
inalcanzable en la interfaz actual. Lo señalo por lectura de código para que se tenga en cuenta al corregir
B2, porque en cuanto esa fila vuelva a renderizarse, este detalle queda expuesto: un cuadrado que visualmente
parece sólo indicar estado en realidad también es un botón funcional, duplicando el objetivo táctil sin
necesidad y sin el `aria-label` que sí tiene el botón "volver".

**Gravedad: importante** (queda oculta detrás de B2 hoy, pero se activa apenas se corrija; conviene resolverla
en el mismo cambio).

---

### Menores

#### M1 — El motivo autogenerado del tipo de viaje sugerido es gramaticalmente pobre

**Qué pasa.** Cuando el motor detecta el tipo por una palabra del destino, el texto que arma es literalmente
`Por "madrid" en el viaje.` (nombre del destino en minúscula, entre comillas, en medio de una oración) en vez
de una frase natural. El texto de ejemplo del propio documento de diseño (sección 4) es mucho más elaborado
("Te propongo Ciudad: es el que usaste en Barcelona y en Lisboa, que se parecen a este"), y lo que realmente
devuelve el motor en este caso es notoriamente más pobre.

**Cómo reproducirlo.** Crear un viaje con destino "Madrid" y sin historial previo, ir a la valija y mirar la
leyenda debajo del selector de tipo de viaje: "Te propongo Montaña: Por "bariloche" en el viaje." (usé
Bariloche en mi prueba).

**Qué debería pasar.** Un texto más cuidado, sin comillas alrededor de una palabra en minúscula en medio de
una oración con mayúscula inicial.

**Gravedad: menor.** El texto sale de `packing-engine.js` (`suggestTripType`), fuera de mi alcance para
re-testear como unidad, y `valija.html` lo muestra tal cual viene — no es un bug de integración, es una
oportunidad de pulido de copy en el motor.

---

#### M2 — El chip de ruta con destino vacío muestra las primeras letras del nombre del viaje en vez de un placeholder

**Qué pasa.** En el selector de tipo de viaje, si el viaje no tiene destino cargado, el chip de ruta
(`routeCodes`) cae al nombre del viaje y muestra sus primeras 3 letras en mayúscula (por ejemplo, "VIA" para
"Viaje sin destino") en vez de un placeholder tipo "···" que sí usa en otras partes de la app cuando no hay
ni destino ni nombre útil.

**Cómo reproducirlo.** Crear un viaje con destino vacío y nombre "Viaje sin destino", con fechas cargadas. Ir
a la valija: el primer chip dice "VIA".

**Qué debería pasar.** Un placeholder neutro quizás sería más claro que un acrónimo que parece un código IATA
real pero no lo es.

**Gravedad: menor.** Es un comportamiento heredado de `routeCodes()`, que ya existía antes de esta iteración y
se usa igual en `cardTrip()` de la lista de viajes — no es nuevo de Valija inteligente, pero esta feature lo
hereda tal cual en su propio selector.

---

## 3. Resumen para quien decida si esto se publica

**No lo publicaría en este estado.** Los cuatro hallazgos bloqueantes (B1-B4) comparten dos causas raíz muy
puntuales y baratas de corregir (no recalcular `conteo` en la escritura parcial, y no pasar
`{includeDismissed:true}` a `groupByCategory`), pero el efecto que tienen hoy es que **la interacción
principal de la feature — tildar y descartar — no se refleja de forma confiable en pantalla**. Un usuario real
que la abra la noche antes de viajar, tilde diez cosas y descarte tres, va a ver un contador que no se mueve y,
si alguna vez descarta todo lo que no necesita, una pantalla vacía. Eso es lo opuesto a la hipótesis del brief
("la lista se vuelve confiable... y deja de ser una tarea para volverse una revisión"): en la práctica hoy la
lista parece no reaccionar a lo que la persona hace.

La buena noticia es que el motor (VAL-32 en particular, y VAL-30 en sus reglas base) funciona muy bien y ya
está probado en profundidad; los caminos degradados (sin IA, sólo lectura, sin fechas, sin historial, viajes
extremos de 1 y 60 días, datos sucios) pasaron todos limpio. El problema está concentrado y localizado en dos
puntos exactos de `app/valija.html` (`bindPackingRows`/`applyItemState`/`Store.savePackingPatch` para B1, y la
llamada a `groupByCategory` en `renderPackingBoard` para B2/B3/B4), lo cual hace pensar que es una corrección
rápida antes de integrar de nuevo, no un rediseño.

Lo único que quedó sin cerrar del todo es I1 (comportamiento de la escritura parcial contra la base
compartida real), que no pude ejercitar en este entorno por falta de la capacidad `db`, y que recomendaría
confirmar manualmente en la app publicada con dos sesiones reales antes de dar por buena la historia de
concurrencia del diseño.
