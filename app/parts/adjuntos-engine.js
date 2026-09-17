/* ============================================================
   VALIJA · MOTOR DE ADJUNTOS
   VAL-58 del brief de iteración 3 (docs/briefs/adjuntar.md):
   el documento original queda en la reserva y se puede descargar.

   JavaScript puro, mismo estilo que import-engine.js y
   packing-engine.js: reglas declaradas como datos, funciones puras,
   sin tocar el DOM. La ÚNICA excepción está aislada a propósito y es
   `recomprimirImagenConCanvas`, igual que `renderPdfPagesToImages` en
   el motor de importación: se inyecta (`opts.recomprimirImagen`) y
   todo el resto del módulo se prueba con `node`.

   Este módulo no escribe en la base, no lee `claude.use`, no sabe que
   existe una pantalla. Recibe un archivo y devuelve DOS cosas listas
   para guardar (metadatos y cuerpo) o un error propio.

   ============================================================
   EL TECHO, Y DE DÓNDE SALE CADA NÚMERO
   ============================================================

   No hay capacidad de almacenamiento de archivos en esta cuenta: el
   documento vive en la misma base que el resto de los datos,
   codificado como texto (brief VAL-58).

   · Un documento de la base se rechaza si pasa **256 KiB
     serializado** (262.144 bytes). Está en el contrato de `db`
     (artifact-capabilities 0.2.41 y 0.2.44, `db.d.ts`: "DOCUMENT
     BODIES ... at most 256 KiB serialized and 32 levels deep") y el
     rechazo llega como `invalid_argument`, que NO es reintentable.
   · Codificar en base64 infla exactamente un tercio (4 bytes de texto
     cada 3 de archivo). Dividir el tope por cuatro tercios da 196.608
     bytes (192 KB) y **deja cero lugar** para los nombres de campo del
     propio documento, así que el número bueno —corregido por el PO el
     13/09 y el que muestra la interfaz (diseño 5.4)— es 194.560 bytes
     = **190 KB**, que codificado ocupa 259.416 caracteres y deja
     2,7 KB de margen.
   · La base entera admite **5.000 documentos** (`db.d.ts`: "CAPACITY:
     an artifact's database holds at most 5,000 documents in total"),
     y cuando se llena, crear uno más rechaza con `quota_exceeded`.
     Esto contesta la pregunta abierta de la sección 8 del diseño: el
     contrato SÍ lo dice.

   Los dos primeros números vienen medidos por el PO contra los
   archivos reales del PM y no se recalculan acá distinto:

     voucher de micro       20.921 bytes → entra de sobra
     pasaje de Aerolíneas  123.129 bytes → entra con margen
     foto de cámara       ~3.250.586 bytes → hay que reducirla

   POR QUÉ EL MOTOR MIDE EN VEZ DE SUPONER. Con el número viejo
   (192 KB) el cuerpo de un archivo justo en el tope quedaba unos cien
   bytes ARRIBA de 256 KiB una vez serializado con sus nombres de campo
   (`{"b64":"…","mime":"…"}`), y la base lo habría rechazado con
   `invalid_argument`. Lo encontró `bytesSerializados`, midiendo el
   cuerpo de verdad, y de ahí salió la corrección a 190 KB. La medición
   se queda igual: la advertencia `al-filo-del-tope` es la red por si
   algún día el envoltorio del cuerpo crece, y con 190 KB no la dispara
   ningún archivo que el motor acepte. Por eso, además, lo que el motor
   SÍ controla —la recompresión— apunta a `OBJETIVO_RECOMPRESION_BYTES`,
   con más margen todavía.

   ============================================================
   LOS TRES ESTADOS (diseño sección 2)
   ============================================================

     "ok"            entra tal cual        → D10 en la hoja, D1 en la tarjeta
     "recomprimido"  entró reducido        → D11 al adjuntar y D5 SIEMPRE en el visor
     "no-entra"      no se guarda          → D12, y la reserva se guarda igual

   `estado` se GUARDA con el documento, no se calcula al vuelo: D5 lo
   muestra cada vez que alguien abre la foto, para que quien no pueda
   leer un código de barras en el aeropuerto entienda por qué en ese
   momento.

   ============================================================
   QUÉ DEVUELVE prepararDocumento(file, opts)
   ============================================================

   {
     estado: "ok" | "recomprimido" | "no-entra",
     ok: true|false,
     bloqueaGuardado: false,      // SIEMPRE false: ver abajo
     doc:    { id, nombre, nombreCorto, mime, bytes, paginas,
               estado, origen, at [, bytesOriginales] } | null,
     cuerpo: { id, itemId, mime, bytes, b64, at } | null,
     recompresion: { desdeBytes, aBytes, pasos, ladoMayor, calidad } | null,
     error: null | { codigo, mensaje },
     advertencias: [ { codigo, mensaje } ]
   }

   `bloqueaGuardado` es siempre `false` y está en el resultado a
   propósito: es el criterio del brief escrito como dato. Preparar un
   documento NUNCA puede impedir que se guarde la reserva; el dato
   vale por sí mismo.

   `doc` va adentro del ítem (`trips/{tripId}/items/{itemId}.docs[]`) y
   `cuerpo` va en su propio documento (`trips/{tripId}/docs/{docId}`,
   ver `rutaDelCuerpo`). Es el modelo de la sección 7.2 del diseño.
   ============================================================ */

