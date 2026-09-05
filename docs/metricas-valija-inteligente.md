# Métricas e instrumentación — Valija inteligente

**Épica:** VAL-30
**Escribe:** Analista de producto
**Estado:** definido antes de construir
**Consumen este documento:** motor de sugerencias, QA, Product Owner

Este documento define cómo sabríamos si la hipótesis del brief es verdad, antes de escribir el motor. Lo que
está acá se decide ahora justamente para no elegir el número después de ver el resultado.

---

## 0. La pregunta que hay que responder

El roadmap le pone una pregunta a la iteración 1.5, y es la que manda:

> **¿La app se abre también el día antes de viajar, y no solo mientras se planifica?**

Y fija el criterio de corte: *las listas llegan al día del viaje con más de la mitad marcada*.

Esa pregunta es sobre un momento de uso. El brief agrega el mecanismo por el cual ese momento existiría: la
lista se abre la noche anterior **si vale la pena abrirla**, o sea si es específica y confiable. Nadie vuelve
a una lista que le hace perder el tiempo. Entonces hay una pregunta y una condición debajo:

| Nivel | Qué afirma | Cómo se falsea |
|---|---|---|
| **El momento** (roadmap) | La app se usa la noche anterior, arriba de la lista | Si la lista se genera y no se toca nunca más, el momento no existe |
| **La causa** (brief) | La lista es confiable, y a partir del 2.º o 3.º viaje se revisa en vez de armarse | Si hay que corregir la mitad, o si el viaje 3 no es mejor que el 1, no hay razón para volver |

Se miden las dos. Medir solo el momento deja sin saber por qué pasó lo que pasó, y medir solo la calidad de la
lista deja sin responder la pregunta del roadmap. Cada métrica de acá abajo contesta uno de los dos niveles.
Si no contesta ninguno, no está.

**Sobre el criterio de corte del roadmap.** "Más de la mitad marcada" necesita una precisión antes de poder
calcularse: **descartar un ítem cuenta como marcarlo.** Un descarte es una decisión tomada sobre la lista, y
es además la señal que alimenta todo el aprendizaje. Si el criterio contara solo lo empacado, castigaría
exactamente la conducta que la feature necesita fomentar. Es la métrica M2 de abajo, con el umbral en 0,5 que
el roadmap ya fijó.

### Advertencia de calendario, arriba de todo

La pregunta del roadmap se puede responder en esta iteración: alcanza con un viaje real para ver si la lista
se toca la noche anterior. **La condición de abajo no.** Un usuario hace tres o cuatro viajes por año, y tres
viajes *del mismo tipo* son entre doce y dieciocho meses. La afirmación del brief sobre el segundo o tercer
viaje no se valida dentro de esta iteración con este usuario, y no es un problema de instrumentación sino de
aritmética de calendario. De ahí salen dos consecuencias que atraviesan el documento:

1. El backtest (sección 2.3) deja de ser un lujo y pasa a ser el método principal de evaluación del
   aprendizaje.
2. La decisión de seguir o parar con VAL-32 se compromete **ahora**, con el criterio escrito, para no terminar
   defendiendo la feature con la única evidencia que va a haber: una anécdota.

---

## 1. Las métricas de la feature

Cuatro. Cada una con su cálculo, su banda de éxito y la decisión que cambia. Al final de la sección están las
que descarté y por qué, que es tan parte del trabajo como las que quedaron.

### Vocabulario común

Todas las fórmulas se calculan sobre **una lista** (un viaje, una lista de equipaje) y usan los mismos cinco
conjuntos:

| Símbolo | Qué es |
|---|---|
| `S` | Ítems que propuso el motor: origen `regla`, `historial` o `ia` |
| `Sp` | De `S`, los marcados **empacados** — los aciertos |
| `Sd` | De `S`, los **descartados** — el ruido explícito |
| `Su` | De `S`, los que quedaron **sin resolver** — el ruido silencioso |
| `Mp` | Ítems **agregados a mano y empacados** — los huecos de la propuesta |

