# Adjuntar el documento y desprender la tarjeta de embarque — especificación de diseño

**Épica:** VAL-58 y VAL-59 (`docs/briefs/adjuntar.md`) · **Escribe:** diseño UX/UI ·
**Estado:** listo para integración
**Muestrario:** `app/parts/adjuntar-ui.html` — veinte estados, tres de ellos interactivos, tema claro y oscuro.

Esto **se suma** al importador de la iteración 2, no lo reemplaza. Los catorce estados de
`docs/design/importar.md` siguen valiendo tal como están escritos; acá se documenta lo que se agrega y —en un
solo caso, el estado 06— lo que se corrige. El motor que alimenta esta interfaz es `app/parts/import-engine.js`
(`docs/design/import-engine.md`); este documento lo asume leído y señala en la sección 7 los tres cambios que
necesita para que estas pantallas existan.

---

## 0 · Para quién es esto

**Qué tiene que poder hacer.** Dos cosas distintas, en dos momentos distintos.

La primera: **tener la tarjeta de embarque en pantalla, ya.** Está en la fila del mostrador, el teléfono en una
mano y la valija en la otra, y necesita mostrar un código de barras. No quiere "administrar sus documentos":
quiere que el papel que subió hace dos semanas aparezca.

La segunda: **entender qué hizo la app con una tarjeta de embarque.** La subió esperando que complete su vuelo.
Si la app no encontró ese vuelo, lo peor que puede pasar es que invente una reserva suelta y ella se entere tres
días después, con dos vuelos iguales en la pantalla, sin saber cuál es el real.

**En qué momento y estado llega.** Para la primera, apurada y de pie: el documento tiene que estar a **un
toque** desde la pantalla del viaje, sin submenús. Para la segunda, de noche, cargando cosas de a una: ahí sí
hay tiempo para una pregunta, pero **una**, y con las opciones a la vista.

**El camino más corto.** Del viaje al documento: un toque en la tira del documento dentro de la reserva. De la
tarjeta de embarque al vuelo completo: cero toques cuando coincide (el caso frecuente), un toque cuando hay que
elegir, dos cuando hay que crear el vuelo. Nunca un formulario para confirmar algo que ya está en la foto.

**Lo que más se cuidó, porque es lo que se podía arruinar.** Hoy la reserva se lee de un vistazo: título, hora,
troquelado con los datos. Sumarle un documento —con su tamaño, su estado de compresión y su descarga— la podía
convertir en un formulario. La respuesta está en la sección 5.1 y se puede resumir en una regla: **en la tarjeta
sólo va lo que se necesita para decidir tocarla; todo lo demás vive en el visor.**

---

## 1 · Los dos flujos

### 1.1 El documento (VAL-58)

```
Pantalla del viaje
   │
   └─ Tarjeta de la reserva  ──► D1 · una tira por documento, abajo del troquelado
         │                        (la tira NO existe si no hay documento)
         │  un toque
         ▼
      D2/D3 · Visor del documento
         ├─ imagen ─────────────► se ve la imagen
         ├─ PDF con pdf.js ─────► primera página dibujada
         ├─ PDF sin pdf.js ─────► D3 (abajo) · se explica y la descarga sigue
         ├─ trayéndolo ─────────► D4 · "Trayendo el documento…"
         ├─ no llegó ───────────► D4 · no se perdió, hace falta conexión + reintentar
         ├─ recomprimido ───────► D5 · aviso permanente de menor calidad
         └─ sólo lectura ──────► D6 · sin reemplazar ni quitar
         │
         ├─ Descargar ──► claude.use("downloads") · si no está: D6 (abajo)
         └─ Quitar ─────► D7 · confirmación en la misma hoja


Hoja de la reserva (Editar / Nueva)
   └─ Bloque "Documento", al final
        ├─ sin documentos ──► D8 · dos orígenes: Archivo y Sacar foto
        ├─ preparando ──────► D9 · "Reduciendo la foto para que entre…"
        ├─ entró tal cual ──► D10 · aparece la fila, sin festejo
        ├─ recomprimido ────► D11 · fila + aviso con los dos números
        ├─ no entró ────────► D12 · fila en rojo con el motivo + "Elegir otro"
        ├─ tres ya ─────────► D13 · sin botones de origen, con la frase que explica
        └─ sólo lectura ────► el bloque no existe (ver 5.6)


Importador (los catorce estados de docs/design/importar.md)
   └─ al guardar ──► D14 · el aviso final nombra qué quedó adjunto y qué no
```

### 1.2 La tarjeta de embarque (VAL-59)

La regla que atraviesa todo, textual del brief: **primero intentar el match, siempre. Después preguntar. Nunca
inventar.**

```
Una reserva interpretada de tipo "flight" que ES una tarjeta de embarque
   │
   └─ ImportEngine.matchAgainstExisting(reserva, itemsDelViaje)
        │
        ├─ "mismo"  ─────────────────────────────► V1 · NO PREGUNTA NADA
        │                                          (tarjeta de resumen en la revisión;
        │                                           la salida "No es este vuelo" es un
        │                                           enlace al pie, no un botón)
        │
        ├─ "ambiguo" (coincide con 2 o más) ─────► V5 · estado 07 de la iteración 2,
        │                                          tal cual, sin tocar nada
        │
        └─ "nuevo" (no coincide con ninguno)
             ├─ no hay ningún vuelo en el viaje ─► V2 · avisa y ofrece crearlo
             │     ├─ Crear el vuelo ───────────► V3 · precargado, con los dos grupos
             │     └─ Descartar la tarjeta ─────► V6 · confirma y no guarda nada
             │
             ├─ hay UN vuelo cargado ───────────► V4 · dos salidas, ninguna preferida
             │     ├─ "Es este vuelo"  ─────────► se comporta como "mismo"
             │     └─ "Es otro vuelo"  ─────────► V3
             │
             └─ hay VARIOS vuelos cargados ─────► V5 · el mismo componente del 07
                   ├─ un candidato ─────────────► se comporta como "mismo"
                   └─ "Ninguno de estos" ──────► V3
```

En cualquiera de las ramas, la tarjeta termina **adjunta al vuelo con el que quedó asociada** (VAL-58), nunca
suelta. Y ninguna rama crea una reserva de vuelo sin que la persona lo haya pedido con un toque.

---

## 2 · VAL-58 · Los estados del documento

### D1 · La reserva con el documento adjunto
**Cuándo aparece:** en la pantalla del viaje, siempre que la reserva tenga al menos un documento.
**Qué muestra:** una tira `.pass-doc` de una línea y 36 px de alto por documento, dentro de `.pass-docs`, pegada
**debajo** del troquelado (`.pass-stub`) y con su mismo fondo `surface-2`, así que no abre un bloque nuevo: se
lee como la continuación del talón. Cada tira lleva el glifo del clip, el **nombre corto** del documento
("Tarjeta de embarque", "Pasaje", "Comprobante") y, a la derecha, tipo y peso en `--f-mono` y `--ink-3`
("JPG · 178 KB"). Un toque abre el visor. No hay botón de descarga, ni estado de compresión, ni fecha: eso está
en el visor.
**Estado vacío:** si la reserva no tiene documentos, `.pass-docs` **no se renderiza**. La tarjeta queda
exactamente igual que hoy. No hay un "Sin documentos" que ocupe una línea por cada reserva del viaje.
**Tope visual:** tres tiras como máximo (ver 5.2), así que la tarjeta crece 108 px en el peor caso, y sólo en
las reservas que de verdad tienen tres papeles.

