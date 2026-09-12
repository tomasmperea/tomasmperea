# Motor de importación de documentos — cómo funciona, cómo se extiende, cómo se integra

**Épica:** VAL-40, VAL-41, VAL-42 (Bloque A de `docs/briefs/interpretar.md`) · **Escribe:** motor de
importación · **Estado:** listo para integrar · **Versión del motor:** 2

Este documento describe `app/parts/import-engine.js`, probado en `app/parts/import-engine.test.js` (69
casos, `node app/parts/import-engine.test.js`). El módulo es JavaScript puro: no toca el DOM, no pide red, no
depende de nada externo salvo pdf.js, que ni siquiera importa — lo recibe ya cargado. Recibe archivos y
devuelve datos, en el mismo espíritu que `packing-engine.js`: reglas declaradas como datos, no enterradas en
condicionales.

No repite lo que ya está documentado en el comentario de cabecera de `import-engine.js` (que es extenso y es
la fuente de verdad si algo acá queda desactualizado). Esto es la puerta de entrada.

---

## 0 · Lo que cambió en la versión 2: primero texto, imágenes como último recurso

**El síntoma.** El PM probó importar tres archivos reales desde Chrome en su teléfono. Los tres fallaron con
el mismo mensaje: *"Esta vista no acepta imágenes"*. Ese texto es `MODEL_ERROR_MESSAGES.images_unavailable`:
el modelo rechazó las tres llamadas con el código `images_unavailable`.

**La causa.** La versión 1 convertía **todo** a imagen antes de mandarlo —una foto es una imagen, un PDF se
renderizaba página por página— y nunca preguntaba si esa vista podía mandar imágenes. Si no puede, no
funcionaba nada: ni PDF, ni foto, ni captura.

**El contrato, que no habíamos leído.** `sample.d.ts` de `artifact-capabilities` 0.2.41 dice dos cosas que
ahora sí usamos:

- `sample.limits()` resuelve un objeto con un miembro `images` **presente sólo cuando esa vista puede mandar
  imágenes**. Es barato y local: *"no usage is spent, the viewer is not prompted"*.
- `images_unavailable` — *"this view cannot send images (check limits first). **Hide the IMAGE affordance
  only; text calls still work.**"*

**El orden nuevo.** Para un PDF:

1. **Extraer la capa de texto** con `page.getTextContent()`, todas las páginas en orden. Si el texto alcanza
   (§3.3), se interpreta **como texto**: sin imágenes, y **sin llamar a `limits()`**.
2. Si no hay capa de texto, recién ahí se **renderiza a imagen**, y sólo si `limits()` reporta `images`. Si no
   las reporta, error propio `pdf-escaneado-sin-imagenes` — nunca una llamada al modelo que ya sabemos que va
   a ser rechazada.

Para una foto o una captura no hay alternativa: necesita visión. Sin `images` en `limits()`, el archivo falla
con `imagenes-no-disponibles` **sin intentar la llamada**.

El camino de texto no es sólo un plan B: **es mejor que la imagen aunque la vista las acepte**. Es más
barato (no hay render ni imágenes en el prompt), más rápido, y más exacto, porque un texto extraído no tiene
errores de lectura.

`limits` llega **inyectado** (`opts.limits`), igual que `callModel`: el motor no llama a `claude.use`. Se lee
como mucho una vez por corrida de `interpretFiles`, y sólo la primera vez que un archivo realmente necesita
saberlo.

---

## 1 · Qué problema resuelve

Hoy `sheetImport` en `app/valija.html` interpreta texto pegado y, si la vista soporta imágenes, fotos sueltas.
Lo que falta, y es la prioridad máxima de la iteración 2:

- **VAL-40.** Subir un PDF (voucher, pasaje) y que se interprete completo, tenga una página o veinte, tenga
  texto seleccionable o sea un escaneo. La capa inteligente nunca recibe un PDF: recibe **el texto** del PDF
  si lo tiene, y si no —y sólo si la vista acepta imágenes— las páginas renderizadas a imagen dentro del
  navegador. Ver §0.
