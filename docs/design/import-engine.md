# Motor de importación de documentos — cómo funciona, cómo se extiende, cómo se integra

**Épica:** VAL-40, VAL-41, VAL-42 (`docs/briefs/interpretar.md`) + VAL-59 y VAL-60
(`docs/briefs/adjuntar.md`) · **Escribe:** motor de importación · **Estado:** listo para integrar ·
**Versión del motor:** 3

Este documento describe `app/parts/import-engine.js`, probado en `app/parts/import-engine.test.js` (101
casos, `node app/parts/import-engine.test.js`). El módulo es JavaScript puro: no toca el DOM, no pide red, no
depende de nada externo salvo pdf.js, que ni siquiera importa — lo recibe ya cargado. Recibe archivos y
devuelve datos, en el mismo espíritu que `packing-engine.js`: reglas declaradas como datos, no enterradas en
condicionales.

No repite lo que ya está documentado en el comentario de cabecera de `import-engine.js` (que es extenso y es
la fuente de verdad si algo acá queda desactualizado). Esto es la puerta de entrada.

---

## 0.bis · Lo que cambió en la versión 3: la tarjeta se desprende, y el lote se manda junto

Dos cambios de la iteración 3, los dos sobre el mismo archivo.

**VAL-59 · La tarjeta de embarque se desprende de un vuelo.** `matchFlightReservation` tiene un cuarto
resultado, `"sin-vuelo"`, que reemplaza al `"nuevo"` **sólo cuando la reserva es una tarjeta de embarque**.
Antes, una tarjeta que no coincidía con ningún vuelo cargado terminaba siendo una reserva de vuelo inventada a
partir de un documento que no es un vuelo. Ahora el motor devuelve **el caso** —`"sin-vuelos"`, `"un-vuelo"` o
`"varios-vuelos"`—, los candidatos y lo que la tarjeta aporta para precargar un vuelo nuevo, y **la app
pregunta**. Ver §6.

**VAL-60 · Un lote, una llamada.** `interpretFiles` agrupa los archivos que se leen **como texto** y los
resuelve en **una sola llamada por lote**, que es lo que pide el contrato (*"For a list of items prefer ONE
call that returns a JSON array over one call per item"*). Cuatro PDFs con texto pasaron de cuatro llamadas a
una. El progreso por fila —la razón válida por la que se llamaba una vez por archivo— se conserva con
`opts.onProgress`. Ver §7.

Las dos garantías que ya existían siguen valiendo y están probadas de nuevo con el lote: **un archivo que
falla no invalida a los demás**, y **una reserva sale atribuida a su archivo o no sale**.

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
  resumen: { total:2, ok:1, vacios:0, errores:1, reservas:1, porTexto:1, porImagenes:0,
             llamadas:1, lotes:1 }
}
```

`llamadas` y `lotes` son de la versión 3: cuántas llamadas al modelo salieron de verdad y en cuántos lotes se
agruparon los textos. Es el número que VAL-60 viene a bajar, y sin él no hay forma de saber si sirvió.

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
  docType:"",                  // qué clase de documento dijo el modelo que era — VAL-59
  archivo:"voucher.pdf"        // de qué archivo salió — VAL-41
}
```