(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else if (root) root.AdjuntosEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
"use strict";

var VERSION = 1;

/* ============================================================
   TOPES — los números del brief, en un solo lugar
   ============================================================ */

/** Tope de un documento de la base, serializado. Contrato de `db`. */
var TOPE_DOC_BASE_BYTES = 262144;          // 256 KiB

/** Archivo crudo más grande que entra codificado. 190 KB, el número de la interfaz.
    Corregido el 13/09: 192 KB (196.608) no dejaba lugar para el envoltorio del
    cuerpo. 194.560 bytes codificados son 259.416 caracteres: 2,7 KB de margen. */
var TOPE_ARCHIVO_BYTES = 194560;

/**
 * A cuánto apunta la recompresión. NO es el tope: es el tope menos un
 * margen, por dos razones concretas.
 *   1. El cuerpo del documento no es sólo el archivo: lleva sus
 *      nombres de campo, el id y la fecha. Un archivo exactamente en
 *      el tope deja el documento serializado arriba de 256 KiB.
 *   2. Una foto que queda a diez bytes del tope no tiene margen para
 *      nada, y es lo único que el motor puede elegir.
 * 2 KB de archivo crudo son ~2,7 KB de texto: sobra para el envoltorio.
 */
var OBJETIVO_RECOMPRESION_BYTES = TOPE_ARCHIVO_BYTES - 2048;   // 192.512

/** Tope de documentos por reserva (diseño 5.2). Decisión nuestra, no de la base. */
var MAX_DOCS_POR_RESERVA = 3;

/** Documentos que admite la base ENTERA. Del contrato de `db`, no inventado. */
var MAX_DOCS_BASE = 5000;

/** Desde qué porcentaje de la base conviene avisar. */
var AVISO_BASE_DESDE = 0.9;

/* ============================================================
   TIPOS DE ARCHIVO — declarados como datos
   Agregar un tipo es agregar una entrada, no tocar la lógica.
   ============================================================ */

var TIPOS = [
  { mime: "application/pdf", alias: [], ext: ["pdf"],
    familia: "pdf", etiqueta: "PDF", recomprimible: false },
  { mime: "image/jpeg", alias: ["image/jpg", "image/pjpeg"], ext: ["jpg", "jpeg"],
    familia: "imagen", etiqueta: "JPG", recomprimible: true },
  { mime: "image/png", alias: [], ext: ["png"],
    familia: "imagen", etiqueta: "PNG", recomprimible: true },
  { mime: "image/webp", alias: [], ext: ["webp"],
    familia: "imagen", etiqueta: "WEBP", recomprimible: true },
  // HEIC es lo que sale de la cámara de un iPhone con "alta eficiencia".
  // Safari lo puede dibujar en un canvas; otros navegadores no, y ahí el
  // recompresor falla y el archivo cae en "no entra", que es honesto.
  { mime: "image/heic", alias: ["image/heif"], ext: ["heic", "heif"],
    familia: "imagen", etiqueta: "HEIC", recomprimible: true }
];

/* ============================================================
   LA ESCALERA DE RECOMPRESIÓN — la decisión más discutible del módulo
   ============================================================

   POR QUÉ HAY UN PISO, Y POR QUÉ ESTÁ DONDE ESTÁ.

   El caso que manda es una tarjeta de embarque fotografiada, porque
   es el documento que hay que poder LEER y, encima, pasarle a un
   lector de códigos. Su código de barras (PDF417 de la BCBP) tiene
   del orden de 300 a 400 módulos de ancho. Para decodificar desde una
   foto hacen falta al menos ~2 píxeles por módulo, y el código rara
   vez ocupa más de dos tercios del ancho de la foto:

       350 módulos × 2 px ÷ 0,66 ≈ 1.060 px de lado mayor

   Redondeando para arriba, el piso es 1.200 px. Por debajo de eso el
   documento deja de servir para lo único que motiva guardarlo, y
   guardar una tarjeta ilegible es peor que decir que no entró: la
   persona se entera en el mostrador.

   POR QUÉ PRIMERO BAJA LA RESOLUCIÓN Y DESPUÉS LA CALIDAD.
   Una foto de 12 MP tiene diez veces la resolución que hace falta:
   el primer paso es gratis en legibilidad y es el que más pesa. De
   ahí en adelante conviene bajar calidad antes que resolución,
   porque los píxeles que se tiran no vuelven, y sólo al final se
   toca de nuevo el lado mayor.

   POR QUÉ LA CALIDAD NO BAJA DE 0,55.
   Debajo de ~0,5 el JPEG mete anillado en los bordes de alto
   contraste, que es exactamente de lo que está hecho un código de
   barras: ensucia la binarización más de lo que ayuda el peso que
   ahorra.

   POR QUÉ CINCO PASOS Y NO DIEZ.
   Cada paso es un decode + encode en un teléfono, con la pantalla
   mostrando "Reduciendo la foto para que entre…" (D9). Cinco acota
   el peor caso; si ninguno entra, la respuesta honesta es D12.

   Lo que NO está verificado: cuánto pesa de verdad cada paso. Eso
   depende del encoder del navegador y sólo se puede medir con una
   foto real en el teléfono. La escalera está armada para que el caso
   típico (foto de cámara de 3 MB) entre en el primer o segundo paso.
*/
var PISO_LADO_MAYOR = 1200;
var PISO_CALIDAD = 0.55;

var ESCALERA_RECOMPRESION = [
  { ladoMayor: 2048, calidad: 0.82 },
  { ladoMayor: 1600, calidad: 0.78 },
  { ladoMayor: 1600, calidad: 0.65 },
  { ladoMayor: 1400, calidad: 0.60 },
  { ladoMayor: PISO_LADO_MAYOR, calidad: PISO_CALIDAD }
];

/** A qué formato se recomprime. JPEG porque es el único con control de calidad continuo. */
var MIME_RECOMPRIMIDO = "image/jpeg";

/* ============================================================
   DE DÓNDE VINO EL DOCUMENTO
   ============================================================ */

var ORIGENES = [
  { id: "importar", frase: "desde Importar" },
  { id: "archivo",  frase: "desde Archivo" },
  { id: "manual",   frase: "" },
  { id: "camara",   frase: "" }
];

/* ============================================================
   EL NOMBRE CORTO (diseño 5.3) — la tabla, tal cual
   La tira y el visor dicen QUÉ ES el documento, no cómo se llama el
   archivo. `genero` está acá porque de él dependen "adjuntada el 20
   sep" y "adjuntado el 12 sep": es un dato de la regla, no un if.
   ============================================================ */

var REGLAS_NOMBRE_CORTO = [
  { id: "tarjeta",     nombre: "Tarjeta de embarque", genero: "f",
    cuando: function (c) { return c.interpretado && !!c.esTarjeta; } },
  { id: "pasaje",      nombre: "Pasaje", genero: "m",
    cuando: function (c) { return c.interpretado && c.tipoReserva === "flight"; } },
  { id: "comprobante", nombre: "Comprobante", genero: "m",
    cuando: function (c) { return c.interpretado; } },
  { id: "manual",      nombre: null, genero: "m",
    cuando: function () { return true; } }   // el nombre del archivo, sin extensión
];

/* ============================================================
   ERRORES PROPIOS — código, y un mensaje que dice qué pasó y qué hacer
   Ninguno pide disculpas ni culpa a la persona.
   ============================================================ */

var ERRORES = {
  "tope-de-reserva": function () {
    return "Esta reserva ya tiene " + MAX_DOCS_POR_RESERVA + " documentos, que es el tope. " +
           "Para sumar otro, quitá uno de estos.";
  },
  "tipo-no-soportado": function (c) {
    return "No puedo guardar un archivo " + (c.extension ? "." + c.extension : "de ese tipo") + ". " +
           "Sirven PDF y fotos (JPG, PNG, WEBP, HEIC).";
  },
  /* NO afirma que el archivo esté vacío: afirma lo único que se sabe, que
     es que no se pudo sacar nada de él. Las dos cosas se parecen y no son
     iguales, y confundirlas costó tres rondas de arreglos equivocados sobre
     archivos que estaban enteros. El detalle observado va aparte, en
     `error.detalle`, y la interfaz lo muestra. */
  "archivo-vacio": function () {
    return "No pude leer ese archivo: probé de tres formas distintas y ninguna trajo nada. " +
           "Si vino por mail, bajalo al teléfono primero y después elegilo desde ahí.";
  },
  "no-entra-pdf": function (c) {
    return "Pesa " + formatearBytes(c.bytes) + " y el tope es " + formatearBytes(TOPE_ARCHIVO_BYTES) + ". " +
           "Un PDF no lo puedo reducir sin romperlo, así que este no lo puedo guardar.";
  },
  "no-entra-ni-reducida": function (c) {
    return "La foto pesa " + formatearBytes(c.bytes) + " y ni reducida baja de " +
           formatearBytes(TOPE_ARCHIVO_BYTES) + " sin quedar ilegible. " +
           "Sacale una foto más de cerca, sólo al papel, y probá de nuevo.";
  },
  "sin-recompresor": function (c) {
    return "Esta foto pesa " + formatearBytes(c.bytes) + " y el tope es " + formatearBytes(TOPE_ARCHIVO_BYTES) +
           ", pero desde acá no puedo reducirla. Guardala más chica desde el teléfono y probá de nuevo.";
  },
  "no-se-pudo-leer": function () {
    return "No pude leer ese archivo. Probá elegirlo de nuevo; si sigue, bajalo otra vez del mail.";
  },
  "no-se-pudo-reducir": function () {
    return "No pude reducir esa foto en este teléfono. Probá con el PDF si lo tenés, o sacale una foto más chica.";
  }
};

/** Advertencias: no impiden nada, se informan. */
var ADVERTENCIAS = {
  "al-filo-del-tope": function (c) {
    return "Este archivo queda justo en el tope (" + formatearBytes(c.bytes) + "). " +
           "Si la base lo rechaza, la reserva se guarda igual y el documento no.";
  }
};

/* ============================================================
   ERRORES DE LA BASE — traducidos según el contrato de `db`
   La app los usa al ESCRIBIR, que es lo que este motor no hace.
   `reintentable` sale del contrato, no de la intuición.
   ============================================================ */

var ERRORES_BASE = {
  invalid_argument: { codigo: "no-entra-en-la-base", reintentable: false,
    mensaje: "El documento no entró: el tope por documento es " + formatearBytes(TOPE_ARCHIVO_BYTES) +
             " y este lo pasa. La reserva se guardó igual." },
  transform_error: { codigo: "no-entra-en-la-base", reintentable: false,
    mensaje: "El documento no entró: el tope por documento es " + formatearBytes(TOPE_ARCHIVO_BYTES) +
             " y este lo pasa. La reserva se guardó igual." },
  quota_exceeded: { codigo: "base-llena", reintentable: false,
    mensaje: "La valija llegó al tope de documentos guardados. Quitá algún documento adjunto " +
             "de otra reserva y probá de nuevo. La reserva se guardó igual." },
  resource_exhausted: { codigo: "demasiadas-operaciones", reintentable: true,
    mensaje: "Se están guardando muchas cosas a la vez. Esperá unos segundos y probá de nuevo." },
  unavailable: { codigo: "base-no-disponible", reintentable: true,
    mensaje: "No pude guardar el documento ahora. Probá de nuevo cuando tengas señal." },
  revoked: { codigo: "sin-permiso", reintentable: false,
    mensaje: "Ya no tenés permiso para escribir en este viaje. Pedile el enlace de nuevo a quien te lo compartió." },
  not_granted: { codigo: "sin-base", reintentable: false,
    mensaje: "Desde esta vista no puedo guardar documentos. Abrí la valija en el navegador y probá de nuevo." },
  capability_disabled: { codigo: "sin-base", reintentable: false,
    mensaje: "Desde esta vista no puedo guardar documentos. Abrí la valija en el navegador y probá de nuevo." },
  capability_removed: { codigo: "sin-base", reintentable: false,
    mensaje: "Desde esta vista no puedo guardar documentos. Abrí la valija en el navegador y probá de nuevo." }
};

/* ============================================================
   UTILIDADES PURAS
   ============================================================ */

var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function norm(s) { return String(s == null ? "" : s).trim(); }

/** Cuántos bytes de texto ocupa un archivo de `n` bytes codificado en base64. */
function bytesCodificados(n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  return Math.ceil(n / 3) * 4;
}

/** Largo en bytes UTF-8 de un string (la base mide bytes, no caracteres). */
function bytesDeTexto(s) {
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

/**
 * Cuánto ocupa un objeto como documento de la base. Se MIDE, no se
 * estima: es la única forma de saber si un cuerpo pasa los 256 KiB
 * antes de que la base lo rechace con `invalid_argument`.
 */
function bytesSerializados(obj) {
  try { return bytesDeTexto(JSON.stringify(obj)); }
  catch (e) { return Infinity; }
}

/**
 * El peso como lo muestra la interfaz (diseño 5.4): KB de 1024 y coma
 * decimal. Con este criterio el tope da exactamente "190 KB", que es
 * el número que la persona tiene que poder comparar con lo que ve en
 * su teléfono.
 */
function formatearBytes(n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  if (n < 1024) return n + " bytes";
  if (n < 1048576) return Math.round(n / 1024) + " KB";
  var mb = Math.round((n / 1048576) * 10) / 10;
  return String(mb).replace(".", ",") + " MB";
}

/**
 * "20 sep", con la zona horaria del dispositivo, que es la que la
 * persona vio cuando adjuntó el documento.
 *
 * Borde conocido y asumido: `at` se guarda en UTC, así que un documento
 * adjuntado cerca de medianoche y abierto desde otro huso puede mostrar
 * el día de al lado. Guardar el huso para arreglarlo cuesta un campo en
 * cada documento y el dato es una etiqueta, no un cálculo.
 */
function fechaCorta(iso) {
  var d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.getDate() + " " + MES[d.getMonth()];
}

function extensionDe(nombre) {
  var n = norm(nombre);
  var i = n.lastIndexOf(".");
  if (i <= 0 || i === n.length - 1) return "";
  return n.slice(i + 1).toLowerCase();
}

function sinExtension(nombre) {
  var n = norm(nombre);
  var ext = extensionDe(n);
  return ext ? n.slice(0, n.length - ext.length - 1) : n;
}

/** Para armar un nombre de archivo cuando el original no sirve: sin tildes ni espacios. */
function slug(s) {
  var t = norm(s).toLowerCase();
  if (typeof t.normalize === "function") t = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  t = t.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return t || "documento";
}

/* ---------- base64, sin dependencias y sin navegador ---------- */

var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Uint8Array → base64. Funciona igual en node y en el navegador. */
function bytesABase64(u8) {
  var out = [], i = 0, len = u8.length, n;
  for (; i + 2 < len; i += 3) {
    n = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2];
    out.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]);
  }
  var resto = len - i;
  if (resto === 1) {
    out.push(B64[u8[i] >> 2] + B64[(u8[i] << 4) & 63] + "==");
  } else if (resto === 2) {
    out.push(B64[u8[i] >> 2] + B64[((u8[i] << 4) | (u8[i + 1] >> 4)) & 63] + B64[(u8[i + 1] << 2) & 63] + "=");
  }
  return out.join("");
}

