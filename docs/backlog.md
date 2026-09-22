# Valija — Backlog

Historias en formato de usuario con criterios de aceptación verificables. Las de la iteración 1 están
entregadas y quedan como referencia de lo que ya se cubrió.

Prioridad: **P0** bloquea la iteración, **P1** entra si el tiempo alcanza, **P2** es deseable.

---

## Iteración 1 — Consolidar (entregada)

### VAL-01 · Abrir varios viajes a la vez — P0 ✅
Como viajero quiero tener varios viajes abiertos en paralelo para planificar el de octubre sin perder las
ideas del de verano.

- Se crea un viaje con nombre, destino, fechas y participantes.
- La lista separa viajes próximos de ya viajados según la fecha de regreso.
- Cada viaje mantiene sus reservas de forma independiente.

### VAL-02 · Cargar una reserva a mano — P0 ✅
Como viajero quiero cargar cada reserva con los campos que le corresponden a su tipo, para no completar
formularios genéricos.

- Seis tipos disponibles: vuelo, alojamiento, auto, traslado, actividad y nota.
- Un vuelo pide origen y destino en código IATA, número de vuelo, asiento, terminal y puerta.
- Un alojamiento pide check-in, check-out, dirección y teléfono.
- Al cambiar el tipo de una reserva a medio completar no se pierde lo ya escrito.
- Una fecha de fin anterior a la de inicio se rechaza con un mensaje claro.

### VAL-03 · Ver el itinerario por día — P0 ✅
Como viajero quiero ver mis reservas ordenadas cronológicamente y agrupadas por día.

- Las reservas se agrupan por fecha y se ordenan por hora dentro del día.
- Cada día se numera según el día de viaje que representa.
- Las reservas sin fecha se agrupan aparte, no se ocultan.

### VAL-04 · Saber qué me falta — P0 ✅
Como viajero quiero que la app me diga qué información falta, para no descubrirlo en el aeropuerto.

- Cada reserva marca sus campos obligatorios faltantes, por tipo.
- Se detectan noches del viaje sin alojamiento y se nombran las fechas.
- Se avisa cuando hay un solo tramo de vuelo en un viaje con fecha de regreso.
- Se avisa del check-in online 48 horas antes de un vuelo sin asiento.
- Los pendientes se ordenan por urgencia y cada uno abre la reserva que lo origina.
- El contador de pendientes y el anillo de completitud se ven desde la lista de viajes.

### VAL-05 · Importar una confirmación — P0 ✅
Como viajero quiero pegar el mail de confirmación en lugar de tipear todo.

- Se acepta texto pegado y foto de tarjeta de embarque o voucher.
- Varias reservas en un mismo texto se separan en reservas distintas.
- Un vuelo de ida y vuelta genera dos reservas.
- Los datos extraídos se muestran para revisar antes de guardar.
- Un campo que no aparece en el original queda vacío y nunca se inventa.

### VAL-06 · Compartir el viaje — P0 ✅
Como viajero quiero compartir el viaje con quien me acompaña, eligiendo si puede editar o solo mirar.

- Quien recibe permiso de lectura ve todo y no puede modificar nada.
- Quien recibe permiso de edición puede cargar y editar reservas.
- Los controles de escritura aparecen deshabilitados en modo lectura, no fallan al usarlos.
- Existe un link que lleva directo al viaje compartido.

### VAL-07 · Exportar el resumen en PDF — P0 ✅
Como viajero quiero un PDF con todo el viaje para tenerlo sin conexión y mandarlo por chat.

- El PDF abre con los pendientes y sigue con el itinerario por día.
- Cada reserva muestra su talón de datos: ruta, número, código de reserva, asiento, dirección y costo.
- Los campos faltantes se señalan también en el PDF.
- Numeración de páginas y fecha de generación en el pie.

---

## Iteración 1.5 — Preparar (entregada)

Épica **VAL-30 · Valija inteligente**. Los criterios de aceptación completos están en
`docs/briefs/valija-inteligente.md`, que es el contrato de la iteración. Acá queda el índice y la prioridad.

| ID | Historia | Prioridad |
|---|---|---|
| VAL-30 | Generar la lista sugerida según tipo, destino, fechas y duración | P0 ✅ |
| VAL-31 | Marcar lo que ya está en la valija, descartar y agregar propios | P0 ✅ |
| VAL-32 | Aprender del historial de viajes anteriores | P0 ✅ |
| VAL-33 | Ajustar la lista por destino y época del año | P1 ✅ |
| VAL-34 | Compartir la lista con quien viaja conmigo | Movida a iteración 2 |
| VAL-35 | Incluir la lista en el PDF del viaje | P2, sin diseñar |

**Por qué se adelanta a la iteración 2:** no necesita backend. Usa la base de datos y la capa de
inteligencia que ya tiene el MVP.

**Decisiones de producto tomadas y cerradas:** el motor es híbrido y la lista base funciona sin IA; la
sugerencia se puede rechazar y rechazar es información que alimenta el aprendizaje; las cantidades explican
de dónde salen; no hay links de compra ni recomendación de producto.

---

## Iteración 2 — Interpretar (reordenada por feedback de uso)

**Brief completo:** `docs/briefs/interpretar.md`. Dos bloques, en este orden de prioridad:

| Bloque | Qué | Prioridad |
|---|---|---|
| A | Importar fotos y PDFs para interpretar reservas (VAL-40 a VAL-42) | **Máxima** |
| B | La valija razona sobre el viaje completo (VAL-44 a VAL-46, VAL-43) | Alta |

Los avisos por correo y el permiso por viaje bajan a prioridad media y quedan para la iteración 3.

**El orden cambió después de probar el MVP.** El plan original ponía los avisos por correo antes que la
interpretación de documentos. Al usar la app, el PM fue explícito: *"la función de importar es lo más
potente que tiene que tener la app"* y *"es incómodo tener que copiar la información del correo de
confirmación"*.

Eso es información que no teníamos al escribir el roadmap. La carga manual es la fricción que decide si la
app se usa o se abandona, y ninguna cantidad de avisos por correo salva a un producto que cuesta llenar. Los
avisos pasan a la iteración 3.

### VAL-40 · Importar desde PDF — P0

Como viajero quiero subir el PDF del voucher o del pasaje y que se cargue solo, sin copiar nada a mano.

- Se acepta un archivo PDF desde el teléfono.
- Un PDF de varias páginas se interpreta completo, no solo la primera.
- Cada reserva encontrada se muestra para revisar antes de guardar, como ya hace el importador de texto.
- Si el PDF es una imagen escaneada sin texto, igual se interpreta.
- **Nota técnica:** la capa de inteligencia recibe imágenes, no PDFs. Hay que renderizar cada página a
  imagen dentro del navegador y mandar esas imágenes. Se resuelve sin servidor.

### VAL-41 · Importar el correo completo — P0

Como viajero quiero pasarle el mail de confirmación entero en lugar de copiar campo por campo.

- Se acepta el archivo del correo, además del texto pegado que ya funciona.
- Se aceptan capturas de pantalla del correo, en PNG y JPG.
- Se pueden cargar varios archivos juntos y se interpretan como un solo viaje.
- La app dice qué reconoció de cada archivo, no un resultado global sin detalle.

### VAL-42 · Completar la reserva con la tarjeta de embarque — P0

Como viajero quiero subir la tarjeta de embarque cuando la recibo y que complete los datos que antes no
existían, sin duplicar el vuelo que ya tenía cargado.

- Puerta, terminal, asiento y hora de embarque salen de la tarjeta de embarque.
- Esos datos aparecen tarde, cuando el vuelo ya está cargado: la app tiene que reconocer que es el mismo
  vuelo y completarlo, no crear uno nuevo.
- El reconocimiento usa número de vuelo y fecha, y ante la duda pregunta en vez de adivinar.
- La tarjeta de embarque queda guardada y se puede mostrar en el mostrador.

### VAL-44 · La capa inteligente ve el viaje completo, no solo el destino — P0

Como viajero quiero que la sugerencia de equipaje razone sobre todo lo que ya cargué, no solo sobre a dónde
voy.

**Qué falta exactamente.** Hoy la capa inteligente recibe cuatro datos: destino, fechas, duración y tipo de
viaje. No ve ninguna de las reservas. Las reglas determinísticas sí las ven, pero solo pueden reaccionar a lo
que alguien anticipó al escribirlas: hay auto alquilado, hay vuelo internacional, hay trekking. Todo lo que
no esté previsto en una regla, no existe.

- La capa inteligente recibe las reservas del viaje: tramos de vuelo con horarios y escalas, alojamiento con
  su tipo y sus notas, auto con su rentadora y su lugar de retiro, actividades cargadas.
- Puede sugerir por combinaciones que ninguna regla anticipó. Una escala de ocho horas, un check-in de
  madrugada, un alojamiento sin lavandería en un viaje largo, una actividad que pide equipo propio.
- Cada sugerencia cita el dato del viaje que la motiva, no una generalidad. "Tu escala en Lima es de ocho
  horas" y no "las escalas largas cansan".
- Junto con VAL-43, también puede sacar ítems que las reservas vuelven innecesarios.

**Lo que no se toca, y es una decisión de producto ya tomada.** Las reglas determinísticas siguen siendo el
piso. La capa inteligente trabaja encima, nunca en lugar de. Sin conexión, o si el modelo falla, la lista
base se genera igual y sirve. Un ítem que una regla marca como crítico, la documentación de identidad entre
ellos, no se puede sacar automáticamente.

**Cuidado con lo que se manda.** Las reservas tienen códigos de reserva, direcciones y teléfonos que no
aportan nada a la sugerencia de equipaje. Se manda el tipo, las fechas, los lugares y la duración: lo que
sirve para razonar. Nunca códigos de reserva ni datos de contacto.

**Riesgo a controlar.** Con más contexto, el modelo tiende a repetir lo que las reglas ya pusieron. Hay que
pasarle la lista base ya armada y pedirle explícitamente lo que ella no cubre. Si el corte por origen de las
métricas muestra que los ítems de la capa inteligente aciertan menos que los de las reglas, la decisión es
subir su umbral o apagarla.

### VAL-45 · Ningún ítem repetido entre capas — P0

Como viajero no quiero ver dos veces lo mismo en mi valija.

Es la regla que hace que las dos capas puedan convivir. Sin esto, sumarle contexto a la capa inteligente
garantiza duplicados: el modelo va a proponer el adaptador de enchufe que la regla del vuelo internacional ya
puso.

- Un ítem que ya existe por una regla no se agrega de nuevo por la capa inteligente, ni al revés.
- La comparación es por clave normalizada, no por texto literal.
- Va más allá de la coincidencia exacta: "adaptador de enchufe" y "adaptador de corriente" son el mismo ítem.
- Cuando dos capas proponen lo mismo, gana la de menor precedencia y conserva su origen: primero regla,
  después historial, después capa inteligente. Un ítem que una regla ya ponía nunca se acredita a la IA,
  porque falsea la métrica de aciertos por capa.
- El motor expone una verificación propia: dada una lista, no puede haber dos ítems que signifiquen lo mismo.

### VAL-46 · La lista se actualiza cuando el viaje crece — P0

Como viajero quiero que la valija se ajuste sola a medida que cargo reservas, sin tener que rehacerla.

- Al agregar, editar o borrar una reserva, la app detecta que la lista quedó desactualizada.
- Los ítems nuevos se marcan como nuevos y dicen qué reserva los motivó.
- Nunca se pierde lo ya marcado, y un ítem descartado no vuelve por más que el viaje crezca.
- La actualización se ofrece, no se impone: no puede interrumpir a alguien que está empacando.

### VAL-43 · La lista de equipaje se adapta de verdad al destino — P0

Como viajero quiero que la lista contemple el clima esperado y las reglas del país al que voy, y que no me
muestre cosas que no necesito.

- La capa inteligente puede **sacar** ítems de la lista base, no solo agregar. Hoy solo agrega, y por eso
  aparece "visa o autorización electrónica" en destinos donde no hace falta.
