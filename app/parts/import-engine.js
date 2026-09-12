/* ============================================================
   VALIJA · MOTOR DE IMPORTACIÓN DE DOCUMENTOS
   Bloque A del brief de iteración 2 (docs/briefs/interpretar.md):
   VAL-40 (PDF), VAL-41 (fotos, varios archivos) y VAL-42
   (reconocer un vuelo ya cargado).

   JavaScript puro, en el mismo estilo que packing-engine.js: reglas
   declaradas como datos, funciones puras, sin tocar el DOM. Las dos
   únicas excepciones documentadas son `renderPdfPagesToImages`
   (necesita canvas) y `extractPdfText` (necesita pdf.js, que se le
   inyecta): las dos están aisladas a propósito.

   ============================================================
   PRIMERO TEXTO, IMÁGENES COMO ÚLTIMO RECURSO   (versión 2)
   ============================================================

   La versión 1 convertía TODO a imagen antes de mandarlo al modelo.
   Eso se rompió entero en el teléfono del PM: los tres archivos
   reales fallaron con `images_unavailable`, el código que la
   plataforma devuelve cuando la vista no puede mandar imágenes. El
   contrato (`sample.d.ts` de artifact-capabilities 0.2.41) dice dos
   cosas que no estábamos usando:

     · `sample.limits()` trae un miembro `images` SÓLO cuando esa
       vista puede mandar imágenes. Es barato y local: no gasta uso
       de la persona ni le pregunta nada.
     · ante `images_unavailable` hay que ocultar "sólo lo que
       depende de imágenes; las llamadas de texto siguen andando".

   Así que el orden es, para un PDF:

     1. Extraer la capa de texto con pdf.js (`page.getTextContent()`,
        todas las páginas en orden). Si el texto alcanza
        (REGLAS_TEXTO_SUFICIENTE), se interpreta COMO TEXTO: sin
        imágenes y sin preguntar `limits()`.
     2. Si no hay capa de texto, recién ahí se renderiza a imagen, y
        sólo si `limits()` reporta `images`. Si no las reporta, error
        propio ("pdf-escaneado-sin-imagenes"), nunca una llamada al
        modelo que ya sabemos que va a ser rechazada.

   Y para una foto o una captura no hay alternativa: necesita visión.
   Sin `images` en `limits()` el archivo falla con
   "imagenes-no-disponibles" sin intentar la llamada.

   El camino de texto no es sólo un plan B: es MEJOR que la imagen
   aunque la vista las acepte. Es más barato, más rápido y más exacto,
   porque un texto extraído no tiene errores de lectura.

   `limits` llega inyectado igual que `callModel` (`opts.limits`): el
   motor nunca llama a `claude.use`. Y se lee UNA sola vez por corrida
   de `interpretFiles`, la primera vez que hace falta — nunca antes.

   ============================================================
   QUÉ HACE
   ============================================================

   1. Recibe archivos (fotos PNG/JPG o PDFs, mezclados) y para cada
      uno decide CÓMO mandárselo a la capa inteligente: como texto
      (PDF con capa de texto) o como imágenes (foto, captura, PDF
      escaneado). Ver arriba.

   2. Llama a una función `callModel` que la app inyecta (igual que
      `ask` en packing-engine.js): este módulo no sabe cómo se habla
      con el modelo, sólo arma el prompt y valida la respuesta.

   3. Devuelve, por archivo, qué se reconoció o por qué falló
      (VAL-41). Un archivo que falla no invalida a los demás: cada
      `interpretFile` atrapa sus propios errores y jamás rechaza la
      promesa que expone `interpretFiles`.

   4. Dada una reserva de tipo vuelo ya interpretada y las reservas
      que el viaje ya tiene, decide si es un vuelo nuevo, el mismo
      vuelo (con los campos que hay que completar) o si hay más de
      un candidato y hace falta preguntar (VAL-42). Nunca decide en
      el caso ambiguo: devuelve los candidatos.

   5. Le dice a la app, ANTES de dibujar la pantalla, si esta vista
      acepta imágenes: `getViewCapabilities(limits)`. Con eso la
      interfaz no ofrece "Sacar foto" ni "Galería" donde no pueden
      funcionar.

   ============================================================
   MODELO DE DATOS DE UNA RESERVA INTERPRETADA
   ============================================================

   Mismos nombres de campo que ya usa `Store.saveItem` en valija.html
   (ver `sheetImport`), más `boardingTime`, que hoy no tiene lugar en
   el modelo de la app. Ver la nota de integración al final del
   archivo y en docs/design/import-engine.md.

   {
     type: "flight|stay|car|transfer|act|note",
     title: "", start: "", end: "", from: "", to: "",
     provider: "", flightNumber: "", confirmation: "", seat: "",
     terminal: "", gate: "", boardingTime: "",
     address: "", phone: "", cost: "", currency: "", notes: "",
     archivo: "voucher.pdf"       // de qué archivo salió, para VAL-41
   }

   Un campo que el modelo no pudo leer con certeza queda en "", nunca
   se inventa (regla del brief, y del prompt en `buildImportPrompt`).

   ============================================================
   RESULTADO DE interpretFiles(archivos, opts)
   ============================================================

   {
     archivos: [
       { archivo:"voucher.pdf", estado:"ok|vacio|error",
         reservas:[...], error:null|{codigo,mensaje},
         paginas:3|null, modo:"texto|imagenes"|null, caracteres:625|null }
     ],
     reservas: [...],           // todas las reservas de todos los archivos, juntas
     resumen: { total, ok, vacios, errores, reservas, porTexto, porImagenes }
   }

   Tres estados por archivo, no un booleano: "ok" (encontró algo),
   "vacio" (se leyó bien pero no había ninguna reserva reconocible) y
   "error" (no se pudo procesar). Un archivo vacío no es un error: es
   una foto borrosa o un documento que no es una reserva, y no hace
   falta alarmar por eso.

   `modo` dice por qué camino se leyó cada archivo. Sirve para la
   interfaz ("leído del texto del PDF") y para diagnosticar.

   ============================================================
   RESULTADO DE matchFlightReservation(candidato, existentes)
   ============================================================

   Tres resultados posibles, nunca una decisión adivinada:

     { resultado:"nuevo",   candidato, motivo }
     { resultado:"mismo",   candidato, existente, patch, motivo }
     { resultado:"ambiguo", candidato, candidatos:[...], motivo }

   El criterio es número de vuelo y fecha (brief VAL-42), comparados
   de forma tolerante: "JA 3040" y "3040" son el mismo número si las
   letras no contradicen, y la fecha se compara sólo por el día.

   `patch` en el caso "mismo" trae sólo los campos de
   CAMPOS_COMPLETABLES que la reserva ya cargada tiene vacíos y la
   tarjeta de embarque sí trae: nunca pisa un dato que la persona ya
   tenía cargado.
   ============================================================ */