/** base64 → Uint8Array. La usa el visor para rearmar el archivo. */
function base64ABytes(b64) {
  var s = String(b64 || "").replace(/[^A-Za-z0-9+/=]/g, "");
  var pad = s.indexOf("=") >= 0 ? s.length - s.indexOf("=") : 0;
  var len = Math.floor((s.length * 3) / 4) - pad;
  var out = new Uint8Array(Math.max(0, len));
  var p = 0, i = 0, a, b, c, d;
  for (; i + 3 < s.length; i += 4) {
    a = B64.indexOf(s[i]); b = B64.indexOf(s[i + 1]);
    c = B64.indexOf(s[i + 2]); d = B64.indexOf(s[i + 3]);
    if (p < out.length) out[p++] = (a << 2) | (b >> 4);
    if (c >= 0 && p < out.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && p < out.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}

/* ============================================================
   CLASIFICAR EL ARCHIVO
   ============================================================ */

/**
 * Qué es este archivo. Primero por mime, después por extensión: algunos
 * selectores de Android devuelven mime vacío, y es el mismo criterio
 * que ya usa `ImportEngine.fileKind`.
 *
 * @param {{name?:string, mimeType?:string, type?:string}} file
 * @returns {{mime:string, familia:"pdf"|"imagen"|"desconocida", etiqueta:string,
 *            extension:string, recomprimible:boolean, soportado:boolean}}
 */
function clasificarArchivo(file) {
  var mime = norm((file && (file.mimeType || file.type)) || "").toLowerCase();
  var ext = extensionDe((file && file.name) || "");
  var hit = null;
  TIPOS.forEach(function (t) {
    if (hit) return;
    if (mime && (mime === t.mime || t.alias.indexOf(mime) >= 0)) hit = t;
  });
  if (!hit) {
    TIPOS.forEach(function (t) {
      if (hit) return;
      if (ext && t.ext.indexOf(ext) >= 0) hit = t;
    });
  }
  if (!hit) {
    return { mime: mime, familia: "desconocida", etiqueta: (ext || "").toUpperCase(),
             extension: ext, recomprimible: false, soportado: false };
  }
  return { mime: hit.mime, familia: hit.familia, etiqueta: hit.etiqueta,
           extension: ext || hit.ext[0], recomprimible: hit.recomprimible, soportado: true };
}

/** La etiqueta que muestra la interfaz para un mime guardado ("JPG", "PDF"). */
function etiquetaTipo(mime) {
  var c = clasificarArchivo({ mimeType: mime });
  return c.soportado ? c.etiqueta : (norm(mime).split("/").pop() || "").toUpperCase();
}

function extensionDeMime(mime) {
  var m = norm(mime).toLowerCase();
  var hit = null;
  TIPOS.forEach(function (t) { if (!hit && (t.mime === m || t.alias.indexOf(m) >= 0)) hit = t; });
  return hit ? hit.ext[0] : "";
}

/* ============================================================
   EL NOMBRE CORTO
   ============================================================ */

function reglaDeNombre(ctx) {
  var c = {
    interpretado: (ctx && ctx.origen) === "importar",
    esTarjeta: !!(ctx && ctx.esTarjeta),
    tipoReserva: ctx && ctx.tipoReserva
  };
  for (var i = 0; i < REGLAS_NOMBRE_CORTO.length; i++) {
    if (REGLAS_NOMBRE_CORTO[i].cuando(c)) return REGLAS_NOMBRE_CORTO[i];
  }
  return REGLAS_NOMBRE_CORTO[REGLAS_NOMBRE_CORTO.length - 1];
}

/**
 * Cómo se llama el documento en la tira y en el visor (diseño 5.3).
 * No se le pregunta nada a la persona: sale del contexto.
 *
 * @param {{origen:string, esTarjeta?:boolean, tipoReserva?:string, nombre?:string}} ctx
 * @returns {string}
 */
function nombreCorto(ctx) {
  var regla = reglaDeNombre(ctx);
  if (regla.nombre) return regla.nombre;
  return sinExtension((ctx && ctx.nombre) || "") || "Documento";
}

/** Femenino sólo "la tarjeta de embarque"; el resto, masculino. Sale de la tabla. */
function generoDe(nombreCortoDelDoc) {
  var g = "m";
  REGLAS_NOMBRE_CORTO.forEach(function (r) { if (r.nombre && r.nombre === nombreCortoDelDoc) g = r.genero; });
  return g;
}

/* ============================================================
   EL CUPO POR RESERVA (diseño 5.2 y D13)
   ============================================================ */

var FRASES_CUPO = [
  { quedan: 3, frase: "Hasta " + formatearBytes(TOPE_ARCHIVO_BYTES) + " por documento, y hasta tres por reserva. " +
                      "Si la foto pesa más, la reduzco yo y te aviso." },
  { quedan: 2, frase: "Podés sumar hasta dos documentos más." },
  { quedan: 1, frase: "Podés sumar un documento más." },
  { quedan: 0, frase: "Llegaste al tope de tres documentos en esta reserva. Para sumar otro, quitá uno de estos." }
];

/**
 * Cuántos documentos entran todavía en esta reserva, con la etiqueta y
 * la frase que muestra el bloque "Documento".
 * @param {Array} docs documentos ya adjuntos
 */
function espacioParaDocumentos(docs) {
  var usados = (docs || []).length;
  var quedan = Math.max(0, MAX_DOCS_POR_RESERVA - usados);
  var frase = "";
  FRASES_CUPO.forEach(function (f) { if (f.quedan === quedan) frase = f.frase; });
  return {
    usados: usados,
    tope: MAX_DOCS_POR_RESERVA,
    quedan: quedan,
    puedeSumar: quedan > 0,
    etiqueta: usados === 0 ? "Documento" : ("Documentos · " + usados + " de " + MAX_DOCS_POR_RESERVA),
    frase: frase
  };
}

/** Suma un documento respetando el tope. Pura: devuelve una lista nueva. */
function agregarDocumento(docs, doc) {
  var lista = (docs || []).slice();
  if (lista.length >= MAX_DOCS_POR_RESERVA) {
    return { docs: lista, error: errorInfo("tope-de-reserva", {}) };
  }
  lista.push(doc);
  return { docs: lista, error: null };
}

/** Quita un documento por id. Pura. */
function quitarDocumento(docs, id) {
  var lista = (docs || []).filter(function (d) { return d && d.id !== id; });
  var quitado = (docs || []).filter(function (d) { return d && d.id === id; })[0] || null;
  return { docs: lista, quitado: quitado };
}

/* ============================================================
   LA BASE: cuánto queda y qué hacer cuando rechaza
   ============================================================ */

/**
 * Cuántos documentos quedan en la base. El tope sale del contrato
 * (5.000 en total), y lo consume TODO lo que la app guarda: viajes,
 * reservas, listas de equipaje y cada cuerpo de documento adjunto.
 * La app sabe cuántos usa; este motor sólo hace la cuenta.
 */
function presupuestoDeLaBase(usados) {
  usados = Math.max(0, Math.floor(Number(usados) || 0));
  var quedan = Math.max(0, MAX_DOCS_BASE - usados);
  var nivel = quedan <= 0 ? "lleno" : (usados >= MAX_DOCS_BASE * AVISO_BASE_DESDE ? "aviso" : "ok");
  return { tope: MAX_DOCS_BASE, usados: usados, quedan: quedan, nivel: nivel };
}

/**
 * Traduce un rechazo de la base a algo que la persona pueda hacer.
 * Un código que no conocemos se trata como `unavailable`, que es lo
 * que manda el contrato ("treat unknown codes as unavailable").
 */
function interpretarErrorDeLaBase(e) {
  var code = (e && (e.code || e.codigo)) || "";
  var conocido = ERRORES_BASE[code];
  if (conocido) return { codigo: conocido.codigo, mensaje: conocido.mensaje, reintentable: conocido.reintentable, code: code };
  var fallback = ERRORES_BASE.unavailable;
  return { codigo: fallback.codigo, mensaje: fallback.mensaje, reintentable: true, code: code };
}

/* ============================================================
   TEXTOS DERIVADOS DEL DOCUMENTO GUARDADO
   Todo sale de los metadatos: nunca hace falta traer el archivo.
   Los textos son los del diseño (sección 6), sin marcado.
   ============================================================ */

/** La tira de la tarjeta de la reserva (D1): "JPG · 178 KB". Sin estado de compresión, a propósito. */
function textoTira(doc) {
  if (!doc) return "";
  return etiquetaTipo(doc.mime) + " · " + formatearBytes(doc.bytes);
}

/** La fila del bloque de adjuntar y de la cola del importador (D10, D11, D14). */
function textoFila(doc) {
  if (!doc) return "";
  var partes = [etiquetaTipo(doc.mime)];
  if (doc.paginas) partes.push(doc.paginas + (doc.paginas === 1 ? " página" : " páginas"));
  partes.push(formatearBytes(doc.bytes));
  if (doc.estado === "recomprimido") partes.push("menor calidad");
  return partes.join(" · ");
}

/** La línea de datos del visor (D2, D3, D5, D6). */
function lineaDeDatos(doc, opts) {
  if (!doc) return "";
  opts = opts || {};
  var partes = [doc.nombre || "documento", etiquetaTipo(doc.mime)];
  if (doc.paginas) partes.push(doc.paginas + (doc.paginas === 1 ? " página" : " páginas"));
  partes.push(formatearBytes(doc.bytes));
  var g = generoDe(doc.nombreCorto);
  if (doc.estado === "recomprimido" && doc.bytesOriginales) {
    partes.push((g === "f" ? "reducida" : "reducido") + " de " + formatearBytes(doc.bytesOriginales));
  }
  if (opts.compartido) {
    partes.push("lo adjuntó quien te compartió el viaje");
  } else {
    var cola = (g === "f" ? "adjuntada" : "adjuntado") + " el " + fechaCorta(doc.at);
    var frase = "";
    ORIGENES.forEach(function (o) { if (o.id === doc.origen) frase = o.frase; });
    if (frase) cola += " " + frase;
    partes.push(cola);
  }
  return partes.join(" · ");
}

var AVISOS_CALIDAD = {
  visor: function (c) {
    return "Guardada en menor calidad. La foto pesaba " + c.antes + " y el tope por documento es " +
           c.tope + ", así que la reduje a " + c.despues + ". Se lee bien en pantalla; " +
           "si un código de barras no te pasa el lector, usá el original del mail.";
  },
  adjuntar: function (c) {
    return "La guardé más chica. La foto pesaba " + c.antes + " y el tope por documento es " +
           c.tope + ": la reduje a " + c.despues + ". Se lee bien en pantalla. " +
           "Si necesitás la original tal cual, guardala también en las fotos del teléfono.";
  }
};

/** El aviso de menor calidad (D5 en el visor, D11 al adjuntar). "" si no se recomprimió. */
function avisoMenorCalidad(doc, opts) {
  if (!doc || doc.estado !== "recomprimido") return "";
  var momento = (opts && opts.momento) === "adjuntar" ? "adjuntar" : "visor";
  return AVISOS_CALIDAD[momento]({
    antes: formatearBytes(doc.bytesOriginales || 0),
    despues: formatearBytes(doc.bytes),
    tope: formatearBytes(TOPE_ARCHIVO_BYTES)
  });
}

/**
 * Con qué nombre baja el archivo (diseño 7.5). Se usa el original, con
 * una corrección: si el documento se guardó recomprimido a JPEG, la
 * extensión tiene que decir JPEG, o el archivo que queda en el teléfono
 * miente sobre lo que es.
 */
function nombreDeDescarga(doc, opts) {
  opts = opts || {};
  var ext = extensionDeMime(doc && doc.mime) || extensionDe((doc && doc.nombre) || "") || "bin";
  var base = sinExtension((doc && doc.nombre) || "");
  if (!base) base = "valija-" + slug(opts.reserva || "documento");
  return base + "." + ext;
}

/** Dónde vive el cuerpo del documento (diseño 7.2). Cuatro segmentos: es un documento. */
function rutaDelCuerpo(tripId, docId) {
  return "trips/" + tripId + "/docs/" + docId;
}

/* ============================================================
   LA ÚNICA FUNCIÓN QUE TOCA EL DOM
   ============================================================

   Mismo trato que `renderPdfPagesToImages` en import-engine.js: vive
   acá, aislada, y el resto del módulo la recibe inyectada
   (`opts.recomprimirImagen`). Así la escalera —que es la decisión que
   importa— se prueba entera con `node`.

   CONTRATO, para quien quiera escribir otra implementación:
     recomprimirImagen(file, paso) → Promise<{bytes:Uint8Array, mime, ancho, alto}>
     paso = { ladoMayor:number, calidad:number, mime:string }
   Opcionalmente puede exponer `.liberar(file)`, que el motor llama
   cuando termina, para soltar la imagen decodificada.

   NO VERIFICADO: esto no corrió nunca en un teléfono. En iOS hay
   topes de área de canvas y decodificación de HEIC que pueden
   devolver una imagen vacía; si la foto sale negra, es acá.
*/
var _decodificadas = typeof WeakMap !== "undefined" ? new WeakMap() : null;

function _blobDe(file) {
  return (file && file.blob) || file;
}

function _decodificar(file) {
  var cache = _decodificadas && _decodificadas.get(file);
  if (cache) return cache;
  var blob = _blobDe(file);
  var p;
  if (typeof createImageBitmap === "function") {
    p = createImageBitmap(blob);
  } else {
    p = new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("no-se-pudo-decodificar")); };
      img.src = url;
    });
  }
  if (_decodificadas) _decodificadas.set(file, p);
  return p;
}

