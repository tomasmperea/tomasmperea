# ¿Cuánto cuesta por usuario pagar nosotros la IA de Valija?

**Historia:** VAL-102, primer paso de la opción C («B ahora, y el primer paso de C en paralelo», decisión del PM
del 12/10). **Esto es sólo un dimensionamiento: no se construyó nada** y no se llamó a ninguna API.
**Fecha:** 12/10/2026 · **Precios:** referencia oficial de la API de Anthropic, cacheada al 06/10/2026.

## La respuesta corta

Con los supuestos de abajo, **un usuario típico cuesta del orden de un dólar por año en IA** (USD 0,60 con Sonnet
5.5, rango 0,29 a 1,28), **no un dólar por mes**. Con Haiku 5.5 serían centavos (USD 0,01 por año). El caso malo
es un usuario intensivo con Opus 5.5: USD 7,49 por año, hasta ~16 si el razonamiento se dispara.

**Lo que esto permite decir:** el costo de la IA, por sí solo, no parece ser lo que frene la opción C. Lo que
sí puede romper la cuenta es **(a)** un usuario que abusa sin límite de uso, **(b)** que el razonamiento de los
modelos grandes sea mucho mayor que el que supuse, y **(c)** que el modelo barato no alcance en calidad (eso
no está medido). **Lo que esto NO permite decir:** que C sea rentable. No hay precio ni ingresos por usuario en
el proyecto, y el servidor, el hosting y la privacidad no están en estas cuentas.

**Cómo leer la confianza:** es una estimación por supuestos. **Ningún número de este documento es una
medición.** La sección «Qué no sé» dice cómo medirlo en una tarde.

---

## 1. Qué hace la IA hoy y cuánto pesa cada pedido

Leí `app/valija.html` y armé los prompts **con el código real de la app**: extraje `PackingEngine` e
`ImportEngine` del HTML y llamé a `destinationPrompt` y `buildImportPrompt`, igual que hace
`app/pruebas/val72-las-reservas-mandan.js`. Para el camino «pegar texto» extraje `buildTextImportPrompt`
tal cual. Los datos de entrada son de ejemplo (un mail de hotel de Madrid, vuelos EZE–MAD–EZE).

**Método para contar tokens (es una estimación):** caracteres ÷ 4. Es la regla de bolsillo habitual y para
español con acentos probablemente **subestima un poco** (más tokens de los que cuento). Por eso en cada
cálculo trato el tamaño de entrada como «±30%». No usé el contador real de tokens de la API porque no se llamó
a la API.

**«Token»**, para quien no lo vea todos los días: la unidad en que se cobra. Una palabra corta en español son
1 o 2 tokens. Se cobra distinto lo que le mandamos al modelo (**entrada**) y lo que contesta (**salida**), y la
salida es entre 5 y 10 veces más cara por token que la entrada.

### Los cuatro tipos de pedido

| # | Pedido | Qué se le manda (medido) | Entrada (tokens) | Salida visible (tokens) |
|---|---|---|---|---|
| 1 | **Importar pegando el texto de un mail** (`buildTextImportPrompt`) | Instrucciones (~1.000 caracteres) + el mail | **~1.300** con un mail de 4 KB | **~150** |
| 2 | **Importar un PDF con texto** (`buildImportPrompt`, modo texto; es el camino principal) | Instrucciones y reglas (~3.400 caracteres) + el texto del PDF | **~1.900** con 4 KB de texto | **~150** |
| 3 | **Importar una foto** (`buildImportPrompt`, modo imágenes) | Instrucciones (~2.900 caracteres, ~740 tokens) + la imagen | **~2.350** | **~130** |
| 4 | **Armar o recalcular la valija** (`destinationPrompt`) | Destino, fechas, resumen de las reservas y los ~28 ítems de la lista base | **~1.200** (900 sin reservas, 1.600 con 12 reservas y notas) | **~300** |

Cómo salieron esos números:

- **El mail de ejemplo que armé pesa 2,6 KB, no 4 KB.** Medí con ese y le sumé a mano la diferencia hasta 4 KB
  (por eso las entradas 1 y 2 son «con un mail de 4 KB»). Un mail real con mucho pie de página puede pesar más;
  el código recorta a 12.000 caracteres (`MAX_CARACTERES_TEXTO`), o sea un techo de ~3.000 tokens de texto.
- **La imagen: SUPUESTO mío, no medido.** Estimo ~1.600 tokens por foto de tarjeta de embarque. Sale de la regla
  que recuerdo de la documentación de Anthropic (tokens ≈ ancho × alto ÷ 750, con un tope de ~1.600 tokens
  por imagen porque se reduce a ~1.568 px de lado mayor). **Esa regla no está en la referencia que me pasaron y
  puede ser distinta en los modelos 5.5.** Rango razonable: 800 a 2.400. Si una foto de un PDF escaneado trae
  varias páginas, cada página suma otra imagen: la app prefiere leer el texto del PDF y sólo cae a imágenes
  como último recurso.
- **La salida:** una reserva en JSON mide ~90 a 110 tokens (medido con un ejemplo). Un mail trae a veces una
  reserva y a veces dos (ida y vuelta), por eso uso ~150 de promedio. La salida de la valija son ~5 ítems con su
  motivo (~220 tokens) más la frase de clima; uso 300.
- **Cada archivo es un pedido** en mi cuenta. En la realidad la app junta hasta 6 PDFs con texto en un solo
  pedido (VAL-60), así que esto es **conservador** para quien sube varios.
- **Todos los prompts están muy por debajo de los 100.000 tokens** del tramo barato de Haiku.

### El razonamiento (lo más incierto de todo)

Sonnet 5.5 y Opus 5.5 «piensan» antes de contestar y ese razonamiento **se cobra como salida**. No sé cuánto
piensan en estas tareas: depende de cómo se configure el pedido, y hoy la app no lo controla (los tiers
«default» y «complex» de la plataforma no dicen qué modelo ni qué esfuerzo usan). Supongo:

| | Bajo | Central | Alto | Por qué |
|---|---|---|---|---|
| Importar (leer un dato escrito) | 0 | **300** | 1.000 | Es copiar y ordenar; poco que pensar. |
| Valija (decidir qué falta en un destino) | 300 | **1.500** | 4.000 | Acá sí hay criterio: clima, enchufes, escalas. |

**Haiku 5.5: sin razonamiento** (supuesto, así lo dice el pedido). Si se lo activara, valdría la tabla de arriba.

---

## 2. Costo por pedido

Fórmula: `entrada × precio de entrada + (salida + razonamiento) × precio de salida`. Precios en USD por millón
de tokens: Haiku 0,10 / 0,50 · Sonnet 2,00 / 10,00 · Opus 4,00 / 20,00.
Cada celda: **central** (entre paréntesis, razonamiento bajo y alto).

| Pedido | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| 1 · Pegar un mail | USD 0,0002 | **0,0071** (0,0041 a 0,0141) | **0,0142** (0,0082 a 0,0282) |
| 2 · PDF con texto | USD 0,0003 | **0,0083** (0,0053 a 0,0153) | **0,0166** (0,0106 a 0,0306) |
| 3 · Foto | USD 0,0003 | **0,0090** (0,0060 a 0,0160) | **0,0180** (0,0120 a 0,0320) |
| 4 · Armar / recalcular la valija | USD 0,0003 | **0,0204** (0,0084 a 0,0454) | **0,0408** (0,0168 a 0,0908) |

**Lo que se ve:**

- **Opus cuesta exactamente el doble que Sonnet** en este uso (los dos precios se duplican). Haiku cuesta ~20 a
  75 veces menos que Sonnet, según el pedido y cuánto razone Sonnet.
- **En Sonnet y Opus casi todo el costo es salida y razonamiento, no lo que mandamos.** En la valija con Sonnet,
  la entrada es USD 0,0024 de los 0,0204 (12%). Esto importa para las palancas: achicar el prompt casi no mueve
  la cuenta; **controlar cuánto piensa el modelo, sí**.
