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
   LO QUE CAMBIÓ EN LA VERSIÓN 3
   ============================================================

   VAL-59 · LA TARJETA DE EMBARQUE SE DESPRENDE DE UN VUELO.
   Hasta acá, una tarjeta de embarque que no coincidía con ningún
   vuelo cargado daba "nuevo", y la app creaba una reserva de vuelo
   con ella. Una tarjeta de embarque NO es un vuelo: es un documento
   que se desprende de uno. Ahora ese caso devuelve "sin-vuelo" con
   el caso que corresponde ("sin-vuelos", "un-vuelo", "varios-vuelos"),
   los candidatos, las salidas posibles y lo que la tarjeta aporta
   para precargar un vuelo nuevo. El motor decide y devuelve el caso;
   la app dibuja y pregunta. Acá adentro no hay texto de interfaz.

   El orden no cambia: PRIMERO EL MATCH, SIEMPRE. Después preguntar.
   Nunca inventar. "mismo" y "ambiguo" funcionan exactamente igual
   que antes; un pasaje, un voucher y cualquier otra reserva siguen
   dando "nuevo" y se cargan como hasta hoy.

   Qué cuenta como tarjeta de embarque está en REGLAS_TARJETA, en un
   solo lugar, y es el mismo criterio que la interfaz usa para poner
   su chip (docs/design/adjuntar.md §7.6.1).

   VAL-60 · UN LOTE, UNA LLAMADA. El contrato pide, textual: "For a
   list of items prefer ONE call that returns a JSON array over one
   call per item". `interpretFiles` agrupa los archivos que se leen
   como TEXTO y los resuelve en una sola llamada por lote; los que
   necesitan imágenes siguen sueltos. El progreso por fila —que era
   la razón válida por la que se llamaba una vez por archivo— se
   conserva con `opts.onProgress` (ver EVENTOS_PROGRESO).

   Dos cosas que el lote no puede romper, y por eso están escritas:
     · cada reserva sale atribuida a SU archivo, o no sale. Si la
       respuesta no permite atribuirla sin adivinar, el motor relee
       archivo por archivo en vez de mezclar.
     · un archivo que falla no invalida a los demás (VAL-41): los que
       fallan antes de la llamada ni entran al lote, y un error del
       lote que pueda ser del lote cae a llamadas sueltas.

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

   Cuatro resultados posibles, nunca una decisión adivinada:

     { resultado:"nuevo",   candidato, motivo }
     { resultado:"mismo",   candidato, existente, patch, motivo }
     { resultado:"ambiguo", candidato, candidatos:[...], motivo }
     { resultado:"sin-vuelo", caso, candidato, candidatos:[...],
       opciones:["asociar","crear"], precarga:{vuelo, desdeLaTarjeta, vacios} }

   El cuarto es de VAL-59 y sólo aparece con tarjetas de embarque:
   es el "nuevo" de antes, con lo que hace falta para preguntar en
   vez de crear una reserva suelta.

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

var VERSION = 3;

/** Tipos de reserva que la app conoce (mismas claves que TYPES en valija.html). */
var RESERVATION_TYPES = ["flight", "stay", "car", "transfer", "act", "note"];

/**
 * QUÉ CLASE DE DOCUMENTO SE LEYÓ (VAL-59). Lo declara el modelo en el campo
 * `docType`, y es una lista cerrada: cualquier otra cosa que conteste se
 * descarta y queda "". Un valor vacío NO es un error: es la respuesta
 * honesta cuando el documento no dice qué es, y el criterio local de
 * `REGLAS_TARJETA` sigue funcionando sin él (ver `esTarjetaDeEmbarque`).
 */
var TIPOS_DOCUMENTO = ["boarding-pass", "ticket", "voucher", "booking", "other"];

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

/**
 * Los campos de un vuelo que la interfaz muestra al crear uno nuevo a partir
 * de una tarjeta de embarque (VAL-59, estado V3 de docs/design/adjuntar.md:
 * "8 campos · de la tarjeta" / "3 campos · vacíos"). Son once, y el orden es
 * el del formulario. El motor NO pone las etiquetas: devuelve los nombres de
 * campo y la app les pone el nombre que usa un viajero.
 */
var CAMPOS_VUELO = [
  "from", "to", "provider", "flightNumber", "start", "end",
  "seat", "terminal", "gate", "boardingTime", "confirmation"
];

/**
 * ¿ESTO ES UNA TARJETA DE EMBARQUE? (VAL-59)
 *
 * Declarado como datos y evaluado EN ORDEN: gana la primera regla que
 * aplica, y cada una deja escrito su motivo. Agregar un criterio es agregar
 * una entrada.
 *
 * Por qué hace falta un criterio explícito: la sección 7.6 de
 * docs/design/adjuntar.md pide que el dato salga del motor y NO se infiera en
 * la interfaz, con una advertencia textual — "si la app adivina 'es una
 * tarjeta porque trae asiento', va a tratar como tarjeta a un pasaje con
 * asiento asignado". Por eso el asiento solo NUNCA alcanza (regla
 * `asiento-solo-no-alcanza`), y por eso el criterio vive en un solo lugar:
 * el mismo `esTarjetaDeEmbarque` que decide el flujo es el que la interfaz
 * usa para poner su chip.
 *
 * Las señales, en orden de fuerza:
 *
 *  1. `declarada-por-el-modelo` — el documento dice qué es y el modelo lo
 *     copió en `docType`. Es la única señal de primera mano; si está, manda.
 *     También manda en negativo: si el modelo dijo "ticket", no es tarjeta.
 *  2. `hora-de-embarque` — `boardingTime` es un dato que sólo se imprime en
 *     una tarjeta de embarque (y el prompt lo dice: "si el documento no es
 *     una tarjeta de embarque, dejalo vacío").
 *  3. `puerta-de-embarque` — la puerta se asigna el día del vuelo, no cuando
 *     se compra el pasaje.
 *  4. `sin-titulo-ni-proveedor` — el perfil que `sanitizeReservation` ya
 *     contemplaba: un vuelo sin título ni aerolínea pero con asiento, puerta
 *     o terminal. Un pasaje siempre nombra a la aerolínea; una tarjeta
 *     fotografiada o recortada, a veces no.
 */