`S = Sp + Sd + Su`. El corte se toma al terminar el viaje, y los ítems que la persona agregó a mano pero
tampoco empacó quedan afuera: son ruido que se generó ella, no error nuestro.

---

### M1 · Acierto de la lista

**La métrica principal.** Mide la mitad "reemplaza".

```
Acierto = Sp / (Sp + Sd + Su + Mp)
```

El numerador es lo que propusimos y terminó en el bolso. El denominador es la unión entre lo que propusimos y
lo que la persona realmente llevó. Es un índice de coincidencia entre dos conjuntos: la propuesta y la valija.

Está construido así a propósito, porque castiga los dos errores opuestos con la misma vara. Una lista de 200
ítems no se olvida de nada y es inservible: `Sd + Su` la hunde. Una lista de 5 ítems obvios no molesta a nadie
y tampoco sirve: `Mp` la hunde. Cualquier métrica que mire un solo lado premia una de esas dos listas malas.

**Bandas de éxito**

| Acierto | Lectura | Decisión |
|---|---|---|
| < 0,50 | Es un borrador, no una propuesta — **salvo que M2 esté por debajo de 0,5, en cuyo caso lo que falló es el uso y no la lista** | Con M2 sana: frenar VAL-32, porque el problema son las reglas base y no la personalización |
| 0,50 – 0,70 | Sirve pero todavía es trabajo | Seguir, y podar por donde indique la descomposición de abajo |
| ≥ 0,70 en el viaje 1, ≥ 0,80 en el 3.º | Se cumple la promesa: se revisa, no se arma | Habilitar los P1: VAL-33 destino y VAL-34 compartir |

De dónde salen los números: en una lista de 35 ítems, 0,80 son unas 7 correcciones. Por arriba de eso la
persona siente que está armando la lista, no revisándola, que es exactamente lo que el brief promete evitar.
**Son umbrales declarados, no medidos.** Se revisan después de las dos primeras listas reales, y el momento de
revisarlos es antes de mirar el resultado del viaje 3, no después.

**Descomposición, que es la que decide qué se toca**

El acierto solo dice que algo anda mal. Estas dos lo ubican:

```
Ruido  = (Sd + Su) / S        de lo que propusimos, cuánto sobró
Huecos = Mp / (Sp + Mp)       de lo que se llevó, cuánto no se nos ocurrió
```

| Qué domina | Decisión |
|---|---|
| Ruido alto, huecos bajos | Sobra lista. Subir el umbral de las reglas por cantidad de días y recortar categorías enteras |
| Huecos altos, ruido bajo | Falta lista. Es el caso en el que el historial personal más aporta: acelerar VAL-32 |
| Los dos altos | La lista es genérica. El tipo de viaje no está discriminando nada y hay que revisar la taxonomía |

**Y el corte por origen, que decide qué capa se apaga.** El mismo acierto calculado por separado sobre los
ítems de origen `regla`, `historial` e `ia`. Si los ítems de `historial` aciertan menos que los de `regla`, la
memoria personal está empeorando la lista y la decisión es subir el umbral de dos apariciones a tres, o apagar
la capa. Si los de `ia` aciertan menos que los de `regla`, VAL-33 no vale su costo y la lista base alcanza.

Este corte no cuesta un dato extra: VAL-32 ya obliga a mostrar en pantalla qué viene del historial y qué de
las reglas generales, así que el campo tiene que existir igual.

> **Regla de atribución, para que el corte no mienta.** `origen` guarda la capa que **puso** el ítem en la
> lista, no la que lo hubiera puesto. Si una regla ya lo agregó, el origen queda `regla` aunque el historial
> también lo hubiera sugerido. Una implementación ingenua le acredita al historial todo lo que las reglas ya
> resolvían solas, y el aprendizaje mide mucho mejor de lo que es.

---

### M2 · Resolución de la lista

**Es el criterio de corte que fija el roadmap, y la clave para interpretar M1.**

```
Resolución = (Sp + Sd) / S
```

Qué porcentaje de lo propuesto la persona efectivamente tocó, para empacarlo o para descartarlo. Es la
traducción calculable de "las listas llegan al día del viaje con más de la mitad marcada", con el descarte
contando como marca por lo dicho en la sección 0. El umbral de 0,5 lo puso el roadmap, no yo.

