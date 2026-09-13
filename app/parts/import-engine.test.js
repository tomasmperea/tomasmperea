/* ============================================================
   VALIJA · PRUEBAS DEL MOTOR DE IMPORTACIÓN DE DOCUMENTOS
   Sin frameworks. Se corre así:

       node app/parts/import-engine.test.js

   Imprime cada caso, lo que falló, y sale con código distinto de
   cero si hay una sola falla (ver `process.exitCode` al final).

   Cubre lo que pide el brief (docs/briefs/interpretar.md, Bloque A):
     - un archivo, varios archivos, mezcla de PDF y foto;
     - un archivo que falla entre otros que sí funcionan;
     - respuesta basura del modelo;
     - vuelo nuevo, vuelo que coincide con uno existente, y
       coincidencia ambigua entre dos candidatos (VAL-42).

   Y lo que agregó la versión 2 del motor (primero texto, imágenes
   como último recurso):
     - qué contesta `getViewCapabilities` con y sin `images` en
       `sample.limits()`, y cuando `limits()` rechaza;
     - cuándo alcanza la capa de texto de un PDF y cuándo no;
     - el voucher de micro REAL del PM
       (app/pruebas/fixtures/voucher-lobos-bus.txt) leído de punta a
       punta como texto, con su código LB0TKCV5;
     - que un PDF con capa de texto no pide imágenes NI llama a
       `limits()` — con espías, no por inspección del código;
     - que un PDF escaneado sin soporte de imágenes, y una foto sin
       soporte de imágenes, fallan con un error propio SIN llamar al
       modelo (es el bug que el PM vio en su teléfono: tres archivos,
       tres veces "Esta vista no acepta imágenes").

   Nada de esto toca el navegador: los "blobs" son objetos cualquiera,
   porque el motor no mira su contenido, sólo los pasa a `callModel`.
   `renderPdfToImages` se inyecta como una función falsa, igual que en
   la app se inyectaría `renderPdfPagesToImages` ya atado a pdf.js.
   ============================================================ */

var E = require("./import-engine.js");
var fs = require("fs");
var path = require("path");

/* El texto REAL que el PM extrajo del voucher de micro con
   app/pruebas/fixtures/extraer-texto-pdf.py. No se copia acá adentro a mano:
   se lee del archivo, para que la prueba use exactamente lo que salió del PDF. */
var TEXTO_VOUCHER = fs.readFileSync(
  path.resolve(__dirname, "../pruebas/fixtures/voucher-lobos-bus.txt"), "utf8"
).trim();

/* ---------- arnés mínimo, igual al de packing-engine.test.js ---------- */
var passed = 0, failed = 0, pending = [];

function group(title) { console.log("\n" + title + "\n" + "-".repeat(title.length)); }

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ok     " + name);
  } catch (e) {
    failed++;
    console.log("  FALLA  " + name);
    console.log("         " + (e && e.message ? e.message : e));
    pending.push(name);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "se esperaba verdadero"); }
function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ". " : "") + "esperaba " + JSON.stringify(expected) + " y vino " + JSON.stringify(actual));
  }
}

/* ---------- helpers de prueba ---------- */

/** Un "blob" de prueba: al motor no le importa qué es, sólo lo transporta. */
function blob(tag) { return { __blob: tag }; }

function fileImg(name, tag) { return { name: name, mimeType: "image/jpeg", blob: blob(tag || name) }; }
function filePdf(name, tag) { return { name: name, mimeType: "application/pdf", blob: blob(tag || name) }; }

/** callModel falso que responde según el nombre de archivo mencionado en el prompt. */
function callModelPorArchivo(respuestas) {
  return async function (prompt) {
    var match = Object.keys(respuestas).find(function (nombre) { return prompt.indexOf(nombre) >= 0; });
    var r = match ? respuestas[match] : { items: [] };
    if (r && r.__throw) throw r.__throw;
    return r;
  };
}

function reservaVuelo(over) {
  return Object.assign({
    type: "flight", title: "Buenos Aires → Madrid", start: "2026-03-10T22:40",
    end: "", from: "EZE", to: "MAD", provider: "Aerolíneas Argentinas",
    flightNumber: "AR1140", confirmation: "XKD9P2", seat: "", terminal: "", gate: "",
    boardingTime: "", address: "", phone: "", cost: "", currency: "", notes: ""
  }, over || {});
}

function existente(over) {
  return Object.assign({ id: "it-1", type: "flight", title: "A Madrid", start: "2026-03-10T22:40",
    flightNumber: "AR1140", from: "EZE", to: "MAD", provider: "Aerolíneas Argentinas",
    seat: "", terminal: "", gate: "", boardingTime: "" }, over || {});
}

/* ---------- DOM falso, sólo para probar renderPdfPagesToImages sin navegador ----------
   No es jsdom ni ninguna librería nueva: el motor sólo necesita `document.createElement("canvas")`
   con un `getContext` y un `toBlob`, así que se simula con lo mínimo. Se instala en `global.document`
   antes de cada prueba de esta sección y se saca después, para no ensuciar al resto de las pruebas. */
function withFakeDom(fn) {
  global.document = {
    createElement: function (tag) {
      if (tag !== "canvas") throw new Error("elemento inesperado: " + tag);
      return {
        width: 0, height: 0,
        getContext: function () { return {}; },
        toBlob: function (cb, mimeType) { cb({ __fakeBlob: true, mimeType: mimeType }); }
      };
    }
  };
  return Promise.resolve().then(fn).finally(function () { delete global.document; });
}

/** Documento de pdf.js falso, con `numPages` páginas que "renderizan" sin problema.
 *  `textoPorPagina` (opcional) simula la capa de texto: `getTextContent()` devuelve
 *  `{items:[{str, hasEOL}]}`, que es la forma que documenta la API de pdf.js —
 *  un ítem por fragmento, con `hasEOL` en el último de cada línea. Sin
 *  `textoPorPagina`, `getTextContent()` devuelve `{items:[]}`: un PDF escaneado. */
function fakePdfDocument(numPages, textoPorPagina) {
  return {
    numPages: numPages,
    getPage: function (n) {
      var texto = (textoPorPagina || [])[n - 1] || "";
      return Promise.resolve({
        getViewport: function () { return { width: 100, height: 100 }; },
        render: function () { return { promise: Promise.resolve() }; },
        getTextContent: function () { return Promise.resolve({ items: textItems(texto) }); }
      });
    }
  };
}

/** Pasa un texto a los `items` que devolvería pdf.js: un ítem por palabra, `hasEOL` al fin de línea. */
function textItems(texto) {
  var items = [];
  String(texto).split("\n").forEach(function (linea) {
    var palabras = linea.split(/ +/).filter(Boolean);
    palabras.forEach(function (w, i) {
      items.push({ str: w, hasEOL: i === palabras.length - 1 });
    });
  });
  return items;
}

/**
 * pdf.js falso. `opts.workerFails:true` hace que `getDocument` lance una
 * excepción SÍNCRONA la primera vez (worker no se pudo instanciar) y sólo
 * funcione cuando se lo llama con `disableWorker:true`, que es exactamente
 * lo que hace `openPdfDocument` al reintentar.
 */
function fakePdfjsLib(opts) {
  opts = opts || {};
  var llamadas = [];
  return {
    llamadas: llamadas,
    getDocument: function (params) {
      llamadas.push(params);
      if (opts.workerFails && !params.disableWorker) {
        throw new Error("no se pudo instanciar el Worker: bloqueado por el sandbox del iframe");
      }
      return { promise: Promise.resolve(fakePdfDocument(opts.numPages || 1, opts.textoPorPagina)) };
    }
  };
}