var REGLAS_TARJETA = [
  {
    id: "no-es-vuelo",
    aplica: function (r) { return !r || r.type !== "flight"; },
    esTarjeta: false,
    motivo: "No es un vuelo: una tarjeta de embarque siempre lo es."
  },
  {
    id: "declarada-por-el-modelo",
    aplica: function (r) { return TIPOS_DOCUMENTO.indexOf(r.docType) >= 0; },
    esTarjeta: function (r) { return r.docType === "boarding-pass"; },
    certeza: "declarada",
    motivo: function (r) { return "El documento se identifica como \"" + r.docType + "\"."; }
  },
  {
    id: "hora-de-embarque",
    aplica: function (r) { return !!norm(r.boardingTime); },
    esTarjeta: true,
    certeza: "inferida",
    motivo: "Trae hora de embarque, un dato que sólo se imprime en una tarjeta de embarque."
  },
  {
    id: "puerta-de-embarque",
    aplica: function (r) { return !!norm(r.gate); },
    esTarjeta: true,
    certeza: "inferida",
    motivo: "Trae puerta de embarque, que se asigna el día del vuelo y no figura en un pasaje."
  },
  {
    id: "sin-titulo-ni-proveedor",
    aplica: function (r) {
      return !norm(r.title) && !norm(r.provider) &&
        (!!norm(r.seat) || !!norm(r.terminal) || !!norm(r.gate) || !!norm(r.boardingTime));
    },
    esTarjeta: true,
    certeza: "inferida",
    motivo: "Es un vuelo sin título ni aerolínea, con datos de embarque: el perfil de una tarjeta recortada o borrosa."
  },
  {
    id: "asiento-solo-no-alcanza",
    aplica: function () { return true; },
    esTarjeta: false,
    motivo: "No hay ningún dato de embarque que la distinga de un pasaje: un asiento asignado también lo trae un pasaje."
  }
];

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

/**
 * UN LOTE, UNA LLAMADA (VAL-60). El contrato lo pide textual: "For a list of
 * items prefer ONE call that returns a JSON array over one call per item".
 * Subir cuatro PDFs con texto era hasta acá cuatro llamadas al modelo.
 *
 * El tope de 64 KiB del contrato es para TODO el input, así que con un lote
 * hay que mirar la suma, no cada archivo por separado. Los tres números,
 * declarados como datos:
 *
 *   maxCaracteresPorDocumento — es `MAX_CARACTERES_TEXTO` y no cambia: lo
 *     que entra de UN comprobante. El recorte de `clipText` sigue pasando
 *     archivo por archivo, antes de agrupar.
 *
 *   maxCaracteres 24000 — la suma de todos los documentos de una misma
 *     llamada. La cuenta: 64 KiB son 65536 bytes; un texto en español con
 *     acentos puede pesar hasta ~2 bytes por carácter, así que 24000
 *     caracteres son como mucho ~48000 bytes, más ~3000 del andamiaje del
 *     prompt (reglas, formato, encabezado de cada documento): ~51000, con
 *     margen. Y está muy por encima de cualquier lote real: el voucher de
 *     micro del PM tiene 625 caracteres, así que entran cuarenta.
 *
 *   maxDocumentos 6 — techo por prudencia, no por tamaño: cuanto más largo
 *     el lote, más caro sale reintentar si la respuesta viene mal. Con seis
 *     documentos ya se bajó de seis llamadas a una.
 *
 * Un documento que solo ya llena el lote viaja solo. El orden de los
 * archivos nunca se altera.
 */
var LIMITES_LOTE = {
  maxDocumentos: 6,
  maxCaracteres: 24000,
  maxCaracteresPorDocumento: MAX_CARACTERES_TEXTO
};

/**
 * Los eventos que `interpretFiles` le avisa a la app por `opts.onProgress`,
 * declarados como datos. Es la forma de conservar el progreso por fila
 * (VAL-60) ahora que varios archivos comparten una llamada.
 *
 *   preparando — empezó a prepararse este archivo (extraer la capa de texto
 *                de un PDF, ver si la vista acepta imágenes). Es trabajo por
 *                archivo y sigue siendo por archivo.
 *   preparado  — ya se sabe cómo se va a leer: `modo`, `paginas`,
 *                `caracteres`. La fila puede decir "leído del texto del PDF"
 *                antes de que el modelo conteste.
 *   leyendo    — salió la llamada que incluye a este archivo. Si va en lote,
 *                `lote` trae los nombres de todos los archivos de esa misma
 *                llamada: todas esas filas arrancan juntas.
 *   terminado  — este archivo tiene su resultado (`fileResult`), haya salido
 *                bien, vacío o con error.
 */
var EVENTOS_PROGRESO = ["preparando", "preparado", "leyendo", "terminado"];

/**
 * Cuando la llamada de un lote falla, ¿conviene reintentar cada archivo por
 * separado? Declarado como datos, porque la respuesta depende del código y
 * no es obvia:
 *
 *   true  — el problema puede ser del lote en sí (demasiado largo, respuesta
 *           cortada a la mitad). Cada archivo solo tiene chance de andar, y
 *           es la única forma de cumplir la garantía de VAL-41: un archivo
 *           que falla no invalida a los demás.
 *   false (o ausente) — el problema es de la vista o de la cuota, y no lo
 *           arregla repetirlo: reintentar seis veces lo empeora. El error se
 *           reparte tal cual a todos los archivos del lote.
 */