- Se considera la proyección de clima para las fechas del viaje, no solo la época del año.
- La sugerencia distingue destinos dentro del mismo país: un pueblo de playa no necesita lo mismo que una
  capital, aunque estén a dos horas.
- Todo ítem sacado o agregado por esta capa explica por qué.
- Un ítem que la capa base marca como crítico (documentación de identidad) nunca se saca automáticamente.

---

## Hallazgos de la validación del MVP

Salen de usar la app y de los comentarios dejados sobre la versión publicada. No forman una iteración: se
reparten según prioridad.

### VAL-55 · Importar sin depender de imágenes — P0, en curso

Como viajero quiero que el PDF del voucher se cargue solo, aunque la app no pueda
mandarle imágenes al modelo.

Descubierto el 11/09 probando con documentos reales: la vista donde corre la app
devuelve `images_unavailable`, y el importador convierte **todo** a imagen antes de
mandarlo. Sin soporte de imágenes no entra ni un archivo. El detalle está en
`docs/briefs/interpretar.md`, sección "Restricción de plataforma".

- Un PDF con capa de texto se interpreta extrayendo el texto en el navegador, sin
  imágenes y sin consultar `limits()`.
- Un PDF sin capa de texto sólo se renderiza a imagen si `limits()` reporta `images`.
- Sin soporte de imágenes, la app lo dice **antes** de que la persona suba el archivo,
  y no ofrece cámara ni galería como si funcionaran.
- Ningún archivo falla con una llamada al modelo que ya sabemos que va a rechazarse.

### VAL-56 · Saber si el bloqueo de imágenes es permanente — P1

Como equipo necesitamos saber si la vista no acepta imágenes por la vista, por la
cuenta o por el contexto en que se abre el artifact.

De la respuesta depende si VAL-41 (importar fotos y capturas) y VAL-42 (completar con
la tarjeta de embarque) están **bloqueados por ahora** o **cancelados**. Hoy los dos
están escritos como entregados en el roadmap y no lo son.

- Se consulta `sample.limits()` desde la app publicada y se registra qué devuelve.
- Se prueba en más de un contexto: el visor de la aplicación y el navegador.
- El resultado se escribe en el brief y se corrige el estado de VAL-41 y VAL-42.

### VAL-61 · Reconocer texto de una imagen dentro de la app — ESTACIONADA

Como viajero querría sacarle una foto a un comprobante en papel y que se interprete.

**No está descartada por falta de valor, sino por falta de camino.** El paso cero del
12/09 lo probó en el teléfono del PM: el motor de reconocimiento carga, y el diccionario
del idioma no baja de ningún host que el visor permita. Cuatro orígenes probados,
ninguno funciona. Evidencia en `docs/investigacion/paso-cero-leer-una-foto.md`.

**Decisión del PM (12/09):** *"me cierra el replanteo para esta versión MVP; en todo caso
lo iré probando y si hay necesidades de un OCR, lo agregaremos al backlog en algún
momento."*

Para el MVP la necesidad se cubre pegando el texto del correo, que es mejor que
fotografiarlo. Esta historia queda acá para no volver a investigarla desde cero.

**Qué la revive, cualquiera de las tres:**

1. Que la plataforma habilite el envío de imágenes al modelo. Entonces no hace falta
   reconocer nada localmente: se manda la foto. **Es el camino preferido** y lo que hay
   que mirar primero. Al 12/09 `limits()` dice explícitamente que no las acepta.
2. Que se consiga el archivo del diccionario para empotrarlo en la app. Ya no alcanza
   con que exista en un host permitido: **ninguna descarga por `fetch` pasa**, así que
   tiene que viajar dentro de la propia app.
3. Que el uso real muestre casos que copiar y pegar no cubre —un comprobante en papel,
   un cartel, algo que no llegó por correo— y que sean frecuentes.

**Lo que ya sabemos y no hay que volver a averiguar:**

- **Una descarga por `fetch` está bloqueada siempre**, incluso desde un host permitido:
  la sonda lo probó contra `cdnjs` y falló en 3 ms. Sólo pasa un `<script>`. El motor bajó
  porque la librería lo carga como script desde su worker; el diccionario usa `fetch`, y
  por eso no hay **ningún** host del que pueda bajar.
- Empotrar el diccionario dentro de la app sumaría unos 3 MB de descarga inicial para
  todos, y este entorno no puede conseguir el archivo para probarlo.
- Los dos sistemas operativos ya traen reconocimiento de texto propio. Reimplementarlo
  peor no es una mejora.

### VAL-50 · El generador de PDF no siempre carga — bug, SUBE A P1

**Cambia de prioridad el 12/09.** Nació como un bug menor del PDF de salida, pero la
auditoría cruzó dos hechos que estaban sueltos: el `<script src="cdnjs…">` que falló en
el teléfono del PM es **el mismo mecanismo** con el que se carga `pdf.js`, y desde la
iteración 2 toda la importación de PDF depende de eso. Que es, además, lo único que
quedó entregable del bloque A después de la restricción de imágenes.

O sea: el mismo fallo que hoy sólo arruina la exportación deja sin importar nada.

Mitigado en parte —la app detecta que la librería no cargó **antes** de que la persona
suba un archivo, y muestra la vía que sí funciona— pero la causa sigue viva y sin
diagnosticar. No sabemos si fue un corte puntual, la red del PM, o algo del visor.



Al exportar el resumen aparece "No se pudo cargar el generador de PDF" y no se genera nada.

La app arma el PDF con una librería que trae de un repositorio público en el momento de usarla. Si esa
descarga falla, por señal, por bloqueo de red o porque el repositorio no responde, la función queda muerta.
El aviso además no dice qué hacer.

- El aviso explica que es un problema de conexión y sugiere reintentar, en lugar de sonar a error interno.
- Se reintenta la carga antes de darse por vencido.
- Se evalúa dejar de depender de una descarga en el momento del uso.

**Por qué importa más de lo que parece.** VAL-40, la interpretación de PDFs, que es la prioridad máxima de
la iteración 2, trae su librería del mismo repositorio y por el mismo camino. Este bug es la primera
evidencia real de que esa descarga puede fallar en un teléfono. Conviene resolver los dos juntos.

### VAL-51 · Pedir la hora solo donde hace falta — P2

Como viajero no quiero cargar la hora cuando no aporta nada.

Hoy todos los campos de fecha piden también la hora. En un vuelo la hora es el dato central. En una
actividad, una nota o una idea suelta, es fricción pura.

- El campo de fecha por defecto pide solo la fecha.
- La hora se pide donde es parte del dato: salida y llegada de un vuelo, check-in y check-out, retiro y
  devolución del auto.
- Donde no se pide por defecto, se puede agregar si la persona quiere.

### VAL-52 · Los pendientes llevan a resolverlos — P1

Como viajero quiero que el panel de pendientes funcione como una campana de notificaciones: que tocar un
aviso me lleve directo a resolverlo.

Hoy los pendientes que nacen de una reserva ya cargada la abren, pero los que hablan del viaje entero no
llevan a ningún lado. "Falta el vuelo de vuelta" te informa y te deja solo.

- Tocar un pendiente abre la acción que lo resuelve, con lo que se pueda precargado.
- "Falta el vuelo de vuelta" abre el alta de un vuelo con el origen y el destino invertidos y la fecha de
  regreso puesta.
- "Noches sin alojamiento" abre el alta de alojamiento con esas fechas.
- "Check-in abierto" abre la reserva del vuelo en el campo del asiento.
- Un pendiente que no tiene acción clara sigue siendo informativo, sin botón que no lleve a nada.

### VAL-53 · El regreso no puede ser antes ni el mismo día que la salida — ENTREGADO ✅

- El calendario de regreso no deja elegir una fecha anterior ni igual a la salida.
- Elegir la salida ajusta el límite del regreso en el momento, y descarta un regreso que quedó inválido.
- Si igual se fuerza, el mensaje dice qué pasa y no guarda.

## Lo que la iteración 3 dejó abierto

### VAL-57 · Que la confirmación del correo entre sin tipear — P0, CORRIDA A LA 5 (ver abajo)

Como viajero quiero cargar una confirmación que llegó por correo sin PDF adjunto, sin
tipear los datos a mano.

**Especificada en `docs/briefs/adjuntar.md` y NO construida.** La iteración 3 cerró sin
ella por decisión del PM el 14/09, para publicar antes las dos mejoras que sí estaban
probadas. Queda anotado que el brief la llamaba "la prueba que define el éxito" de esa
iteración, así que la 3 cerró sin responder su propia pregunta.

**Lo que falta no es tecnología.** Pegar el texto ya funciona y ya se interpreta con el
mismo motor que un PDF. Criterios:

- Una línea explica cómo traer un correo que no tiene adjunto, sin tecnicismos y sin dar
  por sentado qué teléfono usa la persona.
- Si la única fuente es una captura, se dice que el propio teléfono sabe sacarle el
  texto. No lo reimplementamos peor que el sistema operativo.
- Varias reservas pegadas juntas se separan solas. Ya funciona; falta verificarlo con
  correos reales del PM, que es lo que nunca se hizo.

#### ⚠️ Esta historia decía una cosa que el PM contradijo el 18/09. Leer antes de construirla.

El texto original de VAL-57 decía: *"el problema es que la app lo esconde adentro de un
`<details>` colapsado, como si fuera el plan de contingencia"*, y pedía como criterio que
**"pegar el texto sea uno de los dos caminos principales, a la par de subir el PDF"**.

El 18/09, después de validar la v19 en su teléfono, el PM pidió exactamente lo contrario:
*"cuando abre la pantalla de importar, quiero que esté colapsado la opción de pegar el
texto del correo ya que no es la funcionalidad principal"*. Se hizo, y por eso este
criterio se sacó de la lista de arriba.

**Los dos tienen razón sobre cosas distintas, y por eso conviene no reabrirlo a ciegas.**
La NECESIDAD de VAL-57 sigue intacta: una confirmación que llega por correo sin PDF hoy
se carga a mano. Lo que quedó desmentido es la SOLUCIÓN que la historia daba por hecha —
que el problema fuera la jerarquía visual de esa caja. No lo era: el PM usa PDF, el PDF
es su camino principal, y una caja permanentemente abierta al lado del botón que sí usa
le compite en vez de ayudarlo.

**Recomendación del PO para cuando se construya:** que VAL-57 no vuelva a plantearse como
"subir de categoría la caja". El aviso de la pantalla ya ofrece la vía en palabras, y
abrir la caja es un toque. El trabajo real de esta historia está en otro lado:

1. **Qué tan bien se interpreta un correo pegado de verdad.** Nunca se probó con correos
   reales del PM. Ese es el criterio que define el éxito y sigue sin verificarse.
2. **Cómo se llega a pegar desde donde está la persona**, que es su app de correo, no
   Valija. Ahí puede haber una idea mejor que un textarea.

Si al construirla aparece evidencia de que la caja sí tiene que estar abierta en algún
caso, se decide con esa evidencia y con el PM — no heredando el criterio viejo.

### VAL-62 · Avisar del cupo de la base antes de que se llene — P2

Como viajero querría saber que me estoy quedando sin lugar para documentos antes de que
un guardado falle.

**Viene del hallazgo H4 de QA** (`docs/qa/2026-09-14-iteracion-3.md`). El motor ya expone
`presupuestoDeLaBase()` y la interfaz nunca la llama. Hoy sólo existe el error reactivo,
que está bien traducido y le dice a la persona qué hacer. Se dejó abierto a propósito
para no inventar una pantalla nueva sobre el cierre de la iteración.

- El aviso aparece antes de que un guardado falle, no después.
- No aparece cuando falta mucho: molestar con un cupo lejano es peor que no avisar.

---

## De la prueba completa del PM — 19/09

Nueve hallazgos suyos recorriendo la app entera. Las prioridades son las que él puso; lo que está en
**Diagnóstico** lo verifiqué leyendo el código antes de escribir la historia, no es una interpretación de su
reporte.

### VAL-63 · La lista de la valija no se entera de que cambió el viaje — P0 · ✅ TERMINADA el 19/09