async function main() {

group("fileKind — qué tipo de archivo es");

await test("un PDF por mimeType", function () {
  eq(E.fileKind({ mimeType: "application/pdf", name: "voucher.pdf" }), "pdf");
});
await test("un PDF por extensión, sin mimeType confiable", function () {
  eq(E.fileKind({ mimeType: "", name: "reserva.PDF" }), "pdf");
});
await test("una foto jpg", function () {
  eq(E.fileKind({ mimeType: "image/jpeg", name: "foto.jpg" }), "imagen");
});
await test("una foto png por extensión", function () {
  eq(E.fileKind({ mimeType: "", name: "captura.png" }), "imagen");
});
await test("un tipo que no se reconoce", function () {
  eq(E.fileKind({ mimeType: "application/zip", name: "algo.zip" }), "desconocido");
});

group("parseImportResponse / sanitizeReservation — respuesta basura del modelo");

await test("respuesta bien formada: reservas saneadas", function () {
  var out = E.parseImportResponse({ items: [
    { type: "flight", title: "EZE → MAD", provider: "AR", flightNumber: "AR1140" }
  ] });
  eq(out.length, 1);
  eq(out[0].type, "flight");
  eq(out[0].flightNumber, "AR1140");
  eq(out[0].notes, "", "un campo no informado por el modelo queda en string vacío, nunca undefined");
});

await test("un string que no es JSON no rompe nada", function () {
  var out = E.parseImportResponse("esto no es json {{{");
  eq(out.length, 0);
});

await test("un objeto sin `items` no rompe nada", function () {
  eq(E.parseImportResponse({ algo: "raro" }).length, 0);
  eq(E.parseImportResponse(null).length, 0);
  eq(E.parseImportResponse(undefined).length, 0);
  eq(E.parseImportResponse(42).length, 0);
  eq(E.parseImportResponse("null").length, 0);
});

await test("items con basura adentro se descartan uno por uno, no todo el archivo", function () {
  var out = E.parseImportResponse({ items: [
    null, 42, "texto", {},
    { title: "" , provider: "" },                       // sin título ni proveedor: no sirve
    { type: "flight", title: "Vale este", provider: "" }, // este sí
    { type: "tipo-inventado", title: "Otro válido" }      // tipo raro -> cae a "note"
  ] });
  eq(out.length, 2);
  eq(out[0].title, "Vale este");
  eq(out[1].type, "note", "un tipo que el modelo inventó no rompe: cae a nota");
});

await test("un ítem inventa un campo que no es string: se ignora ese campo, no el ítem", function () {
  var out = E.parseImportResponse({ items: [
    { type: "flight", title: "Vuelo", cost: 450, currency: null, notes: ["a", "b"] }
  ] });
  eq(out.length, 1);
  eq(out[0].cost, "", "un número donde se esperaba texto se descarta, no se inventa una conversión");
});

group("VAL-42/F1 · una tarjeta de embarque sin título ni proveedor no se descarta (estado 07B)");

await test("una tarjeta de embarque sin título/proveedor pero con asiento y fecha sobrevive al saneador", function () {
  var out = E.parseImportResponse({ items: [
    { type: "flight", title: "", provider: "", flightNumber: "", seat: "3C",
      start: "2026-09-20T06:00", end: "", from: "", to: "", confirmation: "",
      terminal: "", gate: "", boardingTime: "", address: "", phone: "", cost: "",
      currency: "", notes: "" }
  ] });
  eq(out.length, 1, "hay fecha y asiento: no se descarta aunque falten título y proveedor");
  eq(out[0].seat, "3C");
  eq(out[0].start, "2026-09-20T06:00");
});

await test("un vuelo sin título/proveedor y sin ningún dato identificable sí se descarta", function () {
  var out = E.parseImportResponse({ items: [
    { type: "flight", title: "", provider: "", flightNumber: "", seat: "",
      start: "", end: "", from: "", to: "", confirmation: "", terminal: "", gate: "",
      boardingTime: "", address: "", phone: "", cost: "", currency: "", notes: "" }
  ] });
  eq(out.length, 0, "sin título, proveedor, ni ningún dato de vuelo no hay nada para mostrar");
});

await test("gate y terminal solos (sin número, fecha, ni asiento) también alcanzan para conservar el vuelo", function () {
  eq(E.parseImportResponse({ items: [{ type: "flight", gate: "C3" }] }).length, 1);
  eq(E.parseImportResponse({ items: [{ type: "flight", terminal: "2" }] }).length, 1);
});

await test("un alojamiento sin título ni proveedor se sigue descartando: la excepción es sólo para vuelos", function () {
  var out = E.parseImportResponse({ items: [
    { type: "stay", title: "", provider: "", address: "Rua X 123", start: "2026-09-21T12:00" }
  ] });
  eq(out.length, 0, "para tipos que no son vuelo, la regla original se mantiene sin excepción");
});

await test("de punta a punta: esa tarjeta llega hasta matchAgainstExisting y da ambiguo, como pide VAL-42 (estado 07B)", function () {
  var tarjeta = E.parseImportResponse({ items: [
    { type: "flight", title: "", provider: "", flightNumber: "", seat: "3C",
      start: "2026-09-20T06:00", end: "", from: "", to: "", confirmation: "",
      terminal: "", gate: "", boardingTime: "", address: "", phone: "", cost: "",
      currency: "", notes: "" }
  ] })[0];
  var vueloA = existente({ id: "f1", flightNumber: "G31234", start: "2026-09-20T06:40" });
  var vueloB = existente({ id: "f2", flightNumber: "G35678", start: "2026-09-20T11:00" });
  var r = E.matchAgainstExisting(tarjeta, [vueloA, vueloB]);
  eq(r.resultado, "ambiguo", "antes del arreglo, sanitizeReservation la descartaba y nunca llegaba hasta acá");
  eq(r.candidatos.length, 2);
  assert(r.candidatos.some(function (c) { return c.id === "f1"; }));
  assert(r.candidatos.some(function (c) { return c.id === "f2"; }));
});

group("interpretFile — un archivo (VAL-40 / VAL-41)");

await test("una foto se interpreta y devuelve la reserva encontrada", async function () {
  var callModel = callModelPorArchivo({
    "voucher.jpg": { items: [{ type: "stay", title: "Hotel Central", provider: "Booking" }] }
  });
  var r = await E.interpretFile(fileImg("voucher.jpg"), { callModel: callModel });
  eq(r.archivo, "voucher.jpg");
  eq(r.estado, "ok");
  eq(r.reservas.length, 1);
  eq(r.reservas[0].provider, "Booking");
  eq(r.reservas[0].archivo, "voucher.jpg", "cada reserva sabe de qué archivo salió");
  eq(r.paginas, null, "una foto no tiene páginas");
});

await test("una foto sin ninguna reserva reconocible queda en estado vacío, no en error", async function () {
  var callModel = callModelPorArchivo({ "borrosa.jpg": { items: [] } });
  var r = await E.interpretFile(fileImg("borrosa.jpg"), { callModel: callModel });
  eq(r.estado, "vacio");
  eq(r.reservas.length, 0);
  assert(!r.error, "vacío no es lo mismo que error");
});

await test("sin callModel, el archivo degrada a error con mensaje claro y no revienta", async function () {
  var r = await E.interpretFile(fileImg("a.jpg"), {});
  eq(r.estado, "error");
  eq(r.error.codigo, "ia-no-disponible");
});

group("interpretFile — PDF (VAL-40): varias páginas y PDF escaneado");

await test("un PDF de varias páginas se renderiza completo y se interpreta entero", async function () {
  var paginasRenderizadas = null;
  var renderPdfToImages = async function (b) { paginasRenderizadas = 3; return [blob("p1"), blob("p2"), blob("p3")]; };
  var callModel = callModelPorArchivo({
    "itinerario.pdf": { items: [
      { type: "flight", title: "Ida", provider: "AR", flightNumber: "AR1140" },
      { type: "flight", title: "Vuelta", provider: "AR", flightNumber: "AR1141" }
    ] }
  });
  var r = await E.interpretFile(filePdf("itinerario.pdf"), { callModel: callModel, renderPdfToImages: renderPdfToImages });
  eq(r.estado, "ok");
  eq(r.paginas, 3);
  eq(r.reservas.length, 2, "un PDF de varias páginas se interpreta completo, no sólo la primera");
  eq(paginasRenderizadas, 3);
});

await test("un PDF escaneado sin texto igual se interpreta: se renderiza a imagen de cualquier forma", async function () {
  // No hay ninguna distinción de "con texto" o "sin texto" en la entrada: la
  // función de render siempre devuelve imágenes, sea cual sea el origen del PDF.
  var renderPdfToImages = async function () { return [blob("pagina-escaneada")]; };
  var callModel = callModelPorArchivo({
    "escaneado.pdf": { items: [{ type: "stay", title: "Reserva escaneada", provider: "Hotel" }] }
  });
  var r = await E.interpretFile(filePdf("escaneado.pdf"), { callModel: callModel, renderPdfToImages: renderPdfToImages });
  eq(r.estado, "ok");
  eq(r.reservas.length, 1);
});

await test("un PDF sin función de render disponible falla con dignidad, sin tirar la promesa abajo", async function () {
  var r = await E.interpretFile(filePdf("sin-render.pdf"), { callModel: async () => ({ items: [] }) });
  eq(r.estado, "error");
  eq(r.error.codigo, "pdf-no-disponible");
});

await test("un PDF cuyo render se cae (archivo corrupto) también degrada con dignidad", async function () {
  var renderPdfToImages = async function () { throw new Error("archivo corrupto"); };
  var r = await E.interpretFile(filePdf("roto.pdf"), { callModel: async () => ({ items: [] }), renderPdfToImages: renderPdfToImages });
  eq(r.estado, "error");
  eq(r.error.codigo, "pdf-fallo");
});

await test("un tipo de archivo no soportado se señala solo", async function () {
  var r = await E.interpretFile({ name: "algo.zip", mimeType: "application/zip", blob: blob("z") }, { callModel: async () => ({ items: [] }) });
  eq(r.estado, "error");
  eq(r.error.codigo, "tipo-no-soportado");
});

group("interpretFiles — varios archivos, mezcla de tipos y fallas parciales (VAL-41)");

await test("varios archivos del mismo tipo: cada uno dice qué reconoció", async function () {
  var callModel = callModelPorArchivo({
    "a.jpg": { items: [{ type: "flight", title: "Vuelo A", provider: "AR" }] },
    "b.jpg": { items: [{ type: "stay", title: "Hotel B", provider: "Booking" }] }
  });
  var res = await E.interpretFiles([fileImg("a.jpg"), fileImg("b.jpg")], { callModel: callModel });
  eq(res.archivos.length, 2);
  eq(res.resumen.total, 2);
  eq(res.resumen.ok, 2);
  eq(res.reservas.length, 2);
  eq(res.reservas.find(function (r) { return r.archivo === "a.jpg"; }).title, "Vuelo A");
  eq(res.reservas.find(function (r) { return r.archivo === "b.jpg"; }).title, "Hotel B");
});

await test("mezcla de fotos y PDF en la misma carga", async function () {
  var renderPdfToImages = async function () { return [blob("p1")]; };
  var callModel = callModelPorArchivo({
    "foto1.jpg": { items: [{ type: "car", title: "Auto en Madrid", provider: "Hertz" }] },
    "foto2.png": { items: [{ type: "stay", title: "Hotel", provider: "Booking" }] },
    "voucher.pdf": { items: [{ type: "flight", title: "Vuelo", provider: "AR", flightNumber: "AR1140" }] }
  });
  var res = await E.interpretFiles(
    [fileImg("foto1.jpg"), fileImg("foto2.png"), filePdf("voucher.pdf")],
    { callModel: callModel, renderPdfToImages: renderPdfToImages }
  );
  eq(res.resumen.total, 3);
  eq(res.resumen.ok, 3);
  eq(res.reservas.length, 3);
  var porArchivo = {};
  res.archivos.forEach(function (a) { porArchivo[a.archivo] = a; });
  eq(porArchivo["voucher.pdf"].reservas[0].type, "flight");
  eq(porArchivo["foto1.jpg"].reservas[0].type, "car");
});

await test("un archivo que falla no invalida a los demás", async function () {
  var callModel = callModelPorArchivo({
    "buena1.jpg": { items: [{ type: "flight", title: "Vuelo bueno", provider: "AR" }] },
    "rota.jpg": { __throw: Object.assign(new Error("no se pudo leer"), { code: "image_rejected" }) },
    "buena2.jpg": { items: [{ type: "stay", title: "Hotel bueno", provider: "Booking" }] }
  });
  var res = await E.interpretFiles(
    [fileImg("buena1.jpg"), fileImg("rota.jpg"), fileImg("buena2.jpg")],
    { callModel: callModel }
  );
  eq(res.archivos.length, 3, "los tres archivos aparecen en el resultado");
  eq(res.resumen.ok, 2);
  eq(res.resumen.errores, 1);
  var rota = res.archivos.find(function (a) { return a.archivo === "rota.jpg"; });
  eq(rota.estado, "error");
  eq(rota.error.codigo, "image_rejected");
  eq(rota.error.mensaje, E.friendlyModelError({ code: "image_rejected" }).mensaje);
  eq(res.reservas.length, 2, "las reservas de los archivos que sí funcionaron llegan igual");
  assert(res.reservas.every(function (r) { return r.archivo !== "rota.jpg"; }));
});

await test("respuesta basura del modelo en un archivo no rompe la carga completa", async function () {
  var callModel = callModelPorArchivo({
    "buena.jpg": { items: [{ type: "flight", title: "Vuelo", provider: "AR" }] },
    "basura.jpg": "che esto no es JSON para nada"
  });
  var res = await E.interpretFiles([fileImg("buena.jpg"), fileImg("basura.jpg")], { callModel: callModel });
  eq(res.resumen.ok, 1);
  var basura = res.archivos.find(function (a) { return a.archivo === "basura.jpg"; });
  eq(basura.estado, "vacio", "una respuesta que no es JSON válido se lee como ninguna reserva encontrada, no como error");
  eq(basura.reservas.length, 0);
});

group("prompt de interpretación");

await test("el prompt pide dejar vacío antes que inventar", function () {
  var p = E.buildImportPrompt({ trip: { name: "Europa 2026" } });
  assert(/NUNCA inventes/.test(p), "tiene que llevar la instrucción explícita de no inventar");
  assert(p.indexOf("Europa 2026") >= 0, "usa el contexto del viaje");
});

await test("el prompt avisa cuando son varias páginas del mismo archivo", function () {
  var p = E.buildImportPrompt({ trip: {}, archivo: "itinerario.pdf", paginas: 4 });
  assert(p.indexOf("4 imágenes") >= 0 || p.indexOf("páginas") >= 0);
});

group("renderPdfPagesToImages — guardas de la función que toca el DOM");

await test("sin pdf.js cargado, rechaza con un mensaje claro (no intenta tocar el DOM)", async function () {
  try {
    await E.renderPdfPagesToImages({}, {});
    assert(false, "tenía que rechazar");
  } catch (e) {
    assert(/pdfjs-no-disponible/.test(e.message));
  }
});

await test("con pdf.js y worker disponibles, renderiza sin caer al modo sin worker", async function () {
  await withFakeDom(async function () {
    var pdfjsLib = fakePdfjsLib({ numPages: 2 });
    var pdfBlobFalso = { arrayBuffer: async function () { return new ArrayBuffer(1); } };
    var imagenes = await E.renderPdfPagesToImages(pdfBlobFalso, { pdfjsLib: pdfjsLib });
    eq(imagenes.length, 2);
    eq(pdfjsLib.llamadas.length, 1, "no hizo falta reintentar: el worker anduvo a la primera");
  });
});

await test("si instanciar el Worker de pdf.js lanza (sandbox del iframe), cae solo al modo sin worker y de todas formas obtiene las imágenes", async function () {
  await withFakeDom(async function () {
    var pdfjsLib = fakePdfjsLib({ workerFails: true, numPages: 3 });
    var pdfBlobFalso = { arrayBuffer: async function () { return new ArrayBuffer(1); } };
    var imagenes = await E.renderPdfPagesToImages(pdfBlobFalso, { pdfjsLib: pdfjsLib });
    eq(imagenes.length, 3, "igual se obtienen las imágenes, aunque el worker no haya arrancado");
    eq(pdfjsLib.llamadas.length, 2, "primero intentó con worker, después reintentó sin worker");
    assert(!pdfjsLib.llamadas[0].disableWorker, "el primer intento es el camino rápido, con worker");
    eq(pdfjsLib.llamadas[1].disableWorker, true, "el reintento pide explícitamente correr sin worker");
  });
});

await test("la caída al modo sin worker no llega como error a interpretFile: el archivo queda ok", async function () {
  await withFakeDom(async function () {
    var pdfjsLib = fakePdfjsLib({ workerFails: true, numPages: 1 });
    var renderPdfToImages = function (blob) {
      return E.renderPdfPagesToImages(blob, { pdfjsLib: pdfjsLib });
    };
    var callModel = callModelPorArchivo({
      "voucher.pdf": { items: [{ type: "flight", title: "Vuelo", provider: "AR", flightNumber: "AR1140" }] }
    });
    var archivoFalso = filePdf("voucher.pdf");
    archivoFalso.blob = { arrayBuffer: async function () { return new ArrayBuffer(1); } };
    var r = await E.interpretFile(archivoFalso, { callModel: callModel, renderPdfToImages: renderPdfToImages });
    eq(r.estado, "ok", "el fallo del worker es interno y no se le nota a quien está esperando la reserva");
    eq(r.reservas.length, 1);
  });
});

group("VAL-42 · reconocer un vuelo ya cargado");

await test("vuelo nuevo: no hay ningún vuelo cargado que coincida", function () {
  var r = E.matchFlightReservation(reservaVuelo(), []);
  eq(r.resultado, "nuevo");
});

await test("vuelo nuevo: hay vuelos cargados pero ninguno coincide en número y fecha", function () {
  var otros = [existente({ id: "it-2", flightNumber: "AR1099", start: "2026-03-10T08:00" })];
  var r = E.matchFlightReservation(reservaVuelo(), otros);
  eq(r.resultado, "nuevo");
});

await test("vuelo nuevo cuando la tarjeta no trae número de vuelo y no hay ningún vuelo cargado ese día", function () {
  var otroDia = existente({ start: "2026-05-01T10:00" });
  var r = E.matchFlightReservation(reservaVuelo({ flightNumber: "" }), [otroDia]);
  eq(r.resultado, "nuevo");
});

await test("sin número de vuelo pero con un vuelo cargado ese mismo día: ambiguo, nunca duplica en silencio", function () {
  var ya = existente(); // mismo día que reservaVuelo(): 2026-03-10
  var r = E.matchFlightReservation(reservaVuelo({ flightNumber: "" }), [ya]);
  eq(r.resultado, "ambiguo");
  eq(r.candidatos.length, 1);
  eq(r.candidatos[0].id, "it-1");
  assert(!r.existente, "no decide por la persona: no hay `existente` en un resultado ambiguo");
});

await test("sin número de vuelo y con más de un vuelo cargado ese día: ambiguo con todos los candidatos", function () {
  var ya1 = existente({ id: "it-1" });
  var ya2 = existente({ id: "it-9", flightNumber: "AR9999" }); // distinto número, mismo día: igual es candidato
  var r = E.matchFlightReservation(reservaVuelo({ flightNumber: "" }), [ya1, ya2]);
  eq(r.resultado, "ambiguo");
  eq(r.candidatos.length, 2);
});

await test("es el mismo vuelo: mismo número y misma fecha", function () {
  var boarding = reservaVuelo({ gate: "B12", terminal: "T1", seat: "14C", boardingTime: "21:10", start: "2026-03-10T22:40" });
  var r = E.matchFlightReservation(boarding, [existente()]);
  eq(r.resultado, "mismo");
  eq(r.existente.id, "it-1");
  eq(r.patch.gate, "B12");
  eq(r.patch.terminal, "T1");
  eq(r.patch.seat, "14C");
  eq(r.patch.boardingTime, "21:10");
});

await test("número de vuelo tolerante: \"3040\" en la tarjeta contra \"AR3040\" ya cargado", function () {
  var ya = existente({ flightNumber: "AR3040" });
  var boarding = reservaVuelo({ flightNumber: "3040", gate: "C4" });
  var r = E.matchFlightReservation(boarding, [ya]);
  eq(r.resultado, "mismo");
  eq(r.patch.gate, "C4");
});

await test("el patch no pisa un campo que el vuelo cargado ya tenía", function () {
  var ya = existente({ gate: "A1" });
  var boarding = reservaVuelo({ gate: "B99" });
  var r = E.matchFlightReservation(boarding, [ya]);
  eq(r.resultado, "mismo");
  assert(!("gate" in r.patch), "gate ya estaba cargado: no se propone pisarlo");
});

await test("coincidencia ambigua: dos vuelos cargados con el mismo número y fecha", function () {
  var ya1 = existente({ id: "it-1" });
  var ya2 = existente({ id: "it-9" });
  var boarding = reservaVuelo();
  var r = E.matchFlightReservation(boarding, [ya1, ya2]);
  eq(r.resultado, "ambiguo");
  eq(r.candidatos.length, 2);
  assert(r.candidatos.some(function (c) { return c.id === "it-1"; }));
  assert(r.candidatos.some(function (c) { return c.id === "it-9"; }));
  assert(!r.existente, "en el caso ambiguo el motor no elige: no hay `existente`");
  assert(!r.patch, "en el caso ambiguo tampoco hay patch: que pregunte la interfaz");
});

await test("matchAgainstExisting: lo que no es vuelo siempre es nuevo", function () {
  var r = E.matchAgainstExisting({ type: "stay", title: "Hotel" }, [existente()]);
  eq(r.resultado, "nuevo");
});

group("v2 · qué puede esta vista — `sample.limits()` inyectado (getViewCapabilities)");

/** `sample.limits()` de una vista que SÍ acepta imágenes, con la forma del contrato. */
function limitsConImagenes(espia) {
  return async function () {
    if (espia) espia.llamadas++;
    return {
      maxPromptBytes: 65536,
      images: { maxCount: 5, maxInputBytes: 20971520, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
      tools: { maxCount: 4 }
    };
  };
}
/** La misma vista del teléfono del PM: responde, pero SIN el miembro `images`. */
function limitsSinImagenes(espia) {
  return async function () {
    if (espia) espia.llamadas++;
    return { maxPromptBytes: 65536 };
  };
}

await test("con `images` en limits: se ofrecen las fotos y el accept los lista", async function () {
  var caps = await E.getViewCapabilities(limitsConImagenes());
  eq(caps.aceptaImagenes, true);
  eq(caps.certeza, "si");
  eq(caps.puedeFoto, true);
  eq(caps.puedePdfEscaneado, true);
  eq(caps.maxImagenes, 5);
  assert(caps.accept.indexOf("image/jpeg") >= 0 && caps.accept.indexOf("application/pdf") >= 0, "el accept del input sale de mediaTypes + PDF: " + caps.accept);
  eq(caps.nota, "", "no hay nada que aclarar cuando las imágenes andan");
});

await test("sin `images` en limits: no se ofrecen fotos, pero el PDF con texto sigue disponible", async function () {
  var caps = await E.getViewCapabilities(limitsSinImagenes());
  eq(caps.aceptaImagenes, false);
  eq(caps.certeza, "no");
  eq(caps.puedeFoto, false, "la app no tiene que ofrecer \"Sacar foto\" ni \"Galería\" acá");
  eq(caps.puedePdfEscaneado, false);
  eq(caps.puedePdfConTexto, true, "el contrato es explícito: las llamadas de texto siguen funcionando");
  eq(caps.accept, "application/pdf");
  eq(caps.nota, E.MENSAJE_SIN_IMAGENES);
});

await test("si limits() rechaza se trata como si no hubiera imágenes, como dice el contrato", async function () {
  var caps = await E.getViewCapabilities(async function () { throw { code: "capability_disabled", message: "no" }; });
  eq(caps.aceptaImagenes, false);
  eq(caps.accept, "application/pdf");
});

await test("si limits() lanza de forma síncrona, getViewCapabilities igual resuelve", async function () {
  var caps = await E.getViewCapabilities(function () { throw new Error("explotó"); });
  eq(caps.aceptaImagenes, false);
});

await test("sin limits inyectado no se inventa una respuesta: queda en desconocida y se sigue como antes", async function () {
  var caps = await E.getViewCapabilities(null);
  eq(caps.certeza, "desconocida");
  eq(caps.aceptaImagenes, true, "no saber no puede dejar a una integración vieja peor que antes del cambio");
});

group("v2 · ¿alcanza la capa de texto de un PDF? (umbral declarado como datos)");

await test("el texto del voucher real alcanza de sobra", function () {
  var ev = E.evaluateText(TEXTO_VOUCHER, "normal");
  eq(ev.suficiente, true, ev.motivo);
  assert(ev.medida.caracteres > 500, "el voucher real trae " + ev.medida.caracteres + " caracteres");
});

await test("tres palabras sueltas de un pie de página NO alcanzan, y el motivo lo explica", function () {
  var ev = E.evaluateText("Página 1 de 2", "normal");
  eq(ev.suficiente, false);
  assert(/caracteres/.test(ev.motivo) && /palabras/.test(ev.motivo), "el motivo dice qué faltó: " + ev.motivo);
});

await test("una tira larga de un solo token (una URL al pie) tampoco alcanza: no basta con los caracteres", function () {
  var url = "https://sistema.example.com/comprobantes/" + "a1b2c3d4".repeat(30);
  assert(url.length > 120, "la URL sola supera el mínimo de caracteres");
  eq(E.evaluateText(url, "normal").suficiente, false, "por eso el umbral también cuenta palabras");
});

await test("un PDF sin capa de texto no alcanza en ningún nivel", function () {
  eq(E.evaluateText("", "normal").suficiente, false);
  eq(E.evaluateText("", "ultimo-recurso").suficiente, false);
  eq(E.evaluateText("   \n  ", "ultimo-recurso").suficiente, false);
});

await test("el nivel \"ultimo-recurso\" es más permisivo, pero sigue siendo un umbral", function () {
  var flaco = "Reserva 4471 13/9/2026 Monte a Buenos Aires 19:01";
  eq(E.evaluateText(flaco, "normal").suficiente, false);
  eq(E.evaluateText(flaco, "ultimo-recurso").suficiente, true);
  eq(E.evaluateText("Página 1 de 2", "ultimo-recurso").suficiente, false, "el pie de página no pasa ni siendo el último recurso");
});

group("v2 · extractPdfText — la capa de texto con pdf.js (inyectado)");

await test("junta las páginas en orden y devuelve el texto tal cual", async function () {
  var pdfjsLib = fakePdfjsLib({ numPages: 2, textoPorPagina: ["Primera página", "Segunda página"] });
  var out = await E.extractPdfText({ arrayBuffer: async function () { return new ArrayBuffer(1); } }, { pdfjsLib: pdfjsLib });
  eq(out.paginas, 2);
  eq(out.texto, "Primera página\n\nSegunda página");
  eq(out.porPagina[0], "Primera página");
});

await test("el texto del voucher real sobrevive entero al viaje por getTextContent", async function () {
  var pdfjsLib = fakePdfjsLib({ numPages: 1, textoPorPagina: [TEXTO_VOUCHER] });
  var out = await E.extractPdfText({ arrayBuffer: async function () { return new ArrayBuffer(1); } }, { pdfjsLib: pdfjsLib });
  eq(out.texto, TEXTO_VOUCHER, "lo que entra por la capa de texto es lo que sale: ni un carácter de diferencia");
  eq(E.evaluateText(out.texto, "normal").suficiente, true);
});

await test("un PDF escaneado devuelve texto vacío, que no es un error sino el dato de que hay que ir por imágenes", async function () {
  var pdfjsLib = fakePdfjsLib({ numPages: 3 });   // sin textoPorPagina: items vacíos
  var out = await E.extractPdfText({ arrayBuffer: async function () { return new ArrayBuffer(1); } }, { pdfjsLib: pdfjsLib });
  eq(out.texto, "");
  eq(out.paginas, 3, "igual sabe cuántas páginas tiene");
});

await test("sin pdf.js cargado, rechaza con un mensaje claro", async function () {
  try {
    await E.extractPdfText({}, {});
    assert(false, "tenía que rechazar");
  } catch (e) {
    assert(/pdfjs-no-disponible/.test(e.message));
  }
});

group("v2 · VAL-40 · un PDF con capa de texto se interpreta COMO TEXTO");

/** callModel fiel al contrato de `sample.json`: resuelve el JSON ya parseado.
 *  Sólo "reconoce" la reserva si el prompt trae de verdad los datos del voucher:
 *  si el motor no hubiera metido el texto en el prompt, el caso falla. */
function callModelVoucher(registro) {
  return async function (prompt, opciones) {
    registro.push({ prompt: prompt, opciones: opciones });
    if (prompt.indexOf("LB0TKCV5") < 0 || prompt.indexOf("13/9/2026") < 0) return { items: [] };
    return { items: [{
      type: "transfer",
      title: "Monte → Buenos Aires",
      start: "2026-09-13T19:01",
      end: "2026-09-13T20:31",
      from: "Monte, Blandengues y Belgrano",
      to: "Buenos Aires, Bartolomé Mitre 1760",
      provider: "Lobos Bus",
      flightNumber: "", confirmation: "LB0TKCV5", seat: "", terminal: "", gate: "",
      boardingTime: "", address: "", phone: "", cost: "", currency: "", notes: ""
    }] };
  };
}

await test("el voucher de micro real sale como reserva, con su código, origen, destino y los dos horarios", async function () {
  var registro = [];
  var r = await E.interpretFile(filePdf("RLB_CLARA_SANCHEZ_ESPUELAS.pdf"), {
    limits: limitsConImagenes(),
    extractPdfText: async function () { return { texto: TEXTO_VOUCHER, paginas: 1 }; },
    callModel: callModelVoucher(registro),
    trip: { name: "Monte", startDate: "2026-09-12", endDate: "2026-09-14" },
    now: "2026-09-11"
  });
  eq(r.estado, "ok");
  eq(r.modo, "texto", "se leyó del texto del PDF, no de una imagen");
  eq(r.reservas.length, 1);
  var res = r.reservas[0];
  eq(res.confirmation, "LB0TKCV5");
  eq(res.type, "transfer");
  eq(res.start, "2026-09-13T19:01");
  eq(res.end, "2026-09-13T20:31");
  assert(res.from.indexOf("Monte") >= 0, "el origen viene del voucher: " + res.from);
  assert(res.to.indexOf("Buenos Aires") >= 0, "el destino viene del voucher: " + res.to);
  eq(res.archivo, "RLB_CLARA_SANCHEZ_ESPUELAS.pdf");
});

await test("el prompt lleva el texto del comprobante entero y no manda imágenes", async function () {
  var registro = [];
  await E.interpretFile(filePdf("voucher.pdf"), {
    limits: limitsConImagenes(),
    extractPdfText: async function () { return { texto: TEXTO_VOUCHER, paginas: 1 }; },
    callModel: callModelVoucher(registro)
  });
  eq(registro.length, 1);
  assert(registro[0].prompt.indexOf(TEXTO_VOUCHER) >= 0, "el texto del voucher va tal cual dentro del prompt");
  assert(!("images" in registro[0].opciones), "en el camino de texto la clave `images` ni aparece en las opciones");
  eq(registro[0].opciones.modo, "texto");
  assert(/NUNCA inventes/.test(registro[0].prompt), "el prompt de texto también prohíbe inventar un dato");
});

await test("un PDF con capa de texto NO renderiza imágenes NI consulta limits()", async function () {
  var espia = { llamadas: 0 };
  var renders = 0;
  var r = await E.interpretFile(filePdf("voucher.pdf"), {
    limits: limitsConImagenes(espia),
    extractPdfText: async function () { return { texto: TEXTO_VOUCHER, paginas: 1 }; },
    renderPdfToImages: async function () { renders++; return [blob("p1")]; },
    callModel: callModelVoucher([])
  });
  eq(r.estado, "ok");
  eq(renders, 0, "renderizar a imagen es el último recurso, no el camino de siempre");
  eq(espia.llamadas, 0, "ni siquiera hace falta preguntar qué puede la vista: el texto no depende de eso");
});

await test("un PDF cuya capa de texto es sólo un pie de página cae a imágenes, no manda esas tres palabras", async function () {
  var registro = [];
  var r = await E.interpretFile(filePdf("escaneado-con-pie.pdf"), {
    limits: limitsConImagenes(),
    extractPdfText: async function () { return { texto: "Página 1 de 2", paginas: 2 }; },
    renderPdfToImages: async function () { return [blob("p1"), blob("p2")]; },
    callModel: async function (prompt, opciones) { registro.push(opciones); return { items: [{ type: "stay", title: "Hotel", provider: "Booking" }] }; }
  });
  eq(r.estado, "ok");
  eq(r.modo, "imagenes");
  eq(registro[0].images.length, 2);
});

await test("si la extracción de texto se cae, el PDF sigue por el camino de imágenes", async function () {
  var r = await E.interpretFile(filePdf("raro.pdf"), {
    limits: limitsConImagenes(),
    extractPdfText: async function () { throw new Error("pdf.js explotó leyendo el texto"); },
    renderPdfToImages: async function () { return [blob("p1")]; },
    callModel: async function () { return { items: [{ type: "flight", title: "Vuelo", provider: "AR" }] }; }
  });
  eq(r.estado, "ok");
  eq(r.modo, "imagenes", "un fallo de la extracción no puede costar el archivo entero");
});

group("v2 · lo que le pasó al PM: una vista que no acepta imágenes");

await test("un PDF escaneado sin soporte de imágenes da un error propio y NO llama al modelo", async function () {
  var llamadasModelo = 0, renders = 0;
  var r = await E.interpretFile(filePdf("aerolineas-escaneado.pdf"), {
    limits: limitsSinImagenes(),
    extractPdfText: async function () { return { texto: "", paginas: 1 }; },
    renderPdfToImages: async function () { renders++; return [blob("p1")]; },
    callModel: async function () { llamadasModelo++; throw { code: "images_unavailable", message: "this view cannot send images" }; }
  });
  eq(r.estado, "error");
  eq(r.error.codigo, "pdf-escaneado-sin-imagenes");
  eq(llamadasModelo, 0, "no se gasta una llamada que ya sabemos que va a ser rechazada");
  eq(renders, 0, "tampoco se renderiza una imagen que no se va a poder mandar");
  assert(/escaneo/.test(r.error.mensaje) && /a mano/.test(r.error.mensaje), "el error dice qué pasó y qué hacer: " + r.error.mensaje);
});

await test("una foto sin soporte de imágenes falla con un error que lo explica, sin intentar la llamada", async function () {
  var llamadasModelo = 0;
  var r = await E.interpretFile(fileImg("foto-del-voucher.jpg"), {
    limits: limitsSinImagenes(),
    callModel: async function () { llamadasModelo++; throw { code: "images_unavailable", message: "this view cannot send images" }; }
  });
  eq(r.estado, "error");
  eq(r.error.codigo, "imagenes-no-disponibles");
  eq(llamadasModelo, 0);
  assert(/PDF/.test(r.error.mensaje), "el error propone el camino que sí funciona: " + r.error.mensaje);
});

await test("una foto con soporte de imágenes se interpreta igual que siempre", async function () {
  var registro = [];
  var r = await E.interpretFile(fileImg("voucher.jpg"), {
    limits: limitsConImagenes(),
    callModel: async function (prompt, opciones) { registro.push(opciones); return { items: [{ type: "stay", title: "Hotel Central", provider: "Booking" }] }; }
  });
  eq(r.estado, "ok");
  eq(r.modo, "imagenes");
  eq(registro[0].images.length, 1);
});

await test("último recurso: sin imágenes, un texto flaco se manda igual — es eso o no leer nada", async function () {
  var registro = [];
  var r = await E.interpretFile(filePdf("flaco.pdf"), {
    limits: limitsSinImagenes(),
    extractPdfText: async function () { return { texto: "Reserva 4471 13/9/2026 Monte a Buenos Aires 19:01", paginas: 1 }; },
    renderPdfToImages: async function () { return [blob("p1")]; },
    callModel: async function (prompt, opciones) { registro.push(opciones); return { items: [{ type: "transfer", title: "Monte → Buenos Aires", provider: "Lobos Bus" }] }; }
  });
  eq(r.estado, "ok");
  eq(r.modo, "texto");
  assert(!("images" in registro[0]), "no se mandan imágenes a una vista que no las acepta");
});

await test("VAL-41 · en la misma carga, el PDF con texto se lee y la foto falla sola", async function () {
  var res = await E.interpretFiles(
    [filePdf("voucher.pdf"), fileImg("captura.png")],
    {
      limits: limitsSinImagenes(),
      extractPdfText: async function () { return { texto: TEXTO_VOUCHER, paginas: 1 }; },
      callModel: callModelVoucher([])
    }
  );
  eq(res.resumen.total, 2);
  eq(res.resumen.ok, 1);
  eq(res.resumen.errores, 1);
  eq(res.resumen.porTexto, 1);
  eq(res.reservas.length, 1);
  eq(res.reservas[0].confirmation, "LB0TKCV5");
  var foto = res.archivos.find(function (a) { return a.archivo === "captura.png"; });
  eq(foto.error.codigo, "imagenes-no-disponibles");
});

await test("limits() se consulta UNA sola vez por corrida, por más archivos que haya", async function () {
  var espia = { llamadas: 0 };
  var res = await E.interpretFiles(
    [fileImg("a.jpg"), fileImg("b.jpg"), filePdf("escaneado.pdf")],
    {
      limits: limitsConImagenes(espia),
      extractPdfText: async function () { return { texto: "", paginas: 1 }; },
      renderPdfToImages: async function () { return [blob("p1")]; },
      callModel: async function () { return { items: [{ type: "note", title: "Algo", provider: "X" }] }; }
    }
  );
  eq(res.resumen.ok, 3);
  eq(espia.llamadas, 1, "es barato, pero no hay razón para preguntarlo tres veces");
});

await test("sin limits inyectado, todo sigue funcionando como antes del cambio (integración vieja)", async function () {
  var r = await E.interpretFile(fileImg("foto.jpg"), {
    callModel: async function () { return { items: [{ type: "stay", title: "Hotel", provider: "Booking" }] }; }
  });
  eq(r.estado, "ok");
  eq(r.modo, "imagenes");
});

/* ============================================================
   VAL-59 · LA TARJETA DE EMBARQUE SE DESPRENDE DE UN VUELO
   ============================================================ */

/** Una tarjeta de embarque interpretada: vuelo con datos de embarque. */
function tarjeta(over) {
  return Object.assign(reservaVuelo({
    title: "", provider: "", confirmation: "", terminal: "", end: "",
    seat: "14A", gate: "22", boardingTime: "21:10"
  }), over || {});
}

group("VAL-59 · esTarjetaDeEmbarque — el criterio, en un solo lugar");

await test("lo que el modelo declara como tarjeta de embarque, es una tarjeta de embarque", function () {
  var c = E.clasificarTarjetaDeEmbarque(reservaVuelo({ docType: "boarding-pass" }));
  assert(c.esTarjeta, "docType declarado manda");
  eq(c.certeza, "declarada");
  eq(c.regla, "declarada-por-el-modelo");
});

await test("un pasaje con asiento asignado NO es una tarjeta de embarque", function () {
  // La advertencia textual de docs/design/adjuntar.md §7.6.1: "si la app adivina
  // 'es una tarjeta porque trae asiento', va a tratar como tarjeta a un pasaje
  // con asiento asignado". El asiento solo nunca alcanza.
  var pasaje = reservaVuelo({ seat: "14A" });
  assert(!E.esTarjetaDeEmbarque(pasaje), "un pasaje con asiento sigue siendo un pasaje");
  eq(E.clasificarTarjetaDeEmbarque(pasaje).regla, "asiento-solo-no-alcanza");
});

await test("la hora de embarque sí alcanza, y la puerta también", function () {
  assert(E.esTarjetaDeEmbarque(reservaVuelo({ boardingTime: "21:10" })));
  eq(E.clasificarTarjetaDeEmbarque(reservaVuelo({ boardingTime: "21:10" })).regla, "hora-de-embarque");
  assert(E.esTarjetaDeEmbarque(reservaVuelo({ gate: "22" })));
  eq(E.clasificarTarjetaDeEmbarque(reservaVuelo({ gate: "22" })).regla, "puerta-de-embarque");
});

await test("un vuelo sin título ni aerolínea pero con asiento: el perfil que ya contemplaba sanitizeReservation", function () {
  var recortada = reservaVuelo({ title: "", provider: "", seat: "14A" });
  assert(E.esTarjetaDeEmbarque(recortada));
  eq(E.clasificarTarjetaDeEmbarque(recortada).regla, "sin-titulo-ni-proveedor");
});

await test("si el modelo dijo que es un pasaje, una puerta suelta no lo convierte en tarjeta", function () {
  var c = E.clasificarTarjetaDeEmbarque(reservaVuelo({ docType: "ticket", gate: "22" }));
  assert(!c.esTarjeta, "lo que el documento dice de sí mismo es de primera mano y gana");
  eq(c.certeza, "descartada");
});

await test("lo que no es un vuelo nunca es una tarjeta de embarque", function () {
  assert(!E.esTarjetaDeEmbarque({ type: "stay", title: "Hotel", gate: "22" }));
});

await test("el modelo tiene que poder contestar vacío: un docType inventado se descarta", function () {
  var r = E.parseImportResponse({ items: [{ type: "flight", title: "Vuelo", provider: "AR", docType: "tarjetita" }] });
  eq(r[0].docType, "", "una clase que no está en la lista vale lo mismo que no haber contestado");
  var r2 = E.parseImportResponse({ items: [{ type: "flight", title: "Vuelo", provider: "AR" }] });
  eq(r2[0].docType, "", "si el modelo no contesta el campo, queda vacío y no se infiere en el sanitizador");
});

await test("el prompt le pide al modelo dejar docType vacío antes que elegir uno al azar", function () {
  var p = E.buildImportPrompt({ trip: {} });
  assert(p.indexOf("docType") >= 0, "el campo tiene que estar en el formato pedido");
  assert(/dejalo VACÍO/.test(p), "y con la instrucción explícita de dejarlo vacío");
});

group("VAL-59 · los tres casos de una tarjeta que no coincide con ningún vuelo");

await test("sin ningún vuelo cargado: no se inventa una reserva, se devuelve qué precargar", function () {
  var r = E.matchAgainstExisting(tarjeta(), []);
  eq(r.resultado, "sin-vuelo", "una tarjeta de embarque no es un vuelo: no se carga como reserva nueva");
  eq(r.caso, "sin-vuelos");
  eq(r.candidatos.length, 0, "no hay con qué matchear");
  eq(r.opciones.join(","), "crear", "la única salida es crear el vuelo, y la pide la persona");
  eq(r.esTarjeta, true);
  eq(r.precarga.vuelo.flightNumber, "AR1140");
  eq(r.precarga.vuelo.seat, "14A");
  eq(r.precarga.vuelo.gate, "22");
  eq(r.precarga.vuelo.boardingTime, "21:10");
  eq(r.precarga.vuelo.from, "EZE");
  eq(r.precarga.vuelo.to, "MAD");
  eq(r.precarga.vuelo.start, "2026-03-10T22:40");
});

await test("lo que la tarjeta no trae queda vacío, y se dice cuántos campos son", function () {
  var r = E.matchAgainstExisting(tarjeta(), []);
  eq(r.precarga.campos, 11, "los once campos del vuelo, como los cuenta el diseño (V3)");
  eq(r.precarga.desdeLaTarjeta.length + r.precarga.vacios.length, 11);
  assert(r.precarga.vacios.indexOf("terminal") >= 0, "la terminal no se deduce del aeropuerto");
  assert(r.precarga.vacios.indexOf("end") >= 0, "la hora de llegada no se calcula");
  assert(r.precarga.vacios.indexOf("confirmation") >= 0, "el código de reserva no se inventa");
  eq(r.precarga.vuelo.terminal, "");
  eq(r.precarga.vuelo.end, "");
  eq(r.precarga.vuelo.confirmation, "");
});

await test("con un vuelo que no coincide: las dos salidas, y ninguna marcada como la correcta", function () {
  var otro = existente({ id: "it-7", flightNumber: "AR1143", start: "2026-03-10T22:40" });
  var r = E.matchAgainstExisting(tarjeta(), [otro]);
  eq(r.resultado, "sin-vuelo");
  eq(r.caso, "un-vuelo");
  eq(r.candidatos.length, 1);
  eq(r.candidatos[0].id, "it-7");
  eq(r.opciones.join(","), "asociar,crear", "asociarla a ese vuelo, o crear uno nuevo");
  assert(!("preferida" in r) && !("sugerida" in r) && !r.existente,
    "el motor no elige: un número que no coincide puede ser un número mal leído");
  assert(!r.patch, "sin match no hay patch que aplicar");
});

await test("con varios vuelos y ninguno que coincida: vienen todos, ordenados por salida, con lo que los distingue", function () {
  var v1 = existente({ id: "it-a", flightNumber: "AR9", start: "2026-03-18T06:00", from: "MAD", to: "BCN" });
  var v2 = existente({ id: "it-b", flightNumber: "AR8", start: "2026-03-10T22:40", from: "EZE", to: "MAD" });
  var v3 = existente({ id: "it-c", flightNumber: "", start: "", from: "BCN", to: "EZE" });
  var hotel = { id: "it-h", type: "stay", title: "Hotel", start: "2026-03-11T14:00" };
  var r = E.matchAgainstExisting(tarjeta(), [v1, v2, v3, hotel]);
  eq(r.resultado, "sin-vuelo");
  eq(r.caso, "varios-vuelos");
  eq(r.candidatos.length, 3, "todos los vuelos del viaje, no sólo los del día de la tarjeta");
  eq(r.candidatos.map(function (c) { return c.id; }).join(","), "it-b,it-a,it-c",
    "ordenados por fecha de salida; el que no tiene fecha va al final");
  assert(r.candidatos.every(function (c) { return "id" in c && "from" in c && "to" in c && "start" in c; }),
    "ruta y fecha, que es lo que los distingue en la pantalla (V5)");
  eq(r.opciones.join(","), "asociar,crear");
});

await test("una tarjeta sin fecha legible tampoco se convierte en un vuelo", function () {
  var r = E.matchAgainstExisting(tarjeta({ start: "" }), []);
  eq(r.resultado, "sin-vuelo", "sin fecha no hay con qué comparar, pero sigue sin ser un vuelo");
  eq(r.caso, "sin-vuelos");
});

await test("primero el match, siempre: si coincide, no pregunta nada", function () {
  var ya = existente({ id: "it-1", seat: "", gate: "", boardingTime: "" });
  var r = E.matchAgainstExisting(tarjeta(), [ya]);
  eq(r.resultado, "mismo", "el caso frecuente tiene que seguir siendo invisible");
  eq(r.esTarjeta, true, "y la interfaz sigue pudiendo poner el chip");
  eq(r.patch.seat, "14A");
  eq(r.patch.gate, "22");
  eq(r.patch.boardingTime, "21:10");
  assert(r.motivo.indexOf("AR1140") >= 0, "deja registro de por qué coincidió");
});

await test("no todo vuelo es una tarjeta: un pasaje sin vuelos cargados sigue creando su reserva", function () {
  var r = E.matchAgainstExisting(reservaVuelo(), []);
  eq(r.resultado, "nuevo", "esto no se toca: es el camino de siempre de un pasaje");
  eq(r.esTarjeta, false);
  assert(!r.precarga, "un pasaje no necesita que le pregunten nada");
});

await test("un voucher de micro con asiento sigue siendo una reserva nueva", function () {
  var r = E.matchAgainstExisting({ type: "transfer", title: "Lobos Bus", provider: "Lobos", seat: "12" }, []);
  eq(r.resultado, "nuevo");
  eq(r.esTarjeta, false);
});

/* ============================================================
   VAL-60 · UN LOTE, UNA LLAMADA
   ============================================================ */

/** Un texto de comprobante que pasa el umbral de "texto suficiente" (120 car., 15 palabras, 4 dígitos). */
function textoDe(codigo, ciudad) {
  return "COMPROBANTE DE RESERVA " + codigo + "\nPasajero: Clara Sanchez\nSalida: 2026-03-10 19:01 desde " +
    ciudad + "\nLlegada: 2026-03-10 20:31\nAsiento 14 · Documento 30123456 · Emitido el 2026-02-01";
}

/** extractPdfText falso que devuelve el texto que le corresponde a cada archivo. */
function extractorPorArchivo(mapa) {
  return async function (blob, info) {
    var nombre = (info && info.name) || "";
    if (!(nombre in mapa)) return { texto: "", paginas: 1 };
    return { texto: mapa[nombre], paginas: 1 };
  };
}

/** Espía de callModel: guarda cada prompt y cada opciones, y contesta lo que le digan. */
function espiaCallModel(responder) {
  var espia = { llamadas: 0, prompts: [], opciones: [] };
  espia.fn = async function (prompt, o) {
    espia.llamadas++;
    espia.prompts.push(prompt);
    espia.opciones.push(o);
    return responder(prompt, o, espia.llamadas);
  };
  return espia;
}

function tresPdfsDeTexto() {
  return [filePdf("uno.pdf"), filePdf("dos.pdf"), filePdf("tres.pdf")];
}
function textosDeLosTres() {
  return extractorPorArchivo({
    "uno.pdf": textoDe("AAA111", "Lobos"),
    "dos.pdf": textoDe("BBB222", "Chascomus"),
    "tres.pdf": textoDe("CCC333", "Dolores")
  });
}
/** La respuesta que pide el prompt de lote: un arreglo con el número de documento. */
function respuestaDeLote() {
  return {
    documentos: [
      { documento: 1, items: [{ type: "transfer", title: "Micro a Lobos", provider: "Lobos Bus", confirmation: "AAA111" }] },
      { documento: 2, items: [{ type: "transfer", title: "Micro a Chascomús", provider: "Lobos Bus", confirmation: "BBB222" }] },
      { documento: 3, items: [{ type: "transfer", title: "Micro a Dolores", provider: "Lobos Bus", confirmation: "CCC333" }] }
    ]
  };
}

group("VAL-60 · un lote de textos se resuelve en UNA llamada");

await test("tres PDFs con texto: UNA sola llamada al modelo, no tres", async function () {
  var espia = espiaCallModel(function () { return respuestaDeLote(); });
  var res = await E.interpretFiles(tresPdfsDeTexto(), {
    callModel: espia.fn,
    extractPdfText: textosDeLosTres()
  });
  eq(espia.llamadas, 1, "es lo que pide el contrato: ONE call that returns a JSON array");
  eq(res.resumen.llamadas, 1);
  eq(res.resumen.lotes, 1);
  eq(res.resumen.ok, 3);
  eq(res.reservas.length, 3);
});

await test("cada reserva del lote queda atribuida a SU archivo", async function () {
  var espia = espiaCallModel(function () { return respuestaDeLote(); });
  var res = await E.interpretFiles(tresPdfsDeTexto(), {
    callModel: espia.fn,
    extractPdfText: textosDeLosTres()
  });
  var porArchivo = {};
  res.reservas.forEach(function (r) { porArchivo[r.archivo] = r.confirmation; });
  eq(porArchivo["uno.pdf"], "AAA111");
  eq(porArchivo["dos.pdf"], "BBB222");
  eq(porArchivo["tres.pdf"], "CCC333");
  res.archivos.forEach(function (a) {
    assert(a.reservas.every(function (r) { return r.archivo === a.archivo; }),
      "si se mezclan, la pantalla de revisión miente sobre de dónde salió cada dato");
  });
});

await test("el prompt del lote lleva los tres textos, numerados, y pide un arreglo por documento", async function () {
  var espia = espiaCallModel(function () { return respuestaDeLote(); });
  await E.interpretFiles(tresPdfsDeTexto(), { callModel: espia.fn, extractPdfText: textosDeLosTres() });
  var p = espia.prompts[0];
  assert(p.indexOf("AAA111") >= 0 && p.indexOf("BBB222") >= 0 && p.indexOf("CCC333") >= 0,
    "los tres documentos tienen que viajar enteros");
  assert(p.indexOf("DOCUMENTO 1 de 3") >= 0 && p.indexOf("DOCUMENTO 3 de 3") >= 0, "numerados y delimitados");
  assert(p.indexOf('"documentos"') >= 0, "el formato pedido es un arreglo con el número de documento");
  assert(/NUNCA inventes/.test(p), "y la regla de no inventar sigue estando");
  assert(!("images" in espia.opciones[0]), "el camino de texto nunca manda la clave images");
  eq(espia.opciones[0].modo, "texto");
  eq(espia.opciones[0].archivos.join(","), "uno.pdf,dos.pdf,tres.pdf");
});

await test("el progreso sigue siendo por fila: cada archivo avisa que se prepara, que se lee y que terminó", async function () {
  var eventos = [];
  var espia = espiaCallModel(function () { return respuestaDeLote(); });
  await E.interpretFiles(tresPdfsDeTexto(), {
    callModel: espia.fn,
    extractPdfText: textosDeLosTres(),
    onProgress: function (e) { eventos.push(e); }
  });
  ["uno.pdf", "dos.pdf", "tres.pdf"].forEach(function (nombre) {
    var suyos = eventos.filter(function (e) { return e.archivo === nombre; }).map(function (e) { return e.evento; });
    eq(suyos.join(","), "preparando,preparado,leyendo,terminado", "la fila de " + nombre + " recorre sus cuatro estados");
  });
  var preparado = eventos.find(function (e) { return e.evento === "preparado" && e.archivo === "dos.pdf"; });
  eq(preparado.modo, "texto", "antes de llamar al modelo ya se sabe que se leyó del texto del PDF");
  assert(preparado.caracteres > 0);
  var leyendo = eventos.find(function (e) { return e.evento === "leyendo" && e.archivo === "dos.pdf"; });
  eq(leyendo.lote.join(","), "uno.pdf,dos.pdf,tres.pdf", "la fila sabe con quién comparte la llamada");
  var terminado = eventos.find(function (e) { return e.evento === "terminado" && e.archivo === "tres.pdf"; });
  eq(terminado.resultado.reservas[0].confirmation, "CCC333");
});

await test("un onProgress que se rompe no tumba la importación", async function () {
  var espia = espiaCallModel(function () { return respuestaDeLote(); });
  var res = await E.interpretFiles(tresPdfsDeTexto(), {
    callModel: espia.fn,
    extractPdfText: textosDeLosTres(),
    onProgress: function () { throw new Error("la pantalla se cayó"); }
  });
  eq(res.resumen.ok, 3, "el progreso es adorno: nunca decide si se importa o no");
});

await test("un archivo roto en el lote no tumba a los otros dos", async function () {
  var espia = espiaCallModel(function () {
    return {
      documentos: [
        { documento: 1, items: [{ type: "transfer", title: "Micro a Lobos", provider: "Lobos Bus", confirmation: "AAA111" }] },
        { documento: 2, items: [{ type: "transfer", title: "Micro a Dolores", provider: "Lobos Bus", confirmation: "CCC333" }] }
      ]
    };
  });
  var res = await E.interpretFiles(
    [filePdf("uno.pdf"), { name: "roto.zip", mimeType: "application/zip", blob: blob("z") }, filePdf("tres.pdf")],
    {
      callModel: espia.fn,
      extractPdfText: extractorPorArchivo({ "uno.pdf": textoDe("AAA111", "Lobos"), "tres.pdf": textoDe("CCC333", "Dolores") })
    }
  );
  eq(res.archivos.length, 3, "los tres aparecen en el resultado");
  eq(res.resumen.errores, 1);
  eq(res.resumen.ok, 2);
  var roto = res.archivos.find(function (a) { return a.archivo === "roto.zip"; });
  eq(roto.error.codigo, "tipo-no-soportado");
  eq(espia.llamadas, 1, "el que no se podía leer ni siquiera entró en la llamada");
  eq(res.reservas.length, 2);
  eq(res.archivos[0].reservas[0].confirmation, "AAA111");
  eq(res.archivos[2].reservas[0].confirmation, "CCC333");
});

await test("una foto en la misma carga sigue yendo sola: agrupar imágenes no ahorra nada", async function () {
  var espia = espiaCallModel(function (prompt, o) {
    if (o.images) return { items: [{ type: "stay", title: "Hotel", provider: "Booking" }] };
    return {
      documentos: [
        { documento: 1, items: [{ type: "transfer", title: "Micro a Lobos", provider: "Lobos Bus", confirmation: "AAA111" }] },
        { documento: 2, items: [{ type: "transfer", title: "Micro a Chascomus", provider: "Lobos Bus", confirmation: "BBB222" }] }
      ]
    };
  });
  var res = await E.interpretFiles(
    [filePdf("uno.pdf"), filePdf("dos.pdf"), fileImg("foto.jpg")],
    { callModel: espia.fn, extractPdfText: textosDeLosTres() }
  );
  eq(espia.llamadas, 2, "una llamada para los dos textos, una para la foto");
  eq(res.resumen.lotes, 1);
  eq(res.resumen.porTexto, 2);
  eq(res.resumen.porImagenes, 1);
  eq(res.archivos.find(function (a) { return a.archivo === "foto.jpg"; }).reservas[0].title, "Hotel");
});

await test("un solo archivo de texto usa el prompt de siempre, no el de lote", async function () {
  var espia = espiaCallModel(function () { return { items: [{ type: "transfer", title: "Micro", provider: "Lobos Bus" }] }; });
  var res = await E.interpretFiles([filePdf("uno.pdf")], {
    callModel: espia.fn,
    extractPdfText: extractorPorArchivo({ "uno.pdf": textoDe("AAA111", "Lobos") })
  });
  eq(espia.llamadas, 1);
  assert(espia.prompts[0].indexOf("COMIENZA EL COMPROBANTE") >= 0, "con uno solo no hay nada que agrupar");
  eq(res.resumen.ok, 1);
});

group("VAL-60 · cuando el lote no sale bien, nadie queda mal atribuido");

await test("si la respuesta no dice de qué documento salió cada reserva, se relee archivo por archivo", async function () {
  var espia = espiaCallModel(function (prompt) {
    // El modelo contesta la forma plana, sin números: no hay forma de saber
    // cuál es de cuál sin adivinar.
    if (prompt.indexOf("DOCUMENTO 1 de 3") >= 0) {
      return { items: [{ type: "transfer", title: "Micro", provider: "Lobos Bus", confirmation: "AAA111" },
                       { type: "transfer", title: "Micro", provider: "Lobos Bus", confirmation: "BBB222" }] };
    }
    var cod = ["AAA111", "BBB222", "CCC333"].find(function (c) { return prompt.indexOf(c) >= 0; });
    return { items: [{ type: "transfer", title: "Micro", provider: "Lobos Bus", confirmation: cod }] };
  });
  var res = await E.interpretFiles(tresPdfsDeTexto(), { callModel: espia.fn, extractPdfText: textosDeLosTres() });
  eq(espia.llamadas, 4, "una del lote que no sirvió, más una por archivo");
  eq(res.resumen.ok, 3);
  eq(res.archivos[0].reservas[0].confirmation, "AAA111");
  eq(res.archivos[1].reservas[0].confirmation, "BBB222");
  eq(res.archivos[2].reservas[0].confirmation, "CCC333");
});

await test("parseBatchResponse nunca adivina: sin atribución clara devuelve null", function () {
  eq(E.parseBatchResponse({ items: [{ type: "flight", title: "A" }] }, 3), null);
  eq(E.parseBatchResponse("no es JSON", 2), null);
  eq(E.parseBatchResponse({ documentos: [{ documento: 1, items: [] }, { items: [] }] }, 2), null,
    "si unas entradas traen número y otras no, es mezcla");
  var porOrden = E.parseBatchResponse({ documentos: [{ items: [{ type: "note", title: "A", provider: "X" }] }, { items: [] }] }, 2);
  assert(porOrden && porOrden.length === 2 && porOrden[0][0].title === "A",
    "sin ningún número y con una entrada por documento, el orden es la única lectura posible y es la que se pidió");
});

await test("un lote que falla por tamaño se reintenta archivo por archivo", async function () {
  var espia = espiaCallModel(function (prompt, o, n) {
    if (n === 1) throw Object.assign(new Error("muy largo"), { code: "prompt_too_large" });
    if (prompt.indexOf("BBB222") >= 0) throw Object.assign(new Error("otra vez"), { code: "prompt_too_large" });
    var cod = ["AAA111", "CCC333"].find(function (c) { return prompt.indexOf(c) >= 0; });
    return { items: [{ type: "transfer", title: "Micro", provider: "Lobos Bus", confirmation: cod }] };
  });
  var res = await E.interpretFiles(tresPdfsDeTexto(), { callModel: espia.fn, extractPdfText: textosDeLosTres() });
  eq(espia.llamadas, 4);
  eq(res.resumen.ok, 2, "los dos que sí entraban se leen igual (VAL-41)");
  eq(res.resumen.errores, 1);
  eq(res.archivos[1].error.codigo, "prompt_too_large");
});

await test("un límite de cuota no se reintenta seis veces: el error se reparte y se dice", async function () {
  var espia = espiaCallModel(function () {
    throw Object.assign(new Error("pará un poco"), { code: "rate_limited" });
  });
  var res = await E.interpretFiles(tresPdfsDeTexto(), { callModel: espia.fn, extractPdfText: textosDeLosTres() });
  eq(espia.llamadas, 1, "repetirlo no lo arregla y lo empeora");
  eq(res.resumen.errores, 3);
  res.archivos.forEach(function (a) {
    eq(a.error.codigo, "rate_limited");
    eq(a.error.mensaje, E.MODEL_ERROR_MESSAGES.rate_limited);
  });
});

await test("sin callModel inyectado, el lote degrada con dignidad: cada archivo dice que la IA no está", async function () {
  var res = await E.interpretFiles(tresPdfsDeTexto(), { extractPdfText: textosDeLosTres() });
  eq(res.resumen.errores, 3);
  eq(res.resumen.llamadas, 0);
  res.archivos.forEach(function (a) { eq(a.error.codigo, "ia-no-disponible"); });
});

group("VAL-60 · el tope de 64 KiB se mira por lote, no sólo por archivo");

await test("planBatches parte por cantidad de documentos", function () {
  var ocho = [];
  for (var i = 0; i < 8; i++) ocho.push({ texto: "corto" });
  var lotes = E.planBatches(ocho);
  eq(lotes.length, 2, "el techo de documentos por lote es " + E.LIMITES_LOTE.maxDocumentos);
  eq(lotes[0].length, E.LIMITES_LOTE.maxDocumentos);
  eq(lotes[1].length, 8 - E.LIMITES_LOTE.maxDocumentos);
});

await test("planBatches parte por caracteres, y respeta el orden de los archivos", function () {
  var largo = new Array(E.MAX_CARACTERES_TEXTO + 1).join("x");   // 12000 caracteres, el tope de UN documento
  var lotes = E.planBatches([
    { texto: largo, n: 1 }, { texto: largo, n: 2 }, { texto: largo, n: 3 }
  ]);
  eq(lotes.length, 2, "dos documentos al tope ya llenan los " + E.LIMITES_LOTE.maxCaracteres + " del lote");
  eq(lotes[0].map(function (e) { return e.n; }).join(","), "1,2");
  eq(lotes[1].map(function (e) { return e.n; }).join(","), "3");
});

await test("cuatro PDFs largos de verdad salen en dos llamadas, no en una que no entra", async function () {
  // Cada documento ocupa poco menos de la mitad del lote: entran de a dos.
  var largo = textoDe("AAA111", "Lobos") + "\n" + new Array(11000).join("y");
  var espia = espiaCallModel(function (prompt) {
    var n = (prompt.match(/COMIENZA EL DOCUMENTO/g) || []).length;
    var docs = [];
    for (var i = 1; i <= n; i++) docs.push({ documento: i, items: [{ type: "transfer", title: "Micro", provider: "Lobos Bus" }] });
    return { documentos: docs };
  });
  var archivos = ["a.pdf", "b.pdf", "c.pdf", "d.pdf"].map(function (n) { return filePdf(n); });
  var mapa = {}; archivos.forEach(function (f) { mapa[f.name] = largo; });
  var res = await E.interpretFiles(archivos, { callModel: espia.fn, extractPdfText: extractorPorArchivo(mapa) });
  eq(res.resumen.lotes, 2);
  eq(espia.llamadas, 2, "cuatro llamadas seguirían siendo cuatro; dos entran en el tope del prompt");
  eq(res.resumen.ok, 4);
  espia.prompts.forEach(function (p) {
    assert(p.length < 32000, "cada prompt tiene que quedar cómodo abajo de los 64 KiB del contrato");
  });
});

/* ---------- cierre ---------- */
console.log("\n" + "=".repeat(52));
console.log("  " + passed + " pasaron, " + failed + " fallaron");
if (failed) {
  console.log("\n  Fallaron:");
  pending.forEach(function (n) { console.log("   - " + n); });
}
console.log("=".repeat(52) + "\n");
process.exitCode = failed ? 1 : 0;
}

main().catch(function (e) {
  console.error("\nLa corrida se cayó antes de terminar:\n", e);
  process.exitCode = 1;
});