### D2 · Visor · imagen
**Cuándo aparece:** al tocar una tira de un documento de imagen, con el archivo ya traído.
**Qué muestra:** una hoja `.sheet` cuyo título es el nombre corto del documento. El cuerpo es `.doc-view`: la
imagen lo más grande que entra (`max-height:52vh`), centrada, con su sombra. Debajo, una sola línea `.doc-meta`
en mono con todo lo que es dato: nombre de archivo, tipo, peso, fecha y de dónde vino. Después, separadas por un
`.hr`, las dos acciones de edición como botones chicos: **Reemplazar** y **Quitar**. El pie: **Cerrar** (ghost) y
**Descargar** (primaria).
**Por qué Descargar es la primaria:** es la única acción que deja el archivo en el teléfono, y el momento en que
se necesita el documento es justo el momento en que puede no haber señal.

### D3 · Visor · PDF
**Cuándo aparece:** al abrir un documento PDF.
**Qué muestra:** lo mismo que D2, con la **primera página dibujada** — pdf.js ya está cargado en la app para la
importación, así que se reusa `ImportEngine.renderPdfPagesToImages(blob, {paginas:1})`. La línea de datos suma la
cantidad de páginas.
**Variante sin previsualización** (segunda hoja del estado en el muestrario): cuando pdf.js no está disponible
—y pasa, se baja de un CDN—, el mismo marco `.doc-view` sostiene un `.ph` centrado que dice qué se puede hacer.
La descarga sigue funcionando: es lo único que hace falta para tener el papel. Nunca un rectángulo gris sin
explicación.

### D4 · Visor · trayendo el documento / no se pudo traer
**Cuándo aparece:** siempre, un instante: el cuerpo del archivo no vive en el teléfono, hay que pedirlo (ver
7.2). Con señal el estado pasa de largo; sin señal se queda.
**Qué muestra, cargando:** `.doc-view` con el `.spin` que ya existe y "Trayendo el documento…". La descarga queda
deshabilitada mientras no haya nada que descargar — un botón habilitado que no puede cumplir es peor que uno
apagado que va a encenderse en medio segundo.
**Qué muestra, si no llegó:** un `.ph` que dice las dos cosas que importan —**el archivo no se perdió** y **hace
falta conexión**— y un `.notice.warn` con el reintento y el consejo que de verdad resuelve el problema:
descargarlo antes de salir si va a estar sin señal. No dice "error de red" ni pide disculpas.
**Es interactivo en el muestrario:** el botón "Probar de nuevo" vuelve al estado de carga.

### D5 · Visor · se guardó en menor calidad
**Cuándo aparece:** cada vez que se abre un documento con `estado:"recomprimido"`. **No es un aviso de una sola
vez.**
**Qué muestra:** un `.notice.warn` **debajo** de la imagen —donde se nota el problema, no tapándola— con los dos
números: cuánto pesaba y cuánto pesa. Y qué hacer si el código de barras no pasa el lector. La línea de datos
también lo lleva ("reducida de 3,1 MB").
**Por qué vive acá y para siempre:** el brief lo pide explícito, y la razón es de uso: si alguien abre la foto en
el aeropuerto para leer un código y está borroso, tiene que entender por qué **en ese momento**, no acordarse de
un mensaje de hace dos semanas.

### D6 · Visor · sólo lectura, y visor sin capacidad de descarga
**Cuándo aparece (sólo lectura):** `!Store.canWrite`. Quien entró por un link compartido.
**Qué muestra:** el chip "sólo lectura" arriba, el documento, la línea de datos aclarando quién lo adjuntó, y
**Descargar** habilitado: mirar y llevarse el papel es el sentido de compartir un viaje. Reemplazar y Quitar no
están deshabilitados: **no están en el HTML**, mismo criterio que el estado 12 del importador.
**Cuándo aparece (sin descarga):** `claude.use("downloads")` devolvió `null`.
**Qué muestra:** el botón Descargar no está, y en su lugar hay un `.notice` que dice qué hacer en vez de eso. Un
botón que no puede cumplir no se muestra apagado: se reemplaza por la explicación.

### D7 · Quitar el documento
**Cuándo aparece:** al tocar "Quitar" en el visor.
**Qué muestra:** la confirmación en la **misma hoja**, sin un modal encima de otro. El texto dice lo que se
pierde (el archivo, que capaz no está en ningún otro lado) y lo que **no** se pierde (la reserva y sus datos).
Las dos salidas tienen el mismo peso y la destructiva está nombrada: "Quitar la tarjeta", no "OK".

### D8 · Adjuntar a una reserva cargada a mano · vacío
**Cuándo aparece:** en la hoja de la reserva (`sheetItem`), al final del formulario, cuando la reserva no tiene
documentos y hay permiso de edición.
**Qué muestra:** el bloque "Documento" con un `.empty.sm` punteado y **dos** orígenes, con el mismo patrón de
`<button>` + `<input type="file">` hermano que ya usa el importador: **Archivo** (PDF o imagen) y **Sacar foto**
(cámara). Debajo, el `hint` con los dos topes: 190 KB por documento y tres por reserva, más el aviso de que una
foto grande se reduce sola.
**Por qué dos y no los tres del importador:** "Galería" existe ahí porque se eligen varios archivos de golpe;
acá se adjunta uno a una reserva puntual, y una captura de pantalla se elige igual desde "Archivo". Tres botones
para un solo adjunto es ruido.
**Por qué el tope se dice antes:** un tope que aparece después de elegir el archivo es un rechazo; antes, es una
instrucción.

### D9 · Preparando el archivo
**Cuándo aparece:** entre elegir el archivo y tenerlo listo para guardar. Codificar y, si hace falta, reducir una
foto de tres megas lleva un momento visible en un teléfono.
**Qué muestra:** la fila `.imp-file` de la cola del importador, reusada tal cual, con el `.spin` y la frase que
dice qué está pasando: "Preparando el archivo…" o "Reduciendo la foto para que entre…". El botón **Guardar del
pie queda deshabilitado**: guardar a mitad de camino dejaría la reserva sin el documento sin que nadie lo pida.

### D10 · Entró tal cual
**Cuándo aparece:** el archivo, codificado, cabe en el tope. Es la mayoría: los dos documentos reales del PM
entran (20 KB y 123 KB).
**Qué muestra:** la fila con el nombre, el tipo, las páginas y el peso. Y nada más. El `hint` recuerda las dos
cosas que todavía no son obvias: que queda adjunto **cuando se toque Guardar**, y cuántos más se pueden sumar.
**Por qué no hay un aviso verde:** un cartel de "¡guardado!" en el camino feliz es exactamente lo que empieza a
convertir la reserva en un tablero de avisos. La fila con el peso es toda la confirmación que hace falta.

