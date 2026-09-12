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

## VAL-57 · Que la confirmación del correo entre sin tipear — P0 · REPLANTEADA

**El planteo original era leer la captura de pantalla reconociendo el texto en el
teléfono. El paso cero lo descartó:** el motor de reconocimiento carga, pero el
diccionario del idioma no baja de ningún host que el visor permita. Cuatro orígenes
probados, ninguno funciona. El detalle está en
`docs/investigacion/paso-cero-leer-una-foto.md`.

**Y al mirarlo de nuevo, el problema estaba mal planteado.** La necesidad no es la
captura: es que la confirmación esté en el cuerpo de un correo. La captura era el medio
que se le ocurrió al PM para traerla.

Para eso ya hay un camino que funciona hoy: **copiar el texto del correo y pegarlo.** Y
es estrictamente mejor que fotografiarlo — no hay error de lectura, no hay librería de
varios megas, no hay espera, y funciona sin señal. Un reconocedor de imagen sobre una
captura de pantalla es la peor versión de algo que el correo ya entrega en texto
perfecto.

Lo que falta no es tecnología: es que **la app no te lleva a esa vía.** Está ahí, abajo,
como si fuera el plan de contingencia.

- Pegar el texto de una confirmación deja de ser el camino de escape y pasa a ser uno de
  los dos caminos principales, a la par de subir el PDF.
- Se explica en una línea cómo traer un correo que no tiene adjunto, sin tecnicismos y
  sin dar por sentado qué teléfono usa la persona.
- Si la única fuente es una captura, se dice que el propio teléfono sabe sacarle el texto
  y cómo. **No lo reimplementamos peor que el sistema operativo.**
- El texto pegado se interpreta con la misma calidad que un PDF: mismo motor, mismas
  reglas, misma pantalla de revisión.
- Varias reservas pegadas juntas se separan solas. Ya funciona; hay que verificarlo con
  correos reales del PM, que es lo que nunca se hizo.

**Lo que NO se hace, y por qué:** no se empotra el diccionario del idioma dentro de la
app. Serían unos 3 MB más de descarga inicial para todos, este entorno no puede
conseguir el archivo para probarlo, y resolvería peor un problema que el copiar y pegar
ya resuelve bien. Queda anotado como apuesta posible si la vía A resulta incómoda en la
práctica.

**Si algún día la plataforma acepta imágenes,** la lectura de la foto se suma como
camino preferido por precisión y esto queda como respaldo. No depende de nosotros.

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

**El contrato, leído antes de diseñar y no después.**

**No hay capacidad de almacenamiento de archivos disponible para esta cuenta.** Las
capacidades habilitadas son las que ya usamos y algunas más, pero ninguna guarda
archivos. El documento tiene que vivir en la misma base que el resto de los datos,
codificado como texto.

Y esa base tiene un techo duro: **un documento de más de 256 KiB se rechaza.** Codificar
un archivo como texto lo infla un tercio, así que el archivo crudo más grande que entra
es de unos **192 KB**. Medido contra los documentos reales del PM:

| Archivo | Tamaño | Codificado | ¿Entra? |
|---|---|---|---|
| Voucher de micro (Lobos Bus) | 20 KB | 28 KB | **Sí**, de sobra |
| Pasaje de Aerolíneas | 123 KB | 164 KB | **Sí**, con margen |
| Foto típica de cámara | ~3 MB | ~4 MB | **No**, hay que recomprimir |

Consecuencias para el diseño, que dejan de ser sorpresas:

- **La mayoría de los vouchers y tarjetas de embarque entran.** Los dos casos reales del
  PM entran, y son representativos: un PDF de aerolínea rara vez pasa los 200 KB.
- **Una foto de cámara no entra tal cual.** Hay que reducirla y recomprimirla en el
  navegador antes de guardarla, y **decirle a la persona que se guardó en menor
  calidad**, no hacerlo en silencio.
- **Un PDF grande de varias páginas no entra ni recomprimido.** Ahí no se guarda, se dice
  por qué, y la reserva se guarda igual: el dato vale por sí mismo.
- Partir el archivo en varios documentos es posible pero gasta el cupo de documentos de
  la base. **No se hace en esta iteración**; si aparece la necesidad, se decide con datos.
- Para devolver el archivo sí hay capacidad de descarga disponible, la misma que usa el
  PDF del resumen.

## VAL-59 · La tarjeta de embarque se desprende de un vuelo — P0

Como viajero quiero que la tarjeta de embarque complete mi vuelo, y que si ese vuelo no
está cargado la app me lo diga y me ofrezca crearlo, en vez de inventar una reserva
suelta.

**Pedido del PM, textual:** *"identifico que las tarjetas de embarque las interpreta como
reserva 'vuelo' pero en realidad, debería estar incluido dentro de una reserva previa que
exista como vuelo o, sino, alertar que no existe vuelo asociado y dar la posibilidad de
crear uno. en definitiva, la tarjeta se desprende de una reserva de vuelo"*.

