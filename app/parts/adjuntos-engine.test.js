/* ============================================================
   VALIJA · PRUEBAS DEL MOTOR DE ADJUNTOS (VAL-58)
   Sin frameworks. Se corre así:

       node app/parts/adjuntos-engine.test.js

   Imprime cada caso, lo que falló, y sale con código distinto de cero
   si hay una sola falla (ver `process.exitCode` al final).

   ------------------------------------------------------------
   QUÉ TOCA LA PERSONA, Y QUÉ TOCA ESTA PRUEBA
   ------------------------------------------------------------
   La persona toca "Archivo" o "Sacar foto" en la hoja de la reserva
   (D8), elige un archivo, y la app llama a `prepararDocumento` con lo
   que devolvió el `<input type="file">`. Esta prueba entra por
   `prepararDocumento`, que es el primer punto del motor después del
   gesto. Lo que va ANTES —que el botón dispare el selector en el
   teléfono— no lo cubre este archivo y no puede: es DOM, y es
   exactamente el tramo donde ya murió una vez el importador. Se
   conecta con `wireFileInput` (diseño 7.4) y se prueba tocando el
   botón en la app publicada.

   Lo que esta prueba NO prueba, escrito para que no se confunda con
   "verificado":
     · La recompresión real. `recomprimirImagenConCanvas` necesita
       canvas y acá se inyecta un doble. El doble replica el CONTRATO
       que declara el motor (recibe un paso, devuelve bytes y mime),
       no el resultado real de un JPEG: el tamaño que devuelve sale de
       un modelo inventado y sirve para probar la ESCALERA, nunca para
       afirmar cuánto va a pesar una foto de verdad.
     · Que la base acepte o rechace un documento. Acá se compara
       contra los números del brief y contra el tamaño serializado
       real (`JSON.stringify`), que sí se puede medir sin red.
   ============================================================ */

/* La fecha de la línea de datos ("adjuntada el 20 sep") se arma con la
   zona horaria del dispositivo, que es la que vio la persona. Para que
   la prueba sea determinista se fija la zona del PM antes de crear
   cualquier Date; sin esto, la misma prueba pasa en Buenos Aires y falla
   en +14, que es justo el tipo de prueba que no garantiza lo que dice. */
process.env.TZ = "America/Argentina/Buenos_Aires";

var A = require("./adjuntos-engine.js");

/* ---------- arnés mínimo, igual al de import-engine.test.js ---------- */
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
function incluye(texto, trozo, msg) {
  if (String(texto).indexOf(trozo) < 0) {
    throw new Error((msg ? msg + ". " : "") + "esperaba que \"" + texto + "\" incluyera \"" + trozo + "\"");
  }
}

/* ---------- helpers de prueba ---------- */

/** Bytes de relleno deterministas: el motor no mira el contenido, sólo su largo. */
function relleno(n) {
  var u = new Uint8Array(n);
  for (var i = 0; i < n; i++) u[i] = (i * 7 + 13) & 0xff;
  return u;
}

/** Un archivo como el que devuelve un <input type="file">, con bytes de verdad. */
function archivo(nombre, mime, n) {
  return { name: nombre, mimeType: mime, size: n, bytes: relleno(n) };
}

/** Un archivo grande del que NO queremos materializar los bytes (una foto de 3 MB). */
function archivoPesado(nombre, mime, n) {
  return { name: nombre, mimeType: mime, size: n, bytes: null };
}

/**
 * Doble de `recomprimirImagenConCanvas`, fiel al contrato que declara el
 * motor: recibe (archivo, paso) y resuelve { bytes, mime, ancho, alto }.
 *
 * El tamaño sale de un modelo inventado —bytes ≈ lado² · densidad ·
 * calidad— que sólo sirve para que la escalera tenga que trabajar. NO
 * predice cuánto pesa un JPEG real; eso se mide en el teléfono.
 */
function recompresorFalso(cfg) {
  cfg = cfg || {};
  var ladoOriginal = cfg.ladoOriginal || 4032;
  var densidad = cfg.densidad == null ? 0.05 : cfg.densidad;
  var f = async function (file, paso) {
    var lado = Math.min(paso.ladoMayor, ladoOriginal);
    var bytes = Math.round(lado * lado * densidad * paso.calidad);
    f.pasos.push({ ladoMayor: paso.ladoMayor, calidad: paso.calidad, bytes: bytes });
    return { bytes: relleno(bytes), mime: "image/jpeg", ancho: lado, alto: Math.round(lado * 0.6) };
  };
  f.pasos = [];
  f.liberado = 0;
  f.liberar = function () { f.liberado++; };
  return f;
}