var ERRORES_QUE_SE_REINTENTAN_SUELTOS = {
  prompt_too_large: true,
  invalid_json: true,
  empty_completion: true,
  desconocido: true
};

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
    "\"docType\" dice qué clase de documento leíste, y sólo acepta uno de estos cinco valores: \"boarding-pass\" si es una tarjeta de embarque (dice BOARDING PASS o TARJETA DE EMBARQUE, o trae puerta y hora de embarque); \"ticket\" si es un pasaje, e-ticket o billete; \"voucher\" si es un voucher o comprobante de un servicio; \"booking\" si es una reserva de alojamiento o de alquiler; \"other\" para cualquier otra cosa. Si el documento no dice qué es y no estás seguro, dejalo VACÍO: vacío es una respuesta válida y correcta, y es mejor que elegir uno al azar.",
    "Nada de comentarios ni texto fuera del JSON."
  ],
  /* Cierre del formato cuando la llamada lleva UN solo documento. */
  unDocumento: [
    "Si no reconocés ninguna reserva en el documento, devolvé {\"items\":[]}. Es preferible eso a inventar una."
  ],
  /* Cierre del formato cuando la llamada lleva VARIOS documentos (VAL-60). */
  lote: [
    "Hay varios documentos numerados. Devolvé UNA entrada por cada uno, con su número en \"documento\", incluso si no encontraste nada en él: en ese caso su \"items\" va vacío.",
    "Cada reserva va en el documento del que salió. NUNCA mezcles datos de un documento con los de otro, ni repitas en uno lo que leíste en el otro: son comprobantes distintos y sin relación entre sí.",
    "Un documento ilegible o que no sea una reserva no cancela a los demás: dejá su \"items\" vacío y seguí con el resto."
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

/** Los campos de una reserva, tal como se le piden al modelo. */
var CAMPOS_JSON_PROMPT = [
  '"type":"flight|stay|car|transfer|act|note",',
  '"title":"texto corto y humano, ej: Buenos Aires → Madrid",',
  '"start":"YYYY-MM-DDTHH:mm o vacío",',
  '"end":"YYYY-MM-DDTHH:mm o vacío",',
  '"from":"IATA de 3 letras si es vuelo, si no ciudad o lugar",',
  '"to":"idem",',
  '"provider":"aerolínea, hotel, plataforma, empresa de micro o rentadora",',
  '"flightNumber":"","confirmation":"código de reserva","seat":"","terminal":"","gate":"",',
  '"boardingTime":"HH:mm o vacío",',
  '"docType":"boarding-pass|ticket|voucher|booking|other, o vacío si el documento no lo dice",',
  '"address":"","phone":"","cost":"","currency":"","notes":""'
];

/** El JSON de una llamada con UN documento. */
var FORMATO_JSON_PROMPT = ["Devolvé este JSON exacto:", '{"items":[{']
  .concat(CAMPOS_JSON_PROMPT).concat(["}]}"]);

/** El JSON de una llamada con VARIOS documentos (VAL-60): un arreglo, como pide el contrato. */
var FORMATO_JSON_LOTE = ["Devolvé este JSON exacto, con una entrada por documento y en el mismo orden:",
  '{"documentos":[{"documento":1,"items":[{']
  .concat(CAMPOS_JSON_PROMPT)
  .concat(["}]},", '{"documento":2,"items":[…]}', "]}"]);

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
  var paginas = ctx.paginas;
  var nombreArchivo = ctx.archivo ? " (\"" + ctx.archivo + "\")" : "";
  var contexto = contextoDelViaje(ctx.trip, ctx.now);

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

  var reglas = REGLAS_PROMPT.comunes
    .concat(REGLAS_PROMPT.unDocumento)
    .concat(REGLAS_PROMPT[modo] || []);

  return [encabezado, ""]
    .concat(cuerpo)
    .concat(["", "Contexto: " + contexto, ""])
    .concat(FORMATO_JSON_PROMPT)
    .concat(["", "Reglas que no se rompen:"])
    .concat(numerar(reglas))
    .join("\n");
}

/** Las reglas del prompt, numeradas. Se usa igual en el prompt de uno y en el de lote. */
function numerar(reglas) {
  return reglas.map(function (r, i) { return (i + 1) + ". " + r; });
}

/** El contexto del viaje, igual para el prompt de uno y para el de lote. */
function contextoDelViaje(trip, now) {
  trip = trip || {};
  var hoy = now ? String(now).slice(0, 10) : new Date().toISOString().slice(0, 10);
  return "El viaje se llama \"" + (trip.name || "") + "\"" +
    (trip.destination ? ", destino " + trip.destination : "") +
    (trip.startDate ? ", entre " + trip.startDate + " y " + (trip.endDate || "?") : "") +
    ". Hoy es " + hoy + ".";
}

/**
 * VAL-60 · El prompt de UNA llamada con VARIOS documentos de texto.
 *
 * Cada documento va numerado y delimitado, y el JSON que se pide es un
 * arreglo con esos mismos números: de ahí sale la atribución de cada reserva
 * a SU archivo. Si esa atribución no llega, el motor no adivina — reparte los
 * archivos en llamadas sueltas (ver `interpretarLote`).
 *
 * El prompt de un solo documento (`buildImportPrompt`) no cambia, y se sigue
 * usando cuando el lote tiene un solo archivo: no hay nada que agrupar y no
 * hay razón para pedirle al modelo un formato más difícil.
 *
 * @param {Object} ctx
 * @param {Array<{archivo:string, texto:string, paginas:number|null}>} ctx.documentos
 * @param {Object} [ctx.trip] {name, destination, startDate, endDate}
 * @param {string} [ctx.now]
 * @returns {string}
 */