| Resolución | Lectura | Decisión |
|---|---|---|
| ≥ 0,80 | La lista se usó de verdad | M1 se lee y se cree |
| 0,50 – 0,80 | Se usó a medias | M1 se lee con reserva, y hay que preguntar por qué quedaron ítems colgados |
| < 0,50 | La lista se abandonó | **M1 no se lee.** El problema es la interacción, no el motor: la lista es demasiado larga o marcar cuesta demasiado. Se acorta la lista, no se mejora el algoritmo |

M2 no está para tapar un agujero de M1: los ítems sin resolver ya están en el denominador de M1, así que una
lista abandonada no puede sacar buen acierto. De hecho las dos métricas están atadas por una desigualdad que
conviene tener presente:

```
Acierto ≤ Sp / S ≤ Resolución
```

**El acierto nunca puede ser mayor que la resolución.** Un acierto de 0,70 garantiza que más del 70% de la
lista se marcó, o sea que el criterio del roadmap se cumplió con margen. Por eso M2 no es un segundo titular
sino el diagnóstico de M1: cuando el acierto da bajo, M2 dice si fue una lista mala o una lista abandonada, y
son dos problemas con dos equipos distintos del otro lado. **Una lista abandonada no es una lista buena, y sin
M2 las dos se ven igual.**

---

### M3 · Empacado en la ventana de salida

**Es la respuesta directa a la pregunta del roadmap.** Ninguna otra métrica dice si la app se abre la noche
anterior; las demás dicen si valía la pena abrirla.

Con los sellos de tiempo de cada ítem: **¿hubo al menos un ítem marcado dentro de las 48 horas previas a la
fecha de salida?** Se cuenta por viaje, no por ítem. La métrica es la proporción de viajes que lo cumplen.

| Resultado | Decisión |
|---|---|
| Se cumple en 2 de cada 3 viajes | El momento existe. El correo del día anterior de la iteración 2 tiene que llevar la lista, y la lista se gana un lugar en la pantalla de inicio cuando el viaje está cerca |
| Toda la actividad es del día de la generación, semanas antes | El momento no existe: es un artefacto de planificación, no de empacado. **No se construye el correo de empacado** y los P1 de la épica se reordenan |
| No se toca nunca después de generar | La lista se genera por curiosidad. Es la señal más fuerte para parar la épica |

---

### M4 · Olvidos reportados al volver

**No se instrumenta. Se pregunta.** Una pregunta al volver del viaje: *¿te faltó algo?*

Es la única métrica que toca el problema real que enuncia el brief, "olvidar lo que hacía falta", y ninguna
instrumentación puede darla. **Un ítem que la persona olvidó por completo no aparece en ningún lado de los
datos: no lo sugerimos, no lo descartó, no lo agregó.** Es un silencio, y los silencios no se registran. El
sistema solo puede ver aquello en lo que la persona pensó.

| Resultado | Decisión |
|---|---|
| 0 – 1 olvido por viaje | Aceptable. Los olvidos impredecibles son parte del viaje |
| Un olvido que una regla podía anticipar (el adaptador yendo a España) | Se convierte en regla esa misma semana. No es una métrica, es una entrada de backlog |
| ≥ 3 olvidos en dos viajes seguidos | La lista no está haciendo su trabajo aunque M1 dé bien. Se revisa la cobertura de categorías antes que cualquier otra cosa |

Es también el único dato **no contaminado por la propia sugerencia**, y por eso vale más que su prolijidad
aparente. Ver el supuesto S5.

---

### Diferida a la iteración 2 · Listas con más de una persona marcando

Cuántas listas compartidas tienen marcas de más de un participante. Cambia una decisión concreta que hoy está
cerrada: el brief deja fuera de alcance las listas por persona dentro del mismo viaje. Si en la práctica dos
personas marcan sobre la misma lista, la ambigüedad de "¿quién empacó el cargador?" se vuelve real y esa
decisión hay que reabrirla.