Como viajero quiero que si cambio las fechas o el destino de un viaje, la valija se actualice sola.

**Reporte textual:** *"cree un viaje con noruega como destino principal para viajar ahora (otoño) y luego lo
cambié para verano pero la lista no actualizó automáticamente"*.

**Diagnóstico (verificado en el código, 19/09).** El motor YA sabe hacerlo: `planListUpdate` recibe `trip`
entero y reconstruye la lista base contra las fechas y el destino nuevos. Lo que falta es el disparador.
`checkPackingPlan()` se llama en cuatro lugares —al guardar una reserva (dos) y al importar (dos)— y
**ninguno es guardar el viaje**. El handler de `#save` de la hoja del viaje (`app/valija.html`, ~7924) hace
`Store.saveTrip(...)`, cierra la hoja y muestra un aviso: nunca vuelve a mirar la valija.

O sea: no hay que construir la inteligencia, hay que cablear un evento que falta.

**La segunda mitad, acotada por un dato del PM del 19/09.** El motor no tiene lógica propia de estación: la
única mención de temporada en `packing-engine.js` está adentro del texto que se le manda al modelo, así que
toda la sensibilidad vive en la capa de IA (`enrichWithDestination`).

Eso abría la duda de si esa capa razona sobre la fecha. **El PM la contestó con su propia prueba:** con el
viaje en septiembre, la app *"supo que allá es otoño"*. O sea que la inteligencia de estación existe y
funciona; lo que nunca pasó es que se le volviera a preguntar al cambiar la fecha a junio de 2027.

Textual: *"si sabe hacerlo, que lo haga"*. Tiene razón, y eso reduce esta historia a cablear el evento.

**Lo que ese dato NO prueba, y por eso el criterio no se afloja:** que acierte en septiembre no dice nada
sobre junio, porque nunca se le preguntó. Una observación correcta no es dos. El criterio sigue siendo el
caso completo, con el antes y el después escritos.

- Cambiar fechas o destino de un viaje dispara la misma revisión que hoy dispara cargar una reserva.
- La persona decide: se le propone lo que cambia, no se le pisa la lista. Vale lo de VAL-46 — nada de lo que
  ya marcó se pierde.
- Un cambio que no cambia nada no molesta: si la lista nueva es igual a la vieja, no hay aviso.
- **Criterio que define el éxito:** el caso del PM, con el antes y el después escritos.

**Construida el 19/09, en tres rondas, y lo que enseñó cada una.**

*Ronda 1 (auditoría 38/100).* La guarda elegía a mano qué campos mueven la valija y dejaba afuera el nombre
y las notas, con dos motivos escritos que eran falsos: se miden en cuatro líneas de node —sólo las notas dan
3 ítems nuevos; sólo el nombre da 5, aun con el destino puesto—. El arreglo no fue agregar esos dos campos:
fue dejar de adivinar y comparar todo lo que la persona puede editar.

*Ronda 2 (76/100).* Lo que faltaba exigía estar publicada. De ahí salió la separación entre candidato y
terminado que ahora vive en `CLAUDE.md`.

*Ronda 3 (60/100), después de que el PM la probara en su teléfono.* Su reporte: el cartel llegaba tarde y
"no me mostró cuáles son los que se agregan". El aviso dentro de la valija estaba bien —se comprobó antes de
tocar nada—; lo que fallaba era el camino. El cartel no se podía tocar. Y **apareció un defecto viejo que no
era de esta historia**: cada cartel hacía `innerHTML=""` al vencer su reloj sin mirar qué había adentro, así
que "Viaje actualizado" (2,6 s) borraba a "Tengo N cosas" (7 s). Pasa con cualquier par de carteles
seguidos; esta historia sólo lo hizo visible porque es el primer caso donde el segundo importa más.

Esa misma ronda encontró que el arnés afirmaba "se anuncia como botón, para quien usa lector de pantalla"
mirando sólo el `role`, sobre un contenedor sin `aria-live` que no anunciaba nada. Tercera vez en la semana
que escribo una afirmación sin comprobarla.

**Queda declarado sin comprobar:** si un lector de pantalla real lee el cartel. Se prueba en un teléfono con
el lector prendido y no está hecho.

**TERMINADA.** El PM la probó en su teléfono con la v22 y el recorrido completo anduvo: guardar, esperar el
cartel, tocarlo, llegar a "Ver qué agrego". Cinco rondas de auditoría (38 → 76 → 60 → 74 → 83) sobre lo que
empezó siendo una línea de código; ninguna encontró un invento y las cinco encontraron algo propio, casi
siempre lo mismo: una afirmación escrita sin comprobar.

### VAL-74 · El tope de 8 ítems de la capa de IA — P0 (subida por el PM) · construida el 19/09

**Pregunta textual del PM (19/09):** *"otro patrón que identifico es que siempre las sugerencias son 8 items
máximo; esto es una suposición tuya también? no tiene sentido"*.

**Respuesta: sí, es una suposición mía, y esta vez ni siquiera tiene un motivo escrito.** En
`app/parts/packing-engine.js:195`:

```js
/** Tope de ítems que puede agregar la capa de IA. */
var MAX_AI_ITEMS = 8;
```

Eso es todo el comentario. A diferencia del tope de documentos —que al menos decía "decisión nuestra, no de
la base"—, acá no hay ni una línea que diga por qué 8. No sale de ningún contrato: la respuesta del modelo
no tiene un límite que muerda a los 8 ítems, y la lista entera vive en un documento de la base que admite
256 KiB, donde ocho ítems ocupan menos del uno por ciento.

Y se aplica DOS veces, lo que empeora el efecto:

1. En el texto que se le manda al modelo: *"Agregá hasta 8 ítems"* (línea 1490). O sea que el modelo se
   autocensura antes de contestar.
2. En el parser, que descarta lo que pase de 8 (línea 1556).

**Por qué el PM lo nota y tiene razón en que no tiene sentido.** El tope es fijo, pero lo que hay que
agregar no lo es: un fin de semana en Córdoba y tres semanas por Escandinavia en invierno no necesitan la
misma cantidad de ajustes. Un tope parejo recorta justo donde más falta hace.

- Se saca el número inventado. Lo que limite, si limita algo, tiene que salir de un motivo escrito.
- Si hace falta un tope, que dependa del viaje —días, cantidad de destinos, si es internacional— y no de una
  constante.
- El texto del modelo deja de pedir "hasta 8": pedirle que se autocensure es lo que hace que ni siquiera
  veamos cuánto tenía para decir.
- **Antes de elegir un número nuevo se mide:** cuántos ítems propone el modelo sin tope, en un viaje corto y
  en uno largo. Con `app/pruebas/lote-modelo-real.js` ya hay un camino para preguntarle a un modelo de
  verdad, así que esto se decide con datos y no con otra suposición.

**Relación con VAL-66 y VAL-72:** las tres tocan la misma capa. Conviene hacerlas juntas y medir una sola
vez.

**CONSTRUIDA el 19/09.** Decisión del PM: *"no tiene por qué tener un tope real, en todo caso el máximo
técnico posible"*.

`MAX_AI_ITEMS` ya no existe. El techo sale de lo único que de verdad limita —la lista entera vive en UN
documento de la base, que tope a 256 KiB— y se **calcula contra la lista real** en vez de escribirse a mano,
por dos motivos: un número fijo envejece en cuanto un ítem guarde un campo más, y el cupo de verdad depende
de cuánto ocupa ya la lista, que no es lo mismo en un viaje de tres días que en uno de tres semanas.

Medido: **561 ítems** de cupo sobre una lista base de 28, **1.269** sobre una vacía. El 8 estaba setenta
veces más abajo que el techo real.

Y el texto que va al modelo dejó de pedirle "hasta 8": ahora le pide los que hagan falta, sin llenar por
llenar. Esa mitad era la peor — el modelo se autocensuraba antes de contestar y nunca supimos cuánto tenía
para decir.

Lo fija `app/pruebas/val74-sin-tope-de-ocho.js`, que saca el motor del HTML publicado.

**Y la primera versión de este arreglo estaba mal, con la auditoría en 38/100.** Vale escribirlo porque el
error es de método, no de cuenta.

Calculaba un cupo dividiendo el tamaño de la lista por su cantidad de ítems: o sea **estimaba**, asumiendo
que lo que viene pesa como el promedio de lo que ya está. Los ítems de las reglas traen motivos de veinte a
noventa caracteres; el prompt le pide al modelo una frase entera. Con el cupo que yo mismo publiqué —561— y
motivos reales en español, la lista terminaba en **345.595 bytes contra un tope de 262.144**: 32% arriba, y
la base la habría rechazado.

Tres cosas más salieron de ahí:

- **Medía en caracteres, no en bytes.** La base mide bytes UTF-8, y en español cada acento pesa dos. La
  función correcta ya existía en `adjuntos-engine.js`, con el comentario "la base mide bytes, no caracteres"
  escrito al lado, y no la usé.
- **No había tope de largo** en lo que escribe el modelo. Un solo motivo de doce mil caracteres tiraba la
  lista solo. `sanitizeNotesForAI` y el título de una reserva ya lo tenían; acá faltaba.
- **El mensaje que iba a ver la persona era falso.** `writeErr` traducía `invalid_argument` como "Tenés
  acceso de sólo lectura a esta valija", cuando la base usa ese código también para un documento pasado de
  tamaño. Le habría dicho "no sos dueño" al dueño. Corregido: ahora dice qué pasó y ofrece las dos
  posibilidades sin elegir una.

**Y el arnés no lo agarró porque tenía el mismo punto ciego que el código:** medía en caracteres y probaba
con motivos ASCII cortos y parejos. Es la familia de error que `CLAUDE.md` llama "el simulador escrito de
memoria", aplicada a una medición. Ahora prueba con motivos reales, mide bytes UTF-8, y cubre la lista que
ya está pasada de tope.

Estado actual, medido: 3.000 ítems propuestos con motivos de una frase real entran 465 y la lista queda en
256.957 bytes, debajo del tope.

**Lo que NO se midió, y queda declarado:** cuántos ítems devuelve el modelo real del teléfono con el prompt
sin tope. El criterio original de esta historia decía medirlo con `lote-modelo-real.js` antes de elegir un
número; no elegí ninguno —saqué el tope— pero tampoco medí. Va en el guion del PM como lo que hay que mirar:
si ahora sugiere veinte cosas y cinco son ruido, es peor que ocho buenas.

### VAL-73 · Un arnés inestable en `valija-bloque-b.js` — deuda de prueba, P3

El 19/09, construyendo VAL-63, la prueba "el plan se recalcula al ENTRAR a la valija" falló 3 aserciones en
una corrida y pasó en las dos siguientes, con el mismo código. No es un misterio: el propio diagnóstico que
imprime la prueba muestra la carrera —`appPlan: 2` en una lectura y `planDe('t1')` en 0 en la aserción de la
línea siguiente—, y la espera previa es un `waitForFunction(...).catch(()=>{})` que se traga el vencimiento y
sigue igual.

**Y puede no ser el arnés.** La auditoría lo reprodujo por su cuenta y trajo un diagnóstico peor que el mío.
Yo había leído la carrera como "la revisión no llegó a tiempo". El suyo dice otra cosa:

```
diag {"view":"packing","recalc":[],"items":["flight"],"hayLista":false,"aMano":null,"appPlan":null}
```

`hayLista:false`, y falta el ítem del auto que la prueba había guardado JUSTO ANTES de recargar. No es que
el recálculo tardó: es que **después de recargar, lo guardado no estaba**. Eso ya no es timing de prueba —
es la misma promesa que VAL-63, "la app se entera de lo que pasó", aplicada a guardar una reserva.

**Entonces esto se investiga como posible defecto de la app, no como arnés inestable**, y recién si se
descarta se arregla la espera. Bajarlo a "puro timing de test" sería subinvestigarlo, que es como empezaron
las cuatro rondas de septiembre.

No se tocó al construir VAL-63: arreglar el arnés de otra historia en el medio de ésta es meter ruido en una
entrega que ya tiene su propio alcance. El criterio lo confirmó la auditoría.

