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
   que mirar primero.
2. Que aparezca una copia del diccionario del idioma en un host permitido.
3. Que el uso real muestre casos que copiar y pegar no cubre —un comprobante en papel,
   un cartel, algo que no llegó por correo— y que sean frecuentes.

**Lo que ya sabemos y no hay que volver a averiguar:**

- El visor bloquea **por host**, no por tipo de archivo: el motor en WebAssembly bajó
  perfecto del CDN permitido.
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

## Iteración 3 — Avisar

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

## Iteración 4 — Acompañar y mapas

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
