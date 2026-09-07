# Motor de importación de documentos — cómo funciona, cómo se extiende, cómo se integra

**Épica:** VAL-40, VAL-41, VAL-42 (Bloque A de `docs/briefs/interpretar.md`) · **Escribe:** motor de
importación · **Estado:** listo para integrar

Este documento describe `app/parts/import-engine.js`, probado en `app/parts/import-engine.test.js` (38
casos, `node app/parts/import-engine.test.js`). El módulo es JavaScript puro: no toca el DOM, no pide red, no
depende de nada externo salvo pdf.js, que ni siquiera importa — lo recibe ya cargado. Recibe archivos y
devuelve datos, en el mismo espíritu que `packing-engine.js`: reglas declaradas como datos, no enterradas en
condicionales.

No repite lo que ya está documentado en el comentario de cabecera de `import-engine.js` (que es extenso y es
la fuente de verdad si algo acá queda desactualizado). Esto es la puerta de entrada.

---

## 1 · Qué problema resuelve

Hoy `sheetImport` en `app/valija.html` interpreta texto pegado y, si la vista soporta imágenes, fotos sueltas.
Lo que falta, y es la prioridad máxima de la iteración 2:

- **VAL-40.** Subir un PDF (voucher, pasaje) y que se interprete completo, tenga una página o veinte, tenga
  texto seleccionable o sea un escaneo. La capa inteligente sólo recibe imágenes, nunca PDFs: el PDF se
  renderiza a imagen dentro del navegador antes de mandarlo.
- **VAL-41.** Subir varios archivos a la vez, mezclando fotos y PDFs, y saber qué se reconoció de **cada
  uno**, no un resultado global. Un archivo roto se señala solo y no arrastra a los demás.
- **VAL-42.** Cuando llega tarde una tarjeta de embarque de un vuelo que ya estaba cargado, completarlo (puerta,
  terminal, asiento, hora de embarque) en lugar de duplicarlo. El criterio es número de vuelo y fecha. Ante la
  duda, el motor nunca decide solo: devuelve los candidatos para que la interfaz pregunte.

---

## 2 · Las dos piezas del módulo

### 2.1 · Interpretar archivos (VAL-40 / VAL-41)

`interpretFiles(files, opts)` es la entrada principal. Recibe un array de archivos —
`{ name, blob, mimeType }` — y un `opts.callModel` inyectado por la app (la firma es igual a `ask` en
`packing-engine.js`: `async (prompt, {images}) => objeto o string JSON`). Por cada archivo:

1. **`fileKind(file)`** decide si es `"pdf"`, `"imagen"` o `"desconocido"` por mimeType y, si falta, por
   extensión.
2. Si es PDF, se renderiza con **`opts.renderPdfToImages(blob)`**, una función que la app inyecta (ver
   sección 3). Sin esa función, o si se cae, el archivo degrada a un error claro — nunca tira abajo la carga
   completa.
3. Se arma el prompt con **`buildImportPrompt(ctx)`** y se llama a `opts.callModel(prompt, {images})`.
4. La respuesta pasa por **`parseImportResponse(raw)`**, que nunca confía: si no es JSON, si no tiene
   `items`, o si un ítem viene con basura adentro, ese ítem (o el archivo entero, si no queda nada) cae en
   silencio en vez de romper algo. Ver la prueba *"respuesta basura del modelo en un archivo no rompe la
   carga completa"*.

Cada archivo termina en uno de tres estados — **tres, no un booleano, mismo criterio que
`packing-engine.js` usa para los ítems**:

| Estado | Cuándo |
|---|---|
| `ok` | se reconoció al menos una reserva |
| `vacio` | se leyó bien pero no había ninguna reserva reconocible (foto borrosa, documento que no es una reserva, respuesta del modelo sin nada aprovechable) |
| `error` | no se pudo procesar: tipo no soportado, PDF que no se pudo renderizar, o el modelo falló |

