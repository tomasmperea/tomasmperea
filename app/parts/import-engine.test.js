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

   Nada de esto toca el navegador: los "blobs" son objetos cualquiera,
   porque el motor no mira su contenido, sólo los pasa a `callModel`.
   `renderPdfToImages` se inyecta como una función falsa, igual que en
   la app se inyectaría `renderPdfPagesToImages` ya atado a pdf.js.
   ============================================================ */

var E = require("./import-engine.js");

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

/** Documento de pdf.js falso, con `numPages` páginas que "renderizan" sin problema. */
function fakePdfDocument(numPages) {
  return {
    numPages: numPages,
    getPage: function () {
      return Promise.resolve({
        getViewport: function () { return { width: 100, height: 100 }; },
        render: function () { return { promise: Promise.resolve() }; }
      });
    }
  };
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
      return { promise: Promise.resolve(fakePdfDocument(opts.numPages || 1)) };
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