**No se puede medir hoy** porque requiere saber quién marcó, y hoy no hay identidad: el permiso es por valija,
no por persona. Llega con las cuentas propias de la iteración 2.

---

### Lo que decidí no medir

| Descartada | Por qué |
|---|---|
| Listas generadas | Vanidad pura. Generar es gratis y no dice nada de si sirvió |
| Ítems sugeridos por lista | Vanidad, y peor: incentiva listas largas, que es justo el fracaso que M1 castiga |
| Aperturas de la explicación de cantidad | No cambia ninguna decisión. Explicar las cantidades ya es una decisión de producto tomada, y no la revertiríamos porque se abra poco |
| Tiempo en la pantalla de la lista | No distingue interés de confusión. Más tiempo puede ser mejor o mucho peor |
| Porcentaje de listas con la capa inteligente disponible | Es salud técnica, no valor. Lo que importa es si los ítems de esa capa aciertan, y eso ya está en el corte por origen de M1 |

---

## 2. La métrica del aprendizaje

Es la difícil. "La lista mejora viaje a viaje para la misma persona" tiene tres trampas encima, y hay que
sacarlas antes de escribir una fórmula.

**Trampa 1: comparar viajes distintos.** El acierto de una lista de playa de 4 días contra una de ciudad de 15
no compara motores, compara viajes. Por eso toda comparación es **dentro de la misma persona y el mismo tipo
de viaje**, que es además el corte que ya define VAL-32.

**Trampa 2: confundir un motor roto con una hipótesis falsa.** Si el viaje 3 no mejora, puede ser que la
memoria personal no aporte nada, o puede ser que el código no esté aplicando lo que aprendió. Son dos
conclusiones opuestas y una lleva a parar la épica y la otra a arreglar un bug. Hay que poder distinguirlas, y
para eso está la verificación mecánica de 2.2.

**Trampa 3: el n de calendario.** Ya está dicho arriba: tres viajes del mismo tipo son más de un año. Por eso
2.3.

### 2.1 · La métrica: Δ acierto dentro del tipo

Para una persona y un tipo de viaje, se ordenan las listas por fecha de salida: `L1, L2, L3...` y se calcula
M1 sobre cada una.

```
Δ = Acierto(Ln) − Acierto(L1)
```

El brief se compromete a algo bastante preciso, "confiable a partir del segundo o tercer viaje", así que la
condición de éxito también lo es:

| Condición | Veredicto |
|---|---|
| `Acierto(L2) > Acierto(L1)` y `Acierto(L3) ≥ 0,80` | La hipótesis se sostiene |
| `Acierto(L3) > Acierto(L1)` pero por debajo de 0,80 | Aprende pero no alcanza. Ajustar: bajar el umbral de dos apariciones a una para los ítems agregados a mano |
| `Δ ≤ 0` con la verificación mecánica en cero errores | **La hipótesis es falsa.** El historial personal no tiene señal suficiente. Se apaga la capa de aprendizaje y el presupuesto se mueve a VAL-33, donde el valor estaría en la especificidad del destino y no en la memoria |

Cada Δ se reporta siempre pegado a los atributos del viaje: días, tipo, tamaño de la lista y si la capa
inteligente estuvo disponible. **Un Δ entre dos listas con atributos muy distintos no se lee, se descarta.**
Con un solo usuario no hay forma de controlar esas variables con estadística, así que se controlan mirándolas
y absteniéndose.

### 2.2 · La verificación mecánica: errores no aprendidos

**No es una métrica de producto, es la condición para poder interpretar la anterior.** VAL-32 define reglas
determinísticas, y una regla determinística se verifica, no se estima.

Sobre las listas previas del mismo tipo, antes de generar la lista actual:

- **Ruido persistente.** Un ítem descartado en 2 listas previas del tipo y vuelto a sugerir.
- **Hueco persistente.** Un ítem agregado a mano y empacado en 2 listas previas del tipo y ausente de la
  sugerencia.

```
Errores no aprendidos = (ruido persistente + hueco persistente) / oportunidades de aprendizaje
```

donde las oportunidades son los ítems que cruzaron el umbral de dos apariciones antes de esta lista.