/**
 * Un paso de la escalera, con canvas. Necesita navegador.
 * @param {Object} file  el archivo elegido (o {blob})
 * @param {{ladoMayor:number, calidad:number, mime?:string}} paso
 * @returns {Promise<{bytes:Uint8Array, mime:string, ancho:number, alto:number}>}
 */
function recomprimirImagenConCanvas(file, paso) {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("recomprimirImagenConCanvas necesita un navegador: usa canvas."));
  }
  var mime = (paso && paso.mime) || MIME_RECOMPRIMIDO;
  return _decodificar(file).then(function (img) {
    var w = img.width || img.naturalWidth;
    var h = img.height || img.naturalHeight;
    if (!w || !h) throw new Error("no-se-pudo-decodificar");
    // Nunca se agranda: si la foto ya es más chica que el paso, se
    // reencoda al mismo tamaño y sólo baja la calidad.
    var escala = Math.min(1, paso.ladoMayor / Math.max(w, h));
    var ancho = Math.max(1, Math.round(w * escala));
    var alto = Math.max(1, Math.round(h * escala));
    var canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    var ctx = canvas.getContext("2d");
    // Fondo blanco: un PNG con transparencia sobre JPEG queda negro,
    // y una captura de pantalla de un mail suele tener transparencia.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (!b) { reject(new Error("no-se-pudo-reducir")); return; }
        b.arrayBuffer().then(function (buf) {
          resolve({ bytes: new Uint8Array(buf), mime: mime, ancho: ancho, alto: alto });
        }, reject);
      }, mime, paso.calidad);
    });
  });
}

