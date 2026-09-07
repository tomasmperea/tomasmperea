/* ============================================================
   VALIJA · MOTOR DE IMPORTACIÓN DE DOCUMENTOS
   Bloque A del brief de iteración 2 (docs/briefs/interpretar.md):
   VAL-40 (PDF), VAL-41 (fotos, varios archivos) y VAL-42
   (reconocer un vuelo ya cargado).

   JavaScript puro, en el mismo estilo que packing-engine.js: reglas
   declaradas como datos, funciones puras, sin tocar el DOM. La única
   excepción documentada es `renderPdfPagesToImages`, aislada a
   propósito porque necesita canvas.

   ============================================================
   QUÉ HACE
   ============================================================

   1. Recibe archivos (fotos PNG/JPG o PDFs, mezclados) y para cada
      uno arma las imágenes que hace falta mandarle a la capa
      inteligente. Una foto es una imagen. Un PDF se renderiza página
      por página (VAL-40): un PDF de varias páginas o un PDF
      escaneado sin texto se interpretan igual, porque de cualquier
      forma se convierten a imagen antes de mandarlos.

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
         reservas:[...], error:null|{codigo,mensaje}, paginas:3|null }
     ],
     reservas: [...],           // todas las reservas de todos los archivos, juntas
     resumen: { total, ok, vacios, errores, reservas }
   }

   Tres estados por archivo, no un booleano: "ok" (encontró algo),
   "vacio" (se leyó bien pero no había ninguna reserva reconocible) y
   "error" (no se pudo procesar). Un archivo vacío no es un error: es
   una foto borrosa o un documento que no es una reserva, y no hace
   falta alarmar por eso.

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

var VERSION = 1;

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

function fileResult(archivo, estado, reservas, error, paginas) {
  return {
    archivo: archivo,
    estado: estado,
    reservas: reservas || [],
    error: error || null,
    paginas: paginas == null ? null : paginas
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
   EL PROMPT DE INTERPRETACIÓN
   ============================================================ */

/**
 * Arma el prompt para una tanda de imágenes que pertenecen a un mismo
 * archivo. Mejora el prompt existente de `sheetImport` en valija.html:
 * agrega `boardingTime` y deja explícito que varias páginas son un
 * mismo comprobante, sin perder la instrucción de no inventar nada.
 *
 * @param {Object} [ctx]
 * @param {Object} [ctx.trip] {name, destination, startDate, endDate}
 * @param {string} [ctx.now]  fecha ISO, para pruebas determinísticas
 * @param {string} [ctx.archivo] nombre del archivo, sólo para el mensaje
 * @param {number|null} [ctx.paginas] cantidad de imágenes de este archivo
 * @returns {string}
 */
function buildImportPrompt(ctx) {
  ctx = ctx || {};
  var trip = ctx.trip || {};
  var hoy = ctx.now ? String(ctx.now).slice(0, 10) : new Date().toISOString().slice(0, 10);
  var paginas = ctx.paginas;

  var nombreArchivo = ctx.archivo ? " (\"" + ctx.archivo + "\")" : "";
  var origenTxt = (paginas && paginas > 1)
    ? "Las " + paginas + " imágenes adjuntas son las páginas, en orden, de un mismo comprobante" + nombreArchivo +
      ". Pueden describir una reserva o varias (por ejemplo ida y vuelta): leelas todas juntas antes de decidir cuántas hay."
    : "La imagen adjunta" + nombreArchivo + " es un comprobante de viaje: tarjeta de embarque, voucher de hotel, contrato de auto, o la captura de un mail de confirmación.";

  var contexto = "El viaje se llama \"" + (trip.name || "") + "\"" +
    (trip.destination ? ", destino " + trip.destination : "") +
    (trip.startDate ? ", entre " + trip.startDate + " y " + (trip.endDate || "?") : "") +
    ". Hoy es " + hoy + ".";

  return [
    "Extraés datos de reservas de viaje a partir de imágenes y devolvés SOLO JSON, sin texto alrededor.",
    "",
    origenTxt,
    "",
    "Contexto: " + contexto,
    "",
    "Devolvé este JSON exacto:",
    '{"items":[{',
    '"type":"flight|stay|car|transfer|act|note",',
    '"title":"texto corto y humano, ej: Buenos Aires → Madrid",',
    '"start":"YYYY-MM-DDTHH:mm o vacío",',
    '"end":"YYYY-MM-DDTHH:mm o vacío",',
    '"from":"IATA de 3 letras si es vuelo, si no ciudad o lugar",',
    '"to":"idem",',
    '"provider":"aerolínea, hotel, plataforma o rentadora",',
    '"flightNumber":"","confirmation":"","seat":"","terminal":"","gate":"",',
    '"boardingTime":"HH:mm o vacío",',
    '"address":"","phone":"","cost":"","currency":"","notes":""',
    "}]}",
    "",
    "Reglas que no se rompen:",
    "1. Un objeto por reserva. Ida y vuelta son DOS vuelos separados, cada uno con su propio número.",
    "2. Usá 24 horas. Si el año no figura en la imagen, deducilo del contexto del viaje de arriba.",
    "3. Si un dato no aparece con claridad en la imagen, dejá \"\" en ese campo. Es preferible un campo vacío: NUNCA inventes códigos de vuelo, horarios, direcciones ni montos que no estén escritos ahí.",
    "4. Para alojamiento, \"start\" es el check-in y \"end\" el check-out.",
    "5. \"boardingTime\" es la hora de embarque impresa en una tarjeta de embarque, distinta de la hora de salida del vuelo. Si la imagen no es una tarjeta de embarque, dejalo vacío.",
    "6. Si no reconocés ninguna reserva en las imágenes, devolvé {\"items\":[]}. Es preferible eso a inventar una.",
    "7. Nada de comentarios ni texto fuera del JSON."
  ].join("\n");
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
  // Sin título ni proveedor no hay nada que mostrarle a la persona para revisar.
  if (!out.title && !out.provider) return null;
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
  images_unavailable: "Esta vista no acepta imágenes.",
  image_rejected: "No pude leer esa imagen. Probá con otra foto, con más luz o sin reflejos."
};