**El valor de éxito es cero. No una banda, cero.** Cualquier valor por encima es un defecto de VAL-32.

Y esto es lo que compra: **si hay errores no aprendidos, ese viaje no dice nada sobre la hipótesis.** Se
arregla el motor y se vuelve a medir. Sin esta verificación, un bug se lee como "la gente no se beneficia de
la personalización" y se mata una feature buena por un error de comparación de cadenas.

Es además la única cosa de todo el documento que **se puede afirmar con un solo caso**: si la persona descartó
dos veces el secador y vuelve a aparecer, eso es falso, y no hace falta ninguna muestra para decirlo.

### 2.3 · El método: backtest sobre las listas ya guardadas

Esperar tres viajes reales no es viable, pero el aprendizaje **no necesita viajes nuevos para evaluarse**.

Con las listas ya guardadas se regenera la lista del viaje `n` alimentando el motor solo con el historial de
`1..n−1`, y se compara la propuesta contra lo que la persona efectivamente empacó y descartó en `n`. Da un
acierto simulado por lista y un Δ simulado, calculable en una tarde.

Qué habilita:

- Evaluar un cambio de motor sin esperar al próximo viaje.
- Probar variantes del umbral (2 apariciones contra 3) sobre los mismos datos.
- Fijar el umbral de éxito de M1 sobre datos propios en vez de sobre mi intuición.

Qué no habilita, y hay que decirlo cada vez que se use: **el resultado real de la lista `n` no es
independiente de lo que se sugirió en `n`.** La persona marcó sobre una propuesta, así que "lo que empacó" ya
está teñido por lo que le ofrecimos. El backtest mide qué tan bien el motor reproduce una decisión que él
mismo ayudó a formar. Sirve para comparar motores entre sí, no para afirmar que la lista es objetivamente
buena. Para eso está M4, que es la única medición no anclada.

---

## 3. Plan de instrumentación

**No se instala analítica en esta iteración.** No hay backend, y además una lista de equipaje contiene la
categoría salud: qué medicación lleva una persona. Eso no sale hacia una herramienta de terceros para
calcular un acierto. La regla se sostiene sola: cada dato registrado hay que justificarlo, y este no se
justifica.

La buena noticia es que **no hace falta**. La lista guardada ya es el dato: si cada ítem conserva su origen y
su destino final, el estado de la base contiene las cinco métricas sin un solo evento.

### 3.1 · Lo que se puede medir hoy, desde el estado guardado

Cada ítem de la lista, como documento propio bajo el viaje, con estos campos:

| Campo | Valores | Para qué | ¿Extra? |
|---|---|---|---|
| `nombre` | texto como se muestra | mostrar | ya requerido |
| `clave` | normalizado: minúsculas, sin acentos, singular, sin espacios extra | cruzar el mismo ítem entre viajes | lo necesita VAL-32 para funcionar |
| `categoria` | documentacion, ropa, calzado, higiene, electronica, salud, destino | agrupar y ubicar huecos | ya requerido por VAL-30 |
| `cantidad` y su motivo | número y texto | producto, no métrica | ya requerido por VAL-30 |
| `origen` | `regla` \| `historial` \| `ia` \| `manual` | corte por capa de M1 | ya requerido por VAL-32 |
| `estado` | `sugerido` \| `empacado` \| `descartado` | los tres destinos posibles | ya requerido por VAL-31 |
| `empacadoEn` | ISO, al pasar a empacado | M3, la ventana de salida | **el único campo extra que pido** |
| `createdAt` / `updatedAt` | ISO | distinguir lo generado de lo agregado después | ya los escribe `Store` solo |

Y en el viaje o en la lista:

| Campo | Valores | Para qué |
|---|---|---|
| `tipoViaje` | playa, ciudad, montaña, trabajo, aventura, mixto | es la clave de agrupación de todo el aprendizaje. Ya lo pide VAL-30 |
| `generadaEn` | ISO | separar el momento de generar del de empacar |
| `capaInteligente` | `ok` \| `sin-conexion` | una lista sin la capa de destino no es comparable con una que la tuvo. Ya lo pide VAL-33 para avisar en pantalla |