Es una corrección conceptual, no un bug. VAL-42 ya reconoce el vuelo por número y fecha
y lo completa; lo que está mal es el caso en que **no encuentra ninguno**: hoy crea una
reserva de vuelo a partir de la tarjeta, y una tarjeta de embarque no es un vuelo.

### El flujo, como lo especificó el PM

La regla que atraviesa los tres casos: **primero intentar el match, siempre. Después
preguntar. Nunca inventar.**

**Sin ningún vuelo cargado en el viaje**
- No hay con qué matchear. La app avisa que no hay vuelo asociado y **ofrece crearlo**.
- Si se acepta, la reserva de vuelo se crea **precargada con lo que la tarjeta aporta**
  (número, fecha, ruta, asiento, puerta, terminal, hora de embarque). Lo que la tarjeta
  no traiga queda vacío y se completa a mano después: un campo vacío nunca se rellena
  adivinando.
- La tarjeta queda **adjunta a ese vuelo** (VAL-58). Es de donde se desprende.
- Si se rechaza, no se guarda nada: ni reserva suelta ni documento huérfano.

**Con un vuelo cargado**
- Primero el match inteligente contra la tarjeta. Si coincide, **completa solo**, sin
  preguntar nada. Es el caso frecuente y tiene que ser invisible.
- Si no coincide, se pregunta: **asociarla a ese vuelo, o crear uno nuevo.** Las dos
  salidas explícitas. Que no coincida el número no significa que sea otro vuelo — puede
  ser que el número se leyó mal, o que la reserva se cargó a mano sin número.

**Con más de un vuelo cargado**
- Primero el match contra todos. Si coincide con uno solo, completa solo.
- Si no coincide con ninguno, o coincide con más de uno, **se pregunta contra cuál
  asociarla**, mostrando los vuelos con lo que los distingue: ruta, fecha y hora. Más la
  salida de crear uno nuevo.
- **Nunca se elige por la app.** Ya es la regla de VAL-42 y se mantiene.

### Criterios

- Un match exitoso no pregunta nada y deja registro de por qué coincidió.
- Ninguna rama crea una reserva de vuelo sin que la persona lo haya pedido.
- Ninguna rama descarta la tarjeta sin decirlo.
- La tarjeta siempre termina adjunta al vuelo con el que quedó asociada, nunca suelta.
- Lo que la tarjeta no traiga se queda vacío, visible, y se completa a mano.

## VAL-60 · Gastar menos por documento — P1 · UN TERCIO HECHO

Como equipo queremos que el límite de uso del visitante aparezca cada veinte documentos
y no cada cinco.

Sale de `docs/investigacion/cuota-de-la-capa-inteligente.md`. No rompe nada, y por eso
es P1, pero es desperdicio medible y nuestro.

**Estado al 12/09, corregido por la auditoría.** Yo encuadré el cambio de tier como
"lo último que quedaba abierto". Era falso: esta historia tiene tres criterios y sólo se
cumplió el primero. Queda anotado porque el que falta es **el que de verdad mueve el
número**.

- ~~El camino de texto deja de usar el tier más caro~~ · **HECHO** (publicado en la
  versión 13). El texto pide `default`; la lectura de imágenes y la sugerencia de
  equipaje se quedan en `complex`, y el tier de importación sale de las opciones que
  manda el motor, así que el día que se habiliten las fotos arranca arriba solo.
- **Un lote de varios documentos se resuelve en UNA llamada**, no una por archivo,
  conservando el progreso por fila. **PENDIENTE, y es la palanca principal**: el propio
  contrato pide *"prefer ONE call that returns a JSON array over one call per item"*.
  Subir cuatro documentos son hoy cuatro llamadas. El tier solo no baja la frecuencia
  del aviso de límite; esto sí.
- Se registra qué tier contestó de verdad. **NO SE PUEDE**, y está declarado:
  `modelTierApplied` viaja en lo que resuelve `sample()`, y la app usa `json()`, que
  resuelve con el JSON ya parseado. Verificado contra el contrato por el PO y por la
  auditoría. Lo que sí se registra: tier pedido, tarea, duración y código de error.

**Deuda de prueba que viene con esto:** `app/pruebas/tier-del-modelo.js` falló una
aserción en una de siete corridas del PO; la auditoría lo corrió diez veces más sin
reproducirlo, y por inspección señaló el sospechoso: tres esperas fijas después de tocar
`#pk-build` y `#save`, en lugar de esperar una señal real de que el recálculo terminó. Es
el mismo patrón que ya tumbó otro arnés. Se arregla en esta iteración: una prueba que
falla una de cada siete no garantiza lo que dice.

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

**La prueba que define el éxito:** tomar la confirmación de un correo sin adjunto,
traerla a la app sin tipear ningún dato, y que el documento —el que haya— quede adjunto a
la reserva y se pueda volver a abrir.

**El paso cero ya corrió y su resultado está incorporado arriba:** el reconocimiento de
texto en el teléfono no es viable dentro de la app. VAL-57 quedó replanteada en
consecuencia, no cancelada.