- **La valija es el pedido más caro**, no el importar, aunque importar sea la función estrella.

---

## 3. Supuestos de uso (discutibles, y mandan sobre el resultado)

**No hay ningún dato de uso real.** La beta guarda en cada teléfono las últimas 30 llamadas (`ValijaTier.log()`:
tarea, tier, cuánto tardó, si salió bien), pero **no guarda tokens**, y nadie las juntó. Estos perfiles son
una hipótesis mía para ordenar la discusión; el PM los puede cambiar y la tabla de la sección 4 se recalcula.

| Supuesto | Liviano | **Típico** | Intensivo | De dónde sale |
|---|---|---|---|---|
| Viajes con IA por año | 1 | **3** | 8 | Inventado. Liviano = un viaje de vacaciones; intensivo = alguien que viaja por trabajo. |
| Reservas importadas por viaje | 3 | **6** | 12 | Inventado. Un viaje típico: 2 vuelos, 1 o 2 alojamientos, un traslado o auto. |
| Cómo entran | 40% mail pegado · 40% PDF · 20% foto | **30% · 40% · 30%** | 20% · 30% · 50% | Inventado. Supone que la foto crece con el uso intensivo. |
| Reintentos y archivos que no dan resultado | +20% | **+20%** | +20% | Inventado. Una lectura fallida o vacía igual se cobra. |
| Veces que se **arma** la valija por viaje | 1 | **1** | 2 | «Rehacer la lista» o cambiar el tipo de viaje. |
| Veces que se **recalcula** por viaje | 2 | **6** | 15 | Ver abajo. |
| Mes | año ÷ 12 | año ÷ 12 | año ÷ 12 | Los viajes no se reparten parejo: un mes con viaje cuesta más que el promedio. |

**Sobre «recalcular», que es el supuesto más sensible y el que leí en el código:** cada vez que la persona
**guarda, edita o borra una reserva a mano** y ya tiene una valija armada, la app hace **un pedido al modelo**
(`checkPackingPlan` → `recalcularPlanContra` → `planListUpdateAsync`). También lo hace una vez por tanda de
importación, al guardar el viaje si cambió algo que mueve la valija (VAL-63), y **otra vez al tocar «Actualizar»**
(la app recalcula antes de aplicar). No hay un tope ni una espera: tres ediciones seguidas son tres pedidos. Hoy
esto no le cuesta nada a Valija porque lo paga la cuenta de quien mira; **si lo pagamos nosotros, es el primer
lugar donde mirar.** Los 2 / 6 / 15 por viaje suponen: import (1 a 2 tandas), ediciones manuales y un «Actualizar».

Pedidos por año que resultan: **liviano** 3,6 importaciones + 3 de valija · **típico** 21,6 + 21 · **intensivo**
115 + 136.

---

## 4. Costo por usuario (USD)

Cada celda: **central** (bajo a alto, variando sólo el razonamiento). «Mes» = central ÷ 12.

| Perfil | Modelo | Por año | Por mes |
|---|---|---|---|
| **Liviano** | Haiku 5.5 | 0,002 | 0,0001 |
| | Sonnet 5.5 | **0,09** (0,04 a 0,19) | 0,007 |
| | Opus 5.5 | **0,18** (0,09 a 0,38) | 0,015 |
| **Típico** | Haiku 5.5 | 0,011 | 0,001 |
| | Sonnet 5.5 | **0,60** (0,29 a 1,28) | 0,050 |
| | Opus 5.5 | **1,21** (0,58 a 2,56) | 0,101 |
| **Intensivo** | Haiku 5.5 | 0,07 | 0,006 |
| | Sonnet 5.5 | **3,74** (1,77 a 7,95) | 0,31 |
| | Opus 5.5 | **7,49** (3,53 a 15,90) | 0,62 |