**Cuenta final: un campo nuevo,** `empacadoEn`. Todo lo demás ya lo exigen los criterios de aceptación o lo
escribe `Store` por su cuenta. La instrumentación de esta iteración es, casi entera, no perder información que
la feature ya genera.

**La decisión que hace posible todo esto es una sola:** `estado` con tres valores en vez de un booleano
`empacado`. Un booleano colapsa "lo descarté" con "no lo toqué", y el descarte es exactamente la señal que
alimenta el aprendizaje. Si esto se implementa como un checkbox, la épica queda sin forma de medirse y VAL-32
queda sin insumo.

**Cómo se leen los datos, en concreto.** La base del artifact se puede leer directamente desde afuera de la
app, sin construir nada: se exportan los documentos de `trips` y sus listas y se calculan las métricas con un
script. No es un tablero, es **una lectura manual, una vez por viaje terminado**, unas tres o cuatro veces por
año. Para este volumen alcanza y sobra, y construir un tablero sería el error clásico de instrumentar más de
lo que se va a mirar.

Cuando la app corre en modo local, contra `localStorage`, los datos no salen del teléfono. Esa lista hay que
exportarla a mano o se pierde para la medición. Es una limitación real y conviene saber en qué modo se generó
cada lista antes de sacar conclusiones.

### 3.2 · Tres cosas que ingeniería tiene que garantizar o los datos no sirven

No son pedidos de instrumentación, son condiciones para que lo guardado se pueda leer. Las tres nacen del
criterio de VAL-30 de que regenerar actualiza la lista existente en vez de duplicarla.

1. **Regenerar no resucita un descarte.** Si al regenerar un ítem descartado vuelve a `sugerido`, se borra la
   señal más importante que tenemos. El descarte es permanente dentro de la lista.
2. **Regenerar no pisa el `origen` de un ítem que ya existe.** Si lo pisa, el corte por capa de M1 mide la
   última regeneración y no quién acertó.
3. **La `clave` normalizada la calcula el motor y se guarda con el ítem.** Motor y medición tienen que usar
   exactamente la misma clave. Si el umbral de dos apariciones se calcula con una normalización y la medición
   con otra, los dos números van a discrepar y nadie va a saber cuál está mal.

### 3.3 · Lo que espera a la iteración 2

| Qué | Por qué espera |
|---|---|
| Quién marcó cada ítem (métrica de listas compartidas) | Requiere identidad por persona. Hoy el permiso es por valija |
| Historial de cambios de un ítem: cuántas veces se marcó y desmarcó | El estado solo guarda el último valor. Necesita un registro de eventos, y eso necesita servidor |
| Cálculo automático y comparación entre viajes | Necesita el proceso diario que la iteración 2 ya trae para los correos |
| Que la lista viaje en el correo de la noche anterior, y si se abre | Es infraestructura de la iteración 2, y depende de que M3 dé positivo |
| Cualquier agregación entre usuarios | Requiere más de un usuario. Ver la sección 5 |

---

## 4. Supuestos

A la vista, con qué pasa si están mal y cómo nos daríamos cuenta.

**S1 · La persona marca mientras empaca, no todo junto al final.**
De ahí sale que M3 mida un momento real y que M1 refleje la valija.
*Si está mal:* M3 mide un trámite administrativo y no un momento de uso.
*Cómo se detecta:* si todos los `empacadoEn` de una lista caen en el mismo minuto, no hubo sesión de empacado,
hubo un repaso declarativo.
*Qué se hace:* esas listas se leen como declaración, no como conducta, y M3 se reporta aparte para ellas.

**S2 · Descartar significa "no lo quiero", no "sacalo de mi vista".**
Es el supuesto que sostiene todo VAL-32.
*Si está mal:* un ítem descartado porque ya vive dentro del bolso queda suprimido para siempre, y el motor
aprende exactamente lo contrario de lo que corresponde.
*Cómo se detecta:* preguntando. Con un usuario, se le preguntan los 3 o 4 descartes de un viaje, no hace falta
más.
*Qué se hace:* separar "descartar" de "no aplica esta vez", que son dos intenciones distintas metidas hoy en
un mismo botón.