/** Espía que falla si alguien lo llama: sirve para probar que NO se llamó. */
function nuncaLlamar(nombre) {
  var f = async function () { f.llamadas++; throw new Error("no se tenía que llamar a " + nombre); };
  f.llamadas = 0;
  return f;
}

/* Tamaños REALES de los documentos del PM (brief VAL-58). */
var VOUCHER_MICRO = 20921;    // voucher de Lobos Bus, PDF
var PASAJE_AEROLINEAS = 123129; // pasaje de Aerolíneas, PDF
var FOTO_DE_CAMARA = 3250586;  // ≈ 3,1 MB

var AHORA = "2025-09-20T12:00:00.000Z";

async function main() {

/* ============================================================ */
group("Los números del brief, sin recalcularlos distinto");

await test("el tope de archivo crudo es 194.560 bytes (190 KB) y el de la base 256 KiB", function () {
  eq(A.TOPE_ARCHIVO_BYTES, 194560, "corregido el 13/09: 192 KB no dejaba lugar para el envoltorio");
  eq(A.TOPE_DOC_BASE_BYTES, 262144);
});

await test("codificar infla un tercio, y 190 KB dejan 2,7 KB de margen bajo el tope de la base", function () {
  eq(A.bytesCodificados(194560), 259416);
  assert(A.TOPE_DOC_BASE_BYTES - A.bytesCodificados(A.TOPE_ARCHIVO_BYTES) > 2048,
         "el archivo más grande que el motor acepta tiene que dejar lugar para los nombres de campo");
  eq(A.bytesCodificados(196608), 262144, "192 KB codificados ocupan el tope entero: por eso se bajó");
  eq(A.bytesCodificados(1), 4);
  eq(A.bytesCodificados(2), 4);
  eq(A.bytesCodificados(3), 4);
  eq(A.bytesCodificados(4), 8);
  eq(A.bytesCodificados(0), 0);
});

await test("el peso se muestra como lo muestra el diseño (KB de 1024, coma decimal)", function () {
  eq(A.formatearBytes(194560), "190 KB", "el tope que dice la interfaz");
  eq(A.formatearBytes(VOUCHER_MICRO), "20 KB", "el voucher del PM, igual que D10");
  eq(A.formatearBytes(182272), "178 KB", "la foto recomprimida de D5/D11");
  eq(A.formatearBytes(1258291), "1,2 MB", "el PDF que no entra, D12");
  eq(A.formatearBytes(FOTO_DE_CAMARA), "3,1 MB", "la foto de cámara de D5");
  eq(A.formatearBytes(512), "512 bytes");
});

/* ============================================================ */
group("Estado 1 · entra tal cual");

await test("el voucher de micro del PM (20.921 bytes) entra tal cual", async function () {
  var r = await A.prepararDocumento(archivo("voucher-lobos-bus.pdf", "application/pdf", VOUCHER_MICRO), {
    origen: "importar", tipoReserva: "transfer", paginas: 1, ahora: AHORA, id: "d1"
  });
  eq(r.estado, "ok");
  eq(r.error, null);
  eq(r.doc.estado, "ok");
  eq(r.doc.bytes, VOUCHER_MICRO);
  assert(!("bytesOriginales" in r.doc), "si no se recomprimió, no se guarda un peso original que no existe");
  eq(r.recompresion, null);
  assert(r.cuerpo && typeof r.cuerpo.b64 === "string", "el cuerpo va codificado como texto");
});

await test("el pasaje de Aerolíneas del PM (123.129 bytes) entra tal cual", async function () {
  var r = await A.prepararDocumento(archivo("pasaje-aerolineas.pdf", "application/pdf", PASAJE_AEROLINEAS), {
    origen: "importar", tipoReserva: "flight", paginas: 2, ahora: AHORA, id: "d2"
  });
  eq(r.estado, "ok");
  eq(r.doc.nombreCorto, "Pasaje");
  eq(r.doc.paginas, 2);
});

await test("el cuerpo codificado vuelve a ser el archivo, byte por byte", async function () {
  var f = archivo("voucher.pdf", "application/pdf", 5000);
  var r = await A.prepararDocumento(f, { origen: "manual", ahora: AHORA, id: "d3" });
  var vuelta = Buffer.from(r.cuerpo.b64, "base64");   // implementación de confianza, ajena al motor
  eq(vuelta.length, 5000, "el largo tiene que volver igual");
  eq(Buffer.compare(vuelta, Buffer.from(f.bytes)), 0, "el contenido tiene que volver igual");
  // Y el decodificador del propio motor, que es el que usa el visor:
  eq(Buffer.compare(Buffer.from(A.base64ABytes(r.cuerpo.b64)), Buffer.from(f.bytes)), 0);
  // Los tres largos raros del final del base64 (0, 1 y 2 bytes sobrantes):
  [3000, 3001, 3002].forEach(function (n) {
    var u = relleno(n);
    eq(A.bytesABase64(u), Buffer.from(u).toString("base64"), "base64 de " + n + " bytes");
    eq(Buffer.compare(Buffer.from(A.base64ABytes(A.bytesABase64(u))), Buffer.from(u)), 0, "vuelta de " + n + " bytes");
  });
});

await test("una imagen que ya entra NO se toca: no se llama al recompresor", async function () {
  var espia = nuncaLlamar("recomprimirImagen");
  var r = await A.prepararDocumento(archivo("captura.png", "image/png", 90000), {
    origen: "manual", ahora: AHORA, id: "d4", recomprimirImagen: espia
  });
  eq(r.estado, "ok");
  eq(espia.llamadas, 0);
  eq(r.doc.mime, "image/png", "no se convierte a JPEG una imagen que entraba tal cual");
});

/* ============================================================ */
group("El borde exacto");

await test("194.560 bytes entran tal cual", async function () {
  var r = await A.prepararDocumento(archivo("justo.pdf", "application/pdf", 194560), {
    origen: "importar", ahora: AHORA, id: "d5"
  });
  eq(r.estado, "ok");
  eq(r.doc.bytes, 194560);
});

await test("un archivo justo en el tope cabe ENTERO en un documento de la base", async function () {
  var r = await A.prepararDocumento(archivo("justo.pdf", "application/pdf", 194560), {
    origen: "importar", ahora: AHORA, id: "d5"
  });
  // Es la razón de ser de la corrección a 190 KB: con 192 KB el cuerpo
  // serializado quedaba arriba de 256 KiB y la base lo rechazaba.
  assert(A.bytesSerializados(r.cuerpo) <= A.TOPE_DOC_BASE_BYTES,
         "el cuerpo serializado, con sus nombres de campo, tiene que entrar en 256 KiB");
  eq(r.advertencias.length, 0, "y por eso ya no hay nada que advertir");
});

await test("194.561 bytes no entran: un byte más y es rechazo", async function () {
  var r = await A.prepararDocumento(archivo("uno-mas.pdf", "application/pdf", 194561), {
    origen: "importar", ahora: AHORA, id: "d6"
  });
  eq(r.estado, "no-entra");
  eq(r.doc, null);
  eq(r.cuerpo, null);
  eq(r.error.codigo, "no-entra-pdf");
});

/* ============================================================ */
group("Estado 2 · entra recomprimido, y lo declara");

await test("una foto de cámara de 3,1 MB entra reducida y el motor lo dice", async function () {
  var rec = recompresorFalso({ densidad: 0.05 });
  var r = await A.prepararDocumento(archivoPesado("foto-tarjeta.jpg", "image/jpeg", FOTO_DE_CAMARA), {
    origen: "camara", esTarjeta: true, ahora: AHORA, id: "d7", recomprimirImagen: rec
  });
  eq(r.estado, "recomprimido");
  eq(r.doc.estado, "recomprimido", "el estado se GUARDA con el documento: D5 lo muestra cada vez que se abre");
  eq(r.doc.bytesOriginales, FOTO_DE_CAMARA, "los dos números tienen que estar para el aviso de D5/D11");
  assert(r.doc.bytes < FOTO_DE_CAMARA, "tiene que pesar menos que la original");
  assert(r.doc.bytes <= A.TOPE_ARCHIVO_BYTES, "y tiene que entrar");
  eq(r.doc.mime, "image/jpeg");
  assert(r.recompresion && r.recompresion.pasos >= 1, "se informa cuánto costó reducirla");
  eq(r.recompresion.desdeBytes, FOTO_DE_CAMARA);
  eq(r.recompresion.aBytes, r.doc.bytes);
});

await test("la reducción baja por la escalera hasta el primer paso que entra", async function () {
  var rec = recompresorFalso({ densidad: 0.12 });
  var r = await A.prepararDocumento(archivoPesado("foto.jpg", "image/jpeg", FOTO_DE_CAMARA), {
    origen: "camara", ahora: AHORA, id: "d8", recomprimirImagen: rec
  });
  eq(r.estado, "recomprimido");
  assert(rec.pasos.length > 1, "con una foto densa tiene que haber probado más de un paso");
  eq(rec.pasos.length, r.recompresion.pasos);
  var ultimo = rec.pasos[rec.pasos.length - 1];
  eq(ultimo.bytes, r.doc.bytes, "se queda con el primer paso que entra, no sigue achicando de gusto");
});

await test("una foto recomprimida se guarda con margen: nunca al filo del tope", async function () {
  var rec = recompresorFalso({ densidad: 0.12 });
  var r = await A.prepararDocumento(archivoPesado("foto.jpg", "image/jpeg", FOTO_DE_CAMARA), {
    origen: "camara", ahora: AHORA, id: "d9", recomprimirImagen: rec
  });
  assert(r.doc.bytes <= A.OBJETIVO_RECOMPRESION_BYTES, "apunta al objetivo con margen, no al tope pelado");
  assert(A.bytesSerializados(r.cuerpo) <= A.TOPE_DOC_BASE_BYTES, "y el documento entero entra en la base");
  eq(r.advertencias.length, 0);
});

/* ============================================================ */
group("Estado 3 · no entra");

await test("un PDF de 1,2 MB no entra, y el mensaje trae los dos números", async function () {
  var r = await A.prepararDocumento(archivoPesado("itinerario-completo.pdf", "application/pdf", 1258291), {
    origen: "importar", ahora: AHORA, id: "d10"
  });
  eq(r.estado, "no-entra");
  eq(r.error.codigo, "no-entra-pdf");
  incluye(r.error.mensaje, "1,2 MB");
  incluye(r.error.mensaje, "190 KB");
  eq(r.doc, null);
});

await test("no entrar el documento NUNCA impide guardar la reserva", async function () {
  var r = await A.prepararDocumento(archivoPesado("grande.pdf", "application/pdf", 1258291), {
    origen: "importar", ahora: AHORA, id: "d11"
  });
  eq(r.bloqueaGuardado, false, "criterio del brief: la reserva se guarda igual");
  eq(r.estado, "no-entra");
});

await test("una foto que no entra ni en el piso de la escalera se rechaza sin guardar algo ilegible", async function () {
  var rec = recompresorFalso({ densidad: 0.5 });
  var r = await A.prepararDocumento(archivoPesado("scan-enorme.jpg", "image/jpeg", 8000000), {
    origen: "camara", ahora: AHORA, id: "d12", recomprimirImagen: rec
  });
  eq(r.estado, "no-entra");
  eq(r.error.codigo, "no-entra-ni-reducida");
  eq(r.doc, null);
  eq(rec.pasos.length, A.ESCALERA_RECOMPRESION.length, "probó toda la escalera antes de rendirse");
});

await test("la escalera nunca baja del piso de legibilidad", async function () {
  var rec = recompresorFalso({ densidad: 0.5 });
  await A.prepararDocumento(archivoPesado("scan-enorme.jpg", "image/jpeg", 8000000), {
    origen: "camara", ahora: AHORA, id: "d13", recomprimirImagen: rec
  });
  assert(A.ESCALERA_RECOMPRESION.length >= 3, "una escalera vacía haría pasar esta prueba sin probar nada");
  assert(rec.pasos.length === A.ESCALERA_RECOMPRESION.length, "y tiene que haberla recorrido entera");
  rec.pasos.forEach(function (p) {
    assert(p.ladoMayor >= A.PISO_LADO_MAYOR, "ningún paso puede achicar por debajo de " + A.PISO_LADO_MAYOR + " px");
    assert(p.calidad >= A.PISO_CALIDAD, "ningún paso puede bajar la calidad de " + A.PISO_CALIDAD);
  });
  A.ESCALERA_RECOMPRESION.forEach(function (p) {
    assert(p.ladoMayor >= A.PISO_LADO_MAYOR && p.calidad >= A.PISO_CALIDAD, "la escalera declarada respeta su propio piso");
  });
});

await test("sin canvas no se rompe nada: el archivo no entra y se dice qué hacer", async function () {
  var r = await A.prepararDocumento(archivoPesado("foto.jpg", "image/jpeg", FOTO_DE_CAMARA), {
    origen: "camara", ahora: AHORA, id: "d14", recomprimirImagen: null
  });
  eq(r.estado, "no-entra");
  eq(r.error.codigo, "sin-recompresor");
  eq(r.bloqueaGuardado, false);
  incluye(r.error.mensaje, "190 KB");
});

/* ============================================================ */
group("Archivos que no se pueden guardar");

await test("un archivo de cero bytes no se guarda, y no se lee ni se recomprime", async function () {
  var espia = nuncaLlamar("recomprimirImagen");
  var r = await A.prepararDocumento(archivo("vacio.pdf", "application/pdf", 0), {
    origen: "manual", ahora: AHORA, id: "d15", recomprimirImagen: espia
  });
  eq(r.estado, "no-entra");
  eq(r.error.codigo, "archivo-vacio");
  eq(r.doc, null);
  eq(espia.llamadas, 0);
});

await test("un tipo que no reconocemos se rechaza nombrando los que sí", async function () {
  var r = await A.prepararDocumento(archivo("reserva.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 30000), {
    origen: "manual", ahora: AHORA, id: "d16"
  });
  eq(r.estado, "no-entra");
  eq(r.error.codigo, "tipo-no-soportado");
  incluye(r.error.mensaje, "PDF");
});

await test("sin mime (pasa en Android) el tipo sale de la extensión", async function () {
  var r = await A.prepararDocumento(archivo("voucher.pdf", "", VOUCHER_MICRO), {
    origen: "manual", ahora: AHORA, id: "d17"
  });
  eq(r.estado, "ok");
  eq(r.doc.mime, "application/pdf");
  eq(A.clasificarArchivo({ name: "foto.JPG", mimeType: "" }).familia, "imagen");
});

/* ============================================================ */
group("El tope de tres documentos por reserva");

await test("con tres documentos ya adjuntos, el cuarto no se prepara siquiera", async function () {
  var espia = nuncaLlamar("recomprimirImagen");
  var yaHay = [{ id: "a" }, { id: "b" }, { id: "c" }];
  var r = await A.prepararDocumento(archivo("cuarto.pdf", "application/pdf", 10000), {
    origen: "manual", ahora: AHORA, id: "d18", docsActuales: yaHay, recomprimirImagen: espia
  });
  eq(r.estado, "no-entra");
  eq(r.error.codigo, "tope-de-reserva");
  eq(espia.llamadas, 0, "no se gasta tiempo ni memoria en un archivo que no se va a poder guardar");
});

await test("espacioParaDocumentos cuenta, etiqueta y dice qué se puede hacer", function () {
  var cero = A.espacioParaDocumentos([]);
  eq(cero.usados, 0); eq(cero.quedan, 3); eq(cero.puedeSumar, true); eq(cero.etiqueta, "Documento");
  var uno = A.espacioParaDocumentos([{ id: "a" }]);
  eq(uno.etiqueta, "Documentos · 1 de 3");
  incluye(uno.frase, "dos documentos más");
  var dos = A.espacioParaDocumentos([{ id: "a" }, { id: "b" }]);
  incluye(dos.frase, "un documento más");
  var tres = A.espacioParaDocumentos([{ id: "a" }, { id: "b" }, { id: "c" }]);
  eq(tres.puedeSumar, false);
  eq(tres.etiqueta, "Documentos · 3 de 3");
  incluye(tres.frase, "quitá uno");
});

await test("agregarDocumento no pisa el tope ni muta la lista que recibe", function () {
  var lista = [{ id: "a" }, { id: "b" }];
  var ok = A.agregarDocumento(lista, { id: "c" });
  eq(ok.error, null);
  eq(ok.docs.length, 3);
  eq(lista.length, 2, "la lista original no se toca: la función es pura");
  var lleno = A.agregarDocumento(ok.docs, { id: "d" });
  eq(lleno.error.codigo, "tope-de-reserva");
  eq(lleno.docs.length, 3);
  eq(A.quitarDocumento(ok.docs, "b").docs.map(function (d) { return d.id; }).join(","), "a,c");
});

/* ============================================================ */
group("El nombre corto (diseño 5.3)");

await test("una tarjeta de embarque interpretada se llama Tarjeta de embarque", function () {
  eq(A.nombreCorto({ origen: "importar", esTarjeta: true, tipoReserva: "flight", nombre: "x.jpg" }), "Tarjeta de embarque");
});

await test("un documento que creó una reserva de vuelo se llama Pasaje", function () {
  eq(A.nombreCorto({ origen: "importar", esTarjeta: false, tipoReserva: "flight", nombre: "x.pdf" }), "Pasaje");
});

await test("cualquier otro documento interpretado se llama Comprobante", function () {
  eq(A.nombreCorto({ origen: "importar", tipoReserva: "stay", nombre: "x.pdf" }), "Comprobante");
  eq(A.nombreCorto({ origen: "importar", tipoReserva: "transfer", nombre: "x.pdf" }), "Comprobante");
});

await test("lo que adjuntó la persona a mano se llama como el archivo, sin la extensión", function () {
  eq(A.nombreCorto({ origen: "manual", nombre: "voucher-lobos-bus.pdf" }), "voucher-lobos-bus");
  eq(A.nombreCorto({ origen: "camara", nombre: "IMG_20250920_0742.jpg" }), "IMG_20250920_0742");
  eq(A.nombreCorto({ origen: "manual", nombre: "" }), "Documento", "nunca un título vacío en la tira");
});

await test("el nombre corto no se pregunta: sale del contexto al preparar", async function () {
  var r = await A.prepararDocumento(archivo("BP_AR1234.pdf", "application/pdf", 12000), {
    origen: "importar", esTarjeta: true, tipoReserva: "flight", ahora: AHORA, id: "d19"
  });
  eq(r.doc.nombreCorto, "Tarjeta de embarque");
});

/* ============================================================ */
group("Qué se guarda, y dónde");

await test("los metadatos del ítem traen lo justo para pintar la tira y el visor", async function () {
  var r = await A.prepararDocumento(archivo("voucher.pdf", "application/pdf", VOUCHER_MICRO), {
    origen: "importar", tipoReserva: "stay", paginas: 1, ahora: AHORA, id: "d20"
  });
  eq(Object.keys(r.doc).sort().join(","),
     "at,bytes,estado,id,mime,nombre,nombreCorto,origen,paginas",
     "ni un campo de más: estos metadatos viajan en el snapshot de ítems");
  eq(r.doc.at, AHORA);
  eq(r.doc.origen, "importar");
  assert(A.bytesSerializados(r.doc) < 400, "los metadatos tienen que ser unas decenas de bytes, no un kilobyte");
});

await test("el cuerpo va aparte, con lo mínimo para devolver el archivo y para poder borrarlo", async function () {
  var r = await A.prepararDocumento(archivo("voucher.pdf", "application/pdf", VOUCHER_MICRO), {
    origen: "importar", ahora: AHORA, id: "d21", itemId: "vuelo1"
  });
  eq(Object.keys(r.cuerpo).sort().join(","), "at,b64,bytes,id,itemId,mime");
  eq(r.cuerpo.id, "d21");
  eq(r.cuerpo.itemId, "vuelo1", "sin esto, un cuerpo huérfano no se puede encontrar para borrarlo");
});

await test("la ruta del cuerpo tiene la cantidad de segmentos que exige la base", function () {
  eq(A.rutaDelCuerpo("viaje1", "d21"), "trips/viaje1/docs/d21");
  eq(A.rutaDelCuerpo("viaje1", "d21").split("/").length % 2, 0, "un documento tiene un número PAR de segmentos");
});

/* ============================================================ */
group("Los textos que el diseño ya escribió");

await test("la tira de la reserva dice tipo y peso, y NADA del estado de compresión", function () {
  var doc = { nombre: "tarjeta.jpg", nombreCorto: "Tarjeta de embarque", mime: "image/jpeg", bytes: 182272, estado: "recomprimido" };
  eq(A.textoTira(doc), "JPG · 178 KB");
  assert(A.textoTira(doc).indexOf("menor calidad") < 0, "el diseño lo descartó a propósito para la tarjeta (sección 4)");
});

await test("la fila del adjunto sí dice páginas y menor calidad", function () {
  eq(A.textoFila({ mime: "application/pdf", bytes: 20921, paginas: 1, estado: "ok" }), "PDF · 1 página · 20 KB");
  eq(A.textoFila({ mime: "image/jpeg", bytes: 182272, estado: "recomprimido" }), "JPG · 178 KB · menor calidad");
  eq(A.textoFila({ mime: "application/pdf", bytes: 167936, paginas: 2, estado: "ok" }), "PDF · 2 páginas · 164 KB");
});

await test("la línea de datos del visor sale igual que en el muestrario", function () {
  eq(A.lineaDeDatos({
    nombre: "tarjeta-g3-1234.jpg", nombreCorto: "Tarjeta de embarque", mime: "image/jpeg",
    bytes: 182272, estado: "ok", origen: "importar", at: "2025-09-20T12:00:00.000Z"
  }), "tarjeta-g3-1234.jpg · JPG · 178 KB · adjuntada el 20 sep desde Importar");

  eq(A.lineaDeDatos({
    nombre: "pasaje-aerolineas.pdf", nombreCorto: "Pasaje", mime: "application/pdf",
    bytes: 167936, paginas: 2, estado: "ok", at: "2025-09-12T12:00:00.000Z"
  }), "pasaje-aerolineas.pdf · PDF · 2 páginas · 164 KB · adjuntado el 12 sep");

  eq(A.lineaDeDatos({
    nombre: "foto-tarjeta.jpg", nombreCorto: "Tarjeta de embarque", mime: "image/jpeg",
    bytes: 182272, estado: "recomprimido", bytesOriginales: 3250586, at: "2025-09-20T12:00:00.000Z"
  }), "foto-tarjeta.jpg · JPG · 178 KB · reducida de 3,1 MB · adjuntada el 20 sep");

  eq(A.lineaDeDatos({
    nombre: "tarjeta-g3-1234.jpg", nombreCorto: "Tarjeta de embarque", mime: "image/jpeg",
    bytes: 182272, estado: "ok", origen: "importar", at: AHORA
  }, { compartido: true }), "tarjeta-g3-1234.jpg · JPG · 178 KB · lo adjuntó quien te compartió el viaje");
});

await test("el aviso de menor calidad trae los tres números y qué hacer", function () {
  var aviso = A.avisoMenorCalidad({ estado: "recomprimido", bytes: 182272, bytesOriginales: 3250586 });
  incluye(aviso, "3,1 MB");
  incluye(aviso, "190 KB");
  incluye(aviso, "178 KB");
  eq(A.avisoMenorCalidad({ estado: "ok", bytes: 1000 }), "", "sin recompresión no hay aviso");
});

await test("el archivo se descarga con una extensión que corresponde a lo que se guardó", function () {
  eq(A.nombreDeDescarga({ nombre: "pasaje-aerolineas.pdf", mime: "application/pdf" }), "pasaje-aerolineas.pdf");
  eq(A.nombreDeDescarga({ nombre: "captura.png", mime: "image/jpeg", estado: "recomprimido" }), "captura.jpg",
     "si se guardó como JPEG, el archivo que baja no puede decir .png");
  eq(A.nombreDeDescarga({ nombre: "", mime: "image/jpeg" }, { reserva: "Vuelo de ida" }), "valija-vuelo-de-ida.jpg");
});

/* ============================================================ */
group("La base: cuánto entra y qué pasa cuando no");

await test("el tope de documentos de la base sale del contrato, no de una suposición", function () {
  eq(A.MAX_DOCS_BASE, 5000);
  var p = A.presupuestoDeLaBase(4990);
  eq(p.quedan, 10);
  eq(p.nivel, "aviso");
  eq(A.presupuestoDeLaBase(5000).nivel, "lleno");
  eq(A.presupuestoDeLaBase(12).nivel, "ok");
});

await test("un rechazo de la base se traduce a algo que la persona pueda hacer", function () {
  var pesado = A.interpretarErrorDeLaBase({ code: "invalid_argument" });
  eq(pesado.codigo, "no-entra-en-la-base");
  eq(pesado.reintentable, false);
  incluye(pesado.mensaje, "190 KB");

  var lleno = A.interpretarErrorDeLaBase({ code: "quota_exceeded" });
  eq(lleno.codigo, "base-llena");
  eq(lleno.reintentable, false);

  var caido = A.interpretarErrorDeLaBase({ code: "unavailable" });
  eq(caido.reintentable, true);

  var raro = A.interpretarErrorDeLaBase({ code: "un_codigo_que_no_existe_todavia" });
  eq(raro.reintentable, true, "el contrato manda tratar los códigos desconocidos como unavailable");
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