/** Suelta la imagen decodificada de un archivo (la llama el motor al terminar). */
recomprimirImagenConCanvas.liberar = function (file) {
  if (!_decodificadas) return;
  var p = _decodificadas.get(file);
  _decodificadas["delete"](file);
  if (p && p.then) p.then(function (img) { if (img && typeof img.close === "function") img.close(); }, function () {});
};

/* ============================================================
   PREPARAR EL DOCUMENTO — la puerta de entrada del motor
   ============================================================ */

function errorInfo(codigo, ctx) {
  var f = ERRORES[codigo];
  var e = { codigo: codigo, mensaje: f ? f(ctx || {}) : "No pude guardar el documento." };
  /* Lo OBSERVADO viaja con el error, aparte del mensaje humano. El mensaje
     dice qué hacer; el detalle dice qué se vio. Nunca se mezclan: el primero
     es para la persona, el segundo para poder arreglar sin adivinar. */
  if (ctx && ctx.detalle) e.detalle = ctx.detalle;
  return e;
}

function advertenciaInfo(codigo, ctx) {
  var f = ADVERTENCIAS[codigo];
  return { codigo: codigo, mensaje: f ? f(ctx || {}) : "" };
}

function resultadoFallido(codigo, ctx) {
  return {
    estado: "no-entra", ok: false, bloqueaGuardado: false,
    doc: null, cuerpo: null, recompresion: null,
    error: errorInfo(codigo, ctx), advertencias: []
  };
}