Para tener una escala: **1.000 usuarios típicos con Sonnet cuestan unos USD 600 por año** (290 a 1.280), o
USD 50 por mes. Con Haiku, USD 11 por año.

**Qué mueve el resultado, de más a menos** (probado cambiando de a uno, usuario típico con Sonnet, USD 0,60
por año de base):

1. **Cuánto piensa el modelo en la valija:** de 0,29 a 1,28 por año (casi ×4 entre extremos). Es el supuesto
   más grande y el menos conocido.
2. **Cuántos recálculos por viaje:** con 2 en vez de 6, USD 0,36; con 15, USD 1,16.
3. **El modelo elegido:** Haiku vs Sonnet vs Opus = ×1 / ×~55 / ×~110 (típico, con razonamiento central).
4. **Cuántos viajes por año.** Es lineal: el doble de viajes, el doble de costo.
5. **Lo que pesa cada archivo** (±30% de entrada): mueve poco en Sonnet y Opus, porque casi todo es salida.
   En Haiku sí mueve, pero partiendo de centavos.

**Dónde va la plata en el típico con Sonnet:** ~USD 0,43 (71%) en armar y recalcular la valija, ~USD 0,18 (29%)
en importar.

---

## 5. Palancas para bajar el costo

**Ninguna de éstas promete calidad:** la calidad de un modelo más chico, o de un razonamiento más corto, **no
está medida**. Cada una tiene que probarse con reservas reales antes de decidir.

| Palanca | Cuánto podría bajar | Lo que hay que saber |
|---|---|---|
| **Usar Haiku en la importación de texto** (mail pegado y PDF con texto) y un modelo mayor sólo para foto y valija | Típico: de USD 0,60 a ~0,49 por año con Sonnet (-18%). Poco, porque la plata está en la valija. | Es leer un dato escrito; la hipótesis es que alcanza, **pero no está medido**: un código de reserva mal leído es peor que uno vacío. |
| **Usar Haiku también para la valija** | De ~0,60 a ~0,01 por año. Es la palanca más grande. | La valija exige criterio (qué enchufe, qué clima, qué escala). **Es donde más puede perderse calidad**, y no hay medición. Hay que comparar listas lado a lado. |
| **Limitar el razonamiento** de Sonnet/Opus (si el pedido lo permite) | Es el supuesto que más pesa: de USD 1,28 a 0,29 por año entre extremos. | **No sé si la API 5.5 lo deja configurar por pedido en este caso ni cómo**: confirmarlo en la documentación antes de contar con esto. |
| **Recalcular menos**: no llamar al modelo cuando lo editado no cambia destino, fechas ni reservas con lugar; esperar unos segundos y juntar ediciones seguidas; no recalcular dos veces al «Actualizar» | De 15 a 2 recálculos baja el típico de 1,16 a 0,36 por año. Es la palanca que no depende de ningún modelo. | Cambia el comportamiento de la app (la valija se actualiza menos seguido). Es una decisión de producto, no sólo de costo. |
| **Caché del prompt fijo** | **Chica.** Sonnet lee caché a USD 0,20 vs 2,00 de entrada. La parte fija de la valija son ~700 tokens: ahorra ~USD 0,001 por pedido (~5%). | Hoy **las instrucciones fijas van después de los datos** (en el prompt de texto, las reglas van tras el mail), y la caché sólo sirve para un comienzo idéntico: habría que reordenar los prompts, y eso cambia lo que lee el modelo. La caché dura poco, así que con pocos usuarios casi nunca se reaprovecha. No tengo el precio de escribir en caché ni de leerla en Haiku, ni el largo mínimo para cachear: **no los inventé**. |
| **Lotes (Batch, -50%)** | Ninguna para lo que espera el usuario. | Es asincrónico: sirve para procesar de noche, no para alguien mirando la pantalla. |
| **Juntar archivos en un pedido** | Hasta 6 PDFs con texto en uno (ya está hecho, VAL-60). | Ahorra las instrucciones repetidas (~850 tokens por PDF) pero hay que revisar que no mezcle datos entre archivos. |
| **Tope de uso por persona** | No baja el costo promedio: **acota el peor caso**. | Es necesario igual (ya figura en `ia-para-cualquiera.md`). Con un tope de, por ejemplo, 30 pedidos por mes, el peor usuario con Opus cuesta como máximo ~USD 1,2 por mes. |