- **VAL-41.** Subir varios archivos a la vez, mezclando fotos y PDFs, y saber qué se reconoció de **cada
  uno**, no un resultado global. Un archivo roto se señala solo y no arrastra a los demás.
- **VAL-42.** Cuando llega tarde una tarjeta de embarque de un vuelo que ya estaba cargado, completarlo (puerta,
  terminal, asiento, hora de embarque) en lugar de duplicarlo. El criterio es número de vuelo y fecha. Ante la
  duda, el motor nunca decide solo: devuelve los candidatos para que la interfaz pregunte.

---

## 2 · Las dos piezas del módulo

### 2.1 · Interpretar archivos (VAL-40 / VAL-41)

`interpretFiles(files, opts)` es la entrada principal. Recibe un array de archivos —
`{ name, blob, mimeType }` — y cuatro funciones que la app inyecta: `opts.callModel` (la firma es la de `ask`
en `packing-engine.js`, `async (prompt, opciones) => objeto o string JSON`), `opts.limits`,
`opts.extractPdfText` y `opts.renderPdfToImages`. Por cada archivo:

1. **`fileKind(file)`** decide si es `"pdf"`, `"imagen"` o `"desconocido"` por mimeType y, si falta, por
   extensión.
2. **`prepareSource(file, opts, sesion)`** decide *cómo* mandarlo, que es el corazón de la versión 2 (§0):
   un PDF pasa primero por **`opts.extractPdfText(blob)`** y, si el texto alcanza, va como texto; si no
   alcanza, se consulta `limits()` y recién ahí se renderiza con **`opts.renderPdfToImages(blob)`**. Una foto
   va siempre por imágenes, y sólo si `limits()` las permite. Cualquiera de esas funciones puede faltar o
   caerse: el archivo degrada a un error claro y nunca tira abajo la carga completa.