(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else if (root) root.ImportEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
"use strict";

var VERSION = 2;

/** Tipos de reserva que la app conoce (mismas claves que TYPES en valija.html). */
var RESERVATION_TYPES = ["flight", "stay", "car", "transfer", "act", "note"];

/** Campos de texto de una reserva interpretada. Todos son string, "" si no se supo. */
var STRING_FIELDS = [
  "title", "start", "end", "from", "to", "provider", "flightNumber",
  "confirmation", "seat", "terminal", "gate", "boardingTime",
  "address", "phone", "cost", "currency", "notes"
];

/**
 * Campos que una tarjeta de embarque puede completar en un vuelo ya
 * cargado (VAL-42). Declarados como datos: agregar un campo completable
 * es agregar una entrada acá, no tocar la lógica del patch.
 */
var CAMPOS_COMPLETABLES = ["gate", "terminal", "seat", "boardingTime"];

/** Versión fija de pdf.js, cargada desde cdnjs por la app (ver nota de integración). */
var PDFJS_VERSION = "3.11.174";
var PDFJS_CDN_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/";

/**
 * CUÁNDO LA CAPA DE TEXTO DE UN PDF ALCANZA. Declarado como datos: cambiar
 * el criterio es cambiar un número acá, no tocar la lógica.
 *
 * Dos niveles, y el nombre dice cuándo se usa cada uno:
 *
 *  · "normal" — el camino de siempre. Si el texto extraído lo pasa, se
 *    interpreta como texto y no se mira `limits()` ni se renderiza nada.
 *
 *  · "ultimo-recurso" — sólo cuando la vista NO acepta imágenes. Ahí la
 *    única alternativa a mandar un texto flaco es no leer el archivo:
 *    más vale intentarlo que fallar seguro.
 *
 * De dónde salen los números del nivel "normal":
 *
 *   minCaracteres 120 — el voucher de micro real que probó el PM
 *     (app/pruebas/fixtures/voucher-lobos-bus.txt) tiene 625 caracteres
 *     con TODO lo que hace falta: código, nombre, origen, destino y los
 *     dos horarios. Una tarjeta de embarque mínima —nombre, vuelo,
 *     fecha, hora, asiento, puerta, código— no baja de ~90. Un pie de
 *     página tipo "Página 1 de 2 · generado por SistemaX" no llega a 45.
 *     120 deja el pie de página afuera con margen y no roza al
 *     comprobante más escueto que sabemos que existe.
 *
 *   minPalabras 15 — es la defensa contra el caso que avisó el PM: un
 *     PDF escaneado que igual trae tres palabras sueltas de un pie de
 *     página. Contar palabras y no sólo caracteres evita que una tira
 *     larga de un solo token (una URL de 200 caracteres al pie) pase.
 *
 *   minDigitos 4 — toda reserva trae al menos una fecha o un código con
 *     números. Un pie de página de puro texto legal no.
 *
 * Los tres tienen que cumplirse a la vez. Si el texto NO alcanza, no se
 * pierde nada: se cae al camino de imágenes, que es lo que hacía la
 * versión 1 para todos los PDFs.
 */
var REGLAS_TEXTO_SUFICIENTE = {
  normal:           { minCaracteres: 120, minPalabras: 15, minDigitos: 4 },
  "ultimo-recurso": { minCaracteres: 40,  minPalabras: 6,  minDigitos: 2 }
};

/**
 * Cuánto texto del comprobante entra en el prompt. El contrato pone el
 * tope en 64 KiB para TODO el input; se recorta muy por debajo, como
 * recomienda el propio contrato ("slice page text to a few thousand
 * characters rather than measuring"). 12000 caracteres son varias
 * páginas de voucher: ningún comprobante real se acerca.
 */
var MAX_CARACTERES_TEXTO = 12000;

/* ============================================================
   UTILIDADES
   ============================================================ */

function norm(s) { return String(s == null ? "" : s).trim(); }

/** Crea un error interno marcado, para que `interpretFile` lo reconozca y no lo confunda con uno inesperado. */
function ImportError(codigo, mensaje) {
  var e = new Error(mensaje);
  e.__importError = true;
  e.info = { codigo: codigo, mensaje: mensaje };
  return e;
}

function errorInfo(codigo, mensaje) {
  return { codigo: codigo || "desconocido", mensaje: mensaje || "No se pudo interpretar el archivo." };
}

/**
 * El resultado de un archivo. `extra` trae de qué forma se leyó, para que la
 * interfaz pueda decir "leído del texto del PDF" y para diagnosticar.
 * @param {{paginas?:number|null, modo?:string|null, caracteres?:number|null}} [extra]
 */
function fileResult(archivo, estado, reservas, error, extra) {
  extra = extra || {};
  return {
    archivo: archivo,
    estado: estado,
    reservas: reservas || [],
    error: error || null,
    paginas: extra.paginas == null ? null : extra.paginas,
    modo: extra.modo || null,
    caracteres: extra.caracteres == null ? null : extra.caracteres
  };
}

/* ============================================================
   ¿ALCANZA LA CAPA DE TEXTO?
   Puro y sincrónico: recibe un string, devuelve números y un sí/no
   contra REGLAS_TEXTO_SUFICIENTE. No sabe de PDFs ni de pdf.js.
   ============================================================ */

/**
 * @param {string} texto
 * @returns {{caracteres:number, palabras:number, digitos:number}}
 */
function measureText(texto) {
  var t = String(texto == null ? "" : texto).trim();
  var palabras = t ? t.split(/\s+/).filter(function (w) { return w.length >= 2; }) : [];
  var digitos = t.replace(/[^0-9]/g, "");
  return { caracteres: t.length, palabras: palabras.length, digitos: digitos.length };
}

/**
 * ¿El texto extraído alcanza para interpretarlo sin imágenes?
 * @param {string} texto
 * @param {"normal"|"ultimo-recurso"} [nivel]
 * @returns {{suficiente:boolean, nivel:string, regla:Object, medida:Object, motivo:string}}
 */
function evaluateText(texto, nivel) {
  nivel = REGLAS_TEXTO_SUFICIENTE[nivel] ? nivel : "normal";
  var regla = REGLAS_TEXTO_SUFICIENTE[nivel];
  var m = measureText(texto);
  var faltas = [];
  if (m.caracteres < regla.minCaracteres) faltas.push(m.caracteres + " caracteres (hacen falta " + regla.minCaracteres + ")");
  if (m.palabras < regla.minPalabras) faltas.push(m.palabras + " palabras (hacen falta " + regla.minPalabras + ")");
  if (m.digitos < regla.minDigitos) faltas.push(m.digitos + " dígitos (hacen falta " + regla.minDigitos + ")");
  return {
    suficiente: faltas.length === 0,
    nivel: nivel,
    regla: regla,
    medida: m,
    motivo: faltas.length
      ? "La capa de texto del PDF es demasiado pobre para ser una reserva: " + faltas.join(", ") + "."
      : "La capa de texto del PDF alcanza: " + m.caracteres + " caracteres, " + m.palabras + " palabras, " + m.digitos + " dígitos."
  };
}

/** Recorta el texto para el prompt, avisando en el propio texto si se recortó. */
function clipText(texto, max) {
  var t = String(texto == null ? "" : texto);
  max = max || MAX_CARACTERES_TEXTO;
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n[… texto recortado: el documento sigue, pero no entra entero en una consulta]";
}

/* ============================================================
   QUÉ PUEDE ESTA VISTA — `sample.limits()`, INYECTADO
   El motor NUNCA llama a `claude.use`: la app le pasa `limits` igual
   que le pasa `callModel`. Estas funciones jamás rechazan.
   ============================================================ */

/** Texto para la interfaz cuando la vista no puede leer imágenes. */
var MENSAJE_SIN_IMAGENES = "Esta vista no puede leer imágenes: subí el PDF del comprobante y se lee su texto.";

/**
 * Traduce lo que devolvió `sample.limits()` a lo que este motor necesita.
 * `aceptaImagenes` tiene TRES valores a propósito:
 *   true  — `limits()` respondió y trae `images`.
 *   false — `limits()` respondió sin `images`, o rechazó (el contrato dice
 *           "treat a rejection like an absent images").
 *   null  — la app no inyectó `limits`. No sabemos, y no vamos a inventar:
 *           se sigue como antes (se intenta con imágenes) y si el modelo
 *           rechaza, se muestra el mensaje de `images_unavailable`. Así una
 *           integración vieja no queda peor que antes de este cambio.
 * @param {Object|null} crudo lo que resolvió limits()
 * @param {"ausente"|"respondio"|"rechazo"} origen
 */
function describeLimits(crudo, origen) {
  var img = (crudo && typeof crudo === "object" && crudo.images) || null;
  var acepta = origen === "respondio" ? !!img : (origen === "rechazo" ? false : null);
  return {
    origen: origen,
    aceptaImagenes: acepta,
    maxImagenes: (img && Number(img.maxCount)) || 0,
    maxBytesImagen: (img && Number(img.maxInputBytes)) || 0,
    tiposImagen: (img && Array.isArray(img.mediaTypes)) ? img.mediaTypes.slice() : [],
    maxPromptBytes: (crudo && Number(crudo.maxPromptBytes)) || 0
  };
}

/**
 * Lee `limits` (la función que la app inyecta) una sola vez. Nunca rechaza.
 * @param {Function|Object|null} limits async () => SampleLimits, o el objeto ya resuelto
 * @returns {Promise<Object>} ver describeLimits
 */
function readViewLimits(limits) {
  if (limits == null) return Promise.resolve(describeLimits(null, "ausente"));
  return Promise.resolve()
    .then(function () { return typeof limits === "function" ? limits() : limits; })
    .then(function (crudo) {
      if (crudo == null) return describeLimits(null, "rechazo");
      return describeLimits(crudo, "respondio");
    })
    .catch(function () { return describeLimits(null, "rechazo"); });
}

/**
 * LO QUE LA APP PREGUNTA ANTES DE DIBUJAR LA PANTALLA. Nunca rechaza.
 * Con esto la interfaz decide si ofrece "Sacar foto" y "Galería", y qué
 * poner en el `accept` del input de archivos.
 *
 * @param {Function|Object|null} limits el `sample.limits` de la plataforma
 * @returns {Promise<{aceptaImagenes:boolean, certeza:"si"|"no"|"desconocida",
 *   puedeFoto:boolean, puedePdfConTexto:boolean, puedePdfEscaneado:boolean,
 *   maxImagenes:number, maxBytesImagen:number, tiposImagen:string[],
 *   accept:string, nota:string}>}
 */
function getViewCapabilities(limits) {
  return readViewLimits(limits).then(function (l) {
    // Para la interfaz, "no sé" se trata como "sí, mostralo": es el
    // comportamiento de antes de este cambio, y si falla el archivo cae con
    // el mensaje de images_unavailable, no con una pantalla rota.
    var acepta = l.aceptaImagenes !== false;
    var tipos = l.tiposImagen.length ? l.tiposImagen : ["image/jpeg", "image/png", "image/webp"];
    return {
      aceptaImagenes: acepta,
      certeza: l.aceptaImagenes === true ? "si" : (l.aceptaImagenes === false ? "no" : "desconocida"),
      puedeFoto: acepta,
      puedePdfConTexto: true,          // el texto no depende de imágenes: siempre se puede
      puedePdfEscaneado: acepta,
      maxImagenes: l.maxImagenes,
      maxBytesImagen: l.maxBytesImagen,
      tiposImagen: acepta ? tipos : [],
      accept: acepta ? tipos.concat(["application/pdf"]).join(",") : "application/pdf",
      nota: acepta ? "" : MENSAJE_SIN_IMAGENES
    };
  });
}

/**
 * Una corrida de `interpretFiles`. Existe por una razón nombrada, y es la
 * única cosa con estado del módulo: `limits()` se consulta UNA vez por
 * corrida, y sólo la primera vez que un archivo realmente necesita saberlo.
 * Un PDF con capa de texto nunca la dispara.
 */
function newSession(opts) {
  return {
    opts: opts || {},
    _limits: null,
    limits: function () {
      if (!this._limits) this._limits = readViewLimits((opts || {}).limits);
      return this._limits;
    }
  };
}

/* ============================================================
   QUÉ TIPO DE ARCHIVO ES
   ============================================================ */

/**
 * @param {{name?:string, mimeType?:string, type?:string}} file
 * @returns {"pdf"|"imagen"|"desconocido"}
 */
function fileKind(file) {
  var mime = String((file && (file.mimeType || file.type)) || "").toLowerCase();
  var name = String((file && file.name) || "").toLowerCase();
  if (mime === "application/pdf" || /\.pdf$/.test(name)) return "pdf";
  if (mime.indexOf("image/") === 0 || /\.(png|jpe?g|jpg|heic|heif|webp)$/.test(name)) return "imagen";
  return "desconocido";
}

/* ============================================================
   RENDER DE PDF A IMÁGENES — VAL-40
   Única función del módulo que toca el DOM. Todo lo demás en este
   archivo se puede probar con `node`.
   ============================================================ */

/**
 * Abre el PDF con pdf.js. Primero intenta con el Web Worker, que es el
 * camino rápido. Si instanciarlo falla —típico dentro de un iframe con
 * sandbox restringido, que suele bloquear un Worker de otro origen—
 * reintenta en el hilo principal (`disableWorker:true`, la opción que
 * pdf.js expone para ese caso). La caída es automática y silenciosa: la
 * persona ya está mirando una pantalla de progreso, no un error.
 *
 * pdf.js puede fallar tanto lanzando de forma síncrona al pedir el
 * documento como rechazando la promesa una vez que arrancó el worker;
 * se cubren los dos casos.
 *
 * @param {Object} pdfjsLib
 * @param {ArrayBuffer} buf
 * @returns {Promise<Object>} el documento de pdf.js
 */
function openPdfDocument(pdfjsLib, buf) {
  function intentar(extraParams) {
    var task;
    try {
      task = pdfjsLib.getDocument(Object.assign({ data: buf }, extraParams || {}));
    } catch (e) {
      return Promise.reject(e);
    }
    return task.promise;
  }
  return intentar().catch(function () {
    return intentar({ disableWorker: true });
  });
}

/**
 * Renderiza cada página de un PDF a una imagen, con pdf.js. Corre sólo
 * en el navegador: usa document.createElement("canvas") y su contexto 2D.
 *
 * pdf.js NO se importa desde acá — este módulo no agrega dependencias.
 * Se recibe ya cargado (`opts.pdfjsLib`, o `window.pdfjsLib` si la app
 * ya lo cargó globalmente con un <script> a la versión fija de cdnjs,
 * ver PDFJS_VERSION y docs/design/import-engine.md). Así el resto del
 * módulo se puede probar sin navegador, inyectando una función propia
 * en lugar de esta.
 *
 * Un PDF escaneado sin texto seleccionable se renderiza igual: pdf.js
 * dibuja la página como imagen sin importar si tiene texto debajo.
 *
 * @param {Blob} pdfBlob
 * @param {Object} [opts]
 * @param {Object} [opts.pdfjsLib] librería pdf.js ya cargada
 * @param {number} [opts.scale]    resolución del render (2 por defecto)
 * @param {string} [opts.mimeType] tipo de imagen de salida ("image/png" por defecto)
 * @returns {Promise<Blob[]>} una imagen por página, en el orden del PDF
 */
function renderPdfPagesToImages(pdfBlob, opts) {
  opts = opts || {};
  var pdfjsLib = opts.pdfjsLib || (typeof globalThis !== "undefined" && globalThis.pdfjsLib);
  if (!pdfjsLib) {
    return Promise.reject(new Error("pdfjs-no-disponible: cargá pdf.js (ver PDFJS_VERSION) antes de llamar a esta función."));
  }
  if (typeof document === "undefined") {
    return Promise.reject(new Error("renderPdfPagesToImages necesita un navegador: usa document y canvas."));
  }
  var scale = opts.scale || 2;
  var mimeType = opts.mimeType || "image/png";

  return pdfBlob.arrayBuffer()
    .then(function (buf) { return openPdfDocument(pdfjsLib, buf); })
    .then(function (pdf) {
      var paginas = [];
      for (var n = 1; n <= pdf.numPages; n++) paginas.push(n);
      // Secuencial, no en paralelo: varias páginas grandes al mismo tiempo
      // multiplican la memoria de canvas en un teléfono.
      return paginas.reduce(function (chain, n) {
        return chain.then(function (acc) {
          return pdf.getPage(n).then(function (page) {
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            var ctx = canvas.getContext("2d");
            return page.render({ canvasContext: ctx, viewport: viewport }).promise
              .then(function () {
                return new Promise(function (resolve) { canvas.toBlob(resolve, mimeType); });
              })
              .then(function (blob) { if (blob) acc.push(blob); return acc; });
          });
        });
      }, Promise.resolve([]));
    });
}

/* ============================================================
   LA CAPA DE TEXTO DE UN PDF — el camino principal desde la versión 2
   No toca el DOM (no hay canvas acá): sólo necesita pdf.js, que se
   recibe inyectado. Se puede probar con `node` y un pdf.js falso.
   ============================================================ */

/**
 * Pasa un `TextContent` de pdf.js a un string.
 *
 * FORMA DEL CONTRATO DE pdf.js (no de la plataforma Claude): `getTextContent()`
 * resuelve `{ items: [{ str, hasEOL, ... }], styles }`. Se lee de forma
 * defensiva —`items` que no sea array, ítems sin `str`, ítems sin `hasEOL`—
 * porque esa parte del contrato NO se pudo verificar en este entorno: el CDN
 * de pdf.js está bloqueado acá (ver la nota de integración al final del
 * archivo y docs/design/import-engine.md).
 *
 * @param {Object} tc
 * @returns {string}
 */
function textContentToString(tc) {
  if (!tc || !Array.isArray(tc.items)) return "";
  var out = "";
  tc.items.forEach(function (it) {
    if (!it) return;
    var frag = typeof it.str === "string" ? it.str : "";
    out += frag;
    if (it.hasEOL) out += "\n";
    else if (frag && !/\s$/.test(frag)) out += " ";
  });
  return out;
}

/** Deja el texto de un PDF en algo legible: sin espacios repetidos ni líneas en blanco de más. */
function tidyPdfText(texto) {
  return String(texto == null ? "" : texto)
    .replace(/\r/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extrae la capa de texto de un PDF, todas las páginas en orden, con pdf.js.
 *
 * pdf.js NO se importa desde acá — este módulo no agrega dependencias. Se
 * recibe ya cargado (`opts.pdfjsLib`, o `window.pdfjsLib` si la app lo cargó
 * globalmente). Usa el mismo `openPdfDocument` que el render, así que hereda
 * la caída automática al modo sin Worker.
 *
 * Un PDF escaneado devuelve `texto:""` y `paginas` con su cantidad real de
 * páginas: no es un error, es el dato de que hay que ir por imágenes.
 *
 * @param {Blob} pdfBlob
 * @param {Object} [opts]
 * @param {Object} [opts.pdfjsLib]
 * @returns {Promise<{texto:string, paginas:number, porPagina:string[]}>}
 */
function extractPdfText(pdfBlob, opts) {
  opts = opts || {};
  var pdfjsLib = opts.pdfjsLib || (typeof globalThis !== "undefined" && globalThis.pdfjsLib);
  if (!pdfjsLib) {
    return Promise.reject(new Error("pdfjs-no-disponible: cargá pdf.js (ver PDFJS_VERSION) antes de llamar a esta función."));
  }
  return Promise.resolve()
    .then(function () { return pdfBlob.arrayBuffer(); })
    .then(function (buf) { return openPdfDocument(pdfjsLib, buf); })
    .then(function (pdf) {
      var numeros = [];
      for (var n = 1; n <= pdf.numPages; n++) numeros.push(n);
      // Secuencial, igual que el render: en un teléfono no conviene abrir
      // todas las páginas a la vez.
      return numeros.reduce(function (chain, n) {
        return chain.then(function (acc) {
          return Promise.resolve(pdf.getPage(n))
            .then(function (page) { return page.getTextContent(); })
            .then(function (tc) { acc.push(tidyPdfText(textContentToString(tc))); return acc; });
        });
      }, Promise.resolve([])).then(function (porPagina) {
        if (pdf && typeof pdf.destroy === "function") { try { pdf.destroy(); } catch (e) { /* liberar memoria es mejor esfuerzo */ } }
        return {
          texto: tidyPdfText(porPagina.join("\n\n")),
          paginas: porPagina.length,
          porPagina: porPagina
        };
      });
    });
}

/* ============================================================
   EL PROMPT DE INTERPRETACIÓN
   ============================================================ */

/**
 * Las reglas del prompt, declaradas como datos. Agregar una regla es agregar
 * una entrada, no escribir código. `comunes` van siempre; `texto` e
 * `imagenes` según por dónde se leyó el archivo.
 */
var REGLAS_PROMPT = {
  comunes: [
    "Un objeto por reserva. Ida y vuelta son DOS viajes separados, cada uno con su propio número.",
    "Usá 24 horas y el formato YYYY-MM-DDTHH:mm. Las fechas pueden venir como D/M/AAAA, con el día primero: \"13/9/2026\" es el 13 de septiembre de 2026. Si el año no figura, deducilo del contexto del viaje de arriba.",
    "Si un dato no aparece con claridad en el documento, dejá \"\" en ese campo. Es preferible un campo vacío: NUNCA inventes códigos de vuelo, códigos de reserva, horarios, direcciones ni montos que no estén escritos ahí.",
    "Para alojamiento, \"start\" es el check-in y \"end\" el check-out.",
    "Un micro, colectivo, tren, ferry, combi o traslado por tierra es type \"transfer\"; un avión es \"flight\". En un transfer, \"from\" y \"to\" son el lugar de salida y el de llegada tal como están escritos, sin códigos IATA.",
    "\"boardingTime\" es la hora de embarque impresa en una tarjeta de embarque, distinta de la hora de salida. Si el documento no es una tarjeta de embarque, dejalo vacío.",
    "Si no reconocés ninguna reserva en el documento, devolvé {\"items\":[]}. Es preferible eso a inventar una.",
    "Nada de comentarios ni texto fuera del JSON."
  ],
  texto: [
    "El texto de arriba es la capa de texto del PDF, tal como está guardada: puede venir con las columnas mezcladas, con espacios de más o con una etiqueta pegada a su valor. Interpretá lo que dice; no completes lo que no está.",
    "Si aparecen dos fechas con hora, una después de la otra, lo habitual es que la primera sea la salida y la segunda la llegada. Si no podés distinguirlas con seguridad, dejá \"end\" vacío.",
    "Las condiciones, avisos legales y textos de pie de página no son datos de la reserva: ignoralos."
  ],
  imagenes: [
    "Leé todo lo que esté impreso en la imagen, incluidos los recuadros chicos y los códigos al pie.",
    "Si una parte de la imagen está borrosa o cortada, dejá vacíos los campos que dependían de esa parte en vez de adivinarlos."
  ]
};

/** El JSON que se le pide al modelo. Es el mismo, se lea por texto o por imagen. */
var FORMATO_JSON_PROMPT = [
  "Devolvé este JSON exacto:",
  '{"items":[{',
  '"type":"flight|stay|car|transfer|act|note",',
  '"title":"texto corto y humano, ej: Buenos Aires → Madrid",',
  '"start":"YYYY-MM-DDTHH:mm o vacío",',
  '"end":"YYYY-MM-DDTHH:mm o vacío",',
  '"from":"IATA de 3 letras si es vuelo, si no ciudad o lugar",',
  '"to":"idem",',
  '"provider":"aerolínea, hotel, plataforma, empresa de micro o rentadora",',
  '"flightNumber":"","confirmation":"código de reserva","seat":"","terminal":"","gate":"",',
  '"boardingTime":"HH:mm o vacío",',
  '"address":"","phone":"","cost":"","currency":"","notes":""',
  "}]}"
];

/**
 * Arma el prompt para un archivo, según cómo se lo va a mandar.
 *
 * Mejora el prompt de `sheetImport` en valija.html: agrega `boardingTime`,
 * deja explícito que varias páginas son un mismo comprobante y, desde la
 * versión 2, tiene un camino de TEXTO —el principal— además del de imágenes.
 * En los dos casos mantiene la instrucción de dejar un campo vacío antes
 * que inventarlo.
 *
 * @param {Object} [ctx]
 * @param {"texto"|"imagenes"} [ctx.modo] por dónde se leyó el archivo ("imagenes" por defecto)
 * @param {string} [ctx.texto] la capa de texto del PDF, cuando `modo` es "texto"
 * @param {Object} [ctx.trip] {name, destination, startDate, endDate}
 * @param {string} [ctx.now]  fecha ISO, para pruebas determinísticas
 * @param {string} [ctx.archivo] nombre del archivo, sólo para el mensaje
 * @param {number|null} [ctx.paginas] cantidad de páginas/imágenes de este archivo
 * @returns {string}
 */
function buildImportPrompt(ctx) {
  ctx = ctx || {};
  var modo = ctx.modo === "texto" ? "texto" : "imagenes";
  var trip = ctx.trip || {};
  var hoy = ctx.now ? String(ctx.now).slice(0, 10) : new Date().toISOString().slice(0, 10);
  var paginas = ctx.paginas;
  var nombreArchivo = ctx.archivo ? " (\"" + ctx.archivo + "\")" : "";

  var contexto = "El viaje se llama \"" + (trip.name || "") + "\"" +
    (trip.destination ? ", destino " + trip.destination : "") +
    (trip.startDate ? ", entre " + trip.startDate + " y " + (trip.endDate || "?") : "") +
    ". Hoy es " + hoy + ".";

  var encabezado, cuerpo;

  if (modo === "texto") {
    encabezado = "Extraés datos de reservas de viaje a partir del TEXTO de un comprobante y devolvés SOLO JSON, sin texto alrededor.";
    cuerpo = [
      "Abajo está el texto de un comprobante de viaje" + nombreArchivo +
        (paginas && paginas > 1 ? ", de " + paginas + " páginas, en orden" : "") +
        ": puede ser un pasaje, un voucher, una tarjeta de embarque, una reserva de hotel o un contrato de alquiler. Puede describir una reserva o varias.",
      "",
      "--- COMIENZA EL COMPROBANTE ---",
      String(ctx.texto == null ? "" : ctx.texto),
      "--- TERMINA EL COMPROBANTE ---"
    ];
  } else {
    encabezado = "Extraés datos de reservas de viaje a partir de imágenes y devolvés SOLO JSON, sin texto alrededor.";
    cuerpo = [(paginas && paginas > 1)
      ? "Las " + paginas + " imágenes adjuntas son las páginas, en orden, de un mismo comprobante" + nombreArchivo +
        ". Pueden describir una reserva o varias (por ejemplo ida y vuelta): leelas todas juntas antes de decidir cuántas hay."
      : "La imagen adjunta" + nombreArchivo + " es un comprobante de viaje: tarjeta de embarque, voucher de hotel, contrato de auto, o la captura de un mail de confirmación."];
  }

  var reglas = REGLAS_PROMPT.comunes.concat(REGLAS_PROMPT[modo] || []);
  var reglasNumeradas = reglas.map(function (r, i) { return (i + 1) + ". " + r; });

  return [encabezado, ""]
    .concat(cuerpo)
    .concat(["", "Contexto: " + contexto, ""])
    .concat(FORMATO_JSON_PROMPT)
    .concat(["", "Reglas que no se rompen:"])
    .concat(reglasNumeradas)
    .join("\n");
}

/* ============================================================
   VALIDAR LA RESPUESTA DEL MODELO
   Nunca confía: una respuesta rota, sin JSON, o con basura adentro
   se convierte en una lista vacía, no en una excepción.
   ============================================================ */

/**
 * @param {*} x un elemento de `items` en la respuesta cruda
 * @returns {Object|null} la reserva saneada, o null si no sirve
 */
function sanitizeReservation(x) {
  if (!x || typeof x !== "object") return null;
  var out = { type: RESERVATION_TYPES.indexOf(x.type) >= 0 ? x.type : "note" };
  STRING_FIELDS.forEach(function (f) {
    out[f] = typeof x[f] === "string" ? x[f].trim() : "";
  });
  // Sin título ni proveedor no hay nada que mostrarle a la persona para revisar
  // — EXCEPTO una tarjeta de embarque (VAL-42): ahí el título lo termina
  // aportando el vuelo ya cargado que se va a completar, no la tarjeta. El
  // estado 07B del diseño ("el disparador más frecuente") es justamente una
  // tarjeta sin aerolínea ni ruta legibles, sólo asiento y fecha. Alcanza con
  // algún dato que sirva para identificar o completar un vuelo: número de
  // vuelo, fecha de salida, asiento, puerta o terminal. Sin ninguno de esos
  // tampoco hay nada que mostrar, y se descarta igual.
  if (!out.title && !out.provider) {
    if (out.type !== "flight") return null;
    var tieneDatoDeVuelo = out.flightNumber || out.start || out.seat || out.gate || out.terminal;
    if (!tieneDatoDeVuelo) return null;
  }
  return out;
}

/**
 * @param {*} raw lo que devolvió `callModel`: objeto ya parseado o un string con JSON
 * @returns {Array<Object>} reservas saneadas; vacío si la respuesta es basura
 */
function parseImportResponse(raw) {
  var data = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return []; }
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) return [];
  var out = [];
  data.items.forEach(function (x) {
    var r = sanitizeReservation(x);
    if (r) out.push(r);
  });
  return out;
}

/* ============================================================
   ERRORES DEL MODELO, EN MENSAJES HUMANOS
   Tabla declarativa: agregar un código conocido es agregar una
   entrada acá, igual que sheetImport en valija.html.
   ============================================================ */

var MODEL_ERROR_MESSAGES = {
  not_granted: "La lectura automática no está habilitada en esta vista.",
  rate_limited: "Demasiados pedidos seguidos. Esperá un momento y probá de nuevo.",
  images_unavailable: MENSAJE_SIN_IMAGENES,
  image_rejected: "No pude leer esa imagen. Probá con otra foto, con más luz o sin reflejos.",
  prompt_too_large: "El documento es demasiado largo para leerlo de una vez. Probá con las páginas que tienen la reserva.",
  invalid_json: "La respuesta vino incompleta. Probá de nuevo, o cargá la reserva a mano.",
  empty_completion: "No pude sacar nada de ese archivo. Probá con otro, o cargá la reserva a mano."
};

function friendlyModelError(e) {
  var code = e && e.code;
  var mensaje = (code && MODEL_ERROR_MESSAGES[code]) || (e && e.message) || "No pude interpretar el archivo.";
  return { codigo: code || "desconocido", mensaje: String(mensaje) };
}

/**
 * Los errores que pone el propio motor, declarados como datos. Cada uno dice
 * qué pasó y qué hacer, sin pedir disculpas ni culpar a nadie.
 */
var ERRORES_PROPIOS = {
  "tipo-no-soportado": "No reconozco este tipo de archivo. Subí una foto (PNG o JPG) o un PDF.",
  "pdf-no-disponible": "No pude abrir el PDF en este dispositivo. Probá con una foto del comprobante.",
  "pdf-fallo": "No pude leer ese PDF. Probá con una foto del comprobante.",
  "pdf-vacio": "El PDF no tiene páginas legibles.",
  "imagenes-no-disponibles": "Esta vista no puede leer imágenes, así que una foto o una captura no se pueden interpretar acá. Subí el PDF del comprobante: si tiene texto, se lee igual. Si no, cargá la reserva a mano.",
  "pdf-escaneado-sin-imagenes": "Este PDF es un escaneo: no tiene texto adentro para leer, y esta vista no puede leer imágenes. Si tenés el comprobante original en texto (el PDF que manda la empresa, o el mail), probá con ese; si no, cargá la reserva a mano.",
  "ia-no-disponible": "La lectura automática no está disponible ahora mismo. Cargá la reserva a mano."
};

function failWith(codigo) {
  return ImportError(codigo, ERRORES_PROPIOS[codigo] || "No pude interpretar el archivo.");
}

/* ============================================================
   INTERPRETAR UN ARCHIVO — VAL-40 / VAL-41
   Primero texto, imágenes como último recurso (ver la cabecera).
   ============================================================ */

/**
 * Intenta la capa de texto de un PDF. NUNCA rechaza: si no hay función de
 * extracción inyectada, o si se cae, devuelve texto vacío y el camino sigue
 * por imágenes, que es lo que hacía la versión 1 para todos los PDFs.
 * @returns {Promise<{texto:string, paginas:number|null, disponible:boolean, fallo:boolean}>}
 */
function extractTextFor(file, opts) {
  var vacio = { texto: "", paginas: null, disponible: false, fallo: false };
  if (typeof opts.extractPdfText !== "function") return Promise.resolve(vacio);
  return Promise.resolve()
    .then(function () { return opts.extractPdfText(file.blob, { name: file.name }); })
    .then(function (r) {
      if (typeof r === "string") r = { texto: r };
      r = r || {};
      return {
        texto: String(r.texto == null ? "" : r.texto),
        paginas: r.paginas == null ? null : r.paginas,
        disponible: true,
        fallo: false
      };
    })
    .catch(function () {
      return { texto: "", paginas: null, disponible: true, fallo: true };
    });
}

/** Renderiza el PDF a imágenes. Rechaza con un ImportError propio. */
function renderFor(file, opts) {
  if (typeof opts.renderPdfToImages !== "function") return Promise.reject(failWith("pdf-no-disponible"));
  return Promise.resolve()
    .then(function () { return opts.renderPdfToImages(file.blob, { name: file.name }); })
    .catch(function () { throw failWith("pdf-fallo"); })
    .then(function (imagenes) {
      imagenes = (imagenes || []).filter(Boolean);
      if (!imagenes.length) throw failWith("pdf-vacio");
      return { modo: "imagenes", imagenes: imagenes, paginas: imagenes.length, caracteres: null };
    });
}

/**
 * Decide CÓMO se le manda este archivo al modelo, y prepara esa entrada.
 * No llama al modelo. Éste es el corazón del cambio de la versión 2.
 *
 *   foto/captura  → imágenes, y sólo si `limits()` reporta `images`.
 *   PDF           → texto si la capa de texto alcanza; si no, imágenes
 *                   (mismo chequeo de `limits()`); si tampoco, error propio.
 *
 * @returns {Promise<{modo:"texto"|"imagenes", texto?:string, imagenes?:Array,
 *                    paginas:number|null, caracteres:number|null, nivel?:string}>}
 */
function prepareSource(file, opts, sesion) {
  var kind = fileKind(file);

  if (kind === "desconocido") return Promise.reject(failWith("tipo-no-soportado"));

  if (kind === "imagen") {
    // Una foto necesita visión: no hay camino de texto. Si sabemos que la
    // vista no acepta imágenes, se falla acá y no se gasta una llamada que
    // ya sabemos que va a ser rechazada con images_unavailable.
    return sesion.limits().then(function (l) {
      if (l.aceptaImagenes === false) throw failWith("imagenes-no-disponibles");
      return { modo: "imagenes", imagenes: [file.blob], paginas: null, caracteres: null };
    });
  }

  // PDF: primero el texto (VAL-40). Es más barato, más rápido y más exacto
  // que renderizar, y además no depende de que la vista acepte imágenes.
  return extractTextFor(file, opts).then(function (ex) {
    var normal = evaluateText(ex.texto, "normal");
    if (normal.suficiente) {
      return {
        modo: "texto",
        texto: clipText(ex.texto),
        paginas: ex.paginas,
        caracteres: normal.medida.caracteres,
        nivel: "normal"
      };
    }
    // Sin capa de texto (o con tres palabras sueltas de un pie de página):
    // recién ahora miramos si esta vista puede mandar imágenes.
    return sesion.limits().then(function (l) {
      if (l.aceptaImagenes !== false) return renderFor(file, opts);

      // No puede. Antes de darlo por perdido, si algo de texto había, se
      // manda igual: un texto flaco es mejor que no leer nada, y es la
      // única alternativa que queda.
      var ultimo = evaluateText(ex.texto, "ultimo-recurso");
      if (ultimo.suficiente) {
        return {
          modo: "texto",
          texto: clipText(ex.texto),
          paginas: ex.paginas,
          caracteres: ultimo.medida.caracteres,
          nivel: "ultimo-recurso"
        };
      }
      throw failWith("pdf-escaneado-sin-imagenes");
    });
  });
}

/** Llama al modelo con la entrada ya preparada. Nunca rechaza: degrada a un fileResult de error. */
function callModelForSource(fuente, nombre, opts) {
  var extra = { paginas: fuente.paginas, modo: fuente.modo, caracteres: fuente.caracteres };

  if (typeof opts.callModel !== "function") {
    return Promise.resolve(fileResult(nombre, "error", [], errorInfo("ia-no-disponible", ERRORES_PROPIOS["ia-no-disponible"]), extra));
  }

  var prompt = buildImportPrompt({
    trip: opts.trip, now: opts.now, archivo: nombre,
    paginas: fuente.paginas, modo: fuente.modo, texto: fuente.texto
  });

  // El segundo argumento lleva `images` SÓLO en el camino de imágenes: en el
  // de texto la clave ni aparece, así la app no manda `images: undefined` a
  // una vista que no las acepta. `modo` y `archivo` van de yapa, para que la
  // app pueda elegir tier o mostrar progreso.
  var opciones = { modo: fuente.modo, archivo: nombre, paginas: fuente.paginas };
  if (fuente.modo === "imagenes") opciones.images = fuente.imagenes;

  return Promise.resolve()
    .then(function () { return opts.callModel(prompt, opciones); })
    .then(function (raw) {
      var reservas = parseImportResponse(raw).map(function (r) { return Object.assign({}, r, { archivo: nombre }); });
      return fileResult(nombre, reservas.length ? "ok" : "vacio", reservas, null, extra);
    })
    .catch(function (e) {
      return fileResult(nombre, "error", [], friendlyModelError(e), extra);
    });
}

/**
 * Interpreta UN archivo. Nunca rechaza la promesa: cualquier falla
 * (tipo no soportado, PDF escaneado en una vista sin imágenes, modelo
 * caído, respuesta basura) se convierte en un `fileResult` con
 * `estado:"error"`. Así un archivo roto nunca invalida a los demás.
 *
 * @param {{name:string, blob:Blob, mimeType?:string}} file
 * @param {Object} opts
 * @param {Function} opts.callModel        async (prompt, {images?, modo, archivo}) => objeto o string JSON
 * @param {Function} [opts.limits]         async () => sample.limits(); sin esto no se sabe si la vista acepta imágenes y se intenta igual
 * @param {Function} [opts.extractPdfText] async (blob) => {texto, paginas}; sin esto un PDF va derecho a imágenes
 * @param {Function} [opts.renderPdfToImages] async (blob) => Blob[]; sin esto un PDF sin texto falla con dignidad
 * @param {Object}   [opts.trip]           {name, destination, startDate, endDate}
 * @param {string}   [opts.now]            fecha ISO fija, para pruebas
 * @param {Object}   [sesion]              interno: comparte la lectura de `limits` entre archivos
 * @returns {Promise<Object>} fileResult
 */
function interpretFile(file, opts, sesion) {
  opts = opts || {};
  sesion = sesion || newSession(opts);
  var nombre = (file && file.name) || "archivo";
  return prepareSource(file, opts, sesion)
    .then(function (fuente) { return callModelForSource(fuente, nombre, opts); })
    .catch(function (e) {
      if (e && e.__importError) return fileResult(nombre, "error", [], e.info, null);
      return fileResult(nombre, "error", [], errorInfo("desconocido", (e && e.message) || "No pude interpretar el archivo."), null);
    });
}

/**
 * Interpreta varios archivos a la vez (VAL-41), mezclando fotos y PDFs.
 * La promesa se resuelve siempre: cada archivo lleva su propio resultado.
 * `limits()` se consulta como mucho UNA vez por corrida, y sólo si algún
 * archivo necesita imágenes.
 *
 * @param {Array<{name:string, blob:Blob, mimeType?:string}>} files
 * @param {Object} opts ver `interpretFile`
 * @returns {Promise<{archivos:Array, reservas:Array, resumen:Object}>}
 */
function interpretFiles(files, opts) {
  opts = opts || {};
  var sesion = newSession(opts);
  files = (files || []).filter(Boolean);
  return Promise.all(files.map(function (f) { return interpretFile(f, opts, sesion); }))
    .then(function (archivos) {
      var reservas = [];
      archivos.forEach(function (a) { reservas = reservas.concat(a.reservas); });
      function cuantos(campo, valor) {
        return archivos.filter(function (a) { return a[campo] === valor; }).length;
      }
      var resumen = {
        total: archivos.length,
        ok: cuantos("estado", "ok"),
        vacios: cuantos("estado", "vacio"),
        errores: cuantos("estado", "error"),
        reservas: reservas.length,
        porTexto: cuantos("modo", "texto"),
        porImagenes: cuantos("modo", "imagenes")
      };
      return { archivos: archivos, reservas: reservas, resumen: resumen };
    });
}

/* ============================================================
   RECONOCER UN VUELO YA CARGADO — VAL-42
   ============================================================ */

/** Sólo letras y números, en mayúsculas: "JA 3040" y "ja3040" caen igual. */
function normalizeFlightNumber(fn) {
  return String(fn || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function flightNumberDigits(fn) {
  var m = /\d+/.exec(normalizeFlightNumber(fn));
  return m ? m[0].replace(/^0+(?=\d)/, "") : "";
}
function flightNumberLetters(fn) {
  return normalizeFlightNumber(fn).replace(/[0-9]/g, "");
}

/**
 * Dos números de vuelo son "el mismo" si comparten los mismos dígitos y
 * las letras no se contradicen. Una tarjeta de embarque a veces sólo trae
 * "3040" donde el vuelo ya cargado tiene "JA3040": igual cuentan como el
 * mismo número.
 */
function sameFlightNumber(a, b) {
  var da = flightNumberDigits(a), db = flightNumberDigits(b);
  if (!da || !db || da !== db) return false;
  var la = flightNumberLetters(a), lb = flightNumberLetters(b);
  return !la || !lb || la === lb;
}

/** Sólo la parte de fecha, YYYY-MM-DD, de un string ISO o "YYYY-MM-DD HH:mm". */
function dateOnly(s) {
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || "").trim());
  return m ? m[1] : "";
}
function sameFlightDate(a, b) {
  var da = dateOnly(a), db = dateOnly(b);
  return !!da && da === db;
}

/**
 * Los campos que la tarjeta de embarque completa en el vuelo ya cargado,
 * sólo cuando el vuelo cargado los tiene vacíos. Nunca pisa un dato que
 * la persona ya había puesto.
 * @param {Object} candidato reserva interpretada, tipo "flight"
 * @param {Object} existente reserva ya cargada en el viaje
 * @returns {Object} patch parcial, listo para mostrar y para guardar
 */
function buildFlightPatch(candidato, existente) {
  var patch = {};
  CAMPOS_COMPLETABLES.forEach(function (campo) {
    var nuevo = norm(candidato && candidato[campo]);
    var actual = norm(existente && existente[campo]);
    if (nuevo && !actual) {
      patch[campo] = (campo === "boardingTime") ? nuevo : nuevo.toUpperCase();
    }
  });
  return patch;
}

/**
 * VAL-42. Decide si una reserva de vuelo interpretada es nueva, es un
 * vuelo ya cargado (y con qué se completa), o hay más de un candidato
 * y hace falta preguntar. El criterio es número de vuelo y fecha.
 *
 * Ante la duda, nunca decide. Eso incluye el caso en que la tarjeta no
 * trae número de vuelo: sin número no hay certeza, así que si la fecha
 * coincide con uno o más vuelos ya cargados, el resultado es "ambiguo"
 * con esos vuelos como candidatos — nunca "nuevo". Un duplicado
 * silencioso es peor que una pregunta: la persona pierde la confianza
 * en el importador si ve el mismo vuelo dos veces.
 *
 * Sólo es "nuevo" cuando no hay ningún vuelo cargado ese día, o cuando
 * hay número de vuelo y no coincide con ninguno de los de ese día.
 *
 * @param {Object} candidato    reserva interpretada (de `interpretFiles`)
 * @param {Array}  existentes   reservas que el viaje ya tiene
 * @returns {{resultado:"nuevo"|"mismo"|"ambiguo", motivo:string, candidato:Object,
 *            existente?:Object, patch?:Object, candidatos?:Array}}
 */
function matchFlightReservation(candidato, existentes) {
  existentes = (existentes || []).filter(Boolean);

  if (!candidato || candidato.type !== "flight") {
    return { resultado: "nuevo", motivo: "No es un vuelo.", candidato: candidato };
  }

  var numero = candidato.flightNumber;
  var fecha = dateOnly(candidato.start);

  if (!fecha) {
    return {
      resultado: "nuevo",
      motivo: "No se pudo determinar la fecha del vuelo: no hay con qué comparar, se carga como reserva nueva.",
      candidato: candidato
    };
  }

  var vuelosEseDia = existentes.filter(function (it) {
    return it && it.type === "flight" && sameFlightDate(it.start, fecha);
  });

  if (!numero) {
    if (!vuelosEseDia.length) {
      return {
        resultado: "nuevo",
        motivo: "La tarjeta no trae número de vuelo, pero no hay ningún vuelo cargado ese día: se carga como reserva nueva.",
        candidato: candidato
      };
    }
    return {
      resultado: "ambiguo",
      motivo: "La tarjeta no trae número de vuelo y hay " + vuelosEseDia.length +
        (vuelosEseDia.length === 1 ? " vuelo cargado" : " vuelos cargados") +
        " ese mismo día: sin número no hay forma de distinguir sin adivinar.",
      candidato: candidato,
      candidatos: vuelosEseDia
    };
  }

  var candidatos = vuelosEseDia.filter(function (it) { return sameFlightNumber(it.flightNumber, numero); });

  if (!candidatos.length) {
    return { resultado: "nuevo", motivo: "Ningún vuelo cargado coincide en número y fecha.", candidato: candidato };
  }

  if (candidatos.length > 1) {
    return {
      resultado: "ambiguo",
      motivo: "Hay " + candidatos.length + " vuelos cargados con el mismo número y la misma fecha.",
      candidato: candidato,
      candidatos: candidatos
    };
  }

  var existente = candidatos[0];
  return {
    resultado: "mismo",
    motivo: "Mismo número de vuelo (" + numero + ") y misma fecha (" + fecha + ").",
    candidato: candidato,
    existente: existente,
    patch: buildFlightPatch(candidato, existente)
  };
}

/**
 * Azúcar sobre `matchFlightReservation` para usar sobre cualquier reserva
 * interpretada sin fijarse antes el tipo: lo que no es vuelo siempre es
 * nuevo, porque el reconocimiento de duplicados de VAL-42 es sólo para
 * vuelos.
 * @param {Object} reserva
 * @param {Array}  existentes
 * @returns {Object} igual forma que matchFlightReservation
 */
function matchAgainstExisting(reserva, existentes) {
  if (reserva && reserva.type === "flight") return matchFlightReservation(reserva, existentes);
  return { resultado: "nuevo", motivo: "No es un vuelo: se carga como reserva nueva.", candidato: reserva };
}

/* ============================================================
   EXPORTA
   ============================================================ */
return {
  VERSION: VERSION,
  RESERVATION_TYPES: RESERVATION_TYPES,
  STRING_FIELDS: STRING_FIELDS,
  CAMPOS_COMPLETABLES: CAMPOS_COMPLETABLES,
  PDFJS_VERSION: PDFJS_VERSION,
  PDFJS_CDN_BASE: PDFJS_CDN_BASE,
  REGLAS_TEXTO_SUFICIENTE: REGLAS_TEXTO_SUFICIENTE,
  MAX_CARACTERES_TEXTO: MAX_CARACTERES_TEXTO,
  ERRORES_PROPIOS: ERRORES_PROPIOS,
  MODEL_ERROR_MESSAGES: MODEL_ERROR_MESSAGES,
  MENSAJE_SIN_IMAGENES: MENSAJE_SIN_IMAGENES,

  // Qué puede esta vista — lo que la app pregunta ANTES de dibujar la pantalla
  getViewCapabilities: getViewCapabilities,
  readViewLimits: readViewLimits,

  // VAL-40: la capa de texto de un PDF (el camino principal)
  extractPdfText: extractPdfText,
  textContentToString: textContentToString,
  tidyPdfText: tidyPdfText,
  measureText: measureText,
  evaluateText: evaluateText,
  clipText: clipText,

  // VAL-40: PDF a imágenes, último recurso (única función que toca el DOM)
  renderPdfPagesToImages: renderPdfPagesToImages,
  openPdfDocument: openPdfDocument,

  // VAL-40 / VAL-41: interpretar archivos
  fileKind: fileKind,
  buildImportPrompt: buildImportPrompt,
  parseImportResponse: parseImportResponse,
  sanitizeReservation: sanitizeReservation,
  friendlyModelError: friendlyModelError,
  interpretFile: interpretFile,
  interpretFiles: interpretFiles,

  // VAL-42: reconocer un vuelo ya cargado
  matchFlightReservation: matchFlightReservation,
  matchAgainstExisting: matchAgainstExisting,
  buildFlightPatch: buildFlightPatch,
  normalizeFlightNumber: normalizeFlightNumber,
  sameFlightNumber: sameFlightNumber,
  sameFlightDate: sameFlightDate,
  dateOnly: dateOnly
};
});

