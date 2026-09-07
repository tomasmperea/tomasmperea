# Brief de iteración 2 — Interpretar

**Escribe:** Product Owner
**Estado:** en desarrollo
**Consumen este brief:** diseño UX/UI, motor, frontend, QA

Contrato de la iteración. Todo se valida contra los criterios de acá abajo.

---

## El objetivo

Que cargar un viaje deje de ser trabajo.

El MVP demostró que la app sirve para consolidar, pero también que llenarla cuesta. Esa fricción es lo que
decide si la app se usa o se abandona, y por eso esta iteración va antes que los avisos por correo.

## Las dos mitades, en orden de prioridad

**Primero: sacar la carga manual.** Subir una foto o un PDF y que la reserva se cargue sola. Es la prioridad
más alta de la iteración y lo que más valor devuelve por unidad de trabajo.

**Después: la valija razona sobre el viaje entero.** La sugerencia de equipaje deja de mirar solo el destino
y pasa a considerar todo lo cargado, actualizándose a medida que el viaje crece.

El orden importa: la segunda mitad se vuelve mucho más valiosa cuando la primera funciona, porque un viaje
cargado sin fricción tiene más datos sobre los que razonar.

---

## Bloque A — Importar documentos · PRIORIDAD MÁXIMA

### VAL-40 · Importar desde PDF — P0

Como viajero quiero subir el PDF del voucher o del pasaje y que se cargue solo.

- Se acepta un PDF desde el teléfono, en el mismo lugar donde hoy se pega texto.
- Un PDF de varias páginas se interpreta completo, no solo la primera.
- Un PDF escaneado, sin texto seleccionable, también se interpreta.
- Cada reserva encontrada se muestra para revisar antes de guardar.
- **Cómo se resuelve:** la capa inteligente recibe imágenes, no PDFs. Se renderiza cada página a imagen
  dentro del navegador y se mandan esas imágenes. No necesita servidor.

### VAL-41 · Importar fotos y capturas — P0

Como viajero quiero sacarle una foto al voucher, o mandar la captura del mail, y que se interprete.

- Se aceptan PNG y JPG, varias a la vez.
- Se pueden mezclar tipos en una misma carga: dos fotos y un PDF juntos.
- La app dice qué reconoció de cada archivo, no un resultado global sin detalle.
- Un archivo que no se pudo interpretar se señala solo, sin invalidar los que sí funcionaron.

### VAL-42 · Completar la reserva con la tarjeta de embarque — P0

Como viajero quiero subir la tarjeta de embarque y que complete el vuelo que ya tenía, sin duplicarlo.

- Puerta, terminal, asiento y hora de embarque salen de la tarjeta de embarque, que llega tarde, cuando el
  vuelo ya está cargado.
- La app reconoce que es el mismo vuelo por número y fecha, y lo completa en lugar de crear otro.
- Ante la duda pregunta a cuál corresponde, no adivina.
- Se muestra qué campos se van a completar antes de guardar.

---

## Bloque B — La valija razona sobre el viaje · PRIORIDAD ALTA

### VAL-44 · La capa inteligente ve el viaje completo — P0

Como viajero quiero que la sugerencia razone sobre todo lo que cargué, no solo sobre a dónde voy.

Hoy la capa inteligente recibe cuatro datos: destino, fechas, duración y tipo. No ve ninguna reserva. Las
reglas sí las ven, pero solo reaccionan a lo que alguien anticipó al escribirlas.

- La capa inteligente recibe las reservas: tramos de vuelo con horarios y escalas, alojamiento con su tipo y
  sus notas, auto con su lugar de retiro, actividades y notas del viaje.
- Puede sugerir por combinaciones que ninguna regla anticipó: una escala de ocho horas, un check-in de
  madrugada, un alojamiento sin lavandería en un viaje largo, una actividad que pide equipo propio.
- Cada sugerencia cita el dato concreto del viaje que la motiva. "Tu escala en Lima es de ocho horas", no
  "las escalas largas cansan".
- **Nunca se mandan códigos de reserva, teléfonos ni direcciones exactas.** No aportan a decidir qué llevar.
  Van tipo, fechas, ciudades, duración y notas.