- Primero: ¿por qué `hayLista` es falso después de recargar, y por qué falta un ítem recién guardado?
  Se reproduce y se dice qué se observó antes de tocar nada.
- Si resulta ser del arnés: la espera deja de tragarse el vencimiento, o se espera por la condición que la
  aserción va a mirar.
- Se corre varias veces seguidas antes de darlo por arreglado: una corrida verde no distingue un arnés
  estable de uno con suerte.

**Más datos, del 19/09 al cerrar VAL-72.** Volvió a aparecer, con las mismas tres aserciones. Se midió en
vez de suponer:

| Árbol | Corridas | Resultado |
|---|---|---|
| Con VAL-72 (`e313e4c`) | 8 | 7 en 111/111, **1 en 108/111** |
| Sin VAL-72 (v23, `11f7cdf~1`) | 3 | 3 en 111/111 |

La corrida que falló incluyó un `locator.innerText: Timeout 30000ms exceeded`, o sea un vencimiento del
navegador y no una aserción de lógica, y las otras dos fallas son las de siempre: el plan leído en 0 cuando
la prueba esperaba 2.

**Lo que estos números NO permiten decir:** que VAL-72 no tenga nada que ver. Una falla en ocho contra cero
en tres no distingue nada, y decir "es el flake conocido" sería exactamente la conclusión cómoda que este
proyecto ya pagó cara. Lo que sí se puede afirmar es más chico y se afirma sólo eso: **VAL-72 no toca la
capa de guardado ni la de recarga**, que es donde vive el `hayLista:false`, y el modo de falla observado es
el mismo que ya estaba anotado acá antes de que VAL-72 existiera.

Queda como está: P3, a investigar como posible defecto de la app. Si al investigarlo se encuentra que sí es
de la app, esta tabla es el punto de partida.

**Y una corrección a una afirmación mía, del 21/09.** Al pedir la auditoría de confirmación escribí que la
inestabilidad de `tier-del-modelo.js` estaba *"anotada en VAL-73 con la tabla de corridas"*. **Es falso:**
esta historia es enteramente sobre `valija-bloque-b.js` y no menciona `tier-del-modelo` ni una vez. Confundí
dos arneses distintos y le pasé al auditor una referencia que no existía. La encontró él yendo a leerla.

Lo que sí se puede decir de `tier-del-modelo`, ahora escrito donde corresponde:

| Cuándo | Qué pasó |
|---|---|
| 20/09 | 1 falla en 1 corrida, **sin capturar cuál aserción**. 9 corridas siguientes, 42/42 |
| 21/09 | 1 falla en 1 corrida, **sin capturar cuál**. 4 + 5 corridas siguientes, 42/42 |

**Las dos veces se perdió la salida de la corrida que falló**, que es exactamente lo que el protocolo de este
proyecto pide guardar para un defecto que no se reproduce. Así que no hay dato: hay dos ausencias de dato.
Mientras no se capture una falla, no se puede decir si es el arnés o la app, y **decir "es un flake conocido"
sería inventar una causa** — la regla que este proyecto ya tiene escrita.

**Hecho el 21/09, después de la tercera falla.** Se corrió en bucle: **12 corridas más, todas 42/42**, sin
capturar nada. Total acumulado: **3 fallas en ~30 corridas, y las tres salidas perdidas.**

Así que se dejó de cazarla a mano. **El arnés se guarda a sí mismo**: envuelve `console.log`, escribe cada
corrida a un archivo en el directorio temporal, y cuando falla lo grita con la ruta en la última línea.
Comprobado con un sabotaje que rompe dos aserciones: el aviso aparece y el archivo queda.

Pedirlo a mano falló tres veces; ahora no hace falta acordarse. Es la misma regla que ya está en `CLAUDE.md`:
cuando una regla se pueda convertir en mecanismo, se convierte.

**Y el mecanismo también tuvo que recibir el ataque.** La quinta confirmación lo volteó en los dos
escenarios que reproducen exactamente el síntoma que el mecanismo existe para prevenir:

- si no se podía escribir el archivo, el `catch` se tragaba el error y el aviso estaba detrás de "hay archivo",
  así que una corrida que fallaba **y** no podía guardar terminaba sin archivo, sin mensaje y sin motivo;
- una excepción fuera de toda prueba —el navegador que no arranca— terminaba el proceso sin pasar nunca por
  el guardado.

O sea: **el mecanismo contra perder la salida perdía la salida.** Arreglado: el fracaso de guardar se dice
con su motivo, el aviso de falla se da haya archivo o no, y la corrida entera va envuelta. Los dos sabotajes
del auditor se repitieron y ahora los dos gritan.

Queda declarado lo que **no** cubre: una excepción antes de que el arnés imprima nada —el fixture que no
está, el `require` que falla— sigue sin envolverse, a propósito, porque ahí todavía no hay salida que perder.

La próxima falla va a tener nombre. Hasta entonces sigue sin diagnóstico, y **no se la llama flake**.

**Y una deuda vecina que salió de la misma auditoría:** de los `waitForTimeout` fijos que la auditoría del
12/09 marcó como sospechosos en `valija-bloque-b.js`, sólo tres se migraron a espera de señal real. Quedan
varios sin migrar (líneas 429, 431, 454, 459, 461, 480). Es la causa más probable de la intermitencia de ESE
arnés, y está sin tocar.

### VAL-75 · Los ítems del destino viejo se quedan, y encima mienten sobre su origen — P0

**Reporte del PM (19/09), con captura.** Cambió el viaje de Noruega a Argentina. La valija sugirió cosas
nuevas —o sea que VAL-63 funcionó— pero *"no actualiza los que ya hizo"*.

En la captura, la cabecera dice **ARGENTINA · MONTAÑA**, y abajo:

| Ítem | Chip | Motivo |
|---|---|---|
| Pantalón impermeable | **por Argentina** | *"En **Noruega** la lluvia es frecuente en septiembre…"* |
| Capas intermedias de polar | **por Argentina** | *"Fin de septiembre en la montaña **noruega** es frío…"* |
| Buff o cuello | **por Argentina** | *"El viento de montaña en **Noruega**…"* |

**Son dos defectos distintos y el segundo es peor.**

#### A · Nada saca los ítems del destino anterior

`planListUpdate` sólo SUMA. Cuando el destino cambia, los ítems que la capa de IA había agregado para el
destino viejo se quedan en la lista, con su motivo intacto. Verificado: no hay ningún camino que los revise
ni los proponga para sacar.

Esto no contradice la regla de "proponer y no pisar" que el PM confirmó el 19/09. Esa regla protege **lo que
la persona marcó o agregó**; un ítem que sugirió la app para un destino que ya no existe no lo eligió nadie.
Lo que corresponde no es borrarlo en silencio: es **proponer sacarlo**, con el mismo mecanismo que ya existe
para las propuestas de quitar (VAL-43).

#### B · El chip le pone al ítem viejo el destino NUEVO

`app/valija.html:3657`:

```js
if(it.origen === "destino") return {cls:"chip soon", tx:`por ${trip.destination || "el destino"}`};
```

El chip no dice de dónde salió el ítem: dice **cuál es el destino del viaje AHORA**. Así que en el momento en
que el PM cambió el destino, tres ítems razonados para Noruega pasaron a declarar *"por Argentina"* sin que
nadie los volviera a mirar.

**Eso es una causa inventada, que es lo que este proyecto tiene prohibido por escrito.** Y es peor que
dejarlos: un ítem viejo con su motivo de Noruega es una lista desactualizada, que se nota. Un ítem viejo con
un cartel que dice "por Argentina" es la app afirmando algo falso con cara de dato.

**La causa de fondo: el ítem no guarda de qué destino salió.** `makeItem` guarda clave, nombre, categoría,
cantidad, motivo, origen, regla, orden y fechas — ningún campo dice para qué destino se razonó. Sin ese dato
el chip no tiene con qué ser honesto, y (A) tampoco puede saber cuáles revisar.

**DECISIÓN DEL PM (19/09), que corrige la propuesta del PO.** El PO había propuesto guardar el destino de
origen y etiquetar el ítem "por Noruega" aunque el viaje ya fuera Argentina, y proponer sacarlo. El PM lo
rechazó, textual: *"pero qué sentido tiene esto? yo quiero que actualice la lista, no que mantenga lo
anterior (...) quiero que se pisen o se eliminen las sugerencias relacionadas al destino viejo"*.

Tiene razón, y el error del PO vale escribirlo: **estaba resolviendo el problema equivocado.** El problema
del PO era que la app no mintiera; el del PM es que la lista esté al día. Etiquetar bien un ítem que ya no
corresponde lo vuelve honestamente inútil — seguís teniendo un pantalón impermeable de Noruega en un viaje a
Argentina, ahora con un cartel prolijo. La etiqueta correcta era la solución a (B) tratada como si fuera la
solución a (A).

**Entonces:**

- El ítem guarda el destino con el que se lo generó. Sigue haciendo falta, pero para otra cosa: para saber
  **cuáles pisar**. Es un campo, y la medición de bytes de VAL-74 ya lo cuenta sola.
- **Al cambiar el destino, lo que la capa de IA había sugerido para el anterior se reemplaza.** No se
  propone: se pisa. La persona cambió el destino; esa es la decisión.
- **La única excepción, y es la que hay que cuidar:** un ítem que la persona YA marcó, editó en cantidad o
  anotó dejó de ser una sugerencia y pasó a ser suyo. Ese no se pisa. Lo que se hace con él —dejarlo callado
  o avisar que venía del destino viejo— se decide al construir, con el caso a la vista.
- La regla de "proponer y no pisar" que el PM eligió el 19/09 **no se contradice**: esa protege lo que la
  persona marcó o agregó, y una sugerencia de la app para un destino que ya no existe no la eligió nadie.
- **El caso que define el éxito es el del PM:** Noruega → Argentina, y que en la lista no quede ni un ítem
  cuyo motivo hable de Noruega.

**Sale junto con VAL-76 y VAL-77**, por decisión del PM: los tres son la misma pregunta —qué pasa con una
lista ya armada cuando el viaje cambia de verdad— y sueltos no se pueden probar.

**Relación con VAL-63:** es su otra mitad. VAL-63 hizo que la lista se entere de que cambió el viaje y sume
lo que falta; esto es que también se entere de lo que sobra. Y se nota más ahora justamente porque VAL-63
anda: antes no se sumaba nada, así que tampoco se veía lo que quedaba viejo.

**Relación con VAL-72:** la misma pregunta de fondo —cuál es el destino de este viaje— vista desde otro
lado. Conviene resolver VAL-72 primero: si el destino sale de las reservas, "el destino con el que se generó
el ítem" ya no es un campo de texto suelto.

### VAL-76 · Cambiar el tipo de viaje sobre una lista ya armada — P0

**Reporte del PM (19/09):** *"no solo quiero actualizar el viaje sino que quiero actualizar el tipo de viaje
para que alimente al motor: playa, montaña, mixto, etc. no hay paso atrás una vez elegido esto y la lista,
por más que cambien las fechas, los destinos, no se está contemplando que un viaje ya armado cambie
rotundamente de la montaña a la playa"*.

**Corrección a la premisa, verificada en el código: el paso atrás SÍ existe, pero está escondido.** Hay un
botón "Cambiar el tipo" (`pk-changetype`, `app/valija.html:11126`) y funciona: pasa por `runGenerate`, que
reemplaza la lista entera y tira el plan pendiente.

El problema es dónde vive: adentro de la hoja que se abre con el ícono de información ⓘ de la cabecera de la
valija. O sea que la acción que rehace la lista entera está detrás del ícono que uno toca para *leer de
dónde salió la lista*. El PM usó la app varios días y concluyó que no se podía. **Si el PM no lo encuentra,
no existe.**

- El tipo de viaje se puede cambiar desde donde se ve el tipo de viaje, no desde el ícono de ayuda.
- Cambiar el tipo rehace la lista, que es lo que ya hace. Lo que falta es que eso sea alcanzable y que se
  entienda qué va a pasar antes de tocarlo.