`interpretFile` nunca rechaza su promesa. Por eso `interpretFiles` puede usar `Promise.all` sin que un
archivo roto tire abajo a los demás: cada uno resuelve siempre con su propio resultado.

```js
{
  archivos: [
    { archivo:"voucher.pdf", estado:"ok", reservas:[...], error:null, paginas:2 },
    { archivo:"foto.jpg",    estado:"error", reservas:[], error:{codigo:"image_rejected", mensaje:"..."}, paginas:null }
  ],
  reservas: [ /* todas las reservas de todos los archivos, con su campo `archivo` */ ],
  resumen: { total:2, ok:1, vacios:0, errores:1, reservas:1 }
}
```

Cada reserva interpretada tiene los mismos nombres de campo que ya guarda `Store.saveItem` (ver
`sheetImport` en `valija.html`), más `boardingTime`, que hoy no existe en el modelo de la app:

```js
{
  type: "flight|stay|car|transfer|act|note",
  title:"", start:"", end:"", from:"", to:"",
  provider:"", flightNumber:"", confirmation:"", seat:"",
  terminal:"", gate:"", boardingTime:"",
  address:"", phone:"", cost:"", currency:"", notes:"",
  archivo:"voucher.pdf"        // de qué archivo salió — VAL-41
}
```