**S3 · El tipo de viaje se elige consistente entre viajes parecidos.**
Es la clave de agrupación de absolutamente todo el aprendizaje.
*Si está mal:* la misma escapada se marca "ciudad" una vez y "mixto" la siguiente, el historial nunca acumula
dos apariciones del mismo ítem y **VAL-32 no se activa jamás**. El aprendizaje se leería como inexistente
cuando en realidad nunca corrió.
*Cómo se detecta:* contar listas por tipo. Seis tipos con un viaje cada uno es la señal.
*Qué se hace:* agrupar tipos vecinos, o caer al historial personal global sin filtrar por tipo, que con pocos
viajes probablemente sea mejor de todas formas.
**Es el supuesto más frágil de la lista y el que más silenciosamente rompe la feature.**

**S4 · Los nombres de los ítems se pueden cruzar entre viajes.**
"remera", "Remeras", "remera blanca" tienen que poder reconocerse como el mismo ítem.
*Si está mal:* el umbral de dos apariciones nunca se cumple para los ítems agregados a mano, la métrica de
errores no aprendidos da cero por la razón equivocada, y concluimos "no aprende" cuando la verdad es "no
cruza".
*Cómo se detecta:* listar las claves normalizadas de dos viajes del mismo tipo y mirarlas. Es literalmente
mirar veinte líneas de texto.
*Qué se hace:* es el motivo por el que la `clave` es un campo guardado y no un cálculo al vuelo.

**S5 · Lo que la persona empaca es una preferencia propia y no obediencia a la sugerencia.**
*Si está mal:* la persona acepta todo lo que se le ofrece, M1 tiende a 1 y no mide calidad sino docilidad.
*Cómo se detecta:* ruido y huecos casi en cero **en el primer viaje**, antes de que exista cualquier
aprendizaje, es sospechoso, no bueno.
*Qué se hace:* M4, los olvidos reportados al volver, es la única medición que no está anclada a la propuesta.
Cuando M1 y M4 se contradigan, gana M4.

**S6 · La lista se genera con tiempo, no el día de la salida.**
*Si está mal:* no hay ventana de empacado que medir y M3 pierde sentido.
*Cómo se detecta:* la distancia entre `generadaEn` y la fecha de salida.

**S7 · Las listas viejas no se editan retroactivamente.**
El orden `L1, L2, L3` supone que el pasado está quieto.
*Si está mal:* el Δ compara contra un viaje 1 que ya no es el que fue.
*Cómo se detecta:* `updatedAt` de una lista muy posterior a la fecha de fin de ese viaje.

---

## 5. Advertencia sobre el volumen de datos

Esto hay que decirlo antes que cualquier número, y repetirlo cada vez que se muestre uno.

**El producto tiene hoy un usuario y sus acompañantes.** Tres o cuatro viajes por año, dos o tres del mismo
tipo si hay suerte. Cualquier porcentaje calculado sobre eso es **una descripción de lo que pasó, no una
estimación de lo que pasa**.

### Lo que no se puede concluir

- Nada que suene a "el acierto mejoró un 12%". Con dos listas, esa diferencia es indistinguible de que un
  viaje fue más corto que el otro.
- Nada con intervalos de confianza, valores de significancia ni tests. Aplicar estadística inferencial acá no
  agrega rigor, lo simula.
- Ninguna prueba A/B. No hay con qué partir la muestra.
- Nada sobre "los usuarios". Hay un usuario, y es alguien muy cercano al producto, o sea el menos
  representativo posible: sabe cómo funciona el motor y eso cambia cómo lo usa.
- Estos números no se muestran afuera como evidencia de que el producto funciona. Son para decidir qué
  construir la semana que viene.

### Lo que sí se puede concluir

**Que una regla determinística está rota.** Con un caso. Si un ítem descartado dos veces reaparece, eso es
falso y no admite muestra. Toda la sección 2.2 se apoya en esto, y es la clase de evidencia más fuerte que
este producto puede producir hoy.