### D11 · Entró recomprimido
**Cuándo aparece:** una imagen que no cabe tal cual y sí cabe reducida.
**Qué muestra:** la fila, con "menor calidad" pegado al peso —así el dato viaja con el archivo y vuelve a
aparecer en el visor (D5)—, y un `.notice.warn` con los dos números y qué hacer si se necesita la original.
**Por qué ámbar y no rojo:** nada se rompió y el documento quedó guardado. Rojo diría "esto falló".

### D12 · No entró
**Cuándo aparece:** un PDF que, codificado, pasa el tope. No se puede reducir un PDF sin romperlo.
**Qué muestra:** la fila en rojo (`.imp-file.err` + `.meta.err`) con el motivo y los dos números, y la acción que
sigue ahí mismo: **"Elegir otro"**. El `hint` dice lo único que puede dar tranquilidad —la reserva no cambia— y
una pista concreta: en el mail suele venir también la página sola del pasaje, y esa entra.
**Por qué acá sí es rojo:** es la misma cosa que la cola del importador ya pinta en rojo, un archivo que pesa más
de lo que se puede procesar. Coherencia con lo que ya existe, y es un rechazo real: ese archivo no va a entrar
nunca.

### D13 · Tope de documentos por reserva
**Cuándo aparece:** la reserva ya tiene tres documentos.
**Qué muestra:** la etiqueta pasa a "Documentos · 3 de 3", las tres filas con su cruz para quitar, y los botones
de origen **desaparecen** — no quedan grises. En su lugar, la frase que dice qué hacer: quitá uno. Ofrecer un
selector que no va a poder guardar nada es la misma trampa que el importador ya evita en su estado 11.

### D14 · El cierre del importador nombra qué quedó adjunto y qué no
**Cuándo aparece:** al terminar de guardar un lote importado. Es el estado 09 de la iteración 2, ampliado.
**Qué muestra:** el `.notice.ok` de siempre, que ahora también nombra el documento que quedó adjunto; un
`.notice.warn` **separado** por cada documento que no entró, con el motivo; y la lista `.imp-files` diciendo a
qué reserva quedó adjunto cada uno. El toast resume las tres cosas.
**Por qué dos avisos y no un párrafo:** lo que salió bien y lo que no son dos hechos distintos. Mezclarlos hace
que el segundo se lea como una aclaración del primero, y este es el único momento en que alguien se puede
enterar de que su PDF no quedó guardado.

---

## 3 · VAL-59 · Los estados de la tarjeta de embarque

### V1 · Coincide: no pregunta nada
**Cuándo aparece:** `matchAgainstExisting` devolvió `"mismo"`. Es el caso frecuente.

**Respuesta directa a lo que pidió el PO ("verificá que el flujo actual ya lo hace así"): NO, hoy no lo hace.**
`renderMatchMismo` (`app/valija.html`, ~línea 6772) abre un **paso propio y bloqueante** con dos botones
—"Completar vuelo" (primario) y "Cargar como nuevo" (ghost)— por cada tarjeta que coincidió. Pregunta lo que ya
sabe. Y encima lo hace antes de la revisión, así que hay que contestar dos veces para guardar una vez.

**Cómo queda.** La coincidencia deja de ser un paso y pasa a ser **una tarjeta más de la pantalla de revisión**
(estado 04), arriba de las reservas nuevas:

- Se **muestra** lo que va a completar —`.imp-existing` con el vuelo que ya estaba y `.imp-diff` con los campos
  del `patch` en acento—, que es lo que pide VAL-42 ("mostrarlo antes de guardar").
- **No se pregunta nada.** No hay botones propios. Se resuelve con el mismo "Guardar" del lote.
- El **motivo del match queda escrito** abajo de la tarjeta, en `.tiny.muted`: "Coincide por número de vuelo
  (G3 1234) y fecha (20 de septiembre) con el vuelo que ya tenías cargado. No se toca ningún dato que ya
  tuvieras." Es el criterio "deja registro de por qué coincidió", visible y sin abrir nada.
- La salida para el caso raro —la persona sabe que en realidad es otro vuelo— es **un enlace al pie de la
  tarjeta**, "No es este vuelo", con la clase `.act` (nueva, N4). Existe, se ve, y no tiene el tamaño de un
  botón primario: la app no está pidiendo una decisión, está ofreciendo una corrección.
- La tira del documento dentro de la tarjeta dice "Queda adjunta a este vuelo".

**Si el lote sólo tiene coincidencias** (nada nuevo que revisar), la revisión se muestra igual, con las tarjetas
de completado y su único botón de guardar. Eso ya lo hace el código de hoy y está bien: el guardado es el único
punto donde cancelar todavía sirve.

**El texto del botón cuando el lote es mixto:** "Guardar 2 cambios". La regla de la iteración 2 —el botón cuenta
sólo lo que va a guardar— se mantiene; lo que cambia es el sustantivo, porque "reservas" no describe a un vuelo
que se completa. Con un lote de puras reservas nuevas sigue diciendo "Guardar N reservas".

### V2 · Sin ningún vuelo cargado
**Cuándo aparece:** la reserva es una tarjeta de embarque, el resultado es `"nuevo"` y el viaje **no tiene ningún
vuelo**.
**Qué muestra:** un `.notice.warn` que dice el hecho y el concepto en dos frases —"Esta tarjeta de embarque no
tiene vuelo al que engancharse… una tarjeta sola no es una reserva: se desprende de un vuelo"— y termina en la
pregunta. Debajo, una tarjeta estática con **"Lo que leí de la tarjeta"** en `.imp-diff`, para que la decisión no
sea a ciegas, y una nota que anticipa qué va a quedar vacío. El pie: **"Descartar la tarjeta"** (ghost) y
**"Crear el vuelo"** (primaria). Encima del pie, centrado y en chico: "Si la descartás no queda nada: ni el vuelo
ni el archivo."
**Por qué acá sí hay una acción primaria** (y en V4 no): las dos opciones no son equivalentes. La app **propone**
crear el vuelo —es lo que pide el brief— y la otra opción es no hacer nada. Jerarquizar una propuesta no es
sesgar una elección entre dos datos posibles.
**La tarjeta no se guarda como reserva suelta en ninguna de las dos ramas.** Es el punto de VAL-59.

### V3 · El vuelo precargado: qué vino de la tarjeta y qué falta
**Cuándo aparece:** después de aceptar en V2, o de elegir "Es otro vuelo" en V4, o "Ninguno de estos" en V5.
**Qué muestra:** la tarjeta de revisión editable de siempre, con los campos partidos en **dos grupos**, cada uno
encabezado por un chip con su cuenta:

- `chip accent src` — **"8 campos · de la tarjeta"**: origen, destino, aerolínea, número de vuelo, salida,
  asiento, puerta, embarque. Valores precargados, en inputs de verdad.
- `chip src` — **"3 campos · vacíos, no están en la tarjeta"**: llegada, terminal, código de reserva. Vacíos, con
  el placeholder "No lo encontré" que ya usa el importador.