/**
 * Un id para el documento. Impura por una razón nombrada: un id tiene
 * que ser único y no hay nada en la entrada de donde derivarlo. Se
 * puede pasar `opts.id` y la función vuelve a ser determinista, que
 * es lo que hacen las pruebas.
 */
function generarId() {
  return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizarBytes(x) {
  if (!x) return new Uint8Array(0);
  if (x instanceof Uint8Array) return x;
  if (typeof ArrayBuffer !== "undefined" && x instanceof ArrayBuffer) return new Uint8Array(x);
  if (x.buffer) return new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength);
  return new Uint8Array(x);
}

/* ============================================================
   LEER EL ARCHIVO: TODOS LOS CAMINOS, Y ANOTAR QUÉ PASÓ

   Por qué existe esto. El PM reportó TRES veces el mismo error sobre
   archivos que le llegan por mail a su Android, y las tres veces se
   arregló una hipótesis distinta sin acertar. El problema común de los
   tres fracasos no estuvo en el código: estuvo en el método. Cada
   arreglo se probó contra un simulador escrito DESDE la hipótesis, y un
   simulador así sólo puede darle la razón a quien lo escribió. Nunca
   puede avisar que la hipótesis es falsa.

   Así que acá se deja de suponer POR DÓNDE falla la lectura y se
   prueban, en orden, los tres caminos que un navegador ofrece, hasta
   que uno traiga bytes:

     1. blob.arrayBuffer()          el moderno, el único que se usaba;
     2. blob.slice(0).arrayBuffer() fuerza una copia nueva — en varios
                                    Android el original lo sirve un
                                    proveedor y la rebanada no;
     3. FileReader                  la API vieja, que sigue andando en
                                    vistas donde las otras dos no.

   Esto no es otra hipótesis: es agotar los caminos documentados.

   Y de cada intento se anota qué devolvió. Ese registro es lo que la
   interfaz muestra cuando falla, para que el próximo reporte traiga el
   dato observado en vez de obligar a adivinar una cuarta vez.
   ============================================================ */
function leerBytesConDiagnostico(file, opts) {
  var intentos = [];
  function anotar(via, bytes, e) {
    intentos.push({
      via: via,
      bytes: bytes == null ? null : bytes.length,
      error: e ? ((e.name || "Error") + (e.message ? " " + String(e.message).slice(0, 48) : "")) : null
    });
  }
  function listo(bytes) { return { bytes: bytes || new Uint8Array(0), intentos: intentos }; }

  if (opts && typeof opts.leerBytes === "function") {
    return Promise.resolve(opts.leerBytes(file)).then(normalizarBytes).then(
      function (b) { anotar("inyectado", b, null); return listo(b); },
      function (e) { anotar("inyectado", null, e); return listo(null); }
    );
  }
  if (file && file.bytes) {
    var enMemoria = normalizarBytes(file.bytes);
    anotar("memoria", enMemoria, null);
    return Promise.resolve(listo(enMemoria));
  }

  var blob = _blobDe(file);
  if (!blob) { anotar("archivo", null, new Error("no llegó ningún archivo")); return Promise.resolve(listo(null)); }

  function viaArrayBuffer() {
    if (typeof blob.arrayBuffer !== "function") { anotar("arrayBuffer", null, new Error("no existe")); return Promise.resolve(null); }
    return Promise.resolve().then(function () { return blob.arrayBuffer(); }).then(
      function (ab) { var b = new Uint8Array(ab); anotar("arrayBuffer", b, null); return b.length ? b : null; },
      function (e) { anotar("arrayBuffer", null, e); return null; }
    );
  }
  function viaSlice() {
    if (typeof blob.slice !== "function") { anotar("slice", null, new Error("no existe")); return Promise.resolve(null); }
    return Promise.resolve().then(function () {
      var copia = blob.slice(0);
      if (!copia || typeof copia.arrayBuffer !== "function") throw new Error("la copia no se puede leer");
      return copia.arrayBuffer();
    }).then(
      function (ab) { var b = new Uint8Array(ab); anotar("slice", b, null); return b.length ? b : null; },
      function (e) { anotar("slice", null, e); return null; }
    );
  }
  function viaFileReader() {
    if (typeof FileReader !== "function") { anotar("FileReader", null, new Error("no existe")); return Promise.resolve(null); }
    return new Promise(function (res) {
      try {
        var fr = new FileReader();
        fr.onload = function () {
          var b;
          try { b = normalizarBytes(fr.result); } catch (e) { anotar("FileReader", null, e); return res(null); }
          anotar("FileReader", b, null); res(b.length ? b : null);
        };
        fr.onerror = function () { anotar("FileReader", null, fr.error || new Error("falló")); res(null); };
        fr.readAsArrayBuffer(blob);
      } catch (e) { anotar("FileReader", null, e); res(null); }
    });
  }

  return viaArrayBuffer()
    .then(function (b) { return b || viaSlice(); })
    .then(function (b) { return b || viaFileReader(); })
    .then(function (b) { return listo(b); });
}

/**
 * Una línea corta con lo que se OBSERVÓ, no con lo que se supone. No
 * explica ni interpreta: enumera. Está pensada para que entre en una
 * captura de pantalla y para que un reporte traiga el dato en vez de
 * una conjetura.
 * @returns {string} p.ej. `informa 0 B · arrayBuffer 0 B · slice 5166 B`
 */
function detalleDeLectura(file, intentos) {
  var partes = [];
  var t = tamañoDe(file);
  partes.push("informa " + (t === null ? "sin dato" : t + " B"));
  (intentos || []).forEach(function (i) {
    partes.push(i.via + " " + (i.error ? i.error : (i.bytes === null ? "—" : i.bytes + " B")));
  });
  var blob = _blobDe(file);
  var tipo = norm((file && file.type) || (blob && blob.type));
  if (tipo) partes.push(tipo);
  return partes.join(" · ");
}

function leerBytes(file, opts) {
  return leerBytesConDiagnostico(file, opts).then(function (r) { return r.bytes; });
}

function tamañoDe(file) {
  if (file && typeof file.size === "number") return file.size;
  if (file && file.bytes && typeof file.bytes.length === "number") return file.bytes.length;
  var blob = _blobDe(file);
  if (blob && typeof blob.size === "number") return blob.size;
  return null;
}