- Y se cuida lo mismo que en VAL-75: lo que la persona ya marcó o agregó no se pierde al rehacer.
- **El caso del PM:** un viaje de montaña ya armado que pasa a ser de playa, y una lista que queda de playa.

### VAL-77 · "Mixto" no quiere decir nada — P1

**Reporte del PM (19/09):** *"incluso, el viaje mixto no se entiende a qué hace referencia: debería poder
elegir el mixto entre ciudad/montaña o playa/montaña o playa/ciudad, etc"*.

Los tipos hoy son seis y el último es `mixto` (`packing-engine.js:362`), sin ninguna definición. Para el
motor es una etiqueta más; para la persona es "ninguna de las anteriores", que no es lo mismo y no le dice
nada al motor.

Y es el caso más común de los viajes reales: nadie se va diez días a un solo tipo de lugar.

- "Mixto" deja de ser un tipo y pasa a ser una **combinación explícita** de los que ya existen:
  ciudad + montaña, playa + ciudad, playa + montaña, las que hagan falta.
- El motor recibe las dos partes, no una etiqueta vacía. Las reglas de los dos tipos suman.
- No se inventan tipos nuevos: se combinan los que hay.
- **Cuidado con lo que ya está guardado:** hay listas con `tipoViaje:"mixto"` a secas. Tienen que seguir
  funcionando, y conviene que la app pregunte una vez qué combinación era en vez de adivinar.

**Sale junto con VAL-75 y VAL-76**, por decisión del PM.

### VAL-72 · Las reservas mandan sobre el destino escrito a mano — ✅ VERIFICADA en el teléfono del PM (22/09)

Como viajero quiero que si cargué vuelos, traslados o alojamientos, la valija use ESOS destinos y no el que
escribí al crear el viaje.

**Reporte textual del PM (19/09):** *"el tipo de valija inteligente que pregunta al principio (playa,
montaña, ciudad, etc) se guía por los vuelos cargados pero luego termina sugiriendo en función del destino
principal que está en el viaje (...) si hay viaje cargado y a su vez hay vuelos o cualquier reserva en firme
que indique destino, eso prima por sobre cualquier otra cosa. el ejemplo más claro es un viaje multidestino
a Europa"*.

**Diagnóstico (verificado en el código, 19/09), y es más preciso que "usa uno u otro": usa LOS DOS y no hay
ninguna regla de precedencia.**

| Dónde | Qué manda | Línea |
|---|---|---|
| El resumen base que va al modelo | `destino: ctx.destination` — el campo que la persona escribió a mano | `packing-engine.js:1224` |
| Cada vuelo de ese mismo resumen | `destino: f.to` — el código de aeropuerto real | `packing-engine.js:1395` |
| La sugerencia de tipo de viaje | un texto plano con nombre + destino + notas + títulos de las reservas, todo mezclado | `suggestTripType`, ~986 |

Al modelo le llega un campo llamado `destino` que dice "Europa" y, más abajo, tres vuelos que dicen MAD, CDG
y FCO. Nada le dice cuál manda, así que el `destino` de arriba —el más pobre— pesa como si fuera la verdad.

Y la sugerencia de tipo mezcla las dos fuentes en una bolsa de palabras, que es por lo que el PM ve que
"se guía por los vuelos" al principio y por el destino escrito después: no son dos criterios, es el mismo
texto con distinto peso accidental.

**La regla que pidió:**

1. **Si hay reservas en firme que indiquen destino** —vuelos, traslados, alojamientos— **esas mandan.** Un
   viaje multidestino tiene varios, y todos cuentan: no se elige uno.
2. **Si no hay ninguna**, el destino principal del viaje alimenta el motor, como hoy.
3. El destino escrito a mano nunca contradice a una reserva; a lo sumo la complementa.

**La regla que se entregó, que es la misma con un recorte, y el recorte va acá arriba y no escondido abajo.**
Dos rondas de auditoría mostraron que "reserva en firme que indique destino" no se puede decidir para todos
los tipos de reserva. Lo que se puede determinar es esto:

- **Un vuelo sí manda.** Su destino es un código IATA y el origen del primer vuelo también, así que se
  comparan entre sí: de un vuelo se puede afirmar que no es el punto de partida.
- **Una dirección no alcanza para mandar** —alojamiento, traslado, auto—. Es texto libre y no hay nada
  guardado contra qué compararla. "Hotel Ezeiza Este, Buenos Aires" la noche antes de salir se escribe igual
  que un hotel al llegar, y las fechas tampoco los distinguen. Van al modelo **enteras, con sus fechas y
  etiquetadas como pista**, para que decida con el dato completo; lo que no hacen es desplazar lo escrito.
- Por eso el punto 3 de arriba, tal como está redactado, **no se cumple de forma incondicional** y se deja
  escrito así en vez de darlo por bueno.

Resolver esto de verdad —traducir IATA a ciudad y comparar ciudades— es **VAL-66**.

**Criterios de aceptación:**

- El resumen que va al modelo dice explícitamente de dónde salió cada destino y cuál tiene precedencia.
- Un viaje multidestino manda la lista de destinos, no uno solo.
- La sugerencia de tipo de viaje usa la misma jerarquía que el resto del motor, no una bolsa de palabras.
  **Con una salvedad que esta historia NO resuelve:** el clasificador local busca palabras completas y un
  código IATA de tres letras no puede ser ninguna, así que un vuelo sin título no clasifica. Cuando pasa, la
  pantalla lo dice. Es trabajo de VAL-66, y está detallado más abajo.
- **El caso que define el éxito:** un viaje "Europa" con vuelos a Madrid, París y Roma tiene que sugerir para
  esas tres ciudades, no para "Europa".
- **Y el caso que define que no se rompió nada:** un viaje a Bariloche con el destino bien escrito y una sola
  reserva en el punto de partida —el traslado al aeropuerto, el hotel de la noche anterior— tiene que seguir
  sugiriendo para Bariloche. Este criterio no estaba en la historia original: lo agregaron las dos auditorías
  que voltearon las dos primeras versiones de la entrega.

**Y una pregunta de producto que salió al construir VAL-63:** el motor usa el NOMBRE del viaje como pista de
destino. Medido: renombrar "Viaje" a "Noruega" agrega 5 ítems, aun con el destino cargado, porque
`tripContext` mete nombre, destino, notas y títulos de reservas en un mismo `textBlob`. Eso es la misma bolsa
de palabras que esta historia viene a ordenar, y refuerza que la jerarquía tiene que ser explícita: un vuelo
a Oslo no puede valer lo mismo que una palabra en el título del viaje.

**Relación con VAL-66:** son la misma pieza. VAL-66 es que el motor razone mejor sobre el destino; VAL-72 es
que razone sobre el destino CORRECTO. No tiene sentido hacer la primera sin la segunda — afinar el
razonamiento sobre un dato equivocado es afinar el error.

**Verificada en el teléfono del PM el 22/09, con v32 publicada.** Las dos pruebas pasaron y el detalle está
en `docs/qa/v32-resultado.md`. Lo esencial:

- **Europa con tres vuelos → EUROPA · CIUDAD**, y los tres ítems específicos nombran **Madrid, París y Roma**.
  Es el criterio de aceptación de esta historia, textual, cumplido en el aparato.
- **Bariloche con un solo traslado a Ezeiza → BARILOCHE · MONTAÑA**, sin una sola mención a Buenos Aires. Es
  el caso que volteó las rondas 2 y 3.

**Y la apuesta de la novena ronda quedó resuelta con evidencia.** Un motivo dice *"con más de cuatro días en
Madrid, cinco en París y tres en Roma"*: **nadie le pasó esos números, el modelo los calculó** del renglón
`entre-vuelos` con sus horas. La decisión de mandar el dato crudo en vez de resumirlo —la que cerró tres
rondas de vetos— estaba declarada como no verificable desde acá en cinco auditorías seguidas. Esta captura la
cierra: el dato crudo alcanzó, y el resumen habría estorbado.

**El encabezado de esta historia decía «✅ entregada en v24» y era falso dos veces:** ni estaba entregada
—seis rondas de auditoría la vetaron— ni había v24 publicada. El 20/09 se leyó el archivo que sirve el
Artifact y los cuatro `grep` dicen: **lo que está arriba es la v23**, con VAL-63 y VAL-74 y nada de VAL-72.
El PM no tiene ninguna versión vetada en el teléfono, que era el riesgo que abrió la sexta auditoría.

**Cómo quedó (v32):**

- `destinosDelViaje(trip, items)` arma la lista de destinos con **dos cajones**, y cuál va en cuál se
  decide por una sola pregunta: *¿puedo comparar este dato contra el punto de partida?*
  - **En firme**, y desplaza al destino escrito: el `to` de un vuelo, menos el del vuelo de vuelta. Es
    código IATA contra código IATA, así que la comparación existe.
  - **Pista**, y NO desplaza nada: toda dirección —alojamiento, traslado, auto—. Va al modelo entera, con
    sus fechas, y con las dos lecturas dichas en el propio prompt.
  - Si no hay ningún vuelo, manda el destino escrito a mano, como antes.

  **Llegar a esto costó dos vetos, y los dos fueron el mismo error.** La primera versión metía todo en un
  cajón y un traslado al Aeropuerto de Ezeiza desplazaba a un "Bariloche" bien escrito. La segunda le hizo
  la pregunta del origen al traslado y al auto, y **no al alojamiento, que estaba en el cajón de al lado**:
  el hotel junto al aeropuerto la noche antes de un vuelo temprano volvía a producir el mismo texto. Es la
  trampa que `CLAUDE.md` ya tenía escrita —descartar una causa sin preguntar si vale para el caso vecino—
  y la cometí dos veces seguidas sobre la misma función.
- La línea que le llega al modelo nombra cada destino con su fuente, dice que las reservas son lo que
  manda, avisa cuando el viaje es multidestino y cierra con *"úsalo sólo como contexto, NUNCA por encima
  de lo de arriba"* sobre el campo escrito.
- `suggestTripType` deja de ser una bolsa de palabras: puntúa **primero** lo reservado y sólo cae en lo
  escrito si de ahí no sale ninguna pista. El motivo dice de dónde salió (*"en lo que tenés reservado"* /
  *"en lo que escribiste del viaje"*), así que la precedencia es visible en pantalla y no sólo en el código.

  **Con un límite que hay que decir, porque la primera versión de esta entrega lo tapó.** El destino de un
  vuelo es un código IATA de tres letras y ninguna palabra del catálogo de pistas tiene tres letras: `MAD`
  **no puede puntuar nunca**. De un vuelo, lo único que clasifica es su texto libre —título y notas—, que la
  importación suele llenar ("Vuelo a Madrid") y la carga manual no. Entonces: un viaje cargado a mano, con
  vuelos sin título, sigue clasificándose por lo que la persona escribió aunque tenga reservas en firme.

  Eso ya pasaba en la v23 y sigue pasando: **no es una regresión, es una promesa que esta historia no
  cumple.** Lo que sí cambia es que deja de ser invisible — cuando ocurre, el motivo en pantalla dice
  *"tus reservas no dicen de qué tipo de viaje se trata"*. Resolver IATA → ciudad es trabajo de **VAL-66**.

  El **destino** que le llega al modelo sí sale de los vuelos en todos los casos: esta limitación es sólo
  del clasificador local de tipo de viaje, que corre sin conexión.
- **No se le adivina la ciudad a una dirección.** "Calle Atocha 123, Madrid" va entera al modelo. Recortar
  la ciudad con una heurística sería exactamente el tipo de suposición que esta historia viene a sacar.

**Un caso que el PM no reportó y salió de releer el código antes de entregar:** su viaje de prueba era de
ida sola. Con el vuelo de vuelta cargado, `EZE` entraba a la lista de destinos y el prompt le pedía al
modelo que la valija sirviera también para Buenos Aires. Se descarta el destino del **último** vuelo cuando
coincide con el origen del **primero** — no es una suposición sobre el viajero, está escrito en los datos.
El arnés tiene el caso y su control negativo: un viaje que termina en Lisboa sin volver a EZE conserva
Lisboa, así que la prueba no pasaría con una función que descarte siempre el último vuelo.

