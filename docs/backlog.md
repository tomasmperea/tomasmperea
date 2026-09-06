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

## Iteración 1.5 — Preparar

Épica **VAL-30 · Valija inteligente**. Los criterios de aceptación completos están en
`docs/briefs/valija-inteligente.md`, que es el contrato de la iteración. Acá queda el índice y la prioridad.

| ID | Historia | Prioridad |
|---|---|---|
| VAL-30 | Generar la lista sugerida según tipo, destino, fechas y duración | P0 |
| VAL-31 | Marcar lo que ya está en la valija, descartar y agregar propios | P0 |
| VAL-32 | Aprender del historial de viajes anteriores | P0 |
| VAL-33 | Ajustar la lista por destino y época del año | P1 |
| VAL-34 | Compartir la lista con quien viaja conmigo | Movida a iteración 2 |
| VAL-35 | Incluir la lista en el PDF del viaje | P2, sin diseñar |

**Por qué se adelanta a la iteración 2:** no necesita backend. Usa la base de datos y la capa de
inteligencia que ya tiene el MVP.

**Decisiones de producto tomadas y cerradas:** el motor es híbrido y la lista base funciona sin IA; la
sugerencia se puede rechazar y rechazar es información que alimenta el aprendizaje; las cantidades explican
de dónde salen; no hay links de compra ni recomendación de producto.

---

## Iteración 2 — Avisar

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

## Iteración 3 — Interpretar todo

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