/** El recompresor que corresponde: el inyectado, el de canvas, o ninguno. */
function resolverRecompresor(opts) {
  if (opts && Object.prototype.hasOwnProperty.call(opts, "recomprimirImagen")) return opts.recomprimirImagen || null;
  if (typeof document !== "undefined") return recomprimirImagenConCanvas;
  return null;
}

/**
 * Prepara un archivo para guardarlo junto a la reserva. NO escribe
 * nada: el documento se guarda cuando se toca Guardar (diseño 5.5).
 *
 * @param {{name?:string, mimeType?:string, size?:number, blob?:Blob, bytes?:Uint8Array}} file
 * @param {Object} [opts]
 * @param {"importar"|"manual"|"archivo"|"camara"} [opts.origen]
 * @param {boolean} [opts.esTarjeta]   lo dice el motor de importación, no se adivina acá
 * @param {string}  [opts.tipoReserva] "flight", "stay", ...
 * @param {number}  [opts.paginas]     páginas del PDF, si se conocen
 * @param {Array}   [opts.docsActuales] documentos que la reserva ya tiene
 * @param {string}  [opts.id]          id del documento (si no, se genera)
 * @param {string}  [opts.itemId]      reserva a la que se engancha
 * @param {string}  [opts.ahora]       fecha ISO (si no, ahora)
 * @param {Function}[opts.recomprimirImagen] contrato arriba; null = no hay canvas
 * @param {Function}[opts.leerBytes]   para leer el archivo (por defecto, blob.arrayBuffer)
 * @returns {Promise<Object>} ver el encabezado del archivo
 */
function prepararDocumento(file, opts) {
  opts = opts || {};
  var espacio = espacioParaDocumentos(opts.docsActuales);
  if (!espacio.puedeSumar) return Promise.resolve(resultadoFallido("tope-de-reserva", {}));

  var clas = clasificarArchivo(file);
  if (!clas.soportado) return Promise.resolve(resultadoFallido("tipo-no-soportado", { extension: clas.extension }));

  /* CERO NO ES VACÍO: ES "NO SÉ".

     Esto NO depende de ninguna hipótesis sobre el teléfono del PM, y es la
     diferencia con los otros dos arreglos de este defecto: se sostiene solo.

     `size: 0` significa "no sé cuánto mide", no "no tiene nada adentro". Son
     dos afirmaciones distintas y el motor las confundía: concluía "está
     vacío" de ese cero y ni siquiera intentaba leer. Lo único que prueba que
     un archivo está vacío es leerlo y que no venga nada.

     Que en Android un proveedor —el correo, Drive— pueda entregar un archivo
     entero sin el dato de cuánto mide es plausible y encaja con lo que el PM
     vio (el PDF del mail falló, la foto de la cámara entró y esa sí trae su
     tamaño), pero es hipótesis y no está observada en el aparato. No importa:
     el arreglo no la necesita. Tratar un cero como desconocido y caer al
     camino que lee para saber es correcto en cualquier navegador, porque la
     premisa que se corrige es un error de lógica, no una conjetura sobre una
     plataforma.

     Lo reproduce `app/pruebas/archivo-sin-tamano.js`. */
  var tam = tamañoDe(file);
  if (tam === 0) tam = null;

  var ctx = {
    id: opts.id || generarId(),
    itemId: opts.itemId || null,
    at: opts.ahora || new Date().toISOString(),
    nombre: norm(file && file.name) || ("documento." + (clas.extension || "bin")),
    origen: opts.origen || "manual",
    paginas: typeof opts.paginas === "number" ? opts.paginas : null,
    clas: clas
  };
  ctx.nombreCorto = nombreCorto({
    origen: ctx.origen, esTarjeta: opts.esTarjeta, tipoReserva: opts.tipoReserva, nombre: ctx.nombre
  });

  /* Caminos 1 y 2, que ahora son el mismo. Antes se separaban porque con el
     tamaño conocido se creía que no hacía falta leer para decidir; la
     experiencia dijo lo contrario.

     Precisión que la auditoría del 17/09 pidió y corresponde: esto NO es
     "siempre lee". Un archivo que informa un tamaño MAYOR al tope sigue yendo
     al camino 3 sin leerse, y está bien: ahí el número alcanza para decidir
     porque el error sería aceptar algo que no entra, no rechazar algo que sí.
     Lo que cambió es que un tamaño chico —o cero— ya no concluye nada. */
  if (tam === null || tam <= TOPE_ARCHIVO_BYTES) {
    return leerBytesConDiagnostico(file, opts).then(function (r) {
      var bytes = r.bytes;
      if (!bytes.length) {
        return resultadoFallido("archivo-vacio", { detalle: detalleDeLectura(file, r.intentos) });
      }
      if (bytes.length > TOPE_ARCHIVO_BYTES) return rutaGrande(file, opts, ctx, bytes.length);
      return armar(ctx, bytes, clas.mime, "ok", null);
    }, function (e) {
      /* NO ENCONTRÉ CÓMO LLEGAR ACÁ, y lo digo así.

         La auditoría del 17/09 marcó esta rama como código muerto. La primera
         respuesta que escribí fue que sí se alcanzaba, "porque `normalizarBytes`
         puede lanzar sobre un valor inyectado por `opts.leerBytes`". Era falso,
         y la segunda auditoría lo agarró: esa rama de `leerBytesConDiagnostico`
         tiene su propio manejador de rechazo y devuelve bytes vacíos, así que
         nunca propaga. Inventé una justificación en vez de comprobarla — la
         misma trampa que el proyecto tiene escrita, cometida al contestar una
         auditoría.

         Lo comprobé después, con cinco intentos de llegar (quedan en
         `app/pruebas/preparar-no-lanza.js`): `opts.leerBytes` que rechaza, que
         devuelve basura y que lanza sincrónico, y `file.bytes` con un valor
         raro y con un objeto hostil. Ninguno cae acá.

         Se queda de todos modos, y eso es una DECISIÓN, no un hecho
         demostrado: el costo es una función anónima que no corre, y el
         beneficio es que si mañana alguien agrega un camino de lectura que sí
         rechace, el usuario ve un mensaje en vez de nada. Lo que no se puede
         es seguir afirmando que dispara. */
      return resultadoFallido("no-se-pudo-leer", { detalle: detalleDeLectura(file, [{ via: "lectura", bytes: null, error: (e && e.name) || "Error" }]) });
    });
  }

  // Camino 3: pesa más que el tope.
  return rutaGrande(file, opts, ctx, tam);
}

/** Qué se hace con un archivo que no entra tal cual. */
function rutaGrande(file, opts, ctx, bytes) {
  if (!ctx.clas.recomprimible) {
    return Promise.resolve(resultadoFallido("no-entra-pdf", { bytes: bytes }));
  }
  var rec = resolverRecompresor(opts);
  if (typeof rec !== "function") {
    return Promise.resolve(resultadoFallido("sin-recompresor", { bytes: bytes }));
  }
  return bajarLaEscalera(file, rec, bytes).then(function (r) {
    if (typeof rec.liberar === "function") { try { rec.liberar(file); } catch (e) {} }
    if (!r.ok) return resultadoFallido(r.codigo, { bytes: bytes });
    return armar(ctx, r.bytes, r.mime, "recomprimido", {
      desdeBytes: bytes,
      aBytes: r.bytes.length,
      pasos: r.pasos,
      ladoMayor: r.paso.ladoMayor,
      calidad: r.paso.calidad
    });
  }, function () {
    if (typeof rec.liberar === "function") { try { rec.liberar(file); } catch (e) {} }
    return resultadoFallido("no-se-pudo-reducir", { bytes: bytes });
  });
}