**El alcance de esa regla, dicho para que nadie lo descubra creyendo que fue un descuido:** mira el último
vuelo contra el origen del primero, y nada más. Un viaje que pasa por casa **a mitad** de camino deja ese
lugar entre los destinos. Está en el arnés como caso declarado, no como caso resuelto.

**Y una regresión que esta historia introdujo y la auditoría volteó con 57/100, antes de publicar.** La
primera versión metía en un solo cajón todo lo que tuviera un lugar escrito. Un viaje a Bariloche con el
destino bien cargado y **un solo traslado al Aeropuerto de Ezeiza** terminaba diciéndole al modelo que
Ezeiza era lo que manda y que Bariloche no iba "NUNCA por encima". Medido contra la v23: antes el modelo
recibía `- Destino: Bariloche`, después recibía lo contrario. El traslado al aeropuerto de salida es de los
datos más comunes que hay, así que no era un caso de borde. De ahí salieron los dos cajones.

**Dónde se probó:** `app/pruebas/val72-las-reservas-mandan.js`, que saca el motor del HTML publicado y no
de `app/parts/`, con los casos de las dos auditorías: reserva en el punto de partida (traslado y
alojamiento), vuelo sin título, ida y vuelta de dos tramos, y vuelta a mitad de viaje. Más
`app/pruebas/las-dos-copias.js`, nuevo, que compara función por función el motor de `parts/` con su copia
embebida en el HTML. Más las regresiones. **No se probó en el teléfono del PM**, que es lo único que este
proyecto llama verificado.

**Dos bloqueantes más, de la cuarta auditoría, y los dos los metió el commit que buscaba cerrar la ronda
anterior.** Están anotados porque la lección no es sobre destinos:

- **Una pista podía borrar el destino escrito.** El destino escrito se sumaba con la misma función que las
  pistas, y esa función comparte un registro de "esto ya lo vi". Un traslado cuyo «hasta» decía lo mismo que
  el destino del viaje se comía la entrada del destino escrito: la línea le decía al modelo que la persona
  no había escrito ninguno —falso— y le ofrecía su propio destino como una pista que no tomara en serio.
  **Una reserva desplazando al destino escrito otra vez, por un camino nuevo.** Reproducía también con sólo
  un acento, una mayúscula o un espacio de diferencia. Ahora el destino escrito no pasa por ese registro, y
  la pista redundante se cae porque dice lo mismo con menos respaldo.
- **El vuelo de vuelta sin fecha se comía el destino de verdad.** El orden por fecha es lo único que le da
  sentido a "el primero" y "el último"; un vuelo sin fecha ordena antes que todos y pasaba a definir cuál era
  el aeropuerto de casa. Con la vuelta sin `start`, el descarte sacaba Madrid y dejaba Ezeiza. La app acepta
  reservas sin fecha a propósito —el contrato del importador dice "o vacío"—, así que ahora el descarte se
  aplica sólo cuando el orden es confiable: sin fechas se manda de más, que es el lado seguro y el mismo que
  ya se había elegido para el vuelo sin origen.

**Y un tercer intento, que también se cayó: el número decía una cosa y calculaba otra.** Al sacar el rótulo
saqué también la guarda que exigía que el próximo vuelo saliera del mismo lugar, y no lo declaré. El número
quedó bien y la palabra quedó mal: un vuelo a Madrid, tren a Lisboa a los dos días y vuelta desde Lisboa
producía *"MAD, 11 días ahí"* **en la misma oración que mostraba el tren del día 3**. La mitad que mentía era
la que el prompt llama "lo que manda".

Ahora se conservan los dos casos: cuando el próximo vuelo sale de acá, el tiempo es tiempo acá; cuando sale
de otra ciudad, se dice cuánto falta **y de dónde sale**, que es el dato que revela el tramo por tierra.
Volver a la guarda habría perdido información real en un viaje perfectamente común.

**Y el 21/09 el PM sacó la anotación de tiempo entera, con el dato a la vista.** Es la decisión que cerró
la historia, así que va primero.

Tres rondas seguidas —quinta, sexta y séptima— se vetaron por defectos de **una sola cosa**: la anotación
que decía cuánto dura cada tramo. Ninguna de las tres tenía que ver con lo que el PM pidió, que estaba
cerrado desde la cuarta. La anotación salió de una *observación* del auditor, no de un reporte, y produjo
seis defectos: marcó como escala las tres ciudades de un multidestino, después el único destino de una ida y
vuelta, después dijo "11 días ahí" sobre un viaje con un tren en el medio, después afirmó un tramo por
tierra que no estaba en los datos, después una frase sobre no poder medir que era falsa, y además se comió
una estadía real de diez días.

**Lo que destapó la salida no fue un arreglo mejor: fue mirar qué recibe el modelo por otro lado.** En el
mismo pedido, más abajo, ya le llega:

```
{"tipo":"vuelo","desde":"2027-04-01T08:00","hasta":"2027-04-01T11:00","origen":"EZE","destino":"GRU"}
{"tipo":"escala","ciudad":"GRU","duracionHoras":2}
```

**El modelo ya sabía que San Pablo era una escala de dos horas.** Todo lo construido repetía un dato que ya
tenía, y cada intento de resumirlo terminó afirmando algo que el dato no decía. La línea de destino vuelve a
hacer una sola cosa —decir qué lugares son destino y de dónde salió cada uno— y suma una frase que apunta al
dato crudo: *"Ojo con las escalas... No lo adivines — abajo tenés cada vuelo con su hora de salida y de
llegada, y un renglón aparte por cada escala con cuántas horas dura."*

El arnés conserva los cuatro casos que voltearon las rondas 5, 6 y 7, ahora comprobando que la línea **no**
trae ningún número de tiempo. Y suma el control que sostiene toda la decisión: que el prompt **sí** trae el
renglón de escala con su duración, porque si no, sacar la anotación sería perder información en vez de dejar
de repetirla.

**Y la premisa con la que se tomó esa decisión estaba INCOMPLETA, lo cual la auditoría encontró mirando
donde ninguna prueba miraba.** Es cierto que el modelo ya recibía el dato. Lo que nadie verificó es **cómo
venía rotulado**: `summarizeReservationsForAI`, de VAL-44, decía `tipo:"escala"` sobre cualquier par de
vuelos encadenados, **sin umbral de duración**. O sea:

- un viaje de ida y vuelta a Madrid mandaba `{"tipo":"escala","ciudad":"MAD","duracionHoras":322.5}` —trece
  días de estadía llamados cambio de avión—;
- **el viaje a Europa del PM, el caso que define el éxito de esta historia**, marcaba como escala dos de sus
  tres ciudades.

Es exactamente el mismo error de rotular por encadenamiento que esta historia ya había cometido tres veces en
la línea de destino, **vivo en otra función desde hacía dos iteraciones**. Estaba dormido; al apuntarle el
modelo a ese bloque, pasó a amplificado.

El dato siempre estuvo bien: 322,5 horas son 322,5 horas. Lo que mentía era el sustantivo. El renglón pasa a
ser `{"tipo":"entre-vuelos","ciudad":"MAD","horasEnTierra":322.5}` —el hecho, sin la interpretación— y el
prompt explica qué es ese número. **Una escala de ocho horas y una estadía de trece días salen ahora por el
mismo camino, con el mismo tipo, y lo único que las distingue es el número, que es lo único que las distingue
de verdad.**

El arnés suma lo que faltaba: aserciones sobre el prompt **entero**, no sólo sobre la línea de destino. Ahí
es donde vivía el defecto y por eso ninguna prueba lo veía.

**Y había DOS más, en otras funciones, con la misma forma.** La tercera confirmación las encontró barriendo
por la **forma** del bug —un objeto con las claves de los tipos de reserva, mantenido a mano— en vez de por
la función tocada:

- **`yaResumidos`**, la guarda que puse para que la rama genérica no duplicara lo que ya salió: era otra
  lista de tipos escrita a mano, **la misma fragilidad que el arreglo decía haber erradicado, un nivel más
  adentro**. El auditor la saboteó sacándole `act` y la reserva salió dos veces. Ahora la guarda no es una
  lista sino el hecho: se anota cada ítem a medida que sale por su bloque propio.

  **Y acá decía "así que no se puede desincronizar", que era afirmar de más.** Sí se puede: si mañana alguien
  agrega un bloque propio y se olvida del `push`, la reserva sale dos veces igual. Lo que cambia es que el
  descuido queda **a un renglón** del código que lo causa en vez de a seiscientas líneas, y que ahora hay una
  prueba que lo agarra — porque **la primera que escribí no lo agarraba**: comparaba firmas JSON, y un
  duplicado nunca tiene la misma firma (la copia sale con el nombre crudo del tipo, `act`, y la original con
  el rótulo, `actividad`). La auditoría la saboteó y las tres aserciones quedaron en verde con el duplicado
  impreso en la línea de arriba. Ahora se cuenta el total, que es lo único que no se puede falsear, y el
  mismo sabotaje la hace fallar.
- **`LABEL` en `describeReservation`**, seiscientas líneas más lejos: le faltaban `transfer` y `note`, justo
  los dos tipos que costaron esta historia entera. Y era alcanzable hoy, no en teoría: `findFactSource`
  busca palabras clave en **cualquier** ítem sin filtrar por tipo, así que una nota terminaba citada como
  *"la reserva"* genérico. Ahora dice *"la nota «Día de playa en Valencia»"* y *"el traslado Madrid –
  Valencia"*, comprobado por el camino público y no por la función suelta.

`grep -n 'flight *:'` sobre el motor encontró las dos en un segundo, y ninguna de las cuatro rondas
anteriores lo había corrido. **Quedó escrito en `CLAUDE.md` como regla:** cuando un defecto resulta ser de
forma, se busca la forma en todo el archivo, con grep de la estructura y no del nombre de la función.

**Y la nota tampoco, y ésa es la tercera vez del mismo error en esta historia.** La app deja cargar seis
tipos de reserva y el resumen tenía un `filter` por tipo, con cinco. Una nota —*"comprar adaptador de
enchufe, el tipo F"*— no llegaba nunca, que es justo la clase de dato para la que existe esa función.

La secuencia, escrita entera porque es la lección:

| Ronda | Se arregló | No se preguntó por |
|---|---|---|
| 2ª | que un traslado no pise el destino escrito | el alojamiento, que estaba en el renglón de al lado |
| confirmación | que el traslado llegue al resumen | la nota, que faltaba por lo mismo |

**Entonces el arreglo dejó de ser agregar el tipo que falta.** Un sexto `filter` habría dejado caer al
séptimo. Ahora **lo que no tiene bloque propio sale igual**, con lo que toda reserva tiene: qué es, cuándo,
cómo se llama y su nota, saneada. El arnés lo comprueba con un tipo inventado que el motor no conoce.

Y el arnés dejó de tener su propia lista de tipos escrita a mano —a esa lista le faltó `transfer`, después
`act`, después `note`—: **ahora la lee del `TYPES` de la app** y falla solo si mañana aparece un séptimo sin
fixtures.

**Y el traslado no llegaba al modelo, desde VAL-44.** `summarizeReservationsForAI` resumía cuatro de los
cinco tipos de reserva que la app deja cargar y se salteaba el traslado. Un viaje con sólo un traslado le
decía al modelo *"(todavía no hay reservas cargadas)"* teniendo una cargada, y la nota que la persona
escribió ahí —"sale del andén 4"— no llegaba nunca. Lo encontró la auditoría de confirmación preguntando por
qué yo había declarado que el prompt lee `transfer.notes`: **no lo leía. La declaración era falsa y la
aserción que la respaldaba pasaba mirando el archivo de pruebas en vez de mirar el prompt.** Ahora entra, con
la misma forma que los otros cuatro y con su nota saneada.

**La lección, que no es sobre escalas:** antes de resumirle un dato al modelo, mirar si ya lo tiene — y
**mirar también cómo se lo estamos contando**. Que el dato esté no alcanza: el rótulo que lo acompaña es una
afirmación más, y puede ser falsa. Un resumen puede mentir; el dato crudo no.