3. Se arma el prompt con **`buildImportPrompt(ctx)`** —que tiene dos variantes, texto e imágenes, con sus
   reglas declaradas en `REGLAS_PROMPT`— y se llama a `opts.callModel(prompt, opciones)`. `opciones` lleva
   `{modo, archivo, paginas}` siempre, y **`images` sólo en el camino de imágenes**: en el de texto esa clave
   ni aparece.
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
    { archivo:"voucher.pdf", estado:"ok", reservas:[...], error:null,
      paginas:2, modo:"texto", caracteres:625 },
    { archivo:"foto.jpg",    estado:"error", reservas:[], error:{codigo:"imagenes-no-disponibles", mensaje:"..."},
      paginas:null, modo:null, caracteres:null }
  ],
  reservas: [ /* todas las reservas de todos los archivos, con su campo `archivo` */ ],
  resumen: { total:2, ok:1, vacios:0, errores:1, reservas:1, porTexto:1, porImagenes:0 }
}
```

`modo` dice por qué camino se leyó cada archivo (`"texto"` o `"imagenes"`) y `caracteres` cuánto texto se
mandó. Sirve para la interfaz ("leído del texto del PDF") y para diagnosticar sin adivinar.

Los códigos de error que pone el motor están declarados como datos en `ERRORES_PROPIOS`, y los del modelo en
`MODEL_ERROR_MESSAGES`. Agregar uno es agregar una entrada:

| código | cuándo | qué dice |
|---|---|---|
| `tipo-no-soportado` | no es PDF ni imagen | subí una foto o un PDF |
| `imagenes-no-disponibles` | foto o captura en una vista sin `images` | subí el PDF del comprobante; si tiene texto se lee igual |
| `pdf-escaneado-sin-imagenes` | PDF sin capa de texto en una vista sin `images` | es un escaneo y acá no se pueden leer imágenes; cargala a mano |
| `pdf-no-disponible` / `pdf-fallo` / `pdf-vacio` | pdf.js no está, se cayó, o no dio páginas | probá con una foto del comprobante |
| `ia-no-disponible` | no se inyectó `callModel` | cargá la reserva a mano |

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

## 3 · Las dos formas de leer un PDF, y cuándo se usa cada una

VAL-40 usa **pdf.js** para las dos cosas, cargado desde cdnjs con versión fija
(`ImportEngine.PDFJS_VERSION`, hoy `3.11.174`) — la única dependencia nueva que permite el brief. El módulo
no lo importa: lo toma de `opts.pdfjsLib`, o de `window.pdfjsLib` si ya está cargado globalmente.

### 3.1 · `extractPdfText(pdfBlob, opts)` — el camino principal

Recorre las páginas en orden, llama a `page.getTextContent()` en cada una y arma un string. **No toca el
DOM**: no hay canvas acá, así que se puede probar entera con `node` y un pdf.js falso. Devuelve
`{texto, paginas, porPagina}`.

`textContentToString(tc)` hace la traducción, y lo hace a la defensiva: `getTextContent()` resuelve
`{items:[{str, hasEOL, ...}], styles}` según la API de pdf.js, y se leen `items` que no sean array, ítems sin
`str` e ítems sin `hasEOL` sin romperse. **Esa parte del contrato no se pudo verificar en este entorno** (el
CDN de pdf.js está bloqueado, ver §5): lo que hay es un simulador escrito contra la API documentada, y la
comprobación real la hace el PM en el teléfono con los pasos de §4.

Un PDF escaneado devuelve `texto:""` y su cantidad real de páginas. **Eso no es un error**: es el dato de que
hay que ir por imágenes.

### 3.2 · `renderPdfPagesToImages(pdfBlob, opts)` — el último recurso, y la única función que toca el DOM

Es la única función del archivo que usa `document.createElement`, canvas y su contexto 2D. Está
deliberadamente aislada para que **todo lo demás en el módulo se pueda probar con `node`**, sin navegador: el
resto de `interpretFiles` la recibe ya resuelta como `opts.renderPdfToImages`, así que las pruebas le
inyectan una versión falsa. Un PDF de varias páginas se recorre entero, en orden, de forma secuencial (no en
paralelo, para no multiplicar la memoria de varios canvas grandes en un teléfono a la vez).

Desde la versión 2 sólo se llega acá cuando **no hay capa de texto utilizable** y **`limits()` reporta
`images`**.

### 3.3 · Cuándo "el texto alcanza" — `REGLAS_TEXTO_SUFICIENTE`

El umbral está declarado como datos, en dos niveles:

| nivel | minCaracteres | minPalabras | minDigitos | cuándo se usa |
|---|---|---|---|---|
| `normal` | 120 | 15 | 4 | siempre: si lo pasa, se interpreta como texto y no se mira `limits()` |
| `ultimo-recurso` | 40 | 6 | 2 | sólo cuando la vista **no** acepta imágenes |

Los tres mínimos se cumplen a la vez. De dónde salen los números del nivel `normal`:

- **120 caracteres.** El voucher de micro real del PM
  (`app/pruebas/fixtures/voucher-lobos-bus.txt`) trae **625** caracteres con todo lo que hace falta: código,
  nombre, origen, destino y los dos horarios. Una tarjeta de embarque mínima —nombre, vuelo, fecha, hora,
  asiento, puerta, código— no baja de unos 90. Un pie de página tipo *"Página 1 de 2 · generado por
  SistemaX"* no llega a 45. 120 deja el pie de página afuera con margen y no roza al comprobante más escueto
  que sabemos que existe.
- **15 palabras.** Es la defensa contra el caso que avisó el PM: un PDF escaneado que igual trae tres
  palabras sueltas al pie. Contar palabras además de caracteres también evita que una tira larga de un solo
  token (una URL de 200 caracteres) pase por "texto suficiente".
- **4 dígitos.** Toda reserva trae al menos una fecha o un código con números; un pie de página de puro texto
  legal, no.

**Qué se pierde si el umbral falla.** Un falso negativo (texto bueno que no pasa) no pierde nada: se cae al
camino de imágenes, que es exactamente lo que hacía la versión 1 para todos los PDFs. Un falso positivo
(basura que pasa) tampoco rompe: el modelo devuelve `{"items":[]}` y el archivo queda en `estado:"vacio"`,
que no es un error. Por eso el umbral se puede mover sin miedo si aparece un comprobante que lo desmiente:
es una entrada en una tabla.

El nivel `ultimo-recurso` existe porque, cuando la vista no acepta imágenes, la alternativa a mandar un texto
flaco no es mandar una imagen: es **no leer el archivo**. Ahí más vale intentarlo. Si ni eso alcanza (un
escaneo puro: cero caracteres), es `pdf-escaneado-sin-imagenes`.

### 3.4 · `getViewCapabilities(limits)` — lo que la app pregunta antes de dibujar la pantalla

Nunca rechaza. Devuelve lo que la interfaz necesita para no ofrecer lo que no puede funcionar:

```js
{
  aceptaImagenes: true, certeza: "si" | "no" | "desconocida",
  puedeFoto: true,            // ¿se ofrecen "Sacar foto" y "Galería"?
  puedePdfConTexto: true,     // SIEMPRE true: el texto no depende de imágenes
  puedePdfEscaneado: true,
  maxImagenes: 5, maxBytesImagen: 20971520, tiposImagen: ["image/jpeg", ...],
  accept: "image/jpeg,...,application/pdf",   // para el input de archivos
  nota: ""                    // qué mostrarle a la persona si no hay imágenes
}
```

`certeza` tiene tres valores porque hay tres situaciones distintas, y ninguna se adivina: `limits()` respondió
con `images` (`"si"`), respondió sin `images` o rechazó (`"no"` — el contrato dice *"treat a rejection like an
absent images"*), o la app no inyectó `limits` (`"desconocida"`). En el caso desconocido se sigue como antes
del cambio: se intenta con imágenes y, si el modelo rechaza, se muestra el mensaje de `images_unavailable`.
Así una integración que todavía no pasa `limits` no queda peor que antes.

### 3.5 · pdf.js puede no conseguir instanciar su Web Worker, y ahí no puede caerse la función

*(Vale para las dos formas de leer el PDF: `extractPdfText` y `renderPdfPagesToImages` abren el documento con
el mismo `openPdfDocument`, así que las dos heredan este respaldo.)*

Valija corre embebida en un iframe con permisos restringidos. Por defecto pdf.js instancia un Web Worker
desde una URL de otro origen (el CDN), y eso es exactamente el tipo de cosa que un sandbox de iframe suele
bloquear. Si eso pasa y `renderPdfPagesToImages` dependiera únicamente del worker, VAL-40 —la prioridad
máxima de la iteración— dejaría de funcionar en ese contexto sin que hubiera ningún camino de respaldo.

Por eso ninguna de las dos llama a `pdfjsLib.getDocument` directo: las dos pasan por `openPdfDocument`
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
   Con eso, tanto `ImportEngine.extractPdfText(blob)` —el camino principal desde la versión 2— como
   `ImportEngine.renderPdfPagesToImages(blob)` encuentran `window.pdfjsLib` sin que la app tenga que pasarlo
   a mano (aunque puede, vía `opts.pdfjsLib`, si en algún momento se prefiere cargarlo asincrónicamente y no
   como variable global). **Sin pdf.js no hay ni texto ni render:** todos los PDFs caen en
   `pdf-no-disponible`, y las fotos siguen funcionando si la vista acepta imágenes.

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
   4. Para confirmar puntualmente el respaldo sin worker de §3.5: en la consola, antes de subir el
      PDF, correr `pdfjsLib.GlobalWorkerOptions.workerSrc = ""` (deja el worker sin URL válida, forzando que
      falle su instanciación) y volver a subir el mismo PDF. Tiene que interpretarse igual, sólo que un poco
      más lento; si en cambio no pasa nada o tarda para siempre, el respaldo de `openPdfDocument` no está
      encontrando el camino sin worker y hay que revisarlo antes de dar esto por cerrado.

2. **Preguntar qué puede esta vista ANTES de dibujar la pantalla.** Es lo que faltaba y lo que causó el bug
   del teléfono del PM:
   ```js
   const caps = await ImportEngine.getViewCapabilities(() => sample.limits());   // nunca rechaza
   fotoBtn.hidden = galeriaBtn.hidden = !caps.puedeFoto;
   fileInput.accept = caps.accept;          // "application/pdf" a secas si no hay imágenes
   notaEl.textContent = caps.nota;          // "" cuando las imágenes andan
   ```
   Se pasa **envuelta en una flecha y sin llamarla**: el motor la llama cuando hace falta, y la flecha
   evita pasar el método suelto y perder su `this` (el contrato la muestra siempre como `sample.limits()`).
   Si no hay
   `sample` (porque `claude.use("sample")` devolvió `null`), no se ofrece importar y queda la carga manual,
   como pide el brief.

3. **Armar la lista de archivos.** Desde el `<input type="file" multiple>` de `sheetImport` —con el `accept`
   que salió de `caps`— convertir cada `File` a `{ name:file.name, mimeType:file.type, blob:file }` (un
   `File` ya es un `Blob`, así que se puede pasar directo).

4. **Llamar a `interpretFiles`,** inyectando las cuatro funciones. El motor no llama a `claude.use` ni
   importa pdf.js:
   ```js
   const callModel = (prompt, o) =>
     sample.json(prompt, o.images ? { images: o.images, modelTier:"complex" } : { modelTier:"complex" });

   const resultado = await ImportEngine.interpretFiles(files, {
     callModel,
     limits: () => sample.limits(),                             // NUEVO en la versión 2
     extractPdfText:   (blob) => ImportEngine.extractPdfText(blob),        // NUEVO: el camino principal
     renderPdfToImages:(blob) => ImportEngine.renderPdfPagesToImages(blob),// el último recurso
     trip: { name:trip.name, destination:trip.destination, startDate:trip.startDate, endDate:trip.endDate }
   });
   ```
   **`o.images` sólo viene en el camino de imágenes.** En el de texto la clave no existe, y la app no tiene
   que agregarla: mandar `images: undefined` a una vista sin soporte es justamente lo que hay que evitar.
   `o` también trae `modo`, `archivo` y `paginas`, por si se quiere elegir otro `modelTier` para texto o
   mostrar progreso por archivo.

   Igual que con `PackingEngine.generatePackingList`, si `claude.use("sample")` no resolvió, no pasar
   `callModel`: cada archivo va a degradar solo a `estado:"error"` con `codigo:"ia-no-disponible"`, sin que
   la promesa general se rechace. La carga manual sigue estando, como pide el brief.

5. **Mostrar de dónde salió cada reserva.** `archivo.modo` es `"texto"` o `"imagenes"`: en la pantalla de
   revisión conviene decir "leído del texto del PDF", porque es el caso más exacto y el que más confianza da.

6. **Mostrar por archivo, no un resultado global.** `resultado.archivos` ya trae, por archivo, su nombre,
   estado y reservas — es lo que pide VAL-41 ("la app dice qué reconoció de cada archivo"). Un archivo en
   `estado:"error"` se muestra con `error.mensaje` (ya en español, listo para la persona) sin bloquear los
   que sí funcionaron.

7. **Antes de guardar cada reserva de tipo `"flight"`, correr `ImportEngine.matchAgainstExisting(reserva,
   Store.itemsOf(trip.id))`:**
   - `"nuevo"` → se guarda como reserva nueva, igual que hoy hace `sheetImport`.
   - `"mismo"` → mostrar los campos de `resultado.patch` como "esto se va a completar" (VAL-42 pide mostrarlo
     antes de guardar) y, al confirmar, actualizar `resultado.existente.id` con esos campos en vez de crear
     una reserva nueva.
   - `"ambiguo"` → mostrar `resultado.candidatos` (cada uno con su `id`, `title`, `start`) y que la persona
     elija a cuál corresponde, o si en realidad es un vuelo distinto. Nunca elegir por ella.

8. **El campo `boardingTime` no tiene lugar hoy en el modelo de ítem de `Store`.** Dos caminos, a decisión de
   integración: (a) agregar el campo al esquema de `items` (`boardingTime:""`, igual que `gate` o `terminal`
   ya están), o (b) mientras tanto, anexarlo a `notes` como `"Embarque: 21:10"` al armar el patch o la
   reserva nueva. El motor no fuerza ninguna de las dos: entrega el dato tal cual lo leyó, en su propio campo.

No hace falta ninguna dependencia nueva más allá de pdf.js. El resto del módulo es JavaScript vainilla.

---

## 5 · Cómo correr las pruebas, y qué NO prueban

```
node app/parts/import-engine.test.js
```

69 casos, sin frameworks, mismo arnés que `packing-engine.test.js` (`test(nombre, fn)`, `assert`, `eq`,
salida con `process.exitCode` fijado una sola vez al final, nunca con `process.exit()` a mitad de camino).

Los **43 de la versión 1** cubren: qué tipo de archivo es cada cosa, que una respuesta basura del modelo nunca
rompe nada, un archivo interpretado solo, un PDF de varias páginas interpretado completo, varios archivos
juntos, mezcla de fotos y PDF, un archivo que falla entre otros que funcionan, el prompt, las guardas de
`renderPdfPagesToImages` sin tocar el DOM (incluida la caída automática al modo sin worker, §3.5) y los tres
resultados de VAL-42.

Los **26 de la versión 2** cubren el cambio de §0, y **los 26 fallan contra la versión 1 del motor**
(comprobado corriendo este mismo archivo de pruebas contra una copia del módulo anterior: 43 pasaron, 26
fallaron):

- `getViewCapabilities` con `images`, sin `images`, con `limits()` que rechaza, con `limits()` que lanza de
  forma síncrona, y sin `limits` inyectado.
- El umbral de §3.3: el voucher real lo pasa; "Página 1 de 2" no; una URL larga de un solo token tampoco
  (por eso el umbral cuenta palabras y no sólo caracteres); un PDF sin texto no pasa en ningún nivel.
- `extractPdfText` contra un pdf.js falso: junta las páginas **en orden**, y el texto del voucher real sale
  **idéntico** al que entró — ni un carácter de diferencia.
- **El voucher de micro real del PM leído de punta a punta**: entra el texto de
  `app/pruebas/fixtures/voucher-lobos-bus.txt` y sale una reserva con `confirmation:"LB0TKCV5"`,
  `type:"transfer"`, origen, destino y los dos horarios (`2026-09-13T19:01` y `2026-09-13T20:31`). El
  `callModel` simulado sigue el contrato de `sample.json` (resuelve el JSON ya parseado) y **sólo devuelve la
  reserva si el prompt trae de verdad el código y la fecha del voucher**: si el motor no metiera el texto en
  el prompt, el caso falla. Lo que se prueba es el trabajo del motor, no la respuesta del simulador.
- Con espías: un PDF con capa de texto **no renderiza nada y no llama a `limits()`** (contadores en cero), y
  las opciones que recibe `callModel` **no tienen la clave `images`**.
- El bug del PM, en tres casos: un PDF escaneado sin soporte de imágenes da `pdf-escaneado-sin-imagenes` con
  **cero llamadas al modelo y cero renders**; una foto sin soporte da `imagenes-no-disponibles` con cero
  llamadas; y en una carga mixta el PDF con texto se lee igual mientras la foto falla sola (VAL-41).
- `limits()` se consulta **una sola vez** aunque haya tres archivos.
- Una integración que todavía no pasa `limits` sigue funcionando como antes.

### Qué NO prueban — la parte que sólo puede comprobar el PM

Ninguna prueba usa un navegador real ni pdf.js real. Los "blobs" son objetos cualquiera (el motor nunca mira
su contenido, sólo los transporta), `extractPdfText` y `renderPdfToImages` se inyectan falsos, y para
`renderPdfPagesToImages` —la única función que toca el DOM— se instala un `global.document` mínimo
(`createElement("canvas")` con `getContext` y `toBlob`) que se saca al terminar cada caso. No es jsdom ni una
dependencia nueva.

**Lo que queda sin verificar, dicho de frente:**

1. **Que `page.getTextContent()` de pdf.js devuelva en un teléfono real lo que este módulo espera.** El CDN
   de pdf.js está bloqueado en el entorno de desarrollo (403 por política de egreso, confirmado antes; no hay
   por qué reintentarlo). El simulador de las pruebas está escrito contra la API documentada —
   `{items:[{str, hasEOL}], styles}`— y `textContentToString` lee esa forma a la defensiva, pero **un
   simulador replica el contrato, no lo verifica**. Si `getTextContent()` devolviera otra forma, el texto
   saldría vacío y el archivo caería al camino de imágenes: degrada, no rompe, pero VAL-40 no se cumpliría
   por el camino bueno.
2. **Que la vista del teléfono del PM efectivamente reporte `limits()` sin `images`.** La causa está
   confirmada por el mensaje de error que vio (`images_unavailable` sólo lo produce ese código), pero lo que
   `limits()` responde ahí no se leyó todavía.
3. **Que el PDF de Aerolíneas siga sin capa de texto en el teléfono.** Se midió acá con
   `app/pruebas/fixtures/extraer-texto-pdf.py`: 0 caracteres. Es un extractor propio y simple; pdf.js podría
   encontrar texto donde ese script no lo ve. Si lo encuentra, mejor: se leería como texto.

**Cómo se comprueba, en la app publicada y desde el teléfono** (esto es lo único que en este proyecto se
puede llamar *verificado*):

1. En la consola del navegador, antes de importar: `await (await claude.use("sample")).limits()`. Anotar si
   el objeto trae `images` o no. Eso confirma o desmiente el punto 2 y decide qué esperar de todo lo demás.
2. Subir **el voucher de micro** (`RLB_CLARA_SANCHEZ…pdf`). Tiene que aparecer la reserva con el código
   `LB0TKCV5`, origen, destino y los dos horarios, **haya o no `images`** — es el caso que antes fallaba con
   "Esta vista no acepta imágenes". En la consola, `resultado.archivos[0].modo` tiene que ser `"texto"`.
3. Subir **el PDF de Aerolíneas** (sin capa de texto). Si la vista tiene `images`, tiene que interpretarse
   por el camino de imágenes (`modo:"imagenes"`). Si no las tiene, tiene que aparecer el error
   `pdf-escaneado-sin-imagenes` con su mensaje en español, **y ninguna llamada al modelo** (se ve en la
   pestaña Red: no hay pedido nuevo).
4. Subir **una foto**. Si no hay `images`, tiene que aparecer `imagenes-no-disponibles` sin llamada al
   modelo, y los botones "Sacar foto" y "Galería" no tendrían que estar visibles (paso 2 de §4).
5. Confirmar que pdf.js cargó: en la consola, `window.pdfjsLib.version`. Si es `undefined`, la URL de cdnjs
   de §4 falló y hay que ajustar `PDFJS_VERSION` — sin pdf.js no hay ni texto ni render, y todos los PDFs
   caen en `pdf-no-disponible`.