function buildBatchImportPrompt(ctx) {
  ctx = ctx || {};
  var docs = (ctx.documentos || []).filter(Boolean);
  var total = docs.length;

  var cuerpo = ["Abajo están los textos de " + total + " comprobantes de viaje DISTINTOS, numerados. " +
    "Cada uno puede ser un pasaje, un voucher, una tarjeta de embarque, una reserva de hotel o un contrato de alquiler, " +
    "y cada uno puede describir una reserva, varias o ninguna.", ""];

  docs.forEach(function (d, i) {
    var n = i + 1;
    cuerpo.push("--- COMIENZA EL DOCUMENTO " + n + " de " + total + " (\"" + d.archivo + "\")" +
      (d.paginas && d.paginas > 1 ? ", " + d.paginas + " páginas en orden" : "") + " ---");
    cuerpo.push(String(d.texto == null ? "" : d.texto));
    cuerpo.push("--- TERMINA EL DOCUMENTO " + n + " ---");
    cuerpo.push("");
  });

  var reglas = REGLAS_PROMPT.comunes
    .concat(REGLAS_PROMPT.lote)
    .concat(REGLAS_PROMPT.texto);

  return ["Extraés datos de reservas de viaje a partir del TEXTO de varios comprobantes y devolvés SOLO JSON, sin texto alrededor.", ""]
    .concat(cuerpo)
    .concat(["Contexto: " + contextoDelViaje(ctx.trip, ctx.now), ""])
    .concat(FORMATO_JSON_LOTE)
    .concat(["", "Reglas que no se rompen:"])
    .concat(numerar(reglas))
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
  // Qué clase de documento dijo el modelo que era (VAL-59). Lista cerrada:
  // cualquier otra cosa queda en "", que es un valor legítimo — el criterio
  // de `esTarjetaDeEmbarque` no depende de que esto venga.
  out.docType = TIPOS_DOCUMENTO.indexOf(x.docType) >= 0 ? x.docType : "";
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
  return sanitizeList(data.items);
}

function sanitizeList(items) {
  var out = [];
  (Array.isArray(items) ? items : []).forEach(function (x) {
    var r = sanitizeReservation(x);
    if (r) out.push(r);
  });
  return out;
}

/**
 * VAL-60 · La respuesta de una llamada con VARIOS documentos, repartida por
 * documento. **Nunca adivina a qué archivo pertenece una reserva:** si la
 * atribución no se puede establecer sin suponer, devuelve `null` y el motor
 * cae a llamadas sueltas. Una reserva atribuida al archivo equivocado hace
 * que la pantalla de revisión mienta sobre de dónde salió cada dato, y eso es
 * peor que gastar una llamada de más.
 *
 * Acepta tres formas, en este orden:
 *   1. `{"documentos":[{"documento":1,"items":[…]}]}` — la que pide el prompt.
 *   2. `{"items":[{"documento":1, …}]}` — plana, con el número en cada ítem.
 *   3. `{"documentos":[{"items":[…]}, {"items":[…]}]}` — sin números, PERO
 *      sólo si hay exactamente una entrada por documento y NINGUNA trae
 *      número: ahí el orden es la única lectura posible y es la que el prompt
 *      pidió. Si algunas traen número y otras no, es `null`: mezcla.
 *
 * @param {*} raw lo que devolvió `callModel`
 * @param {number} cantidad cuántos documentos iban en la llamada
 * @returns {Array<Array<Object>>|null} una lista de reservas por documento, en orden
 */
function parseBatchResponse(raw, cantidad) {
  var data = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return null; }
  }
  if (!data || typeof data !== "object") return null;

  var porDocumento = [];
  var i;
  for (i = 0; i < cantidad; i++) porDocumento.push([]);

  function indiceDe(x) {
    var n = x && x.documento;
    if (typeof n === "string" && /^\d+$/.test(n.trim())) n = parseInt(n, 10);
    if (typeof n !== "number" || !isFinite(n)) return -1;
    n = Math.round(n) - 1;                       // los documentos se numeran desde 1
    return (n >= 0 && n < cantidad) ? n : -1;
  }

  if (Array.isArray(data.documentos)) {
    var entradas = data.documentos.filter(function (d) { return d && typeof d === "object"; });
    var conNumero = entradas.filter(function (d) { return indiceDe(d) >= 0; });

    if (conNumero.length === entradas.length && entradas.length) {
      entradas.forEach(function (d) {
        porDocumento[indiceDe(d)] = porDocumento[indiceDe(d)].concat(sanitizeList(d.items));
      });
      return porDocumento;
    }
    // Sin ningún número, y una entrada por documento: el orden que pidió el prompt.
    if (!conNumero.length && entradas.length === cantidad) {
      entradas.forEach(function (d, n) { porDocumento[n] = sanitizeList(d.items); });
      return porDocumento;
    }
    return null;                                  // mezcla: no se atribuye adivinando
  }

  if (Array.isArray(data.items)) {
    if (cantidad === 1) return [sanitizeList(data.items)];
    var todos = data.items.filter(function (x) { return x && typeof x === "object"; });
    if (!todos.length) return porDocumento;       // "no encontré nada", y es una respuesta válida
    if (!todos.every(function (x) { return indiceDe(x) >= 0; })) return null;
    todos.forEach(function (x) {
      var r = sanitizeReservation(x);
      if (r) porDocumento[indiceDe(x)].push(r);
    });
    return porDocumento;
  }

  return null;
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

/* ============================================================
   UN LOTE, UNA LLAMADA — VAL-60
   ============================================================ */