---

## 6. Qué no sé, y cómo se mide

| No sé | Por qué importa | Cómo se mide |
|---|---|---|
| **Los tokens reales** de cada pedido | Todo el documento usa caracteres ÷ 4 y una regla recordada para imágenes. | Correr unos 30 pedidos reales con la API (10 mails pegados, 10 PDFs, 5 fotos, 5 valijas) y leer el campo **`usage`** de cada respuesta: trae tokens de entrada y de salida exactos. Un script de una tarde, sin tocar la app. |
| **Cuánto razonan los modelos 5.5 en esta tarea** | Es el supuesto que más mueve el costo (×4). | Lo mismo: `usage` separa la salida total; comparar contra el largo del JSON visible. Probar con el razonamiento por defecto y con el más corto que permita la API. |
| **Cuánto usa la gente de verdad** | Los tres perfiles son inventados. | Pedirle a cada tester de la beta que pegue `ValijaTier.resumen()` (consola del navegador) al terminar: cuenta llamadas por tarea. Sólo guarda las últimas 30 y no tiene tokens, pero alcanza para ver si el recálculo domina. **Eso es un pedido a testers, no una construcción.** |
| **Si Haiku alcanza en calidad** | Es la palanca más grande y la menos respaldada. | Con las mismas reservas reales, comparar campo por campo lo que leen Haiku y Sonnet (códigos de reserva, fechas, horas), y las listas de valija a ciegas. No hay prueba de eso hoy. |
| **Qué modelo usan hoy «default» y «complex»** | No lo dice la plataforma; por eso armé escenarios por modelo y no elegí uno. | No se puede saber desde acá. Al pasar a la API propia se elige explícitamente. |
| **Cuánto cuesta lo que no es IA** | Servidor, hosting, base de datos con cuentas, privacidad. | Fuera de este alcance; lo dimensiona quien arme C. |
| **Cuánto cuesta un usuario que no es «uno de los tres»** | Un caso abusivo (alguien que pega cientos de mails) puede costar más que cien usuarios típicos. | Sólo lo acota el tope de uso por persona. |

## 7. Qué decisión cambian estos números

- **Si el PM considera que ~USD 1 por usuario por año (Sonnet, típico) es tolerable**, el costo de la IA no
  frena la opción C y el trabajo pasa a lo que sí es incierto: calidad con el modelo elegido, topes de uso y
  el costo de construir y operar el servidor.
- **Si no es tolerable, el orden de palancas es:** (1) recalcular menos, (2) limitar el razonamiento, (3)
  probar Haiku en la valija. Las tres requieren medir antes de adoptarlas.
- **Para llegar a USD 1 por mes en un usuario típico con Sonnet** habría que multiplicar el uso por ~20. Dicho
  de otro modo: un error de ×3 o ×4 en mis supuestos no cambia la conclusión; un error de ×20 sí, y sólo el
  usuario intensivo con Opus se acerca (USD 0,62 por mes).
- **Lo que no puedo decir** es si conviene o no, porque no hay un precio de Valija para comparar.

**Próximo paso sugerido (barato, sin construir la app):** el script de 30 pedidos con `usage`. Cierra los
primeros dos «no sé» de la tabla y convierte este documento de estimación en medición.

---

*Reproducción de los tamaños: se extraen `PackingEngine` e `ImportEngine` de `app/valija.html` (mismo método que
`app/pruebas/val72-las-reservas-mandan.js`) y se miden los textos de `destinationPrompt` y `buildImportPrompt`.
El script de medición quedó en la carpeta temporal de la sesión y no se agregó al repo.*