Arriba, el `.notice` con la cuenta exacta ("8 de 11 campos"). Abajo, la tira del documento: "Tarjeta de embarque ·
Queda adjunta a este vuelo". El pie: "Descartar" / "Guardar el vuelo".
**Por qué dos grupos y no una marca por campo.** La primera versión ponía una chapita "de la tarjeta" en cada
etiqueta. Con ocho marcas la pantalla se llenaba de repeticiones, y en 390 px las chapitas partían las etiquetas
en dos líneas (está en las capturas de trabajo). Dos grupos con su cuenta se leen de un vistazo, no repiten nada
y dejan la pregunta del brief contestada sin ambigüedad: **esto vino de la tarjeta, esto está vacío**.
**Por qué los valores siguen siendo inputs.** Decisión 3.3 de `importar.md`, que no cambia: corregir una letra
mal leída tiene que ser escribir encima.
**Qué no se rellena.** Nada. Un campo que la tarjeta no trae queda vacío y visible. La hora de llegada no se
calcula, el código de reserva no se inventa con el del ticket, la terminal no se deduce del aeropuerto.

### V4 · Un vuelo cargado que no coincide
**Cuándo aparece:** resultado `"nuevo"` sobre una tarjeta de embarque, con **exactamente un** vuelo en el viaje.
**Qué muestra:** un `.notice.warn` que **enfrenta los dos números** ("La tarjeta dice G3 1234 y el único vuelo
que tenés cargado dice G3 1243"), nombra las dos causas posibles —número mal leído o vuelo distinto— y dice quién
decide. Debajo, "Lo que leí de la tarjeta" en `.imp-diff`. Después, la lista `.imp-choice` con **dos opciones del
mismo alto, el mismo color y el mismo radio**:

1. **"Es este vuelo"** — ruta, fecha, hora y número del vuelo cargado + qué va a pasar ("Le sumo asiento, puerta
   y embarque, y le adjunto la tarjeta").
2. **"Es otro vuelo"** — los datos de la tarjeta + qué va a pasar ("Creo un vuelo nuevo con lo que dice la
   tarjeta y le adjunto la tarjeta").

Nada preseleccionado. El botón arranca deshabilitado con "Elegí una opción" y después se nombra por lo que va a
hacer: "Completar ese vuelo" / "Crear el vuelo nuevo".
**El sesgo que se cuidó.** Que un número no coincida puede ser un número mal leído en una foto con reflejo, no
otro vuelo. Tres cosas evitan que una opción parezca la correcta: ninguna está preseleccionada, las dos tienen
el mismo tratamiento visual, y **no hay separador "o" entre ellas** — el `.sep` que usa el estado 07 agrupa "los
vuelos que ya tenés" y deja aparte "uno nuevo"; con una sola opción de cada lado, ese separador convertiría a la
segunda en el plan B. La única asimetría que queda es el orden, y es inevitable: algo tiene que ir primero. Va
primero el vuelo cargado porque es el que la persona ya conoce, no porque sea más probable.
**Interactivo en el muestrario.**

### V5 · Varios vuelos: elegir contra cuál
**Cuándo aparece:** dos disparadores distintos, un solo componente.
- `"ambiguo"`: coincide con dos o más. Es el estado **07 / 07B** de la iteración 2, **sin un solo cambio**.
- `"nuevo"` con **más de un** vuelo cargado: no coincide con ninguno, y hay que preguntar igual.

**Qué muestra:** el `.imp-choice` que ya existe: una opción por vuelo con **ruta, fecha y hora** —lo que los
distingue, como pide el brief—, el separador "o", y la salida explícita "Ninguno de estos · Creá el vuelo con lo
que dice la tarjeta". Lo único que cambia entre los dos disparadores es el aviso de arriba, porque cambia el
motivo. Abajo, la línea que cierra el círculo con VAL-58: "La tarjeta queda adjunta al vuelo que elijas, sea uno
de estos o el nuevo."
**Por qué se reusa y no se inventa una segunda pantalla:** es literalmente la misma pregunta —¿a cuál de estos
vuelos corresponde esta tarjeta?— con otro motivo. La sección 3.1 de `importar.md` ya argumentó por qué es una
lista de opciones y no un desplegable, por qué "ninguno" es una opción y no un cancelar, y por qué nada viene
preseleccionado. Todo eso vale igual acá.
**Qué vuelos se ofrecen:** **todos los del viaje**, ordenados por fecha de salida, no sólo los del día de la
tarjeta. Si una tarjeta perdió la fecha en el reflejo, filtrar por fecha esconde justamente el candidato
correcto.
**Interactivo en el muestrario.**

### V6 · Descartar la tarjeta se dice
**Cuándo aparece:** al tocar "Descartar la tarjeta" en V2 (o el equivalente en las otras ramas).
**Qué muestra:** la confirmación en la misma hoja: "No se crea el vuelo y el archivo tampoco queda: se va todo.
Siempre podés volver a importarla." Pie: "Volver" / "Sí, descartala" (danger).
**Y si era lo único del lote:** el cierre no es una pantalla en blanco. Un `.empty` que dice que no quedó nada
guardado y por qué, con "Cargar a mano" a mano — el escape que nunca falla, igual que en el estado 10.
**Criterio del brief que esto cumple:** "ninguna rama descarta la tarjeta sin decirlo".

### El caso sin permiso de edición
**No hay ningún estado de VAL-59 alcanzable sin permiso de edición:** el botón "Importar" ya sale deshabilitado
en la pantalla del viaje y el estado 12 del importador es la red. Por eso acá no se diseña una variante de sólo
lectura del flujo de la tarjeta: sería una pantalla imposible. Lo que **sí** es alcanzable sin permiso es el
visor del documento, y está diseñado en **D6**.

---

## 4 · Qué se descartó, y por qué

**Un cajón "Documentos" en la pantalla del viaje.** Descartado: convierte el documento en una cosa que hay que
ir a buscar a otro lado, cuando su valor entero está en su relación con la reserva ("la tarjeta del vuelo de
ida"). Y en el aeropuerto agrega un toque justo donde no sobra ninguno.

**Un botón "Descargar" en la tarjeta de la reserva.** Descartado: es la acción menos frecuente (bajarlo al
teléfono) compitiendo por el lugar más caro de la pantalla. Vive en el visor, donde ya se está mirando el
documento.

**Mostrar el estado de compresión en la tarjeta de la reserva.** Descartado: es un dato que sólo importa cuando
se está mirando el documento y algo no se lee. Ahí está (D5). En la tarjeta sería una advertencia permanente
sobre algo que no hay que hacer.

**Contar los documentos en un chip ("2 documentos") en vez de una tira por documento.** Descartado: ahorra 36 px
y cuesta un toque siempre, porque obliga a una pantalla intermedia de lista. Con el tope de tres, las tiras
nunca son más que tres, y el caso real —una— queda a un toque.

**Mostrar el nombre del archivo en la tarjeta de la reserva.** Descartado: `AR1234_BP_20250920_ORIG.pdf` no
significa nada a las cinco de la mañana. La tarjeta dice **qué es** ("Tarjeta de embarque"); el nombre del
archivo está en el visor, para quien lo necesite.

**Partir un archivo grande en varios documentos para que entre.** Descartado por el brief, y con razón: gasta el
cupo de documentos de la base y deja a la persona con "parte 1 de 3" de un PDF que no puede volver a armar.

**Recomprimir un PDF grande.** No se puede sin romperlo. Se dice que no entró (D12).

**Preguntar antes de recomprimir una foto** ("esta foto pesa 3 MB, ¿la reduzco?"). Descartado: es una pregunta
sin alternativa —la otra opción es no guardar nada— hecha en el peor momento. Se reduce y se dice, con los dos
números, todas las veces que se abra.

**Dejar el estado 06 como un paso propio y sumarle el documento.** Descartado: ver V1. Preguntar en el caso
frecuente es el costo que el brief pide eliminar.

**Elegir automáticamente el vuelo más parecido cuando el número no coincide** (por ejemplo, por distancia de
edición entre "1234" y "1243"). Descartado de plano: es adivinar, con la agravante de que la heurística sería
convincente y casi nunca comprobable por la persona.

**Un modal encima del visor para confirmar el borrado.** Descartado: dos capas de hoja en un teléfono se
convierten en un laberinto para salir. La confirmación es en el lugar (D7).

**Atenuar el documento en tema oscuro.** Descartado, y vale escribirlo: una tarjeta de embarque es blanca en los
dos temas y hay que poder mostrarla a un lector de códigos. El visor adapta su **marco**, nunca el documento.

---

## 5 · Decisiones que no son obvias

### 5.1 Cómo se evita que la reserva se vuelva un depósito
La regla operativa: **en la tarjeta sólo va lo que se necesita para decidir tocarla.** Eso es qué es el documento
y cuánto pesa. Todo lo demás —nombre de archivo, páginas, fecha, compresión, descarga, reemplazo, borrado— vive
en el visor, a un toque.

Y tres decisiones de forma que la sostienen:
1. La tira **comparte el fondo del talón** (`surface-2`), así que no abre un bloque nuevo: se lee como una línea
   más del troquelado, no como una sección.
2. Su texto va en `--ink-2` y el peso en `--ink-3`, los dos grises secundarios que ya usa la app. **El título y
   la hora siguen siendo lo único en `--ink`.** La jerarquía no se toca.
3. El peso va en `--f-mono`, como todos los datos de la app. Un documento adjunto es un dato de la reserva, no
   una función nueva.

### 5.2 Tres documentos por reserva
El caso real del PM necesita más de uno: el pasaje que mandó la aerolínea **y** la tarjeta de embarque del día
del vuelo. Si el segundo reemplazara al primero en silencio, la app perdería un papel sin decirlo.

Tres es el número porque cubre el caso real con margen (pasaje, tarjeta, comprobante de pago), es lo que la
tarjeta puede sostener sin dejar de leerse de un vistazo, y acota el consumo del cupo de documentos de la base.
Al llegar al tope se dice y se ofrece la salida (D13).

**Lo que hace falta para poder decir "cuántos documentos caben" del todo** (criterio de VAL-58): el tope por
reserva es una decisión nuestra y está escrita en la interfaz. El tope **de la base** —cuántos documentos admite
en total— no lo sé, y no lo invento. Está anotado como pregunta en la sección 8.

### 5.3 El nombre corto, y de dónde sale
La tira y el título del visor dicen **qué es** el documento, no cómo se llama el archivo:

| Cuándo | Nombre corto |
|---|---|
| Salió de una tarjeta de embarque interpretada | "Tarjeta de embarque" |
| Salió de un documento que creó una reserva de vuelo | "Pasaje" |
| Salió de cualquier otro documento interpretado | "Comprobante" |
| Lo adjuntó la persona a mano | el nombre del archivo, sin la extensión |

El importador ya sabe cuál corresponde, porque ya pone ese mismo chip en la tarjeta de revisión. Para el adjunto
manual no se pregunta nada: preguntar "¿qué tipo de documento es?" a alguien que acaba de elegir un archivo es
pedirle que clasifique para nosotros.

### 5.4 El peso se muestra en KB, y el tope también
"190 KB" y "1,2 MB", no "196.608 bytes" ni "256 KiB". El tope real es el de la base (256 KiB por documento) menos
lo que agrega codificar el archivo como texto, que es un tercio: **190 KB de archivo crudo**. Ese es el número

**Corregido el 13/09.** El PO había dado 192 KB, que sale de dividir el tope por cuatro tercios. Está mal por
poco y en el sentido peligroso: 196.608 bytes codificados son 262.144 caracteres, o sea **el tope entero**, sin
un byte libre para los nombres de campo del propio documento. Lo encontró el motor midiendo en lugar de confiar.
190 KB deja 2,7 KB de margen y es un número redondo que la persona puede comparar con lo que ve en su teléfono.
que la interfaz dice, porque es el único que la persona puede comparar con lo que ve en su teléfono.

### 5.5 El documento se guarda cuando se toca Guardar
En la hoja de la reserva, elegir el archivo lo **prepara** (lo codifica, lo reduce si hace falta, muestra el
resultado) pero no lo escribe. Escribe el mismo "Guardar" que el resto del formulario. Es la misma regla que el
importador ya cumple —"el motor nunca escribe hasta que se toca Guardar"— y tiene una consecuencia buena: el
estado "no entró" (D12) aparece **antes** de guardar, así que se puede elegir otro archivo sin haber dejado nada
a medias.

### 5.6 Sólo lectura: si no hay nada que mostrar, no hay bloque
Sin permiso de edición y sin documentos, el bloque "Documento" **no existe** en la hoja de la reserva. Un bloque
vacío que no ofrece ninguna acción es ruido en todas las reservas de un viaje compartido. Con documentos, el
bloque existe y es de sólo lectura: las filas abren el visor, sin cruz para quitar y sin botones de origen.

### 5.7 El único ícono nuevo es un clip, y significa algo
`clip` es el único glifo que se agrega. Un clip quiere decir "esto viene enganchado a otra cosa", que es
exactamente la relación entre el documento y la reserva, y es lo que distingue la tira de una fila más de datos
del talón. Para "Descargar" **no se agrega nada**: `I.pdf`, que ya existe en `valija.html`, ya es una flecha
hacia una línea, o sea una descarga. Dos glifos para el mismo significado es peor que ninguno.

### 5.8 Cero tokens nuevos
Se revisó archivo por archivo: `adjuntar-ui.html` no tiene un solo color literal fuera del bloque de tokens
copiado de `valija.html`. Los cuatro grupos de CSS nuevo (N1 a N4) usan `--surface`, `--surface-2`, `--line`,
`--line-2`, `--ink`, `--ink-2`, `--ink-3`, `--accent`, `--accent-soft`, `--warn`, `--crit-soft`, `--shadow`,
`--f-mono`, `--f-display`, `--r-s`, `--r-m` — todos existentes, todos ya redefinidos en los tres bloques de tema.

**No falta ningún token.** El único que estuve por pedir fue un `.notice` en rojo para "no entró", y resultó que
no hacía falta: ese estado va en ámbar por decisión de diseño (nada se rompió, la reserva se guardó) y el rojo
que sí corresponde —la fila del archivo rechazado— ya lo resuelve `.imp-file.err`, que existe.

---

## 6 · Texto exacto de la interfaz

Todo en español rioplatense, voseo. Reproducido tal como está en `adjuntar-ui.html`.

**La tira del documento (D1)**
- "Tarjeta de embarque" · "JPG · 178 KB"
- "Pasaje" · "PDF · 164 KB"
- "Comprobante" · "PDF · 28 KB"

**Visor (D2, D3)**
- Línea de datos: "tarjeta-g3-1234.jpg · JPG · 178 KB · adjuntada el 20 sep desde Importar"
- Línea de datos de un PDF: "pasaje-aerolineas.pdf · PDF · 2 páginas · 164 KB · adjuntado el 12 sep"
- Botones: "Reemplazar" / "Quitar" / "Cerrar" / "Descargar"
- Sin previsualización: "No puedo mostrarte el PDF acá" · "Está guardado y lo podés descargar. Para verlo en
  pantalla, abrilo después de bajarlo."

**Trayendo el documento (D4)**
- "Trayendo el documento…"
- "No pude traer el documento" · "Está guardado en la valija y no se perdió: para abrirlo hace falta conexión."
- "Probá de nuevo cuando tengas señal. Y si vas a estar sin señal justo cuando lo necesitás, descargalo antes de
  salir: así queda en el teléfono." + "Probar de nuevo"

**Menor calidad (D5, D11)**
- "**Guardada en menor calidad.** La foto pesaba **3,1 MB** y el tope por documento es **190 KB**, así que la
  reduje a **178 KB**. Se lee bien en pantalla; si un código de barras no te pasa el lector, usá el original del
  mail."
- Al adjuntar: "**La guardé más chica.** La foto pesaba **3,1 MB** y el tope por documento es **190 KB**: la
  reduje a **178 KB**. Se lee bien en pantalla. Si necesitás la original tal cual, guardala también en las fotos
  del teléfono."
- En la fila y en la línea de datos: "menor calidad" · "reducida de 3,1 MB"

**Sólo lectura y sin descarga (D6)**
- Chip: "sólo lectura"
- "tarjeta-g3-1234.jpg · JPG · 178 KB · lo adjuntó quien te compartió el viaje"
- "Desde esta vista no puedo guardar archivos en el teléfono. Abrí la valija en el navegador y probá de nuevo, o
  pedile el archivo a quien te lo mandó."

**Quitar (D7)**
- "**¿Quito la tarjeta de embarque?** Se borra el archivo de la valija y, si no lo tenés en el mail, no hay de
  dónde volver a sacarlo. El vuelo y todos sus datos quedan como están."
- Botones: "No, dejala" / "Quitar la tarjeta"

**Adjuntar (D8)**
- Etiqueta: "Documento"
- "Adjuntá el PDF que te mandaron o sacale una foto al papel. Queda guardado con la reserva, para tenerlo a mano
  sin ir a buscar el mail."
- Botones: "Archivo · PDF o imagen" / "Sacar foto · con la cámara"
- "Hasta 190 KB por documento, y hasta tres por reserva. Si la foto pesa más, la reduzco yo y te aviso."

**Preparando (D9)**
- "Preparando el archivo…" (PDF) · "Reduciendo la foto para que entre…" (imagen)

**Entró (D10)**
- Fila: "voucher-lobos-bus.pdf" · "PDF · 1 página · 20 KB"
- "Queda adjunto cuando toques Guardar. Podés sumar hasta dos documentos más."

**No entró (D12)**
- Fila: "Pesa 1,2 MB y el tope es 190 KB. Un PDF no lo puedo reducir sin romperlo, así que este no lo puedo
  guardar." + "Elegir otro"
- "La reserva no cambia: lo único que no entró es el archivo. Si en el mail viene también la página sola de tu
  pasaje, esa suele entrar."

**Tope (D13)**
- Etiqueta: "Documentos · 3 de 3"
- "Llegaste al tope de tres documentos en esta reserva. Para sumar otro, quitá uno de estos."

**Cierre del importador (D14)**
- "Guardado. Agregué **2** reservas, completé el vuelo de ida con los datos de la tarjeta de embarque y le dejé
  la tarjeta adjunta."
- "**Un documento quedó afuera:** **itinerario-completo.pdf** pesa **1,2 MB** y el tope por documento es
  **190 KB**. Sus reservas sí se guardaron; lo que no quedó es el archivo."
- Filas: "Adjunta al vuelo Buenos Aires → Río · JPG · 178 KB · menor calidad"
- Toast: "2 reservas agregadas · tarjeta adjunta al vuelo de ida · 1 documento no entró"

**Coincide (V1)**
- "Leí 2 archivos. La tarjeta de embarque completa el vuelo que ya tenías cargado y queda adjunta ahí. Revisá la
  reserva nueva y guardá."
- Título de la tarjeta: "Se completa tu vuelo de ida"
- Etiquetas: "Ya tenías cargado" / "Se completa con"
- Motivo: "Coincide por número de vuelo (G3 1234) y fecha (20 de septiembre) con el vuelo que ya tenías cargado.
  No se toca ningún dato que ya tuvieras."
- Fila del documento: "Tarjeta de embarque · Queda adjunta a este vuelo · JPG · 178 KB"
- Enlace: "No es este vuelo"
- Botón: "Guardar 2 cambios"

**Sin ningún vuelo cargado (V2)**
- "**Esta tarjeta de embarque no tiene vuelo al que engancharse.** En este viaje no tenés ningún vuelo cargado, y
  una tarjeta sola no es una reserva: se desprende de un vuelo. ¿Creo el vuelo con lo que dice la tarjeta?"
- Etiqueta: "Lo que leí de la tarjeta"
- "El código de reserva, la hora de llegada y el costo no están en la tarjeta. Si creás el vuelo, esos campos
  quedan vacíos y los completás cuando quieras."
- "Si la descartás no queda nada: ni el vuelo ni el archivo."
- Botones: "Descartar la tarjeta" / "Crear el vuelo"

**El vuelo precargado (V3)**
- "Armé el vuelo con lo que trae la tarjeta: **8** de **11** campos. Los otros tres no están impresos en la
  tarjeta, así que quedan vacíos — completalos ahora o cuando los tengas."
- Chips de grupo: "8 campos · de la tarjeta" / "3 campos · vacíos, no están en la tarjeta"
- Placeholder de un campo vacío: "No lo encontré"
- Botones: "Descartar" / "Guardar el vuelo"

**Un vuelo que no coincide (V4)**
- "La tarjeta dice **G3 1234** y el único vuelo que tenés cargado dice **G3 1243**. Puede ser que haya leído mal
  un número, o que sea otro vuelo. No lo decido yo: si tenés dudas, mirá el número impreso en la tarjeta."
- Etiquetas: "Lo que leí de la tarjeta" / "¿Qué hago con ella?"
- Opción 1: "Es este vuelo" · "EZE → GIG · 20 sep 06:40 · GOL G3 1243" · "Le sumo asiento, puerta y embarque, y
  le adjunto la tarjeta"
- Opción 2: "Es otro vuelo" · "EZE → GIG · 20 sep 06:40 · GOL G3 1234" · "Creo un vuelo nuevo con lo que dice la
  tarjeta y le adjunto la tarjeta"
- Botón antes de elegir: "Elegí una opción" (deshabilitado) · después: "Completar ese vuelo" / "Crear el vuelo
  nuevo"

**Varios vuelos (V5)**
- "La tarjeta dice **G3 1234** y ninguno de los tres vuelos que tenés cargados tiene ese número. Puede ser un
  número mal leído, o un vuelo que todavía no cargaste. ¿A cuál la asocio?"
- Opción final: "Ninguno de estos · Creá el vuelo con lo que dice la tarjeta"
- "La tarjeta queda adjunta al vuelo que elijas, sea uno de estos o el nuevo."
- (Para el caso `"ambiguo"` se conservan los textos de los estados 07 y 07B de `importar.md`, sin cambios.)

**Descartar la tarjeta (V6)**
- "**¿Descarto la tarjeta de embarque?** No se crea el vuelo y el archivo tampoco queda: se va todo. Siempre
  podés volver a importarla."
- Botones: "Volver" / "Sí, descartala"
- Si era lo único: "No quedó nada guardado" · "Descartaste la tarjeta de embarque y era lo único que había en
  esta carga. Ni el vuelo ni el archivo quedaron en la valija." · "Cerrar" / "Cargar a mano"

---

## 7 · Qué necesita `app/valija.html` para integrar esto

No se edita `valija.html` desde acá. Esta sección es el pedido, ordenado por riesgo.

### 7.1 CSS e ícono
- Copiar el **Bloque C** completo de `adjuntar-ui.html` (cuatro grupos, `N1` a `N4`) al `<style>`. Sin tokens
  nuevos.
- Sumar **un** ícono a `I`: `clip`. Nada más. "Descargar" reusa `I.pdf`.

### 7.2 Dónde vive el documento — el punto de diseño con más consecuencias
El brief lo deja claro: no hay capacidad de guardar archivos, el documento va como texto en la misma base, y un
documento de más de 256 KiB se rechaza. Lo que el diseño **necesita** de ese modelo:

1. **Los metadatos van en el ítem** (`trips/{tripId}/items/{itemId}`), en un array `docs`, con lo que la tira y
   el visor tienen que poder mostrar sin traer el archivo: `{ id, nombre, mime, bytes, paginas, estado, at }`,
   donde `estado` es `"ok"` o `"recomprimido"`. Son unas decenas de bytes: viajan en el snapshot que ya existe y
   se pueden espejar en `localStorage` sin problema.
2. **El cuerpo va aparte**, en su propio documento de la base (por ejemplo `trips/{tripId}/docs/{docId}`), con el
   archivo codificado como texto. **No se espeja en `localStorage`**: 190 KB por documento reventarían la cuota
   del navegador y, peor, harían lento el arranque de la app para todos.
3. Consecuencia directa, y es la que se diseñó en **D4**: la tira del documento se puede pintar sin conexión
   (los metadatos están), pero **abrirlo necesita traer el cuerpo**. De ahí el estado de carga y el de "no pude
   traerlo", y de ahí que la descarga sea la acción primaria del visor: es la única que deja el archivo en el
   teléfono.
4. **Borrar el ítem o el viaje tiene que borrar sus documentos.** Un cuerpo huérfano gasta cupo de la base para
   siempre y no hay pantalla desde la cual verlo. `delItem` y `delTrip` ya recorren subcolecciones; hay que
   sumar ésta.

**Si integración elige otro modelo** (por ejemplo, el cuerpo adentro del mismo ítem), el diseño no se rompe:
lo único que cambia es que D4 deja de aparecer. Pero entonces hay que medir qué le pasa al snapshot de ítems y a
`localStorage` con tres documentos de 190 KB en un viaje de diez reservas, **antes** de publicarlo.

### 7.3 Preparar el archivo: codificar y, si hace falta, reducir
Antes de guardar, en el navegador:
- **PDF:** no se toca. Si codificado pasa el tope, no entra (D12).
- **Imagen:** se reduce con `<canvas>` hasta que entre — bajando el lado mayor y la calidad de JPEG por pasos— y
  se marca `estado:"recomprimido"`. Si ni así entra, es D12.
- El tope a comparar es el del **texto codificado**, no el del archivo: 256 KiB menos el margen del propio
  documento de la base. Los 190 KB de la interfaz son ese número traducido a algo que la persona pueda comparar
  con lo que ve en su teléfono.
- `estado:"recomprimido"` es **persistente**: se guarda con el documento porque D5 lo muestra cada vez que se
  abre, no una sola vez.

### 7.4 Los botones de origen se conectan con `wireFileInput`, no de nuevo
Los dos botones de D8 usan **el mismo patrón que ya está funcionando** en el importador: `<button data-pick>` y
`<input type="file">` **hermanos** dentro de `.tp.imp-pick`, y el toque del botón llama `input.click()` en el
mismo gesto. `valija.html` ya tiene `wireFileInput(id)` (~línea 6462) con el aviso de "selector mudo" incluido:
**se reusa tal cual**. No envolver el campo adentro del botón, no esconderlo con `display:none`, no ponerlo
encima del botón. Así fue como los botones de importar quedaron muertos en el teléfono.

### 7.5 Descargar
Misma capacidad y mismo manejo de errores que el PDF del resumen (`claude.use("downloads")`, ~línea 7759):
`declined` no dice nada, `rate_limited` pide esperar, cualquier otro es un toast de error. Si la capacidad no
está (`null`), **no se muestra el botón**: se muestra el `.notice` de D6. Para el nombre del archivo se usa el
original; si no lo hay, `valija-<reserva>.<ext>`.

### 7.6 Los tres cambios que necesita el motor
Ninguno es de interfaz, y sin ellos V2, V4 y V5 no se pueden armar:

1. **Saber si una reserva interpretada es una tarjeta de embarque.** Hoy no hay forma: `valija.html` pone el chip
   "Tarjeta de embarque" sólo cuando el match dio `"mismo"` o `"ambiguo"`, así que el caso `"nuevo"` —que es
   justamente el de VAL-59— no lo distingue de un pasaje. Hace falta un dato explícito del motor (un
   `esTarjeta` en la reserva, o un `ImportEngine.esTarjetaDeEmbarque(reserva)`). **El diseño no propone
   inferirlo en la interfaz:** si la app adivina "es una tarjeta porque trae asiento", va a tratar como tarjeta a
   un pasaje con asiento asignado.
2. **Los vuelos candidatos cuando el resultado es `"nuevo"`.** Hoy `"nuevo"` viene sin candidatos, y V4 y V5
   necesitan la lista de vuelos del viaje —todos, ordenados por salida— con `{id, title, from, to, start,
   flightNumber, provider}`. La interfaz podría sacarla de `Store.itemsOf(trip.id)`, pero el orden y el criterio
   de qué es candidato son del motor, que ya los tiene.
3. **`boardingTime` en el esquema del ítem.** Ya estaba pedido en la sección 5.6 de `importar.md`, ya está en el
   formulario de la reserva y en el talón de la tarjeta. Se confirma.

### 7.7 El estado 06 deja de ser un paso
Es el único cambio sobre lo ya integrado. `renderMatchMismo` deja de abrir su propia hoja: la coincidencia se
empuja a la lista de revisión como una tarjeta de resumen (V1) y se aplica con el guardado del lote, igual que
hoy hace `st.pendingMatches` (que ya acumula sin escribir — eso no cambia). `renderMatchAmbiguo` **no se toca**:
V5 es ese mismo componente.

### 7.8 Dónde se enganchan las pantallas nuevas
- La tira del documento: en la función que arma la tarjeta de la reserva (~línea 4820), después de `stubHtml`.
- El visor: una hoja nueva, `sheetDoc(trip, item, docId)`, abierta desde la tira.
- El bloque de adjuntar: en `sheetItem` (~línea 5898), al final del formulario, antes del botón Eliminar.
- Los avisos de D14: en el cierre del guardado del importador.

---

## 8 · Criterios del brief, y dónde se verifican

| Criterio | Dónde se ve |
|---|---|
| VAL-58 · El archivo importado queda en la reserva que generó | D1, D14 |
| VAL-58 · Se puede abrir y descargar desde la reserva | D1 → D2 / D3, botón Descargar |
| VAL-58 · Una reserva cargada a mano acepta un documento después | D8, D9, D10 |
| VAL-58 · Se dice cuánto ocupa | D1 (tira), D2 (línea de datos), D10/D11 (filas) |
| VAL-58 · Se dice cuántos documentos caben | D8 (antes de elegir), D10 (cuántos quedan), D13 (tope) · **pero ver la pregunta abierta de abajo** |
| VAL-58 · Si el documento no se pudo guardar, la reserva se guarda igual | D12, D14 |
| VAL-58 · Entró tal cual | D10 |
| VAL-58 · Entró recomprimido, y se dice | D11 (al guardar) y D5 (siempre) |
| VAL-58 · No entró, y se explica por qué | D12, D14 |
| VAL-59 · Un match exitoso no pregunta nada | V1 — **hoy no se cumple; el cambio está en 7.7** |
| VAL-59 · Un match exitoso deja registro de por qué coincidió | V1, el motivo bajo la tarjeta |
| VAL-59 · Ninguna rama crea un vuelo sin que la persona lo pida | V2, V4, V5 · ninguna opción preseleccionada |
| VAL-59 · Ninguna rama descarta la tarjeta sin decirlo | V6, D14 |
| VAL-59 · La tarjeta termina adjunta al vuelo, nunca suelta | V1, V3, V4, V5 · la tira dice a qué vuelo |
| VAL-59 · Lo que la tarjeta no trae queda vacío y visible | V3, grupo "3 campos · vacíos" |
| VAL-59 · Con varios vuelos se muestra ruta, fecha y hora | V5 |
| Tema claro y oscuro | los veinte estados, con el selector del muestrario |
| Foco visible y `prefers-reduced-motion` | Bloque B del muestrario, copiado de la app |
| Cero tokens nuevos | sección 5.8 |

**Pregunta abierta para el PO / el motor, que no invento:** el criterio "se dice cuántos documentos caben" está
cubierto en lo que es nuestro (190 KB por documento, tres por reserva). Lo que **no** puedo decir es cuántos
documentos admite la base en total, porque no conozco ese número. Si existe y es bajo, hace falta una frase más
—probablemente en la pantalla del viaje, no en la reserva— y la escribo en cuanto tenga el dato.

---

## 9 · Qué no pude verificar

Donde se probó y qué **no** prueba. Nada de esto está verificado en el sentido del proyecto: **probado en la app
publicada, en el teléfono.**

**Lo que sí hice.** Abrí `app/parts/adjuntar-ui.html` en Chromium de escritorio con Playwright, en una ventana de
390 × 844 con toque, y corrí 22 comprobaciones **tocando los controles**, no disparando eventos: que las tres
tiras de documento pinten su glifo y midan 36 px de alto, que nada se desborde a lo ancho, que en V4 y V5 no haya
nada preseleccionado y que el botón se habilite y se renombre **al tocar** una opción, que el ciclo de D4 vuelva
a cargar al tocar "Probar de nuevo", que los tres temas cambien los tokens de verdad, que el campo de archivo sea
hermano del botón y esté renderizado con tamaño real, y que el primer tabulado muestre contorno de foco. Pasaron
las 22. Miré capturas de los estados D1, D2, D5, D8, D12, V1, V3 y V4 en claro y en oscuro. El guion está en el
directorio de trabajo de la sesión, no en el repositorio: no prueba la app, prueba el muestrario.

**Lo que eso no prueba, en orden de riesgo:**

1. **Que el tope de 256 KiB sea exactamente eso, y qué error tira la base al pasarlo.** Es el número del brief,
   no un número que yo haya medido. Si el rechazo llega como una excepción distinta de la que espera el manejo de
   errores, D12 no aparece y el guardado falla de otra forma. **Cómo comprobarlo:** en la app publicada, adjuntar
   un PDF de ~300 KB y confirmar que sale D12 y que la reserva igual se guarda.
2. **Que reducir una foto con `<canvas>` funcione en el teléfono del PM.** El muestrario no reduce nada: dibuja
   una foto de ejemplo con CSS. En iOS hay topes de tamaño de canvas que pueden devolver una imagen en blanco.
   **Cómo comprobarlo:** adjuntar una foto de cámara real y abrir el visor; si la imagen sale negra o vacía, es
   esto y no el tope.
3. **Que la primera página del PDF se pueda dibujar en el visor (D3).** Depende de pdf.js, que se baja de
   `cdnjs.cloudflare.com`, bloqueado en este entorno por política de egreso. Por eso D3 tiene su variante sin
   previsualización, que es el estado que hay que mirar primero en la app publicada.
4. **Que `downloads.save` devuelva un archivo usable con un blob de imagen y con uno de PDF.** La app hoy sólo lo
   usa con un PDF que genera jsPDF. **Cómo comprobarlo:** descargar una tarjeta de embarque JPG y abrirla desde
   la galería del teléfono.
5. **Que el documento se pueda abrir sin señal.** Es el caso que motiva todo (el aeropuerto) y **es el que más
   me preocupa**: con el modelo de 7.2, sin conexión se ve la tira pero no el archivo. D4 lo dice y ofrece la
   salida (descargarlo antes), pero si en la práctica resulta que en el aeropuerto nunca hay señal, la respuesta
   correcta pasa a ser guardar una copia local del documento más chico y hay que rediseñarlo. **Cómo
   comprobarlo:** modo avión, abrir la reserva, tocar la tira.
6. **Los alto de toque en un teléfono de verdad.** 36 px de alto en un CSS pixel de escritorio no es lo mismo que
   36 px en el pulgar de alguien apurado. La tira es angosta a propósito para no competir con el título; si en el
   teléfono resulta difícil de acertar, lo primero que hay que probar es subirla a 40 px, no agrandar el texto.
7. **Cómo se ve con las tipografías reales.** Este entorno no baja fuentes, así que todas las capturas están con
   la tipografía del sistema. Bricolage y DM Mono cambian el ancho de las líneas; la tira del documento y la
   línea de datos del visor son los dos lugares donde un ancho distinto se puede notar.
8. **El lector de pantalla.** Las tiras son `<button>` con texto, el visor es una hoja como las demás y las
   opciones de V4 y V5 usan `aria-pressed` igual que el estado 07 ya integrado. No lo probé con un lector real.