**Y la séptima ronda encontró que la rama nueva afirmaba dos cosas que el dato no decía:**

- *"Un lugar sin tiempo es que no hay vuelo después desde el cual medirlo"* era falso. **`end` no es
  obligatorio en un vuelo** —no está en `REQUIRED.flight` y el campo "Llega" se dibuja sin la marca de
  requerido—, así que un vuelo del medio sin hora de llegada deja a su destino sin número **teniendo** vuelo
  después. Ahora dice *"no se pudo medir: puede no haber vuelo después, o faltarle la hora a alguno"*.
- *"que sale de otro lado"* se emitía también cuando el próximo vuelo **no tenía origen cargado**, y el aviso
  traducía eso a *"la persona se movió por tierra"*. Inventar una causa sobre un campo en blanco, que es la
  regla propia que este proyecto ya tiene escrita. Sin origen no hay número ni frase.

**Y una tercera: «gana la estadía más larga» no era lo que hacía el código.** Comparaba números sin mirar si
eran estadías, así que diez días reales en Madrid se perdían detrás de "11 días hasta un vuelo que sale de
Lisboa". Una estadía de verdad le gana a cualquier no-estadía; entre comparables, la más larga.

**Y el mecanismo de fixtures, que la ronda anterior celebró, aseguraba algo falso.** Decía *"end, que la app
siempre escribe"* y prohibía el único fixture que habría encontrado el primero de estos bloqueantes: un vuelo
sin hora de llegada. Convertir una regla en aserción estuvo bien; **se convirtió la regla equivocada**, y una
aserción escrita desde una creencia sólo puede darle la razón a quien la escribió — que es, palabra por
palabra, el error del simulador que este proyecto ya había pagado en septiembre.

La segunda versión no cree nada: exige que **de cada campo que el motor lee haya un caso con y un caso sin**,
y esa lista sale de abrir la función y mirar qué toca. Al correrla encontró **ocho huecos**: no había un solo
fixture de alojamiento, traslado o auto al que le faltara la dirección o las fechas. Ya están, y con
aserciones propias: seis reservas a medias no revientan nada, sólo entran como pista las que tienen lugar, y
la línea no muestra "undefined" por los campos que faltan.

**Y dos casos más, declarados y no resueltos:**

- **Fechas invertidas.** Si el vuelo de vuelta quedó cargado con una fecha anterior a la de ida, el orden se
  invierte y el descarte se come el destino real. No es determinable: un MAD→EZE→MAD es exactamente lo que
  carga alguien que vive en Madrid. `ordenConfiable` cubre la fecha que **falta**, no la equivocada.
- **Una ciudad por la que se pasa dos veces** se quedaba con el primer número —la conexión de 2 h— en vez de
  con los diez días de la vuelta. **Esto sí se arregló:** gana la estadía más larga, que es la que decide qué
  hay que llevar.

**La escala: dos intentos de arreglarla fueron peores que el problema, y el error no era el umbral — era
rotular.**

El problema era real: un Buenos Aires · San Pablo · Madrid le pedía al modelo una valija que sirviera también
para San Pablo, y para quien vuela a Europa desde acá eso es casi todos los viajes.

- **El primer intento** marcó como escala todo lo que encadenara —el destino de un vuelo es el origen del
  siguiente— y marcó las tres ciudades del viaje a Europa, que encadena igual. Lo agarró el arnés.
- **El segundo** puso la marca sólo cuando la duración se podía calcular. La quinta auditoría lo volteó con
  la forma de viaje **más común que existe**: la ida y vuelta. En un EZE→MAD, MAD→EZE, Madrid es el destino
  del primer vuelo y el origen del segundo, así que el **único** destino del viaje quedaba rotulado
  *"escala de 320 h"* y el prompt le pedía al modelo que dudara de tratarlo como destino.

`encadena` es verdadero en **todo** itinerario que siga un orden, porque adonde llegás es de donde salís
después. Lo único que separa dos horas de aeropuerto de dos semanas en Madrid es el tiempo, y el tiempo es un
número que ya teníamos. Así que no se rotula nada: **se dice cuánto se queda en cada lugar** —"MAD (vuelo,
13 días ahí)", "GRU (vuelo, 2 h ahí)"— y elige el modelo. Es lo mismo que se hace con las pistas y con el
destino escrito.

**Y por qué el arnés no lo vio: al fixture le faltaba un campo que la app escribe.** Los vuelos de prueba no
tenían hora de llegada, y la app la pide en el formulario manual, en la pantalla de revisar lo importado, y
en el prompt del importador. El control que declaraba el caso de éxito pasaba porque al dato le faltaba algo,
no porque el código estuviera bien. Es la regla que ya estaba escrita —*un escenario que espera que todo
salga bien puede pasar porque el sabotaje nunca llegó*— con el agravante de que acá **el sabotaje era el dato
real**.

Por eso se revisaron **todos** los fixtures del arnés contra los campos que la app escribe: los traslados
tienen "Desde" además de "Hasta", los alojamientos tienen check-out, los autos tienen devolución, y todas las
fechas son `datetime-local`, nunca una fecha pelada. El barrido no destapó nada más, pero la próxima vez el
arnés parte del dato real y no de una versión conveniente.

**Una escala dejó de ser un destino, y lo agarró mi propio arnés a mitad de camino.** Era una observación
de la cuarta auditoría, no un bloqueante, pero para quien vuela a Europa desde acá es casi todos los viajes:
un Buenos Aires · San Pablo · Madrid le pedía al modelo una valija que sirviera **también** para San Pablo,
con el énfasis de "multidestino".

No se resolvió con un umbral de horas inventado: dónde está el corte entre "esperé el avión" y "salí a
caminar" es una opinión. Se marca que es escala, se dan las horas, y elige el modelo con el resto del viaje
a la vista — el mismo criterio que las pistas.

**Y la primera versión de esa marca rompió el caso que define el éxito de esta historia.** El viaje a Europa
—EZE · MAD · CDG · FCO— encadena exactamente igual que una escala: el destino de cada vuelo es el origen del
siguiente. Quedaron las tres ciudades marcadas como escala y el prompt dejó de avisar que era multidestino.
Arreglando un caso rompí el otro, y lo destapó el arnés en la misma corrida, no una auditoría. La diferencia
real entre las dos cosas es **cuánto dura**, así que la marca se pone sólo cuando la duración se puede
calcular: sin `end` cargado no hay nada que las distinga, y marcar igual sería ponerle un rótulo a una
sospecha.

**Y la lección, que no es sobre destinos:** el primero salió de **sacar una guarda sin preguntar qué más
protegía**. La guarda que cortaba la línea temprano también tapaba que `lugares` pudiera quedar vacío
teniendo un destino escrito vivo. Se quitó mirando un solo caso.

Además, dos afirmaciones que el código hacía sin mirar el dato: *"no hay vuelos cargados"* salía de que no
quedaran destinos, no de que no hubiera vuelos, así que un vuelo cargado sin destino la hacía mentir; y el
`@returns` de `destinosDelViaje` seguía diciendo "en orden de firmeza" —la jerarquía volteada— y ni nombraba
`pistas`, el campo que esta historia agregó. Las dos corregidas, con su prueba.

**Y el arnés `las-dos-copias.js` prometía más de lo que hacía.** Su comentario decía que comparaba la
cabecera "un bloque contra otro" y comparaba una lista filtrada de declaraciones. La auditoría lo falsificó
con dos sabotajes que pasaban en verde: un número cambiado adentro de un comentario, y dos constantes dadas
vuelta. Ahora compara la cabecera entera y tiene los tres sabotajes como control.

**Dos defectos que encontré atacando la función con fixtures nuevos, no leyendo un reporte.** La cuarta
auditoría se cortó por límite de sesión antes de terminar su propio ataque, así que lo hice yo:

- **Sin destino escrito y sin vuelos, las pistas se perdían.** La línea no tenía nada que la encabezara y
  cortaba antes de mandarlas: un viaje al que le importaste el hotel y nunca le escribiste el destino le
  decía al modelo *"Destino: sin especificar"* teniendo el hotel cargado. Las pistas existen para mandarse,
  y se perdían justo cuando eran lo único que había. Arreglado, con su control: un viaje realmente vacío
  sigue diciendo "sin especificar", así que el arreglo no inventa una pista donde no la hay.
- **Un vuelo sin origen cargado deja entrar el aeropuerto de casa.** La regla del vuelo de vuelta compara el
  `to` del último contra el `from` del primero; si ese `from` está vacío no hay contra qué comparar. Es el
  lado seguro del error —se manda de más, no de menos— y queda declarado en el arnés en vez de arreglado con
  una suposición.

**Dos correcciones al propio registro, de la tercera auditoría.**

*Un número escrito a mano que era falso.* El commit de la tercera versión dice que "seis aserciones viejas
fallaron" al correr el arnés después del arreglo. Eran ocho. El auditor las contó corriendo el arnés de la
ronda anterior contra el motor nuevo; yo las conté de memoria mientras las arreglaba. Es la cuarta vez esta
semana que una cifra escrita a mano en prosa queda mal, y la regla que ya salió de las tres anteriores es la
misma: **el arnés dice cuántas son cada vez que corre, y la prosa no tiene por qué repetirlo.** La sustancia
no cambia —las ocho se revisaron y ninguna perdió cobertura— pero el número afirmado era falso y queda
corregido acá, porque un mensaje de commit no se puede reescribir.

*Un hueco del arnés nuevo, que lo encontró el auditor y no yo.* `app/pruebas/las-dos-copias.js` comparaba
sólo desde la primera `function` en adelante: **todo lo anterior —las constantes, los topes, los catálogos—
no se comparaba nunca.** Alguien podía cambiar `TOPE_LISTA_BYTES` en una sola de las dos copias y el arnés
decía verde. Ya está cerrado: compara también las declaraciones de la cabecera, recorta el envoltorio UMD
por su marcador en vez de por número de línea, y tiene su propio control negativo, que cambia un tope a mano
y verifica que el arnés lo ve.

**Una regresión de producto que esta entrega acepta a conciencia, y el PM la aprobó explícitamente el
20/09** después de que la tercera auditoría señalara que no era una decisión del PO: cambia una promesa del
criterio original, no un detalle de implementación. Se le planteó con las tres salidas —aceptarla, volver a
que el alojamiento mande, o frenar VAL-72 hasta VAL-66— y eligió aceptarla y publicar.

Es esta: un viaje con un hotel en Madrid y
"Europa" escrito a mano ya no declara Madrid como destino; lo manda como pista. Se pierde una afirmación
que a veces era correcta, a cambio de no volver a producir la que era catastrófica —decirle al modelo que
ignore el destino escrito porque hay un hotel en el punto de partida—. El modelo sigue viendo Madrid con
sus fechas. Cuando VAL-66 traduzca IATA a ciudad, esto se puede volver a apretar con datos.

**Lo que esta historia NO resuelve, y es VAL-66:** que la sugerencia para MAD, CDG y FCO sea *buena*. Lo que
cambió es cuál es el destino sobre el que el motor razona, no qué tan bien razona.

### VAL-66 · Que el motor sepa de verdad del destino — P0

Como viajero quiero que la valija me diga qué necesito para ESE destino, sobre todo la documentación.

**Reporte textual:** *"necesito que refine las sugerencias/búsquedas por destino en cuánto a la documentación
y todo lo referido al viaje"*.

Es la continuación natural de VAL-44, y va junto con VAL-63: las dos dependen de la misma capa. Si el motor
no razona bien sobre el destino, actualizar la lista al cambiar la fecha actualiza a algo que tampoco sirve.

- Documentación de entrada: visa, pasaporte con vigencia mínima, vacunas exigidas, permisos de menores.
- Lo que cambia por estación en ESE destino, no en general.
- Cada ítem sigue diciendo por qué está, como hoy.
- **Lo que NO se hace:** afirmar un requisito migratorio como si fuera oficial. Esto se sugiere, no se
  certifica, y el texto tiene que dejarlo claro sin asustar.