/* ============================================================
   NOTA DE INTEGRACIÓN — lo que la app tiene que hacer con esto
   (la versión larga, con los pasos de verificación, está en
   docs/design/import-engine.md)
   ============================================================

   1. Antes de dibujar la pantalla de importar:
        const caps = await ImportEngine.getViewCapabilities(() => sample.limits());
      Si `caps.puedeFoto` es false, no se ofrecen "Sacar foto" ni "Galería"
      (sólo PDF), se usa `caps.accept` en el input de archivos y se muestra
      `caps.nota`. Nunca rechaza; sin `sample`, no se ofrece importar.

   2. Al importar, se le pasan las cuatro funciones inyectadas — el motor
      no llama a `claude.use` ni importa pdf.js:
        ImportEngine.interpretFiles(files, {
          callModel: (prompt, o) => sample.json(prompt, o.images ? { images: o.images } : {}),
          limits: () => sample.limits(),   // envuelta, no suelta: se llama como método
          extractPdfText: (b) => ImportEngine.extractPdfText(b),
          renderPdfToImages: (b) => ImportEngine.renderPdfPagesToImages(b),
          trip
        });

   3. pdf.js sigue cargándose desde cdnjs con la versión fija de
      `PDFJS_VERSION`, ahora para las DOS cosas: `getTextContent()` (el
      camino principal) y el render a imagen (el último recurso).
   ============================================================ */