/**
 * Prueba los pasos de la escalera en orden y se queda con el PRIMERO
 * que entra. No sigue achicando de gusto: cada paso de más es calidad
 * tirada a la basura en el documento que después hay que leer.
 */
function bajarLaEscalera(file, recomprimir, bytesOriginales) {
  var pasos = 0;
  function intentar(i) {
    if (i >= ESCALERA_RECOMPRESION.length) {
      return Promise.resolve({ ok: false, codigo: "no-entra-ni-reducida", pasos: pasos });
    }
    var paso = { ladoMayor: ESCALERA_RECOMPRESION[i].ladoMayor,
                 calidad: ESCALERA_RECOMPRESION[i].calidad,
                 mime: MIME_RECOMPRIMIDO };
    return Promise.resolve(recomprimir(file, paso)).then(function (salida) {
      pasos++;
      var bytes = normalizarBytes(salida && salida.bytes);
      if (bytes.length && bytes.length <= OBJETIVO_RECOMPRESION_BYTES && bytes.length < bytesOriginales) {
        return { ok: true, bytes: bytes, mime: (salida && salida.mime) || MIME_RECOMPRIMIDO, paso: paso, pasos: pasos };
      }
      return intentar(i + 1);
    });
  }
  return intentar(0);
}

/** Arma el resultado bueno: metadatos para el ítem y cuerpo para su documento. */
function armar(ctx, bytes, mime, estado, recompresion) {
  var doc = {
    id: ctx.id,
    nombre: ctx.nombre,
    nombreCorto: ctx.nombreCorto,
    mime: mime,
    bytes: bytes.length,
    paginas: ctx.paginas,
    estado: estado,
    origen: ctx.origen,
    at: ctx.at
  };
  if (estado === "recomprimido") doc.bytesOriginales = recompresion.desdeBytes;

  var cuerpo = {
    id: ctx.id,
    itemId: ctx.itemId,
    mime: mime,
    bytes: bytes.length,
    at: ctx.at,
    b64: bytesABase64(bytes)
  };

  var advertencias = [];
  if (bytesSerializados(cuerpo) > TOPE_DOC_BASE_BYTES) {
    advertencias.push(advertenciaInfo("al-filo-del-tope", { bytes: bytes.length }));
  }

  return {
    estado: estado,
    ok: true,
    bloqueaGuardado: false,
    doc: doc,
    cuerpo: cuerpo,
    recompresion: recompresion,
    error: null,
    advertencias: advertencias
  };
}

/* ============================================================
   EXPORTA
   ============================================================ */
return {
  VERSION: VERSION,

  // Topes (los del brief y los del contrato de la base)
  TOPE_ARCHIVO_BYTES: TOPE_ARCHIVO_BYTES,
  TOPE_DOC_BASE_BYTES: TOPE_DOC_BASE_BYTES,
  OBJETIVO_RECOMPRESION_BYTES: OBJETIVO_RECOMPRESION_BYTES,
  MAX_DOCS_POR_RESERVA: MAX_DOCS_POR_RESERVA,
  MAX_DOCS_BASE: MAX_DOCS_BASE,

  // Reglas declaradas como datos
  TIPOS: TIPOS,
  ORIGENES: ORIGENES,
  REGLAS_NOMBRE_CORTO: REGLAS_NOMBRE_CORTO,
  ESCALERA_RECOMPRESION: ESCALERA_RECOMPRESION,
  PISO_LADO_MAYOR: PISO_LADO_MAYOR,
  PISO_CALIDAD: PISO_CALIDAD,
  MIME_RECOMPRIMIDO: MIME_RECOMPRIMIDO,
  ERRORES: ERRORES,
  ERRORES_BASE: ERRORES_BASE,

  // Cuentas
  bytesCodificados: bytesCodificados,
  bytesSerializados: bytesSerializados,
  bytesABase64: bytesABase64,
  base64ABytes: base64ABytes,
  formatearBytes: formatearBytes,
  fechaCorta: fechaCorta,

  // Clasificación y nombres
  clasificarArchivo: clasificarArchivo,
  etiquetaTipo: etiquetaTipo,
  nombreCorto: nombreCorto,
  nombreDeDescarga: nombreDeDescarga,
  rutaDelCuerpo: rutaDelCuerpo,

  // Cupo
  espacioParaDocumentos: espacioParaDocumentos,
  agregarDocumento: agregarDocumento,
  quitarDocumento: quitarDocumento,
  presupuestoDeLaBase: presupuestoDeLaBase,
  interpretarErrorDeLaBase: interpretarErrorDeLaBase,
  leerBytesConDiagnostico: leerBytesConDiagnostico,
  detalleDeLectura: detalleDeLectura,

  // Textos derivados de los metadatos
  textoTira: textoTira,
  textoFila: textoFila,
  lineaDeDatos: lineaDeDatos,
  avisoMenorCalidad: avisoMenorCalidad,

  // Preparar (la puerta de entrada)
  prepararDocumento: prepararDocumento,
  bajarLaEscalera: bajarLaEscalera,

  // La única que toca el DOM
  recomprimirImagenConCanvas: recomprimirImagenConCanvas
};
});

/* ============================================================
   NOTA DE INTEGRACIÓN — lo que la app tiene que hacer con esto
   ============================================================

   1. Al elegir un archivo (botón de D8, conectado con `wireFileInput`,
      diseño 7.4) se prepara sin escribir nada:
        const r = await AdjuntosEngine.prepararDocumento(file, {
          origen:"manual"|"camara"|"importar", esTarjeta, tipoReserva:item.type,
          paginas, docsActuales:item.docs||[], itemId:item.id });
      `r.estado` elige la pantalla: "ok" → D10, "recomprimido" → D11
      (`avisoMenorCalidad(r.doc,{momento:"adjuntar"})`), "no-entra" → D12
      con `r.error.mensaje`. `r.bloqueaGuardado` es siempre false: la
      reserva se guarda igual.

   2. Al tocar Guardar se escriben las DOS partes: `r.doc` en el array
      `docs` del ítem, y `r.cuerpo` en `AdjuntosEngine.rutaDelCuerpo(tripId, r.doc.id)`.
      Si la escritura del cuerpo falla, `interpretarErrorDeLaBase(e)` da
      el mensaje y el cuerpo NO se agrega al array del ítem — y `delItem`
      y `delTrip` tienen que borrar `trips/{tripId}/docs/*`, porque
      borrar un documento de la base no borra lo que cuelga de su ruta.

   3. Para pintar sin traer el archivo alcanzan los metadatos:
      `textoTira` (D1), `textoFila` (D10/D11/D14), `lineaDeDatos` (D2/D3/D6),
      `avisoMenorCalidad` (D5) y `nombreDeDescarga` (D7.5). El visor
      rearma el archivo con `base64ABytes(cuerpo.b64)` y un Blob.
   ============================================================ */