**La dirección de una comparación pareada dentro de la misma persona.** Cada lista tiene entre 25 y 40 ítems,
así que el conteo no es sobre 1 viaje sino sobre decenas de ítems, cada uno con su propio destino. No son
observaciones independientes —son de una persona, un motor, un viaje— pero un patrón de "de los 9 errores del
viaje 1, 7 no se repitieron en el 3" es evidencia real, y se reporta como conteo crudo: **7 de 9**, nunca como
78%. El porcentaje sugiere una precisión que el denominador no banca.

**Que algo es imposible.** Si en tres viajes nunca se marcó un ítem dentro de las 48 horas previas, el momento
de la noche anterior no existe para esta persona. Eso alcanza para no construir el correo de empacado.

### Qué evidencia reemplaza a la estadística

En este orden de valor:

1. **La verificación determinística.** Errores no aprendidos = 0. No es una muestra, es una prueba. Es lo
   primero que hay que mirar siempre.
2. **El backtest sobre las listas guardadas.** Convierte "esperar tres viajes" en "correr el motor sobre lo
   que ya tenemos". Es la única forma de iterar el motor a la velocidad del código y no a la velocidad de los
   viajes. Con sus límites de anclaje, dichos cada vez.
3. **La pregunta al volver.** Dos preguntas, no un cuestionario: *¿te faltó algo?* y *¿armaste la valija o
   revisaste la lista?* La segunda es la hipótesis del brief traducida a lenguaje humano, y una persona la
   contesta mejor de lo que la contesta cualquier índice.
4. **El motivo de cada descarte, preguntado.** Con 4 descartes por viaje, se preguntan los 4. Un "esto ya vive
   en el bolso" y un "esto no lo uso nunca" son dos aprendizajes opuestos que el dato guardado no distingue.
5. **El caso concreto.** "La lista del tercer viaje a la montaña propuso la campera de abrigo que la vez
   anterior tuve que agregar a mano" vale más que cualquier promedio de tres listas, porque es exactamente el
   mecanismo de la hipótesis funcionando, visible y verificable.

**La regla práctica:** con esta muestra, un número sirve para descartar cosas, no para confirmarlas. Un
acierto de 0,35 dice con bastante seguridad que la lista no sirve. Un acierto de 0,85 no dice que la lista sea
buena; dice que en ese viaje anduvo bien. Los umbrales de la sección 1 están escritos como bandas anchas por
esa razón, y no conviene angostarlos por más que tienten.

---

## 6. Recomendación

**Seguir, con la medición armada desde el primer commit y la decisión de corte comprometida por escrito.**

1. Se construye con los campos de 3.1 desde el principio. Agregarlos después significa perder las primeras
   listas, que son irreemplazables: son las únicas sin historial, o sea el único control natural que este
   producto va a tener.
2. Después de la primera lista real se leen M1, M2 y M3 y **se ajustan los umbrales**, que hoy son mi
   intuición y no un dato.
3. Después de la tercera lista del mismo tipo se corre la decisión de 2.1. Si no hay tres listas del mismo
   tipo, se corre el backtest y se decide igual: no se deja abierta la decisión por falta de viajes.
4. **El corte comprometido:** si con errores no aprendidos en cero el Δ acierto es ≤ 0, se apaga la capa de
   aprendizaje y el esfuerzo se mueve a VAL-33. La lista específica por destino y clima puede sostener la
   épica sola; la memoria personal, si no aporta, es complejidad pagada sin retorno.

**Sobre el criterio de corte del roadmap.** Se cumple sin tocarlo: M2 es su cálculo exacto, con el umbral en
0,5 que ya está escrito. Lo único que agrego es la precisión de que descartar cuenta como marcar, y la
observación de que si M1 llega a 0,70 el criterio ya está cumplido por la desigualdad de la sección 1.

**Sobre el PRD.** No lo edito, lo propongo: si la épica funciona, la sección 6 del PRD gana una métrica y
debería entrar segunda, arriba de la completitud promedio: *listas que llegan al día de la salida resueltas en
más de la mitad*. Es la versión de valor de todo esto en el vocabulario que el PRD ya usa, y es el mismo
número que el roadmap ya eligió para decidir si esta iteración sigue.