Un campo que la imagen no dejaba claro llega como `""`, nunca inventado: el prompt de `buildImportPrompt`
lo dice de forma explícita (*"Es preferible un campo vacío: NUNCA inventes códigos de vuelo, horarios,
direcciones ni montos que no estén escritos ahí"*), igual que ya hacía el prompt de `sheetImport`, y
`sanitizeReservation` refuerza esa regla del lado de la validación: cualquier campo que no venga como string
se descarta en vez de convertirse a algo.

### 2.2 · Reconocer un vuelo ya cargado (VAL-42)

`matchFlightReservation(candidato, existentes)` es pura y sincrónica: no llama al modelo, sólo compara datos.
Recibe una reserva interpretada de tipo `"flight"` y las reservas que el viaje ya tiene, y devuelve **uno de
tres resultados, nunca una decisión adivinada**:

```js
{ resultado:"nuevo",   candidato, motivo }
{ resultado:"mismo",   candidato, existente, patch, motivo }
{ resultado:"ambiguo", candidato, candidatos:[...], motivo }
```

El criterio, como pide el brief, es **número de vuelo y fecha**, comparados con tolerancia:

- `sameFlightNumber` compara sólo los dígitos y, si ambos números traen letras, que no se contradigan. Así
  "3040" (lo único que a veces trae impreso una tarjeta de embarque) y "AR3040" (lo que ya está cargado)
  cuentan como el mismo vuelo.
- `sameFlightDate` compara sólo la parte `YYYY-MM-DD` del horario de salida.

Si ningún vuelo cargado coincide, es `"nuevo"`. Si coincide exactamente uno, es `"mismo"` y trae un `patch`
armado por `buildFlightPatch`: sólo los campos de `CAMPOS_COMPLETABLES` (`gate`, `terminal`, `seat`,
`boardingTime`) que la reserva ya cargada tiene **vacíos** y la tarjeta de embarque sí trae. Un campo que la
persona ya había cargado nunca se pisa. Si coinciden **dos o más**, es `"ambiguo"`: el motor no elige, entrega
los candidatos completos para que la interfaz pregunte a cuál corresponde — es la regla del brief que no se
negocia ("ante la duda pregunta a cuál corresponde, no adivina").

**Una tarjeta sin número de vuelo nunca decide sola que es nueva.** Si no se pudo determinar la fecha, no hay
con qué comparar y el resultado es `"nuevo"`. Pero si la fecha sí se conoce y falta el número de vuelo —pasa
con algunas tarjetas de embarque, que a veces vienen recortadas o borrosas justo en ese dato—, y hay uno o
más vuelos cargados ese mismo día, el resultado es `"ambiguo"` con esos vuelos como candidatos, **nunca**
`"nuevo"`. La primera versión de este módulo devolvía `"nuevo"` en ese caso y eso creaba un vuelo duplicado en
silencio el mismo día; se corrigió porque un duplicado silencioso es peor que una pregunta — la persona ve dos
vuelos iguales y deja de confiar en el importador. Sólo es `"nuevo"` cuando no hay ningún vuelo cargado ese
día, o cuando hay número de vuelo y no coincide con ninguno de los de ese día.

`matchAgainstExisting(reserva, existentes)` es el azúcar para usar sobre cualquier reserva interpretada sin
mirar antes el tipo: lo que no es un vuelo siempre es `"nuevo"`, porque VAL-42 sólo pide este reconocimiento
para vuelos.

---

## 3 · La única función que toca el DOM: `renderPdfPagesToImages`

VAL-40 se resuelve renderizando cada página del PDF a imagen dentro del navegador con **pdf.js**, cargado
desde cdnjs con versión fija (`ImportEngine.PDFJS_VERSION`, hoy `3.11.174`) — la única dependencia nueva que
permite el brief.

`renderPdfPagesToImages(pdfBlob, opts)` es la única función del archivo que usa `document.createElement`,
canvas y su contexto 2D. Está deliberadamente aislada para que **todo lo demás en el módulo se pueda probar
con `node`**, sin navegador: el resto de `interpretFiles` recibe esta función ya resuelta como
`opts.renderPdfToImages`, así que las pruebas le inyectan una versión falsa.

No importa pdf.js: lo toma de `opts.pdfjsLib`, o de `window.pdfjsLib` si ya está cargado globalmente. Un PDF
de varias páginas se recorre entero, en orden, de forma secuencial (no en paralelo, para no multiplicar la
memoria de varios canvas grandes en un teléfono a la vez). Un PDF escaneado sin texto seleccionable se
renderiza exactamente igual que uno con texto: pdf.js dibuja la página como imagen sin mirar si hay una capa
de texto debajo, así que VAL-40 lo cubre sin necesitar código aparte.

### 3.1 · pdf.js puede no conseguir instanciar su Web Worker, y ahí no puede caerse la función

Valija corre embebida en un iframe con permisos restringidos. Por defecto pdf.js instancia un Web Worker
desde una URL de otro origen (el CDN), y eso es exactamente el tipo de cosa que un sandbox de iframe suele
bloquear. Si eso pasa y `renderPdfPagesToImages` dependiera únicamente del worker, VAL-40 —la prioridad
máxima de la iteración— dejaría de funcionar en ese contexto sin que hubiera ningún camino de respaldo.

Por eso `renderPdfPagesToImages` no llama a `pdfjsLib.getDocument` directo: pasa por `openPdfDocument`
(exportada también, para poder probarla sola), que:

1. **Intenta primero con worker**, que es el camino rápido y el que pdf.js usa por defecto.
2. **Si instanciarlo falla** —ya sea porque `getDocument` lanza de forma síncrona al crear el worker, o
   porque la promesa que devuelve se rechaza por eso— **reintenta automáticamente con
   `disableWorker:true`**, la opción que la propia API de pdf.js expone para correr todo en el hilo
   principal. Es más lento, pero no depende de que el sandbox permita instanciar un worker de otro origen.
3. La caída es **silenciosa para quien está esperando**: no hay ningún mensaje de error ni una segunda
   confirmación. La persona ya está mirando la pantalla de progreso que la app puso a propósito para esta
   espera; el único efecto visible es que tarda un poco más.

Las pruebas *"si instanciar el Worker de pdf.js lanza (sandbox del iframe), cae solo al modo sin worker..."*
y *"la caída al modo sin worker no llega como error a interpretFile..."* verifican los dos niveles: que
`openPdfDocument` reintenta y consigue las imágenes, y que ese reintento es invisible para
`interpretFile` — el archivo termina en `estado:"ok"`, no en `"error"`.

---

## 4 · Nota de integración — qué necesita `app/valija.html`

Este módulo no se edita desde acá; esto es la lista de lo que el rol de integración tiene que hacer con él.

1. **Cargar el módulo y pdf.js.** `import-engine.js` es UMD, igual que `packing-engine.js`: hay que pegarlo
   dentro de un `<script>` de `valija.html` (sin build, un solo archivo). Además, para que VAL-40 funcione,
   agregar antes del cierre de `</body>` (o donde ya vayan los `<script>` de terceros) las dos etiquetas de
   pdf.js con la versión fija que declara el módulo. Los dos archivos exactos, con la versión que fija
   `PDFJS_VERSION` (`3.11.174`):
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
   <script>
     pdfjsLib.GlobalWorkerOptions.workerSrc =
       "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
   </script>
   ```
   Con eso, `ImportEngine.renderPdfPagesToImages(blob)` ya encuentra `window.pdfjsLib` sin que la app tenga
   que pasarlo a mano (aunque puede, vía `opts.pdfjsLib`, si en algún momento se prefiere cargarlo
   asincrónicamente y no como variable global).

   **Sobre cdnjs, para quien integre:** este entorno de trabajo tiene `cdnjs.cloudflare.com` bloqueado por
   política de egreso de la organización (confirmado con 403 en el túnel del proxy), así que la URL de arriba
   no se pudo confirmar desde acá. No hace falta reintentarlo en este entorno — no va a cambiar. Se verifica
   así, en la app publicada, que es donde sí hay salida de red real:
   1. Abrir la app publicada, abrir las herramientas de desarrollador del navegador y mirar la pestaña
      **Red/Network** mientras carga: `pdf.min.js` y `pdf.worker.min.js` tienen que responder `200`, no `404`.
      Un `404` significa que hay que ajustar `PDFJS_VERSION` a una versión que sí esté publicada en cdnjs
      (`https://cdnjs.com/libraries/pdf.js` lista las versiones disponibles) y actualizarla en las dos
      etiquetas `<script>` de arriba **y** en la constante `PDFJS_VERSION` de `import-engine.js`, para que el
      número no quede desincronizado entre el HTML y el módulo.
   2. En la **consola**, `window.pdfjsLib.version` tiene que devolver `"3.11.174"` (o la versión que haya
      quedado fijada).
   3. Subir un PDF real de varias páginas desde `sheetImport` y confirmar que las reservas de todas las
      páginas aparecen para revisar, no sólo las de la primera — es el criterio de aceptación de VAL-40.
   4. Para confirmar puntualmente el respaldo sin worker de la sección 3.1: en la consola, antes de subir el
      PDF, correr `pdfjsLib.GlobalWorkerOptions.workerSrc = ""` (deja el worker sin URL válida, forzando que
      falle su instanciación) y volver a subir el mismo PDF. Tiene que interpretarse igual, sólo que un poco
      más lento; si en cambio no pasa nada o tarda para siempre, el respaldo de `openPdfDocument` no está
      encontrando el camino sin worker y hay que revisarlo antes de dar esto por cerrado.

2. **Armar la lista de archivos.** Desde el `<input type="file" multiple accept="image/*,application/pdf">`
   de `sheetImport`, convertir cada `File` a `{ name:file.name, mimeType:file.type, blob:file }` (un `File`
   ya es un `Blob`, así que se puede pasar directo).

3. **Llamar a `interpretFiles`:**
   ```js
   const callModel = (prompt, {images}) => sample.json(prompt, { images, modelTier:"complex" });
   const resultado = await ImportEngine.interpretFiles(files, {
     callModel,
     renderPdfToImages: (blob) => ImportEngine.renderPdfPagesToImages(blob),
     trip: { name:trip.name, destination:trip.destination, startDate:trip.startDate, endDate:trip.endDate }
   });
   ```
   Igual que con `PackingEngine.generatePackingList`, si `claude.use("sample")` no resolvió, no pasar
   `callModel`: cada archivo va a degradar solo a `estado:"error"` con `codigo:"ia-no-disponible"`, sin que
   la promesa general se rechace. La carga manual sigue estando, como pide el brief.

4. **Mostrar por archivo, no un resultado global.** `resultado.archivos` ya trae, por archivo, su nombre,
   estado y reservas — es lo que pide VAL-41 ("la app dice qué reconoció de cada archivo"). Un archivo en
   `estado:"error"` se muestra con `error.mensaje` (ya en español, listo para la persona) sin bloquear los
   que sí funcionaron.

5. **Antes de guardar cada reserva de tipo `"flight"`, correr `ImportEngine.matchAgainstExisting(reserva,
   Store.itemsOf(trip.id))`:**
   - `"nuevo"` → se guarda como reserva nueva, igual que hoy hace `sheetImport`.
   - `"mismo"` → mostrar los campos de `resultado.patch` como "esto se va a completar" (VAL-42 pide mostrarlo
     antes de guardar) y, al confirmar, actualizar `resultado.existente.id` con esos campos en vez de crear
     una reserva nueva.
   - `"ambiguo"` → mostrar `resultado.candidatos` (cada uno con su `id`, `title`, `start`) y que la persona
     elija a cuál corresponde, o si en realidad es un vuelo distinto. Nunca elegir por ella.

6. **El campo `boardingTime` no tiene lugar hoy en el modelo de ítem de `Store`.** Dos caminos, a decisión de
   integración: (a) agregar el campo al esquema de `items` (`boardingTime:""`, igual que `gate` o `terminal`
   ya están), o (b) mientras tanto, anexarlo a `notes` como `"Embarque: 21:10"` al armar el patch o la
   reserva nueva. El motor no fuerza ninguna de las dos: entrega el dato tal cual lo leyó, en su propio campo.

No hace falta ninguna dependencia nueva más allá de pdf.js. El resto del módulo es JavaScript vainilla.

---

## 5 · Cómo correr las pruebas

```
node app/parts/import-engine.test.js
```

38 casos, sin frameworks, mismo arnés que `packing-engine.test.js` (`test(nombre, fn)`, `assert`, `eq`,
salida con `process.exitCode` fijado una sola vez al final, nunca con `process.exit()` a mitad de camino).
Cubre, en orden: qué tipo de archivo es cada cosa, que una respuesta basura del modelo nunca rompe nada, un
archivo interpretado solo, un PDF de varias páginas interpretado completo, un PDF "escaneado" (misma
mecánica, sin distinguirlo del resto: es la prueba de que VAL-40 lo cubre sin código aparte), varios archivos
juntos, mezcla de fotos y PDF, un archivo que falla entre otros que funcionan, el prompt (que pide dejar vacío
antes que inventar y avisa cuando son varias páginas de un mismo archivo), las guardas de
`renderPdfPagesToImages` sin tocar el DOM (incluida la caída automática al modo sin worker, ver 3.1), y los
tres resultados de VAL-42: vuelo nuevo (con y sin número de vuelo, con y sin otros vuelos ese día), vuelo que
completa uno existente (con número exacto y con número tolerante), y coincidencia ambigua entre dos
candidatos — tanto con número de vuelo repetido como sin número de vuelo del todo.

Ninguna prueba usa un navegador real. Para `parseImportResponse`, `matchFlightReservation` e `interpretFiles`,
los "blobs" de PDF e imagen son objetos cualquiera (el motor nunca mira su contenido, sólo los transporta
hasta `callModel`), y `renderPdfToImages` se inyecta como una función falsa en cada caso — la misma técnica
que `packing-engine.test.js` usa para probar `enrichWithDestination` con un `ask` simulado, sin red. Para
`renderPdfPagesToImages` en sí (la única función que sí toca el DOM), las pruebas instalan un
`global.document` mínimo con sólo lo que la función necesita (`createElement("canvas")` con `getContext` y
`toBlob`) y lo sacan al terminar cada caso — no es jsdom ni ninguna dependencia nueva, es el mínimo posible
para no tener que mockear un navegador entero sólo para probar que el reintento sin worker funciona.