function friendlyModelError(e) {
  var code = e && e.code;
  var mensaje = (code && MODEL_ERROR_MESSAGES[code]) || (e && e.message) || "No pude interpretar el archivo.";
  return { codigo: code || "desconocido", mensaje: String(mensaje) };
}

/* ============================================================
   INTERPRETAR UN ARCHIVO — VAL-40 / VAL-41
   ============================================================ */

/**
 * Convierte un archivo (imagen o PDF) en las imágenes que hay que
 * mandarle al modelo. No llama al modelo: sólo prepara la entrada.
 * @returns {Promise<{imagenes:Array, paginas:number|null}>}
 */
function prepareImages(file, opts) {
  var kind = fileKind(file);

  if (kind === "desconocido") {
    return Promise.reject(ImportError("tipo-no-soportado",
      "No reconozco este tipo de archivo. Subí una foto (PNG o JPG) o un PDF."));
  }

  if (kind === "imagen") {
    return Promise.resolve({ imagenes: [file.blob], paginas: null });
  }

  // PDF: VAL-40, se renderiza completo, tenga texto o sea escaneado.
  if (typeof opts.renderPdfToImages !== "function") {
    return Promise.reject(ImportError("pdf-no-disponible",
      "No pude convertir el PDF a imagen en este dispositivo. Probá con una foto del comprobante."));
  }
  return Promise.resolve()
    .then(function () { return opts.renderPdfToImages(file.blob, { name: file.name }); })
    .catch(function () {
      throw ImportError("pdf-fallo", "No pude leer ese PDF. Probá con una foto del comprobante.");
    })
    .then(function (imagenes) {
      imagenes = (imagenes || []).filter(Boolean);
      if (!imagenes.length) {
        throw ImportError("pdf-vacio", "El PDF no tiene páginas legibles.");
      }
      return { imagenes: imagenes, paginas: imagenes.length };
    });
}

/** Llama al modelo con las imágenes ya preparadas. Nunca rechaza: degrada a un fileResult de error. */
function callModelForImages(prep, nombre, opts) {
  if (typeof opts.callModel !== "function") {
    return fileResult(nombre, "error", [],
      errorInfo("ia-no-disponible", "La lectura automática no está disponible ahora mismo. Cargá la reserva a mano."),
      prep.paginas);
  }
  var prompt = buildImportPrompt({ trip: opts.trip, now: opts.now, archivo: nombre, paginas: prep.paginas });
  return Promise.resolve()
    .then(function () { return opts.callModel(prompt, { images: prep.imagenes }); })
    .then(function (raw) {
      var reservas = parseImportResponse(raw).map(function (r) { return Object.assign({}, r, { archivo: nombre }); });
      return fileResult(nombre, reservas.length ? "ok" : "vacio", reservas, null, prep.paginas);
    })
    .catch(function (e) {
      return fileResult(nombre, "error", [], friendlyModelError(e), prep.paginas);
    });
}

/**
 * Interpreta UN archivo. Nunca rechaza la promesa: cualquier falla
 * (tipo no soportado, PDF que no se pudo renderizar, modelo caído,
 * respuesta basura) se convierte en un `fileResult` con `estado:"error"`.
 * Así un archivo roto nunca invalida a los demás en `interpretFiles`.
 *
 * @param {{name:string, blob:Blob, mimeType?:string}} file
 * @param {Object} opts
 * @param {Function} opts.callModel        async (prompt, {images}) => objeto o string JSON
 * @param {Function} [opts.renderPdfToImages] async (blob) => Blob[]; sin esto los PDF fallan con dignidad
 * @param {Object}   [opts.trip]           {name, destination, startDate, endDate}
 * @param {string}   [opts.now]            fecha ISO fija, para pruebas
 * @returns {Promise<Object>} fileResult
 */
function interpretFile(file, opts) {
  opts = opts || {};
  var nombre = (file && file.name) || "archivo";
  return prepareImages(file, opts)
    .then(function (prep) { return callModelForImages(prep, nombre, opts); })
    .catch(function (e) {
      if (e && e.__importError) return fileResult(nombre, "error", [], e.info, null);
      return fileResult(nombre, "error", [], errorInfo("desconocido", (e && e.message) || "No pude interpretar el archivo."), null);
    });
}

/**
 * Interpreta varios archivos a la vez (VAL-41), mezclando fotos y PDFs.
 * La promesa se resuelve siempre: cada archivo lleva su propio resultado.
 *
 * @param {Array<{name:string, blob:Blob, mimeType?:string}>} files
 * @param {Object} opts ver `interpretFile`
 * @returns {Promise<{archivos:Array, reservas:Array, resumen:Object}>}
 */
function interpretFiles(files, opts) {
  opts = opts || {};
  files = (files || []).filter(Boolean);
  return Promise.all(files.map(function (f) { return interpretFile(f, opts); }))
    .then(function (archivos) {
      var reservas = [];
      archivos.forEach(function (a) { reservas = reservas.concat(a.reservas); });
      var resumen = {
        total: archivos.length,
        ok: archivos.filter(function (a) { return a.estado === "ok"; }).length,
        vacios: archivos.filter(function (a) { return a.estado === "vacio"; }).length,
        errores: archivos.filter(function (a) { return a.estado === "error"; }).length,
        reservas: reservas.length
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

  // VAL-40: PDF a imágenes (única función que toca el DOM)
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