/**
 * Reparte los documentos de texto en lotes que entren en una llamada, sin
 * alterar el orden de los archivos. Pura y sincrónica: recibe entradas con su
 * texto ya recortado y devuelve grupos.
 *
 * @param {Array<{texto:string}>} entradas
 * @param {Object} [limites] por defecto `LIMITES_LOTE`
 * @returns {Array<Array>} los mismos objetos, agrupados
 */
function planBatches(entradas, limites) {
  limites = limites || LIMITES_LOTE;
  var lotes = [], actual = [], largo = 0;
  (entradas || []).forEach(function (e) {
    var n = String((e && e.texto) || "").length;
    var noEntra = actual.length &&
      (actual.length >= limites.maxDocumentos || largo + n > limites.maxCaracteres);
    if (noEntra) { lotes.push(actual); actual = []; largo = 0; }
    actual.push(e);
    largo += n;
  });
  if (actual.length) lotes.push(actual);
  return lotes;
}

/** Avisa el progreso sin poder romper nada: si la app se cae adentro, el motor sigue. */
function avisar(opts, evento) {
  if (typeof opts.onProgress !== "function") return;
  try { opts.onProgress(evento); } catch (e) { /* el progreso es adorno: nunca tumba una importación */ }
}

/**
 * Interpreta UN lote de documentos de texto en UNA sola llamada (VAL-60).
 * Nunca rechaza: devuelve un `fileResult` por entrada, en orden.
 *
 * Tres cosas que no se negocian y por eso están acá y no repartidas:
 *   · cada reserva sale atribuida a SU archivo, o no sale;
 *   · si la atribución no se puede establecer, se reintenta archivo por
 *     archivo en vez de adivinar;
 *   · un error del lote que pueda ser del lote (ver
 *     ERRORES_QUE_SE_REINTENTAN_SUELTOS) también cae a llamadas sueltas, para
 *     que un documento roto no se lleve puestos a los demás (VAL-41).
 */
function interpretBatch(lote, opts, cuenta) {
  var nombres = lote.map(function (e) { return e.nombre; });
  cuenta = cuenta || { llamadas: 0 };

  function extraDe(e) { return { paginas: e.fuente.paginas, modo: e.fuente.modo, caracteres: e.fuente.caracteres }; }

  function sueltos(motivo) {
    cuenta.llamadas += lote.length;
    return Promise.all(lote.map(function (e) {
      avisar(opts, { evento: "leyendo", archivo: e.nombre, modo: e.fuente.modo, lote: null, motivo: motivo });
      return callModelForSource(e.fuente, e.nombre, opts).then(function (r) {
        avisar(opts, { evento: "terminado", archivo: e.nombre, resultado: r });
        return r;
      });
    }));
  }

  if (typeof opts.callModel !== "function") {
    return Promise.all(lote.map(function (e) {
      var r = fileResult(e.nombre, "error", [], errorInfo("ia-no-disponible", ERRORES_PROPIOS["ia-no-disponible"]), extraDe(e));
      avisar(opts, { evento: "terminado", archivo: e.nombre, resultado: r });
      return r;
    }));
  }

  // Un solo documento no es un lote: va con el prompt de siempre, que es más
  // simple de contestar y es el que ya está probado de punta a punta.
  if (lote.length === 1) return sueltos(null);

  var prompt = buildBatchImportPrompt({
    trip: opts.trip, now: opts.now,
    documentos: lote.map(function (e) {
      return { archivo: e.nombre, texto: e.fuente.texto, paginas: e.fuente.paginas };
    })
  });
  var opciones = { modo: "texto", archivo: nombres[0], archivos: nombres.slice(), paginas: null, lote: lote.length };

  lote.forEach(function (e) {
    avisar(opts, { evento: "leyendo", archivo: e.nombre, modo: "texto", lote: nombres.slice() });
  });
  cuenta.llamadas += 1;

  return Promise.resolve()
    .then(function () { return opts.callModel(prompt, opciones); })
    .then(function (raw) {
      var porDocumento = parseBatchResponse(raw, lote.length);
      if (!porDocumento) return sueltos("la respuesta del lote no dejaba claro de qué documento salía cada reserva");
      return lote.map(function (e, i) {
        var reservas = porDocumento[i].map(function (r) { return Object.assign({}, r, { archivo: e.nombre }); });
        var r = fileResult(e.nombre, reservas.length ? "ok" : "vacio", reservas, null, extraDe(e));
        avisar(opts, { evento: "terminado", archivo: e.nombre, resultado: r });
        return r;
      });
    })
    .catch(function (err) {
      var info = friendlyModelError(err);
      if (ERRORES_QUE_SE_REINTENTAN_SUELTOS[info.codigo]) return sueltos(info.codigo);
      return lote.map(function (e) {
        var r = fileResult(e.nombre, "error", [], info, extraDe(e));
        avisar(opts, { evento: "terminado", archivo: e.nombre, resultado: r });
        return r;
      });
    });
}

/**
 * Interpreta varios archivos a la vez (VAL-41), mezclando fotos y PDFs.
 * La promesa se resuelve siempre: cada archivo lleva su propio resultado.
 * `limits()` se consulta como mucho UNA vez por corrida, y sólo si algún
 * archivo necesita imágenes.
 *
 * VAL-60 · Los archivos que se leen COMO TEXTO se agrupan y se resuelven en
 * una sola llamada por lote, como pide el contrato ("For a list of items
 * prefer ONE call that returns a JSON array over one call per item"). Los que
 * necesitan imágenes siguen sueltos: sus imágenes se reenvían en cada ronda y
 * agruparlas sería exactamente lo contrario de ahorrar.
 *
 * El progreso por fila se conserva por `opts.onProgress` (ver
 * EVENTOS_PROGRESO). Es la única función impura del motor y el motivo tiene
 * nombre: sin ella la persona mira una pantalla quieta mientras se leen
 * cuatro documentos.
 *
 * @param {Array<{name:string, blob:Blob, mimeType?:string}>} files
 * @param {Object} opts ver `interpretFile`
 * @param {Function} [opts.onProgress] (evento) => void; nunca puede romper la corrida
 * @returns {Promise<{archivos:Array, reservas:Array, resumen:Object}>}
 */