### VAL-68 · El tope de tres documentos por reserva — P1

**Pregunta textual del PM:** *"la capacidad de documentos (máximo 3) para adjuntar en una reserva es muy
poco; esto es una limitación técnica o una suposición tuya?"*

**Respuesta: es una suposición mía.** Está escrito así en `app/parts/adjuntos-engine.js:135`:

```js
/** Tope de documentos por reserva (diseño 5.2). Decisión nuestra, no de la base. */
var MAX_DOCS_POR_RESERVA = 3;
```

Los topes que SÍ son de la plataforma, y que no se pueden mover:

| Límite | Valor | De dónde sale |
|---|---|---|
| Tamaño de un documento de la base | 256 KiB serializado | Contrato de `db` |
| Archivo crudo más grande que entra | ~190 KB | Derivado del anterior |
| Documentos en toda la base | 5.000 | Contrato de `db` |

Cada adjunto gasta UN documento de esos 5.000. Con el tope en 3, un viaje de 20 reservas usa como mucho 60.
Subirlo a 10 lo llevaría a 200. El presupuesto no es el problema.

**DECIDIDO el 19/09 por el PM: sin tope.** Textual: *"que no tenga límite básicamente, nunca se va a llegar
al tope por reserva"*.

Y es correcto, medido y no supuesto. "Sin límite" no existe —siempre hay un techo—, pero el techo deja de
ser un número nuestro y pasan a mandar los de la plataforma. El metadato de un documento adentro de la
reserva pesa **251 caracteres** con nombres largos reales; el documento de la reserva tope a 256 KiB. Da
**~1.036 documentos por reserva** antes de chocar. Nadie llega.

Entonces el límite efectivo pasa a ser el otro, el de verdad: **5.000 documentos en TODA la app**, que
comparten viajes, reservas, listas de equipaje y adjuntos.

| Documentos por reserva | Un viaje de 20 reservas usa | De 5.000 |
|---|---|---|
| 3 (hoy) | 60 | 1,2 % |
| 20 | 400 | 8 % |
| 50 | 1.000 | 20 % |

- Se saca `MAX_DOCS_POR_RESERVA` como decisión de producto. No se reemplaza por otro número inventado.
- Queda la guarda técnica contra el tope del documento de la reserva, con su mensaje propio, para que si
  alguien llegara ahí la app lo diga en vez de fallar al guardar.
- **VAL-62 deja de ser P2 y se hace en la misma entrega.** Era el aviso de un cupo lejano; sin tope por
  reserva, el de 5.000 pasa a ser el único que protege y tiene que avisar antes de que falle un guardado.
- El texto de la interfaz ("Documentos · 1 de 3") sale del tope y hay que rehacerlo: sin tope no hay "de N".

### VAL-70 · Entrar a una reserva sin entrar a editarla — P1

Como viajero quiero abrir una reserva y VERLA, y editarla sólo si lo pido.

**Reporte textual:** *"es incómodo entrar a una reserva ya guardada y por defecto hacerlo en el modo edición
(...) genera fricción en la UX y margen de error por cambios involuntarios"*.

- Tocar una reserva guardada abre un resumen legible, no un formulario.
- Editar es una acción explícita.
- Lo que ya existe se reusa: la tira del documento, el troquelado, los chips. No se diseña una pantalla nueva
  desde cero.

### VAL-65 · El campo "Notas" del viaje no lleva a ningún lado — P2

**Reporte textual:** *"no termino de entender realmente la utilidad del campo Notas (...) si lo vamos a
dejar, debería crear una nota automáticamente dentro del viaje o debería servir de input para alertas (...)
porque sino esas notas de ahí no se vuelven a consultar nunca más"*.

Tiene razón y el diagnóstico es de producto, no técnico: hoy ese campo se guarda y nada lo lee. Un campo que
sólo escribe es peor que no tenerlo, porque promete memoria.

Tres salidas posibles, y conviene elegir UNA con él antes de construir:
1. **Se va.** Lo más barato y no pierde nada que hoy sirva.
2. **Se convierte en una nota de verdad** dentro del viaje, visible en el itinerario.
3. **Es entrada del motor**: lo que se escribe ahí alimenta las sugerencias y los avisos.

**DECIDIDO el 19/09 por el PM: la 3.** El campo pasa a ser entrada del motor. Entra en la iteración 4 con
VAL-66, porque es del mismo tema. La interfaz tiene que decir para qué sirve escribir ahí — cambia qué
significa el campo, y un campo que ahora alimenta las sugerencias no puede parecer el mismo cajón de antes.

### VAL-67 · Las categorías de la valija arrancan colapsadas — P2

**Reporte textual:** *"por defecto, cada categoría de la valija ejemplo: documentación, necesito que este
colapsado para mayor orden visual"*.

El acordeón ya existe (`.pk-cat[data-open]`). Es cambiar el estado inicial.

- Arrancan cerradas, con su nombre y su cuenta a la vista.
- Lo que la persona abre o cierra a mano se respeta mientras esté en la pantalla.
- **Ojo con lo que ya nos pasó:** un ítem nuevo o una propuesta adentro de una categoría cerrada no puede
  quedar invisible. Si hay algo que mirar, se ve desde afuera.

### VAL-69 · Formato de fecha según el tipo de reserva — P2

**Reporte textual:** *"el único que tiene sentido sea d/m/a XX:XX am/pm es el auto porque normalmente se
definen horarios de retiro/devolución pero el resto es innecesario"*.

- El auto lleva fecha y hora en los dos extremos.
- El resto muestra la hora sólo cuando la hay y cuando significa algo. Un vuelo sin hora no inventa 00:00.
- Un solo lugar decide el formato por tipo, no cada pantalla por su cuenta.

### VAL-64 · Un viaje vacío no puede estar 100% completo — P3

**Reporte textual:** *"las tarjetas creadas por cada viaje vienen con el indicador de completitud en 100 por
defecto y eso está mal; 100 es que no tengo pendientes y un viaje vacío no puede tener 100"*.

**Diagnóstico (verificado, `app/valija.html:1486`).** `completeness()` cuenta los campos críticos de cada
reserva, y aparte suma 2 puntos por las fechas del viaje. Un viaje recién creado con fecha de ida y de
vuelta tiene `total = 2` y `done = 2`: da 100 sin una sola reserva cargada.

Y hay una línea que se lee como si quisiera devolver 0 y no lo hace nunca:

```js
if(items.length===0) return items.length ? 0 : Math.round(done/total*100);
```

Adentro de ese `if`, `items.length` ya es 0, así que la condición del ternario siempre es falsa y siempre
devuelve el porcentaje. Alguien quiso arreglar esto y escribió una tautología.

- Un viaje sin reservas no muestra 100.
- Qué muestra en cambio lo decide el diseño: puede ser vacío, "sin reservas", o un anillo apagado. No un
  número que miente.

### VAL-71 · El resumen exportable sale mal — P3

**Reporte textual:** *"sale muy pero muy mal; todo desprolijo, caracteres pisados, no tiene un diseño pero
esto es evolutivo (es el final del recorrido de cada viaje)"*.

"Caracteres pisados" es el síntoma típico de fuentes: jsPDF sin una fuente embebida no tiene los glifos del
español y superpone o descarta. Hay que verificarlo antes de rediseñar nada — puede ser que el rediseño no
haga falta y el problema sea la fuente.

- Se reproduce primero, con un viaje real del PM, y se dice qué se observó.
- Recién después se diseña.

---

## Iteración 4 — Avisar

### VAL-10 · Recibir avisos por correo — P0
Como viajero quiero que me avisen por correo cuando falta algo o se acerca una fecha, sin tener que abrir la
app.

- Un proceso diario evalúa las reglas de pendientes de cada viaje activo.
- Solo se envía correo si hay algo nuevo respecto del último envío. Nunca un correo vacío.
- El correo lista los pendientes ordenados por urgencia y enlaza al viaje.
- Cadencia por cercanía: semanal a 30 días, repaso a 7 días, check-in a 48 horas, hoja de ruta el día previo.
- Se puede silenciar por viaje y darse de baja de todo desde el pie del correo.
- **Depende de:** VAL-13.

### VAL-11 · Reenviar mails de confirmación a la app — P0
Como viajero quiero reenviar el mail de Booking a una dirección y que la reserva aparezca cargada sola.

- Cada usuario tiene una dirección de reenvío propia y única.
- El mail reenviado se interpreta y crea la reserva en el viaje que corresponde por fechas.
- Si no se puede determinar el viaje, la reserva queda en una bandeja de entrada para asignar.
- El usuario recibe confirmación de lo que se cargó, con opción de deshacer.
- **Depende de:** VAL-13.

### VAL-12 · Permiso por viaje y no por valija — P0
Como viajero quiero compartir un viaje puntual sin dar acceso al resto de mis viajes.

- Se invita por correo a un viaje específico, con rol de lectura o edición.
- El invitado ve únicamente los viajes a los que fue invitado.
- El dueño puede revocar el acceso en cualquier momento.
- Resuelve la limitación principal documentada en el PRD.
- **Depende de:** VAL-13.

### VAL-54 · Lo nuevo de la valija es nuevo para cada uno — P2

Como viajero que comparte un viaje quiero que la marca de "nuevo" en la valija sea mía, y no que se me borre
porque otro ya la vio.

Hoy `nuevo` es una propiedad del ítem en el documento compartido de la lista. Si una persona recorre la
valija, las marcas se limpian para todas. Se decidió así al integrar el bloque B de la iteración 2, y es
aceptable mientras el permiso siga siendo por valija: dos personas empacando en paralelo es raro cuando
compartir implica dar acceso a todo.

Deja de ser aceptable con VAL-12, que es cuando compartir un viaje puntual se vuelve la forma normal de
usar la app.

- La marca de ítem nuevo se limpia por persona, no por documento.
- Necesita identidad por visitante, que hoy la plataforma no da.
- **Depende de:** VAL-12, VAL-13.

### VAL-13 · Cuentas y backend — P0
Como equipo necesitamos identidad propia y un servidor que corra sin la app abierta, para habilitar avisos,
buzón y permisos.

- Registro e inicio de sesión con correo.
- Migración de los datos existentes sin pérdida.
- Proceso programado capaz de ejecutar el evaluador de reglas a diario.
- Es la base técnica de VAL-10, VAL-11 y VAL-12: va primero.

### VAL-14 · Suscribir el viaje al calendario — P1
Como viajero quiero que los hitos del viaje aparezcan en el calendario de mi teléfono.

- Se genera un calendario suscribible por viaje.
- Vuelos, check-in, check-out y actividades aparecen como eventos con su código de reserva.
- Los cambios en la app se reflejan en el calendario sin volver a suscribir.

---

## Iteración 5 — Acompañar y mapas

### VAL-20 · Subir cualquier documento — P0
Como viajero quiero subir el PDF del voucher o la foto del contrato y que se interprete solo.

- Se aceptan PDF, imágenes y capturas de pantalla.
- El documento original queda guardado y accesible junto a la reserva.
- La tarjeta de embarque se puede mostrar desde la app en el mostrador.

### VAL-21 · Ver el viaje en un mapa — P1
Como viajero quiero ubicar alojamientos y actividades en un mapa para entender las distancias.

- Las direcciones cargadas se geolocalizan y se muestran en un mapa por viaje.
- Se indica la distancia y el tiempo estimado entre puntos consecutivos del itinerario.

### VAL-22 · Detectar conflictos de agenda — P1
Como viajero quiero que me avisen si dos reservas no cierran en el tiempo.

- Se detecta solapamiento entre reservas.
- Se detecta traslado imposible: tiempo insuficiente entre el fin de una reserva y el inicio de la siguiente
  considerando la distancia.
- El aviso propone el problema concreto, no una alerta genérica.

### VAL-23 · Estado de vuelo en vivo — P2
Como viajero quiero saber si mi vuelo se retrasó o cambió de puerta.

- Se consulta el estado del vuelo por número y fecha.
- Los cambios de horario y puerta actualizan la reserva y disparan aviso.