### VAL-45 · Ningún ítem repetido entre capas — P0

Como viajero no quiero ver dos veces lo mismo en mi valija.

Es la regla que hace que las dos capas puedan convivir. Sin esto, sumar contexto a la capa inteligente
garantiza duplicados: el modelo va a proponer el adaptador de enchufe que la regla del vuelo internacional ya
puso.

- Un ítem que ya existe por una regla no se agrega de nuevo por la capa inteligente, ni al revés.
- La comparación es por clave normalizada, no por texto literal: "cargador de celular" y "Cargador celular"
  son el mismo ítem.
- Va más allá de la coincidencia exacta: "adaptador de enchufe" y "adaptador de corriente" son lo mismo, y
  hay que resolverlo.
- Cuando dos capas proponen el mismo ítem, gana la de menor precedencia y conserva su origen: primero regla,
  después historial, después capa inteligente. Un ítem que una regla ya ponía nunca se acredita a la IA.
- El motor expone una verificación propia: dada una lista, no puede haber dos ítems que signifiquen lo mismo.

### VAL-46 · La lista se actualiza cuando el viaje crece — P0

Como viajero quiero que la valija se ajuste sola a medida que voy cargando reservas, sin tener que rehacerla.

- Al agregar, editar o borrar una reserva, la app detecta que la lista quedó desactualizada.
- Los ítems nuevos que aparecen por esa reserva se marcan como nuevos, para que se distingan de lo que ya
  estaba revisado.
- **Nunca se pierde lo ya marcado.** Lo empacado sigue empacado y lo descartado sigue descartado.
- **Un ítem descartado no vuelve.** Que el viaje crezca no revive una decisión ya tomada.
- Se avisa qué cambió y por qué, nombrando la reserva que lo motivó.
- La actualización no puede interrumpir a la persona mientras está empacando: se ofrece, no se impone.

### VAL-43 · La lista se adapta al destino de verdad — P1

Como viajero quiero que la lista contemple el clima y las reglas del país, y que no me muestre cosas que no
necesito.

- La capa inteligente puede **sacar** ítems, no solo agregar. Hoy solo agrega, y por eso pide visa en
  destinos donde no hace falta.
- Se considera la proyección de clima para las fechas del viaje.
- Distingue destinos dentro del mismo país: un pueblo de playa no necesita lo mismo que una capital.
- Todo ítem sacado explica por qué.
- **Piso que no se toca:** un ítem que una regla marca como crítico, la documentación de identidad entre
  ellos, no se saca automáticamente nunca.

---

## Decisiones de producto cerradas

**El motor sigue siendo híbrido.** Las reglas son el piso, la capa inteligente trabaja encima y nunca en
lugar de. Sin conexión, o si el modelo falla, la lista base se genera igual y sirve. Lo mismo para importar:
si la interpretación falla, la carga manual sigue estando.

**Nada se guarda sin revisar.** Ni una reserva interpretada de un PDF ni un ítem sugerido por la capa
inteligente entran a los datos sin que la persona los vea antes.

**Un dato que no está, no se inventa.** Vale para la interpretación de documentos y para la sugerencia de
equipaje. Es preferible un campo vacío o una lista más corta que un dato inventado.

**No se compra nada.** Sin links ni recomendaciones de producto.

---

## Fuera de alcance

- Avisos por correo y buzón de reenvío. Van a la iteración 3, necesitan servidor.
- Permiso por viaje en lugar de por valija. Iteración 3, necesita cuentas propias. Compartir para ver o
  editar ya funciona desde el MVP: lo que falta es que el invitado vea un viaje y no toda la valija.
- Guardar el documento original junto a la reserva. Necesita almacenamiento de archivos, se evalúa aparte.
- Mapas y detección de conflictos de agenda. Iteración 4.

## Cómo se valida

Contra la app publicada, en un teléfono, con documentos reales de reservas reales. Un criterio que no se
puede verificar así se considera no cumplido.

La prueba que define el éxito de la iteración: cargar un viaje entero, con vuelo, alojamiento y auto, sin
tipear ningún dato a mano.