function interpretFiles(files, opts) {
  opts = opts || {};
  var sesion = newSession(opts);
  files = (files || []).filter(Boolean);

  var cuenta = { llamadas: 0 };
  var lotes = 0;

  // 1. Preparar TODO primero: es trabajo por archivo (extraer la capa de
  //    texto, mirar si la vista acepta imágenes) y se avisa por archivo.
  var preparados = files.map(function (f, i) {
    var nombre = (f && f.name) || "archivo";
    avisar(opts, { evento: "preparando", archivo: nombre, indice: i, total: files.length });
    return Promise.resolve().then(function () {
      return prepareSource(f, opts, sesion);
    }).then(function (fuente) {
      avisar(opts, {
        evento: "preparado", archivo: nombre, indice: i,
        modo: fuente.modo, paginas: fuente.paginas, caracteres: fuente.caracteres
      });
      return { nombre: nombre, indice: i, fuente: fuente, resultado: null };
    }, function (e) {
      var info = (e && e.__importError) ? e.info
        : errorInfo("desconocido", (e && e.message) || "No pude interpretar el archivo.");
      var r = fileResult(nombre, "error", [], info, null);
      avisar(opts, { evento: "terminado", archivo: nombre, indice: i, resultado: r });
      return { nombre: nombre, indice: i, fuente: null, resultado: r };
    });
  });

  return Promise.all(preparados).then(function (entradas) {
    var porImagen = entradas.filter(function (e) { return e.fuente && e.fuente.modo === "imagenes"; });
    var porTexto  = entradas.filter(function (e) { return e.fuente && e.fuente.modo === "texto"; });

    var tareas = [];

    // 2. Las imágenes, una llamada cada una: agruparlas no ahorraría nada.
    porImagen.forEach(function (e) {
      if (typeof opts.callModel === "function") cuenta.llamadas++;
      avisar(opts, { evento: "leyendo", archivo: e.nombre, modo: "imagenes", lote: null });
      tareas.push(callModelForSource(e.fuente, e.nombre, opts).then(function (r) {
        e.resultado = r;
        avisar(opts, { evento: "terminado", archivo: e.nombre, indice: e.indice, resultado: r });
      }));
    });

    // 3. Los textos, en lotes.
    planBatches(porTexto.map(function (e) { return { texto: e.fuente.texto, e: e }; }))
      .forEach(function (grupo) {
        var deLote = grupo.map(function (g) { return g.e; });
        lotes++;
        tareas.push(interpretBatch(deLote, opts, cuenta).then(function (rs) {
          rs.forEach(function (r, i) { deLote[i].resultado = r; });
        }));
      });

    return Promise.all(tareas).then(function () { return entradas; });
  }).then(function (entradas) {
    var archivos = entradas.map(function (e) { return e.resultado; });
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
      porImagenes: cuantos("modo", "imagenes"),
      // Cuántas llamadas al modelo salieron y cuántos lotes hubo. Es el número
      // que VAL-60 viene a bajar: sin él, no hay forma de saber si sirvió.
      llamadas: cuenta.llamadas,
      lotes: lotes
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

/* ============================================================
   LA TARJETA DE EMBARQUE SE DESPRENDE DE UN VUELO — VAL-59
   ============================================================ */

/**
 * ¿Esta reserva interpretada es una tarjeta de embarque? Recorre
 * `REGLAS_TARJETA` en orden y devuelve la primera que aplica, con su motivo.
 * Pura y sincrónica.
 *
 * Es el ÚNICO criterio del proyecto: el mismo que decide el flujo de VAL-59
 * es el que la interfaz usa para poner su chip "Tarjeta de embarque"
 * (docs/design/adjuntar.md §7.6.1). Si algún día hay que aflojarlo o
 * apretarlo, se toca la tabla y cambian los dos a la vez.
 *
 * @param {Object} reserva
 * @returns {{esTarjeta:boolean, regla:string, certeza:"declarada"|"inferida"|"descartada", motivo:string}}
 */
function clasificarTarjetaDeEmbarque(reserva) {
  for (var i = 0; i < REGLAS_TARJETA.length; i++) {
    var regla = REGLAS_TARJETA[i];
    if (!regla.aplica(reserva)) continue;
    var es = typeof regla.esTarjeta === "function" ? !!regla.esTarjeta(reserva) : !!regla.esTarjeta;
    return {
      esTarjeta: es,
      regla: regla.id,
      certeza: es ? (regla.certeza || "inferida") : "descartada",
      motivo: typeof regla.motivo === "function" ? regla.motivo(reserva) : regla.motivo
    };
  }
  return { esTarjeta: false, regla: "ninguna", certeza: "descartada", motivo: "No hay ninguna regla que la reconozca como tarjeta de embarque." };
}

/** El sí o no de `clasificarTarjetaDeEmbarque`, para el chip de la interfaz. */
function esTarjetaDeEmbarque(reserva) {
  return clasificarTarjetaDeEmbarque(reserva).esTarjeta;
}

/**
 * Todos los vuelos del viaje, ordenados por fecha de salida (los que no
 * tienen fecha van al final, sin alterar su orden entre sí). Son los
 * candidatos que la interfaz ofrece cuando hay que preguntar contra cuál
 * asociar una tarjeta — todos, no sólo los del día: si la tarjeta perdió la
 * fecha, filtrar por fecha esconde justamente el candidato correcto
 * (docs/design/adjuntar.md, V5).
 */
function flightCandidates(existentes) {
  var vuelos = (existentes || []).filter(function (it) { return it && it.type === "flight"; });
  return vuelos.map(function (v, i) { return { v: v, i: i }; })
    .sort(function (a, b) {
      var da = dateOnly(a.v.start) ? String(a.v.start) : "";
      var db = dateOnly(b.v.start) ? String(b.v.start) : "";
      if (da && db && da !== db) return da < db ? -1 : 1;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.i - b.i;
    })
    .map(function (x) { return x.v; });
}

/**
 * Lo que la tarjeta aporta para precargar un vuelo nuevo (VAL-59).
 *
 * `vuelo` trae todos los campos de una reserva, con lo que la tarjeta traía y
 * con "" en lo que no traía: **un campo vacío no se rellena adivinando**. No
 * se compone el título con la ruta, no se deduce la terminal del aeropuerto,
 * no se calcula la hora de llegada. `desdeLaTarjeta` y `vacios` son los
 * nombres de campo de cada grupo, en el orden de `CAMPOS_VUELO`, para que la
 * interfaz pueda decir "8 de 11 campos" sin volver a mirar los datos.
 *
 * @param {Object} tarjeta reserva interpretada
 * @returns {{vuelo:Object, desdeLaTarjeta:Array<string>, vacios:Array<string>, campos:number}}
 */
function preloadFlightFromBoardingPass(tarjeta) {
  tarjeta = tarjeta || {};
  var vuelo = { type: "flight" };
  STRING_FIELDS.forEach(function (f) { vuelo[f] = norm(tarjeta[f]); });
  if (tarjeta.archivo) vuelo.archivo = tarjeta.archivo;

  var desdeLaTarjeta = [], vacios = [];
  CAMPOS_VUELO.forEach(function (f) { (vuelo[f] ? desdeLaTarjeta : vacios).push(f); });

  return { vuelo: vuelo, desdeLaTarjeta: desdeLaTarjeta, vacios: vacios, campos: CAMPOS_VUELO.length };
}

/**
 * El caso de VAL-59: una tarjeta de embarque que no coincidió con ningún
 * vuelo cargado. El motor decide CUÁL de los tres casos es y devuelve los
 * datos; la app dibuja. Acá adentro no hay una sola línea de texto de
 * interfaz.
 *
 *   caso "sin-vuelos"    — el viaje no tiene ningún vuelo: no hay con qué
 *                          matchear. Única salida: crear uno, precargado.
 *   caso "un-vuelo"      — hay uno y no coincide. DOS salidas, y ninguna es
 *                          la correcta: que el número no coincida puede ser
 *                          un número mal leído o una reserva cargada a mano
 *                          sin número. Por eso `opciones` las lista a las dos
 *                          y el motor no marca ninguna preferida.
 *   caso "varios-vuelos" — hay varios y ninguno coincide: van todos como
 *                          candidatos, más la salida de crear uno nuevo.
 */
function resultadoSinVuelo(candidato, existentes, motivoDelMatch, clasificacion) {
  var candidatos = flightCandidates(existentes);
  var caso = !candidatos.length ? "sin-vuelos" : (candidatos.length === 1 ? "un-vuelo" : "varios-vuelos");
  return {
    resultado: "sin-vuelo",
    caso: caso,
    motivo: motivoDelMatch,
    porQueEsTarjeta: clasificacion.motivo,
    certeza: clasificacion.certeza,
    candidato: candidato,
    esTarjeta: true,
    candidatos: candidatos,
    opciones: candidatos.length ? ["asociar", "crear"] : ["crear"],
    precarga: preloadFlightFromBoardingPass(candidato)
  };
}

/**
 * VAL-42. Decide si una reserva de vuelo interpretada es nueva, es un
 * vuelo ya cargado (y con qué se completa), o hay más de un candidato
 * y hace falta preguntar. El criterio es número de vuelo y fecha.
 *
 * VAL-59 agrega un cuarto resultado, y sólo para tarjetas de embarque:
 * donde antes decía "nuevo" —o sea, "creá una reserva de vuelo con esto"—
 * ahora dice "sin-vuelo", porque **una tarjeta de embarque no es un vuelo:
 * es un documento que se desprende de uno**. Un pasaje, un voucher o
 * cualquier otra reserva de vuelo siguen dando "nuevo" y se cargan como
 * hasta hoy; el orden tampoco cambia: primero el match, siempre, y recién
 * después la pregunta.
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
 * @returns {{resultado:"nuevo"|"mismo"|"ambiguo"|"sin-vuelo", motivo:string, candidato:Object,
 *            existente?:Object, patch?:Object, candidatos?:Array,
 *            caso?:"sin-vuelos"|"un-vuelo"|"varios-vuelos", opciones?:Array, precarga?:Object}}
 */
function matchFlightReservation(candidato, existentes) {
  existentes = (existentes || []).filter(Boolean);

  /* El único punto por donde se sale sin match. Una tarjeta de embarque no se
     convierte en reserva de vuelo (VAL-59): se devuelve el caso y la app
     pregunta. Cualquier otra reserva de vuelo sigue siendo "nuevo", igual que
     antes. */
  function sinMatch(motivo) {
    var clase = clasificarTarjetaDeEmbarque(candidato);
    if (clase.esTarjeta) return resultadoSinVuelo(candidato, existentes, motivo, clase);
    return { resultado: "nuevo", motivo: motivo, candidato: candidato, esTarjeta: false };
  }

  if (!candidato || candidato.type !== "flight") {
    return { resultado: "nuevo", motivo: "No es un vuelo.", candidato: candidato, esTarjeta: false };
  }

  var numero = candidato.flightNumber;
  var fecha = dateOnly(candidato.start);

  if (!fecha) {
    return sinMatch("No se pudo determinar la fecha del vuelo: no hay con qué comparar.");
  }

  var vuelosEseDia = existentes.filter(function (it) {
    return it && it.type === "flight" && sameFlightDate(it.start, fecha);
  });

  if (!numero) {
    if (!vuelosEseDia.length) {
      return sinMatch("La tarjeta no trae número de vuelo, y no hay ningún vuelo cargado ese día.");
    }
    return {
      resultado: "ambiguo",
      motivo: "La tarjeta no trae número de vuelo y hay " + vuelosEseDia.length +
        (vuelosEseDia.length === 1 ? " vuelo cargado" : " vuelos cargados") +
        " ese mismo día: sin número no hay forma de distinguir sin adivinar.",
      candidato: candidato,
      esTarjeta: esTarjetaDeEmbarque(candidato),
      candidatos: vuelosEseDia
    };
  }

  var candidatos = vuelosEseDia.filter(function (it) { return sameFlightNumber(it.flightNumber, numero); });

  if (!candidatos.length) {
    return sinMatch("Ningún vuelo cargado coincide en número (" + numero + ") y fecha (" + fecha + ").");
  }

  if (candidatos.length > 1) {
    return {
      resultado: "ambiguo",
      motivo: "Hay " + candidatos.length + " vuelos cargados con el mismo número y la misma fecha.",
      candidato: candidato,
      esTarjeta: esTarjetaDeEmbarque(candidato),
      candidatos: candidatos
    };
  }

  var existente = candidatos[0];
  return {
    resultado: "mismo",
    motivo: "Mismo número de vuelo (" + numero + ") y misma fecha (" + fecha + ").",
    candidato: candidato,
    existente: existente,
    esTarjeta: esTarjetaDeEmbarque(candidato),
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
  return { resultado: "nuevo", motivo: "No es un vuelo: se carga como reserva nueva.", candidato: reserva, esTarjeta: false };
}

/* ============================================================
   EXPORTA
   ============================================================ */
return {
  VERSION: VERSION,
  RESERVATION_TYPES: RESERVATION_TYPES,
  STRING_FIELDS: STRING_FIELDS,
  TIPOS_DOCUMENTO: TIPOS_DOCUMENTO,
  CAMPOS_COMPLETABLES: CAMPOS_COMPLETABLES,
  CAMPOS_VUELO: CAMPOS_VUELO,
  REGLAS_TARJETA: REGLAS_TARJETA,
  PDFJS_VERSION: PDFJS_VERSION,
  PDFJS_CDN_BASE: PDFJS_CDN_BASE,
  REGLAS_TEXTO_SUFICIENTE: REGLAS_TEXTO_SUFICIENTE,
  MAX_CARACTERES_TEXTO: MAX_CARACTERES_TEXTO,
  LIMITES_LOTE: LIMITES_LOTE,
  EVENTOS_PROGRESO: EVENTOS_PROGRESO,
  ERRORES_QUE_SE_REINTENTAN_SUELTOS: ERRORES_QUE_SE_REINTENTAN_SUELTOS,
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

  // VAL-60: un lote, una llamada
  buildBatchImportPrompt: buildBatchImportPrompt,
  parseBatchResponse: parseBatchResponse,
  planBatches: planBatches,

  // VAL-42: reconocer un vuelo ya cargado
  matchFlightReservation: matchFlightReservation,
  matchAgainstExisting: matchAgainstExisting,
  buildFlightPatch: buildFlightPatch,

  // VAL-59: la tarjeta de embarque se desprende de un vuelo
  esTarjetaDeEmbarque: esTarjetaDeEmbarque,
  clasificarTarjetaDeEmbarque: clasificarTarjetaDeEmbarque,
  preloadFlightFromBoardingPass: preloadFlightFromBoardingPass,
  flightCandidates: flightCandidates,
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
      no llama a `claude.use` ni importa pdf.js — y, desde la versión 3,
      `onProgress`, que es lo que mantiene vivas las filas de la cola:
        ImportEngine.interpretFiles(files, {
          callModel: (prompt, o) => sample.json(prompt, o.images ? { images: o.images } : {}),
          limits: () => sample.limits(),   // envuelta, no suelta: se llama como método
          extractPdfText: (b) => ImportEngine.extractPdfText(b),
          renderPdfToImages: (b) => ImportEngine.renderPdfPagesToImages(b),
          onProgress: (e) => pintarFila(e),   // preparando | preparado | leyendo | terminado
          trip
        });
      IMPORTANTE para VAL-60: hay que llamar a `interpretFiles` con TODOS
      los archivos juntos. `interpretFile` sigue existiendo y sigue siendo
      una llamada por archivo: llamarla en un bucle, como hace hoy
      `runInterpretation`, es exactamente lo que VAL-60 viene a sacar.

   4. Antes de guardar una reserva de tipo "flight", `matchAgainstExisting`
      puede devolver "sin-vuelo" (VAL-59). Ahí NO se guarda nada todavía:
      se pregunta, según `caso` — "sin-vuelos" (V2 del diseño), "un-vuelo"
      (V4) o "varios-vuelos" (V5) — y recién con la respuesta de la persona
      se crea el vuelo con `precarga.vuelo` o se completa el elegido con
      `ImportEngine.buildFlightPatch(tarjeta, vuelo)`. El chip "Tarjeta de
      embarque" sale de `ImportEngine.esTarjetaDeEmbarque(reserva)`, que es
      el mismo criterio que decidió el flujo.

   3. pdf.js sigue cargándose desde cdnjs con la versión fija de
      `PDFJS_VERSION`, ahora para las DOS cosas: `getTextContent()` (el
      camino principal) y el render a imagen (el último recurso).
   ============================================================ */
