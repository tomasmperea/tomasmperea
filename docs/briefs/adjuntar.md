# Brief de iteración 3 — Adjuntar

**Escribe:** Product Owner
**Estado:** en definición
**Consumen este brief:** diseño UX/UI, motor, frontend, QA, auditoría

Contrato de la iteración. Todo se valida contra los criterios de acá abajo.

---

## El objetivo

Que el documento no se interprete y se tire, sino que quede.

La iteración 2 logró que un PDF con texto se cargue solo. Pero se queda a mitad de
camino en dos sentidos: **la mayoría de las confirmaciones llegan por correo sin PDF
adjunto**, y el documento original —el que importa tener a mano en el aeropuerto—
se descarta después de leerlo.

**Pedido del PM, textual:** *"hay muchas confirmaciones que vienen por correo sin un
PDF adjunto y necesito que la funcionalidad sea capaz de interpretar la captura de
pantalla del correo"*.

---

## VAL-57 · Leer la captura de pantalla del correo — P0

Como viajero quiero sacarle una captura al correo de confirmación y que se interprete,
aunque no haya ningún archivo adjunto.

**Por qué no está resuelto:** la vista donde corre la app no acepta imágenes
(`images_unavailable`, ver el brief de la iteración 2). Esperar a que la plataforma lo
habilite no es un plan: es esperar.

**El camino que no depende de eso:** reconocer el texto de la imagen **en el propio
teléfono** y mandar texto, que es el camino que sí funciona. La foto nunca sale del
dispositivo hacia un modelo de visión.

- Se acepta una captura de pantalla o una foto, y de ahí sale una reserva.
- Funciona **sin** la capacidad de imágenes de la plataforma. Si algún día se habilita,
  la capa de visión pasa a ser el camino preferido por precisión, y esto queda como
  respaldo.
- El reconocimiento corre en el teléfono. Hay que decir cuánto tarda y mostrarlo: no es
  instantáneo y la persona tiene que saber que está pasando algo.
- Un reconocimiento pobre —foto torcida, con reflejo, con poca luz— **se declara como
  tal**. Antes una reserva vacía para revisar que una inventada.
- Mismo criterio que ya rige: nada se guarda sin que la persona lo vea antes.

**Riesgo que hay que resolver antes de comprometer esto:** la librería de
reconocimiento pesa varios megas y tiene que bajar del único CDN permitido, **el mismo
que ya falló en el teléfono del PM** (VAL-50). Si no baja, esta función no existe. Hay
que confirmar que baja, medir cuánto tarda en un teléfono real, y decidir qué se ve
mientras baja. **Sin esa confirmación, VAL-57 no arranca.**

## VAL-58 · El documento original queda en la reserva y se puede descargar — P0

Como viajero quiero que el archivo que subí quede guardado en la reserva que creó, para
tenerlo a mano cuando lo necesite.

**Pedido del PM, textual:** *"que no solamente interprete el documento que sea (ahora
PDF y próximamente imagen) sino que lo deje adjunto en la reserva la cual se crea y
disponible para descargar ya que esto es muy útil, por ejemplo, para tener una tarjeta
de embarque a mano"*.

- El archivo que se importó queda guardado junto a la reserva que generó.
- Se puede abrir y descargar desde la reserva, sin depender del correo original.
- Una reserva cargada a mano también acepta que se le adjunte un documento después.
- Se dice cuánto ocupa y cuántos documentos caben, porque el almacenamiento tiene tope.
- Si el documento no se pudo guardar, la reserva se guarda igual: el dato vale por sí
  mismo.

**Nota técnica:** la plataforma tiene una capacidad de almacenamiento de archivos por
artifact. Hay que leer su contrato antes de diseñar, no después, y declarar sus topes
reales en el diseño. Es exactamente el error que costó tres iteraciones en la 2.

## VAL-59 · La tarjeta de embarque no es un vuelo — P0

Como viajero quiero que la tarjeta de embarque complete mi vuelo, y que si ese vuelo no
está cargado la app me lo diga en vez de inventar una reserva suelta.

**Pedido del PM, textual:** *"identifico que las tarjetas de embarque las interpreta
como reserva 'vuelo' pero en realidad, debería estar incluido dentro de una reserva
previa que exista como vuelo o, sino, alertar que no existe vuelo asociado y dar la
posibilidad de crear uno. en definitiva, la tarjeta se desprende de una reserva de
vuelo"*.

Es una corrección conceptual, no un bug de implementación. VAL-42 ya reconoce el vuelo
por número y fecha y lo completa. Lo que está mal es **el caso en que no encuentra
ninguno**: hoy crea una reserva de vuelo nueva a partir de la tarjeta, y una tarjeta de
embarque no es un vuelo. Es un documento que se desprende de uno.

- Si el vuelo existe, la tarjeta lo completa. Ya funciona.
- **Si no existe, no se crea una reserva de vuelo en silencio.** Se avisa que no hay
  vuelo asociado y se ofrece crearlo, con lo que la tarjeta ya aporta precargado.
- La persona puede decir que no: la tarjeta no se guarda como una reserva suelta.
- Ante la duda entre dos vuelos, sigue preguntando. Nunca adivina.
- Junto con VAL-58: la tarjeta queda adjunta al vuelo, que es de donde se desprende.

## VAL-60 · Dejar de pedir el modelo más caro para extraer datos — P1

Como equipo queremos que el límite de uso del visitante aparezca cada veinte documentos
y no cada cinco.

Sale de `docs/investigacion/cuota-de-la-capa-inteligente.md`. No rompe nada, y por eso
es P1, pero es desperdicio medible y nuestro.

- El camino de texto deja de usar el tier más caro. Se mide si el más rápido alcanza
  para extraer campos de un texto limpio.
- Un lote de varios documentos de texto se resuelve en **una** llamada, no una por
  archivo, conservando el progreso por fila.
- Se registra qué tier contestó de verdad (`modelTierApplied`), porque la plataforma
  puede servir uno más barato que el pedido y hoy no lo sabemos.
- La lectura de imágenes y la sugerencia de equipaje se quedan en el tier alto: ahí sí
  hay trabajo difícil.

---

## Decisiones de producto cerradas

**Nada se guarda sin revisar.** Vale para lo interpretado de una captura igual que para
lo interpretado de un PDF.

**Un dato que no está, no se inventa.** Un reconocimiento de imagen pobre devuelve
campos vacíos, no adivinanzas. Esto importa más acá que en la iteración 2: leer una foto
es menos confiable que leer una capa de texto, y la tentación de rellenar es mayor.

**El documento original es del viajero.** Se guarda para que lo tenga, no para
procesarlo de nuevo. No se manda a ningún lado que no sea su propia valija.

**La tarjeta de embarque se desprende de un vuelo.** No es una reserva.

---

## Fuera de alcance

- Avisos por correo y buzón de reenvío. Siguen esperando servidor.
- Que la capa de visión de la plataforma lea las imágenes. No depende de nosotros; si se
  habilita, se suma como camino preferido y VAL-57 queda como respaldo.
- Mapas y detección de conflictos de agenda.

## Cómo se valida

Contra la app publicada, en el teléfono del PM, con documentos reales. Un criterio que
no se puede verificar así se considera no cumplido.

**La prueba que define el éxito:** sacarle una captura al correo de una reserva que no
tiene PDF adjunto, que se cargue sola, y que la captura quede adjunta a la reserva y se
pueda volver a abrir.

Y antes de empezar, el paso cero: **confirmar que la librería de reconocimiento baja en
el teléfono.** Si no baja, VAL-57 no existe y hay que rediseñar la iteración.