`docType` es de la versión 3 y sólo acepta uno de cinco valores (`TIPOS_DOCUMENTO`: `boarding-pass`,
`ticket`, `voucher`, `booking`, `other`). Cualquier otra cosa que conteste el modelo queda en `""`, y **`""`
no es un error**: es la respuesta honesta cuando el documento no dice qué es. El prompt lo pide con esas
palabras (*"Si el documento no dice qué es y no estás seguro, dejalo VACÍO: vacío es una respuesta válida y
correcta, y es mejor que elegir uno al azar"*), y el criterio de §6 funciona igual sin él.

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
{ resultado:"nuevo",     candidato, motivo, esTarjeta:false }
{ resultado:"mismo",     candidato, existente, patch, motivo, esTarjeta }
{ resultado:"ambiguo",   candidato, candidatos:[...], motivo, esTarjeta }
{ resultado:"sin-vuelo", candidato, caso, candidatos:[...], opciones, precarga, motivo, esTarjeta:true }
```

El cuarto es de VAL-59 y está en §6. Los otros tres no cambiaron; lo único que se les sumó es `esTarjeta`,
para que la interfaz ponga el chip sin volver a mirar los datos.

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

**Lo que la versión 3 NO tocó:** `"mismo"` y `"ambiguo"` se calculan exactamente igual, con el mismo criterio
de número y fecha y la misma regla de no elegir nunca en el caso ambiguo. El único camino que cambió es el
que antes decía `"nuevo"` sobre una tarjeta de embarque.

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
     sample.json(prompt, o.images ? { images: o.images, modelTier:"complex" }
                                  : { modelTier:"default" });   // ver § 4.9

   const resultado = await ImportEngine.interpretFiles(files, {
     callModel,
     limits: () => sample.limits(),                             // NUEVO en la versión 2
     extractPdfText:   (blob) => ImportEngine.extractPdfText(blob),        // NUEVO: el camino principal
     renderPdfToImages:(blob) => ImportEngine.renderPdfPagesToImages(blob),// el último recurso
     onProgress: (e) => pintarFila(e),                          // NUEVO en la versión 3: § 7.5
     trip: { name:trip.name, destination:trip.destination, startDate:trip.startDate, endDate:trip.endDate }
   });
   ```
   **Con TODOS los archivos juntos, en una sola llamada a `interpretFiles`.** Es el cambio que pide VAL-60 y
   el único de la versión 3 que la app tiene que hacer a mano: hoy `runInterpretation` (`valija.html`, ~línea
   6672) llama a `ImportEngine.interpretFile` **en un bucle, una vez por archivo**, y así el agrupado nunca
   ocurre. `interpretFile` no desaparece ni cambia —sigue siendo un archivo, una llamada, y sirve para
   reintentar uno solo desde la lista de problemas—, pero el camino normal de la cola pasa a ser
   `interpretFiles`. Las filas de la cola se pintan con `onProgress` en vez de con el `.then()` de cada
   archivo: el mapeo está en § 7.5.
   **`o.images` sólo viene en el camino de imágenes.** En el de texto la clave no existe, y la app no tiene
   que agregarla: mandar `images: undefined` a una vista sin soporte es justamente lo que hay que evitar.
   `o` también trae `modo`, `archivo` y `paginas`, por si se quiere elegir otro `modelTier` para texto o
   mostrar progreso por archivo. **Esos tres son nuestros, no del contrato:** no se reenvían a `sample.json()`
   (los miembros que no conoce los ignora, pero los nombra en la consola). El tier que le corresponde a cada
   camino está decidido en § 4.9.

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
   - `"sin-vuelo"` (NUEVO, VAL-59) → **no se guarda nada todavía**. Se pregunta según `resultado.caso`:
     `"sin-vuelos"` es el estado V2 del diseño, `"un-vuelo"` es V4 y `"varios-vuelos"` es V5. Si la persona
     elige un vuelo de `resultado.candidatos`, se completa con
     `ImportEngine.buildFlightPatch(resultado.candidato, elegido)`; si elige crear uno nuevo, se guarda
     `resultado.precarga.vuelo` tal cual, y `precarga.desdeLaTarjeta` / `precarga.vacios` son los dos grupos
     de campos que V3 muestra con su cuenta. Si descarta, no se guarda ni la reserva ni el documento.
   - El chip "Tarjeta de embarque" sale de `resultado.esTarjeta` (o de
     `ImportEngine.esTarjetaDeEmbarque(reserva)` si no hay match a mano): es el mismo criterio que decidió el
     flujo, y por eso no se vuelve a inferir en la interfaz — ver § 6.1.

8. **El campo `boardingTime` no tiene lugar hoy en el modelo de ítem de `Store`.** Dos caminos, a decisión de
   integración: (a) agregar el campo al esquema de `items` (`boardingTime:""`, igual que `gate` o `terminal`
   ya están), o (b) mientras tanto, anexarlo a `notes` como `"Embarque: 21:10"` al armar el patch o la
   reserva nueva. El motor no fuerza ninguna de las dos: entrega el dato tal cual lo leyó, en su propio campo.

No hace falta ninguna dependencia nueva más allá de pdf.js. El resto del módulo es JavaScript vainilla.

---

### 4.9 · El tier del modelo: texto en `"default"`, imágenes en `"complex"`

Decisión del PO, 12 de septiembre de 2026, a partir de
`docs/investigacion/cuota-de-la-capa-inteligente.md`. Está escrita acá porque es del tipo de decisión que
dentro de tres meses alguien va a querer revertir "por seguridad", subiendo todo a `"complex"` otra vez.
Si la vas a cambiar, cambiala con una medición, no con una intuición.

En `app/valija.html` vive en un solo lugar, la constante `TIER`:

```js
const TIER = { texto:"default", imagenes:"complex", equipaje:"complex" };
```

| Camino | Tier | En una línea |
|---|---|---|
| Importar desde texto (pegado, o PDF con capa de texto) | `"default"` | Extraer lleva inferencia, y `"quick"` no piensa antes |
| Importar desde imagen (foto, o PDF escaneado renderizado) | `"complex"` | Percepción difícil, y las imágenes se reenvían en cada ronda |
| Sugerencia de equipaje (`PackingEngine`) | `"complex"` | Es el único lugar con razonamiento de verdad |

**Texto → `"default"`, y por qué NO es `"quick"`.** El contrato describe `"quick"` como el tier para
"short routine work — classification, tags, one-line rewrites, **small JSON** (…) it does not think first".
Extraer campos de un voucher ya limpio suena exactamente a eso, y no lo es: el trabajo lleva inferencia
que `"quick"` saltea explícitamente.

- Deducir el año cuando el documento dice "20 de septiembre" sin año, usando las fechas del viaje.
- Partir una ida y vuelta en **dos** vuelos separados.
- Decidir el **tipo** de reserva por contexto: un voucher de micro es `transfer`, no `flight`.
- Normalizar "13/9/2026 - 19:01" a ISO.

Una fecha equivocada en un vuelo es un daño mucho peor que dos segundos más de espera. `"default"` es el
medio equilibrado y ya es un escalón más barato que lo que la app pedía antes.

**Cuándo sí se evalúa `"quick"`:** si con una docena de documentos reales del PM el camino de texto se
porta impecable. Si erra una fecha, se vuelve a subir. No se baja sin ese material.

**Imagen → `"complex"`.** Leer una tarjeta de embarque fotografiada torcida y con reflejo es percepción
difícil, y el contrato avisa que las imágenes se reenvían en cada ronda: es el lugar donde la calidad
tiene que ganarle al costo. El camino existe en el código aunque la vista del PM no lo habilite, así que
**el tier no lo elige el call site**: lo decide `tierDeImportacion(o)` mirando las opciones que manda el
motor (`o.images` presente, o `o.modo === "imagenes"`). El día que la vista habilite las fotos, ya está en
el tier alto sin que nadie se tenga que acordar.

**Equipaje → `"complex"`, sin cambios.** Ahí sí hay razonamiento: combinar una escala de ocho horas con un
departamento sin lavarropas y sacar una conclusión. Es el único lugar donde el modelo que piensa más largo
se paga solo.

### `modelTierApplied` no llega por `sample.json()`

El contrato avisa que la plataforma puede servir un tier más barato si el plan del visitante no tiene el
pedido, y que `modelTierApplied` informa cuál contestó realmente. **Ese campo vive en `SampleResult`**, o
sea en lo que resuelve `sample()`. `sample.json()` "resolves with the reply parsed as one JSON value
instead of `{text}`", y la app usa `json()` en las tres llamadas: **por ese camino el dato no llega, y no
hay forma de obtenerlo sin dejar de usar `json()`.** No se inventa.

Lo que sí se registra, en `app/valija.html`, es el tier **pedido**:

```js
ValijaTier.log()      // últimas 30 llamadas: {ts, tarea, pedido, aplicado:null, motivo, estado, ms, codigo?}
ValijaTier.resumen()  // agrupado por tarea y tier: {llamadas, ok, error, msProm}
ValijaTier.borrar()
```

- `aplicado` queda en `null` **siempre**, con el motivo escrito en la propia entrada. Si alguna llamada
  pasa algún día por `sample()` en lugar de `json()`, `iaRegistrar({aplicado})` ya lo acepta y no hay nada
  más que cambiar.
- Vive en `localStorage` (`valija.iaTier.v1`), igual que el tema y el aplazamiento del plan: es estado del
  dispositivo para diagnóstico, no datos del viaje, y por eso **no pasa por `Store`**.
- No guarda ni el prompt ni nada del viaje: tarea, tier, duración y código de error.
- No se muestra en la interfaz. Se lee desde la consola del dispositivo.

**Brecha declarada:** en un teléfono no hay consola. Si hace falta decidir con datos del teléfono del PM,
hay que agregarle una salida (copiar al portapapeles desde una pantalla de diagnóstico, por ejemplo), y eso
todavía no está hecho.

**Cómo se prueba que el tier pedido es el que se pide de verdad:**

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js
```

Asevera sobre las opciones que **efectivamente recibió** `sample.json()`, tocando los controles. Y tiene
control negativo: corriendo el mismo arnés contra una copia del HTML con `texto:"complex"`, falla.

---

## 6 · VAL-59 · La tarjeta de embarque se desprende de un vuelo

La regla que atraviesa los tres casos, tal como la escribió el PO: **primero el match, siempre. Después
preguntar. Nunca inventar.** El motor decide cuál de los casos es y devuelve los datos; **la app dibuja**. En
este módulo no hay una sola línea de texto de interfaz: eso está en la sección 6 de `docs/design/adjuntar.md`
y es del rol de integración.

### 6.1 · Cómo sabe el motor que está mirando una tarjeta de embarque

Era la pregunta abierta del brief, y la sección 7.6 de `docs/design/adjuntar.md` ya había dicho lo que **no**
se podía hacer: *"El diseño no propone inferirlo en la interfaz: si la app adivina 'es una tarjeta porque trae
asiento', va a tratar como tarjeta a un pasaje con asiento asignado"*.

El criterio está en `REGLAS_TARJETA`, declarado como datos y **evaluado en orden: gana la primera regla que
aplica**, y cada una deja escrito su motivo. Agregar un criterio es agregar una entrada.

| # | regla | qué mira | resultado |
|---|---|---|---|
| 1 | `no-es-vuelo` | `type !== "flight"` | **no** |
| 2 | `declarada-por-el-modelo` | `docType` está en `TIPOS_DOCUMENTO` | **lo que diga**: `boarding-pass` sí, cualquier otro no |
| 3 | `hora-de-embarque` | `boardingTime` no vacío | **sí** |
| 4 | `puerta-de-embarque` | `gate` no vacío | **sí** |
| 5 | `sin-titulo-ni-proveedor` | vuelo sin título ni aerolínea, con asiento, puerta, terminal u hora de embarque | **sí** |
| 6 | `asiento-solo-no-alcanza` | todo lo demás | **no** |

De dónde sale cada una:

- **La declaración del modelo manda, y manda también en negativo.** Es la única señal de primera mano: el
  documento dice "BOARDING PASS" o no lo dice. Por eso un documento declarado `ticket` **no** se convierte en
  tarjeta aunque traiga puerta. Y por eso el prompt pide explícitamente dejar `docType` vacío antes que
  elegir uno al azar: una declaración inventada sería peor que no tenerla, porque pisa a las reglas 3 a 5.
- **La hora de embarque y la puerta** son datos del día del vuelo. Un pasaje comprado tres meses antes no
  puede traerlos, y el prompt ya le decía al modelo que dejara `boardingTime` vacío si el documento no es una
  tarjeta de embarque.
- **Sin título ni aerolínea** es exactamente el perfil que `sanitizeReservation` ya contemplaba y que el
  diseño llama el estado 07B: una tarjeta fotografiada, recortada o borrosa, donde lo único legible es el
  asiento y la fecha. Un pasaje siempre nombra a la aerolínea.
- **El asiento solo nunca alcanza**, y esa regla existe con nombre propio para que el día que alguien quiera
  "mejorar la detección" vea por qué está escrita.

`esTarjetaDeEmbarque(reserva)` devuelve el sí o el no; `clasificarTarjetaDeEmbarque(reserva)` devuelve además
`{regla, certeza, motivo}`. **Es el mismo criterio que la interfaz usa para el chip "Tarjeta de embarque"**:
uno solo, en un solo lugar, para que no puedan desincronizarse.

### 6.2 · El cuarto resultado: `"sin-vuelo"`

Aparece **sólo** si `esTarjetaDeEmbarque(candidato)` y el match no encontró nada. Una reserva de vuelo que no
es tarjeta —un pasaje, un e-ticket— sigue dando `"nuevo"` y se guarda como hasta hoy.

```js
{
  resultado:"sin-vuelo",
  caso:"sin-vuelos" | "un-vuelo" | "varios-vuelos",
  candidato,                       // la tarjeta interpretada
  esTarjeta:true,
  certeza:"declarada"|"inferida",  // de dónde salió que es una tarjeta
  porQueEsTarjeta:"…",             // el motivo de la regla que ganó
  motivo:"…",                      // por qué no hubo match
  candidatos:[ /* TODOS los vuelos del viaje, ordenados por salida */ ],
  opciones:["asociar","crear"] | ["crear"],
  precarga:{ vuelo:{…}, desdeLaTarjeta:[…], vacios:[…], campos:11 }
}
```

| `caso` | cuándo | `candidatos` | `opciones` | estado del diseño |
|---|---|---|---|---|
| `sin-vuelos` | el viaje no tiene ningún vuelo | `[]` | `["crear"]` | V2 |
| `un-vuelo` | hay uno y no coincide | ese vuelo | `["asociar","crear"]` | V4 |
| `varios-vuelos` | hay varios y ninguno coincide | todos | `["asociar","crear"]` | V5 |

Tres decisiones que no son obvias:

**Ninguna opción viene marcada como la correcta.** El resultado no tiene ni `preferida` ni `sugerida` ni
`existente`: son dos salidas del mismo peso. Que el número no coincida puede ser un número mal leído en una
foto con reflejo, o una reserva que se cargó a mano sin número. El motor no tiene forma de distinguir eso, así
que no lo distingue.

**`candidatos` trae todos los vuelos del viaje, no sólo los del día de la tarjeta**, ordenados por fecha de
salida (los que no tienen fecha, al final). Es lo que pide V5 del diseño, y la razón es la misma que la de la
opción sin marcar: si la tarjeta perdió la fecha en el reflejo, filtrar por fecha esconde justamente el
candidato correcto. Son los objetos de `Store` tal cual, así que ya traen `id`, `from`, `to`, `start`,
`flightNumber` y `provider` — ruta, fecha y hora, que es lo que los distingue en la pantalla.

**`precarga` dice qué vino de la tarjeta y qué queda vacío, sin rellenar nada.** `precarga.vuelo` es una
reserva completa lista para guardar, con `""` en todo lo que la tarjeta no traía. `desdeLaTarjeta` y `vacios`
son los nombres de campo de cada grupo, sobre los once de `CAMPOS_VUELO` —origen, destino, aerolínea, número
de vuelo, salida, llegada, asiento, terminal, puerta, embarque, código de reserva—, en ese orden, para que la
interfaz arme sus dos chips ("8 campos · de la tarjeta" / "3 campos · vacíos") sin volver a mirar los datos.
**No se compone el título con la ruta, no se deduce la terminal del aeropuerto, no se calcula la hora de
llegada, no se reusa el código del ticket.** Un campo vacío se completa a mano, y el motor no pone los
nombres de campo en castellano: eso es interfaz.

### 6.3 · Lo que sigue igual

- Un match exitoso no pregunta nada y deja su `motivo` con el número de vuelo y la fecha, como pide VAL-42.
- `"ambiguo"` es el mismo de la iteración 2, con sus mismos candidatos: el diseño lo reusa tal cual en V5.
- Ninguna rama de este módulo escribe nada: `interpretFiles` interpreta y `matchAgainstExisting` clasifica. La
  tarjeta se guarda, se adjunta o se descarta del lado de la app, y sólo cuando la persona lo pidió.

---

## 7 · VAL-60 · Un lote, una llamada

### 7.1 · Qué se agrupa y qué no

`interpretFiles` ahora trabaja en dos tiempos:

1. **Preparar todos los archivos** (`prepareSource`, sin cambios): extraer la capa de texto de cada PDF, mirar
   una sola vez si la vista acepta imágenes, y dejar afuera a los que ya fallaron acá (tipo no soportado, PDF
   escaneado sin imágenes, foto en una vista sin imágenes). Esto es trabajo **por archivo** y sigue siéndolo.
2. **Llamar al modelo**: los archivos que quedaron en modo `"texto"` se agrupan con `planBatches` y cada lote
   sale en **una** llamada; los que quedaron en modo `"imagenes"` siguen **sueltos, uno por llamada**.

Las imágenes no se agrupan a propósito: el contrato avisa que las imágenes se reenvían en cada ronda, así que
juntarlas no ahorra nada y sí multiplica el riesgo de que una foto pesada tire abajo la lectura de las otras.

`interpretFile` **no cambió**: sigue siendo un archivo, una llamada. Lo que cambia es que la app tiene que
dejar de llamarla en un bucle (ver §4, punto 2).

### 7.2 · El tope de 64 KiB, ahora por lote — `LIMITES_LOTE`

`MAX_CARACTERES_TEXTO` (12000) sigue existiendo y sigue significando lo mismo: **lo que entra de UN
documento**, recortado por `clipText` antes de agrupar. Lo que faltaba era la suma:

| número | cuánto | por qué |
|---|---|---|
| `maxCaracteresPorDocumento` | 12000 | es `MAX_CARACTERES_TEXTO`, sin cambios |
| `maxCaracteres` | 24000 | la suma de todos los documentos de una llamada |
| `maxDocumentos` | 6 | techo por prudencia |

La cuenta de los 24000: el contrato pone 64 KiB (65536 bytes) para todo el input; un texto en español con
acentos puede pesar hasta ~2 bytes por carácter, así que 24000 caracteres son como mucho ~48000 bytes, más
~3000 del andamiaje del prompt (reglas, formato, encabezado de cada documento). Quedan unos 14000 bytes de
margen. Y está muy por encima de cualquier lote real: el voucher de micro del PM tiene 625 caracteres, así que
entrarían cuarenta si no fuera por el techo de seis.

El techo de seis documentos no es por tamaño: cuanto más largo el lote, más caro sale reintentarlo si la
respuesta viene mal. Con seis ya se bajó de seis llamadas a una, que es el 83% del ahorro posible.

`planBatches` es pura y sincrónica, agrupa en orden y **nunca reordena los archivos**. Un documento que solo
ya llena el lote viaja solo.

### 7.3 · Cada reserva con su archivo, o no sale

El prompt de lote (`buildBatchImportPrompt`) numera y delimita cada documento y pide de vuelta
`{"documentos":[{"documento":1,"items":[…]}]}`. `parseBatchResponse(raw, cantidad)` acepta tres formas, en
orden: la pedida; la plana con el número en cada ítem; y —sólo si hay exactamente una entrada por documento y
**ninguna** trae número— el orden, que es lo único que se puede leer ahí y es lo que el prompt pidió.

**Si la atribución no se puede establecer sin suponer, devuelve `null` y el motor relee los archivos de ese
lote de a uno**, con el prompt de siempre. Cuesta las llamadas que se quería ahorrar, y se paga sin discutir:
una reserva atribuida al archivo equivocado hace que la pantalla de revisión mienta sobre de dónde salió cada
dato, y eso es peor que gastar.

**Un lote con un solo documento usa el prompt de un solo documento**, el de la iteración 2, que ya está
probado de punta a punta con el voucher real. No hay nada que agrupar y no hay razón para pedirle al modelo un
formato más difícil.

### 7.4 · Un archivo que falla no invalida a los demás, tampoco en el lote

La garantía de VAL-41 tenía dos formas de perderse al agrupar, y las dos están cubiertas:

- **Un archivo que falla antes de la llamada** ni entra al lote: su `fileResult` de error ya está armado
  cuando se arma el prompt.
- **La llamada del lote falla entera.** Ahí depende del código, y la decisión está declarada en
  `ERRORES_QUE_SE_REINTENTAN_SUELTOS`:

| código | qué se hace | por qué |
|---|---|---|
| `prompt_too_large`, `invalid_json`, `empty_completion`, `desconocido` | se relee archivo por archivo | el problema puede ser del lote (largo, respuesta cortada), y suelto cada uno tiene chance |
| cualquier otro (`rate_limited`, `not_granted`, …) | el error se reparte a todos los archivos del lote | es de la vista o de la cuota: repetirlo seis veces no lo arregla, lo empeora |

### 7.5 · Qué pasa con el progreso por fila, y qué se pierde

Era la razón válida por la que se llamaba una vez por archivo, así que no se tira: `interpretFiles` acepta
`opts.onProgress(evento)`. **Es la única función impura del motor y el motivo tiene nombre**: sin ella la
persona mira una pantalla quieta mientras se leen cuatro documentos. Un `onProgress` que lanza no puede
romper nada: la llamada está envuelta y el error se descarta.

Cuatro eventos, declarados en `EVENTOS_PROGRESO`, todos con `archivo`:

| evento | cuándo | qué trae |
|---|---|---|
| `preparando` | arranca este archivo | `indice`, `total` |
| `preparado` | ya se sabe cómo se va a leer | `modo`, `paginas`, `caracteres` |
| `leyendo` | salió la llamada que lo incluye | `modo`, `lote` (los nombres de los archivos que comparten la llamada, o `null`) |
| `terminado` | tiene su resultado | `resultado`, el `fileResult` completo |

**Qué se conserva.** La fila de cada archivo recorre sus cuatro estados, una por una: "En cola" → "Leyendo…"
→ "Listo · 2 reservas". La preparación —que es donde vive la parte lenta y visible de un PDF, extraer su capa
de texto— sigue siendo estrictamente por archivo y avisa por archivo. Y `preparado` llega **antes** de la
llamada, así que la fila puede decir "leído del texto del PDF" antes de que el modelo conteste.

**Qué se pierde, dicho de frente.** Dentro de un lote, las filas **dejan de terminar de a una**: los tres
archivos de un lote pasan a "Leyendo…" en el mismo instante y a "Listo" en el mismo instante, porque hay una
sola respuesta. Antes, con tres llamadas en paralelo, la persona veía terminar primero a la más rápida. Es
una pérdida real y no se puede evitar con una sola llamada: el modelo no entrega resultados parciales por
documento a través de `sample.json()`. Lo que sí queda es **quién comparte la llamada** (`evento.lote`), por
si la interfaz quiere decirlo.

Dos consecuencias prácticas para la app:

- **El aviso de "esto está tardando"** (los 7 segundos de `runInterpretation`) sigue funcionando igual, pero
  "Quedarme con lo que ya está listo" queda con menos para ofrecer: en un lote, o están todos o no está
  ninguno. Con archivos que fueron por imágenes, sigue habiendo resultados parciales.
- **La lectura sale más rápida en total** aunque cada fila espere lo mismo: una llamada en vez de cuatro es
  una sola espera de red y un solo turno de cola del modelo.

---

## 5 · Cómo correr las pruebas, y qué NO prueban

```
node app/parts/import-engine.test.js
```

101 casos, sin frameworks, mismo arnés que `packing-engine.test.js` (`test(nombre, fn)`, `assert`, `eq`,
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

Los **32 de la versión 3** cubren VAL-59 y VAL-60. **31 de los 32 fallan contra la versión 2 del motor**
(comprobado corriendo este mismo archivo de pruebas contra una copia del módulo anterior sacada de git: 70
pasaron, 31 fallaron). El único que pasa contra la versión 2 es *"un solo archivo de texto usa el prompt de
siempre, no el de lote"*, y pasa **porque es una guarda de regresión**: la versión 2 siempre usaba ese prompt.
Dos más —*"un pasaje sin vuelos cargados sigue creando su reserva"* y *"un voucher de micro con asiento sigue
siendo una reserva nueva"*— son también guardas: su aserción central (`resultado === "nuevo"`) pasa en las dos
versiones, y contra la versión 2 fallan sólo por el campo `esTarjeta`, que antes no existía. Se dice acá para
no contar como cobertura nueva lo que es una red contra romper lo que ya andaba.

**VAL-59 · la tarjeta de embarque (16 casos).**

- `esTarjetaDeEmbarque` regla por regla: la declaración del modelo manda (y manda también en negativo: un
  documento declarado `ticket` con puerta **no** es tarjeta); la hora de embarque alcanza; la puerta alcanza;
  el perfil sin título ni aerolínea alcanza; **un pasaje con asiento asignado NO alcanza** —es la advertencia
  textual de la sección 7.6 del diseño, y tiene su propia prueba—; y lo que no es un vuelo nunca es una
  tarjeta.
- Que un `docType` inventado por el modelo se descarte, y que el prompt pida dejarlo vacío.
- **Los tres casos**: sin ningún vuelo cargado (`caso:"sin-vuelos"`, `opciones:["crear"]`, precarga con
  número, fecha, ruta, asiento, puerta y embarque); con un vuelo que no coincide (`"un-vuelo"`, las dos
  salidas, **y la comprobación explícita de que ninguna viene marcada como la correcta**); y con varios
  vuelos (`"varios-vuelos"`, todos los del viaje, ordenados por salida, con ruta y fecha, y el que no tiene
  fecha al final).
- Que lo que la tarjeta no trae queda vacío: `terminal`, `end` y `confirmation` vacíos, y la cuenta de once
  campos partida en dos grupos.
- Que una tarjeta sin fecha legible tampoco se convierte en un vuelo.
- Que un match exitoso **sigue sin preguntar nada** y con su patch y su motivo.
- Las dos guardas: un pasaje y un voucher siguen dando `"nuevo"`.

**VAL-60 · un lote, una llamada (16 casos).**

- **Tres PDFs de texto = UNA llamada**, verificado con un espía sobre `callModel` (`espia.llamadas === 1`), no
  por inspección del código. Y `resumen.llamadas`/`resumen.lotes` lo confirman desde el resultado.
- **Cada reserva atribuida a su archivo**: los tres códigos de reserva salen cada uno en su `archivo`, y se
  comprueba además que dentro de cada `fileResult` no haya ninguna reserva de otro archivo.
- El prompt del lote lleva los tres textos enteros, numerados y delimitados, pide el arreglo con
  `"documentos"`, mantiene la regla de no inventar y **no lleva la clave `images`**.
- **El progreso por fila**: cada uno de los tres archivos recorre `preparando → preparado → leyendo →
  terminado`, `preparado` llega con `modo:"texto"` y su cuenta de caracteres **antes** de la llamada, y
  `leyendo` dice con quién comparte la llamada. Y un `onProgress` que lanza no tumba la importación.
- **Un archivo roto entre otros dos no los tumba**: el `.zip` da `tipo-no-soportado`, los otros dos salen en
  **una** llamada y cada uno con su reserva.
- Una foto en la misma carga sigue yendo sola (dos llamadas: una del lote de textos, una de la foto).
- Un lote de un solo archivo usa el prompt de siempre.
- **Cuando el lote no sale bien:** una respuesta sin atribución clara se relee archivo por archivo (cuatro
  llamadas, y cada reserva termina en su archivo); `parseBatchResponse` devuelve `null` ante una respuesta
  plana, una mezcla de entradas con y sin número, y algo que no es JSON; un `prompt_too_large` cae a llamadas
  sueltas y **los dos que sí entraban se leen igual**; un `rate_limited` **no** se reintenta (una sola
  llamada) y el error se reparte con su mensaje; y sin `callModel` inyectado los tres degradan a
  `ia-no-disponible` con cero llamadas.
- `planBatches` parte por cantidad y por caracteres, respetando el orden; y cuatro PDFs largos de verdad
  salen en dos llamadas con cada prompt muy por debajo del tope.

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
3. **Que un modelo real conteste el formato de lote.** Todo lo de VAL-60 está probado contra un `callModel`
   simulado que devuelve lo que el prompt pide. **Un simulador replica el contrato, no lo verifica**: lo que
   no sabemos es con qué frecuencia un modelo real devuelve el arreglo con los números de documento bien
   puestos. Si contesta mal seguido, el motor no rompe —relee archivo por archivo y la atribución sigue
   siendo correcta— pero **VAL-60 no ahorra nada y encima gasta una llamada de más**. Cómo comprobarlo, en la
   app publicada: subir tres PDFs con texto a la vez y mirar `resultado.resumen.llamadas` en la consola. Si
   dice 1, el lote funcionó; si dice 4, el modelo no está contestando el formato y hay que ajustar el prompt
   antes de dar VAL-60 por cerrado. Es la medición que decide si esto sirve.
4. **Que un `docType` real venga bien puesto.** Lo mismo: el criterio de `REGLAS_TARJETA` no depende de él
   —las reglas 3 a 5 funcionan igual con `docType:""`— pero si un modelo real declarara `ticket` sobre una
   tarjeta de embarque, la regla 2 la descartaría. Cómo comprobarlo: subir la tarjeta de embarque real del
   PM y mirar `reserva.docType` y `ImportEngine.esTarjetaDeEmbarque(reserva)` en la consola.
5. **Que el tope de 24000 caracteres por lote sea el correcto.** Sale de la aritmética de §7.2, no de una
   medición: no se probó un prompt real de 24000 caracteres contra el límite real de la plataforma. Si algún
   día aparece un `prompt_too_large` en un lote, el motor ya lo maneja (relee de a uno), pero el número hay
   que bajarlo. Es una entrada en `LIMITES_LOTE`.
6. **Que el PDF de Aerolíneas siga sin capa de texto en el teléfono.** Se midió acá con
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
6. **VAL-60, la medición que decide si sirvió:** subir **tres PDFs con texto a la vez**, con un toque, desde
   la pantalla de importar. En la pestaña **Red** tiene que haber **un** pedido al modelo, no tres, y en la
   consola `resumen.llamadas` tiene que decir `1`. Mirar además que cada reserva de la pantalla de revisión
   diga el archivo del que salió, y que sea el correcto: ése es el riesgo nuevo del lote.
7. **VAL-59, con la tarjeta de embarque real del PM**, en tres corridas sobre el mismo viaje:
   (a) sin ningún vuelo cargado, tiene que aparecer el aviso de que no hay vuelo asociado y la propuesta de
   crearlo, con los campos precargados y los vacíos a la vista — y si se descarta, **no tiene que quedar ni
   la reserva ni el documento**;
   (b) con un vuelo cargado que **no** coincide, tienen que aparecer las dos opciones sin ninguna elegida de
   antemano;
   (c) con el vuelo que sí coincide ya cargado, **no tiene que preguntar nada**: la tarjeta se muestra como
   completado en la revisión y se guarda con el botón del lote.
   Lo que hay que mirar en las tres: que en ningún caso aparezca una reserva de vuelo suelta creada sola.
