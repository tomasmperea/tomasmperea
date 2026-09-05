/* ============================================================
   VALIJA · MOTOR DE SUGERENCIA DE EQUIPAJE
   Épica VAL-30. JavaScript puro: no toca el DOM, no pide red,
   no depende de nada. Recibe datos y devuelve datos.

   El motor es híbrido y tiene tres capas:

     CAPA 1 · reglas locales determinísticas  (BASE_RULES)
       Funciona siempre, sin conexión y sin IA. Documentación
       según si el viaje es internacional, ropa por cantidad
       calculada desde la duración, higiene, electrónica, salud,
       ajustes por tipo de viaje y ajustes por lo ya cargado en
       el viaje (auto alquilado, vuelo internacional, trekking).

     CAPA 2 · ajuste por destino con IA      (enrichWithDestination)
       Agrega ítems específicos del lugar y la época, cada uno con
       su justificación. Puede fallar: la lista base sirve igual.

     CAPA 3 · aprendizaje del historial      (learnFromHistory)
       VAL-32. Un ítem agregado a mano en dos viajes del mismo tipo
       pasa a sugerirse. Un ítem descartado dos veces en el mismo
       tipo deja de sugerirse.

   Cada ítem declara de dónde sale: "regla", "destino", "historial"
   o "manual".

   ------------------------------------------------------------
   MODELO DE DATOS DE UNA LISTA GUARDADA
   ------------------------------------------------------------
   Un documento por viaje. Ruta sugerida en la base compartida:

       trips/{tripId}/packing/list

   Va colgado del viaje, igual que `trips/{tripId}/items/{itemId}`,
   así hereda los permisos de lectura y escritura del viaje y VAL-34
   (compartir con quien viaja conmigo) sale sin trabajo extra.
   Un solo documento y no uno por ítem porque la lista se lee y se
   escribe entera al generar, y el conflicto de dos personas tildando
   a la vez es tolerable: último que escribe gana sobre un ítem, no
   sobre el viaje.

   {
     schemaVersion: 1,
     tripId:        "abc123",
     tripType:      "playa",              // playa|ciudad|montana|trabajo|aventura|mixto
     createdAt:     "2026-09-05T12:00:00.000Z",
     generatedAt:   "2026-09-05T12:00:00.000Z",
     basis: {                             // sobre qué se calculó, para poder explicarlo
       destination:"Florianópolis", startDate:"2026-01-10", endDate:"2026-01-17",
       days:8, nights:7, daysKnown:true,
       international:true, internationalSource:"vuelos",   // vuelos|destino|explicito|desconocido
       facts:{ hasFlight:true, hasRentalCar:false, ... },
       tripTypeSource:"elegido"           // elegido|sugerido
     },
     ai: { status:"ok", at:"...", note:"" },   // ok|sin-ajuste|no-disponible|vacio|error
     learning: {                          // qué aprendió del historial y por qué
       promoted:[{key,label,count}], suppressed:[{key,label,count}], sampleSize:3
     },
     warnings: [{code:"sin-fechas", text:"..."}],
     stats: { total:34, packed:0, dismissed:0, pct:0 },
     items: [{
       id:        "remeras",     // = key. Estable entre generaciones.
       key:       "remeras",     // slug canónico: con esto se matchea entre viajes
       label:     "Remeras",
       category:  "ropa",        // documentacion|ropa|calzado|higiene|electronica|salud|destino|otros
       qty:       6,             // number o null cuando no aplica cantidad
       reason:    "5 días más una de repuesto.",
       source:    "regla",       // regla|destino|historial|manual
       ruleId:    "ropa.remeras",// trazabilidad: qué regla lo puso
       packed:    false,
       dismissed: false,
       manual:    false,
       qtyEdited: false,         // true si la persona corrigió la cantidad a mano
       note:      "",            // nota libre de la persona
       addedAt:   "...", updatedAt:"..."
     }]
   }

   El historial que recibe la capa 3 es un array de estos mismos
   documentos, los de los viajes ya cerrados.
   ============================================================ */

(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else if (root) root.PackingEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
"use strict";

/* ============================================================
   CONSTANTES Y CATÁLOGOS
   ============================================================ */

var SCHEMA_VERSION = 1;

/** Días que se asumen cuando el viaje todavía no tiene fechas. */
var DEFAULT_DAYS = 3;

/** VAL-32: cuántas repeticiones hacen falta para aprender. */
var HISTORY_PROMOTE_AT  = 2;   // agregado a mano en 2 viajes del mismo tipo -> se sugiere
var HISTORY_SUPPRESS_AT = 2;   // descartado en 2 viajes del mismo tipo -> deja de sugerirse

/** Tope de ítems que puede agregar la capa de IA. */
var MAX_AI_ITEMS = 8;

/** De dónde sale un ítem. */
var SOURCE = { RULE:"regla", DESTINATION:"destino", HISTORY:"historial", MANUAL:"manual" };

/** Categorías, en el orden en que se muestran. */
var CATEGORIES = [
  { key:"documentacion", label:"Documentación" },
  { key:"ropa",          label:"Ropa" },
  { key:"calzado",       label:"Calzado" },
  { key:"higiene",       label:"Higiene" },
  { key:"electronica",   label:"Electrónica" },
  { key:"salud",         label:"Salud" },
  { key:"destino",       label:"Específicos del destino" },
  { key:"otros",         label:"Otros" }   // ítems propios sin categoría declarada
];
var CATEGORY_ORDER = CATEGORIES.reduce(function (m, c, i) { m[c.key] = i; return m; }, {});

/** Tipos de viaje. */
var TRIP_TYPES = [
  { key:"playa",    label:"Playa" },
  { key:"ciudad",   label:"Ciudad" },
  { key:"montana",  label:"Montaña" },
  { key:"trabajo",  label:"Trabajo" },
  { key:"aventura", label:"Aventura" },
  { key:"mixto",    label:"Mixto" }
];
var TRIP_TYPE_KEYS = TRIP_TYPES.map(function (t) { return t.key; });
var TRIP_TYPE_LABEL = TRIP_TYPES.reduce(function (m, t) { m[t.key] = t.label; return m; }, {});

/* ============================================================
   UTILIDADES
   ============================================================ */

/** Saca acentos, baja a minúsculas. Base de todos los matcheos de texto. */
function norm(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

/**
 * Clave canónica de un ítem. Es lo que permite reconocer "Protector solar"
 * de un viaje anterior como el mismo ítem que "protector  solar" de este.
 * @param {string} label
 * @returns {string}
 */
function slug(label) {
  return norm(label).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseDay(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  if (!m) return null;
  var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return isNaN(t) ? null : t;
}

/**
 * Días de viaje, contando el de salida y el de regreso.
 * @returns {number|null} null si no se puede calcular.
 */
function daysBetweenInclusive(startDate, endDate) {
  var a = parseDay(startDate), b = parseDay(endDate);
  if (a == null || b == null) return null;
  var d = Math.round((b - a) / 86400000);
  return d >= 0 ? d + 1 : 1;
}

function dias(n) { return n + (n === 1 ? " día" : " días"); }
function clamp(n, lo, hi) {
  if (lo != null && n < lo) n = lo;
  if (hi != null && n > hi) n = hi;
  return n;
}
function nowISO() { return new Date().toISOString(); }
function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

/** Normaliza un tipo de viaje escrito de cualquier forma. */
function normalizeTripType(t) {
  var n = norm(t);
  if (!n) return null;
  if (n === "montana" || n === "montanas" || n === "sierra") return "montana";
  if (n === "negocios" || n === "laboral" || n === "work") return "trabajo";
  if (n === "city" || n === "urbano") return "ciudad";
  if (n === "beach" || n === "costa") return "playa";
  return TRIP_TYPE_KEYS.indexOf(n) >= 0 ? n : null;
}

/* ============================================================
   INTERNACIONAL O NACIONAL
   Se deduce de los códigos IATA de los vuelos y del destino.
   Tablas abiertas: agregar un código o una ciudad es agregar una
   entrada, no tocar código.
   ============================================================ */

/** Aeropuertos argentinos. Un código de vuelo fuera de esta lista se lee como exterior. */
var AR_IATA = ["EZE","AEP","COR","MDZ","BRC","IGR","USH","SLA","FTE","NQN","ROS","TUC","JUJ",
  "MDQ","BHI","CRD","REL","RGL","RGA","PSS","SDE","CTC","LUQ","AFA","RCU","SFN","PRA","CNQ",
  "RES","FMA","VDM","EQS","RSA","OYA","ELO","CPC","RHD","ING","LGS","CVI","GHU","OYO","UAQ",
  "COC","PRQ","ORA","TDL","VLG","JSM","RYO","ARR","EHL","MQD","CSZ","OES","SST"];
var AR_IATA_SET = AR_IATA.reduce(function (m, c) { m[c] = true; return m; }, {});

/** Pistas de destino nacional, para viajes sin vuelos cargados. */
var AR_HINTS = ["argentina","buenos aires","bariloche","mar del plata","cordoba","mendoza",
  "salta","jujuy","ushuaia","calafate","chalten","iguazu","rosario","tucuman","neuquen",
  "pinamar","carilo","villa gesell","necochea","miramar","san rafael","merlo","tandil",
  "chapelco","san martin de los andes","villa la angostura","puerto madryn","esquel",
  "cafayate","purmamarca","tilcare","tilcara","gualeguaychu","colon","concordia","la plata",
  "mar de ajo","monte hermoso","las grutas","el bolson","catamarca","la rioja","san juan",
  "santa fe","corrientes","chaco","formosa","misiones","posadas","rio gallegos","comodoro"];

/** Pistas de destino internacional. */
var FOREIGN_HINTS = ["brasil","brazil","florianopolis","rio de janeiro","sao paulo","buzios",
  "camboriu","chile","santiago de chile","pucon","valparaiso","atacama","uruguay","punta del este",
  "montevideo","colonia","jose ignacio","paraguay","asuncion","bolivia","la paz","peru","lima",
  "cusco","machu picchu","colombia","cartagena","medellin","bogota","mexico","cancun","tulum",
  "riviera maya","estados unidos","eeuu","usa","miami","nueva york","new york","orlando",
  "los angeles","san francisco","las vegas","chicago","canada","toronto","espana","madrid",
  "barcelona","sevilla","valencia","mallorca","ibiza","francia","paris","niza","italia","roma",
  "milan","florencia","venecia","napoli","portugal","lisboa","oporto","inglaterra","londres",
  "reino unido","escocia","irlanda","alemania","berlin","munich","holanda","amsterdam","belgica",
  "suiza","austria","viena","praga","republica checa","hungria","budapest","polonia","grecia",
  "atenas","santorini","croacia","turquia","estambul","marruecos","egipto","sudafrica","japon",
  "tokio","kioto","china","tailandia","bangkok","vietnam","indonesia","bali","india","australia",
  "sidney","nueva zelanda","dubai","emiratos","israel","cuba","varadero","punta cana",
  "republica dominicana","caribe","aruba","curazao","panama","costa rica","ecuador","galapagos",
  "venezuela","noruega","suecia","dinamarca","copenhague","finlandia","islandia"];

/**
 * @param {Trip} trip
 * @param {Array} items reservas del viaje
 * @returns {{value:boolean, known:boolean, source:string, detail:string}}
 */
function deduceInternational(trip, items) {
  trip = trip || {}; items = items || [];

  if (typeof trip.international === "boolean") {
    return { value:trip.international, known:true, source:"explicito",
             detail:trip.international ? "Marcado como internacional en el viaje." : "Marcado como nacional en el viaje." };
  }

  // 1) códigos IATA de los vuelos
  var codes = [];
  items.forEach(function (it) {
    if (!it || it.type !== "flight") return;
    [it.from, it.to].forEach(function (c) {
      var v = String(c || "").trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(v)) codes.push(v);
    });
  });
  codes = uniq(codes);
  var foreignCodes = codes.filter(function (c) { return !AR_IATA_SET[c]; });

  // 2) texto del destino
  var dest = norm([trip.destination, trip.name].filter(Boolean).join(" "));
  var foreignHit = dest ? FOREIGN_HINTS.filter(function (w) { return dest.indexOf(w) >= 0; })[0] : null;
  var localHit   = dest ? AR_HINTS.filter(function (w) { return dest.indexOf(w) >= 0; })[0] : null;

  if (foreignCodes.length) {
    return { value:true, known:true, source:"vuelos",
             detail:"Vuelo con código " + foreignCodes.join(", ") + ", fuera del país." };
  }
  if (foreignHit) {
    return { value:true, known:true, source:"destino", detail:"El destino dice \"" + foreignHit + "\"." };
  }
  if (codes.length) {
    return { value:false, known:true, source:"vuelos",
             detail:"Todos los vuelos son de cabotaje (" + codes.join(", ") + ")." };
  }
  if (localHit) {
    return { value:false, known:true, source:"destino", detail:"El destino dice \"" + localHit + "\"." };
  }
  return { value:false, known:false, source:"desconocido",
           detail:"No hay vuelos cargados ni un destino reconocible." };
}

/* ============================================================
   HECHOS DEL VIAJE
   Lo que ya está cargado y cambia la lista. Cada hecho es una
   entrada con su nombre humano y su prueba.
   ============================================================ */

var TREK_RE  = /\b(trek|trekking|senderismo|hiking|caminata|cerro|cumbre|glaciar|refugio|monta[nñ]a|ascenso|mochilero)\b/;
var WATER_RE = /\b(playa|snorkel|buceo|kayak|surf|rafting|catamaran|isla|piscina|pileta|balneario)\b/;
var WORK_RE  = /\b(congreso|conferencia|reunion|reuniones|cliente|clientes|capacitacion|workshop|feria|summit|oficina|entrevista)\b/;
var SNOW_RE  = /\b(ski|esqui|snowboard|nieve|cerro catedral|chapelco|las le[nñ]as|caviahue)\b/;

var FACTS = {
  hasFlight:        { label:"hay vuelos cargados",        test:function (c) { return c.items.some(function (i) { return i.type === "flight"; }); } },
  hasRentalCar:     { label:"hay un auto alquilado",      test:function (c) { return c.items.some(function (i) { return i.type === "car"; }); } },
  hasStay:          { label:"hay alojamiento cargado",    test:function (c) { return c.items.some(function (i) { return i.type === "stay"; }); } },
  hasInternationalFlight: { label:"hay un vuelo internacional", test:function (c) { return c.international && c.items.some(function (i) { return i.type === "flight"; }); } },
  hasTrekking:      { label:"hay trekking o montaña",     test:function (c) { return TREK_RE.test(c.textBlob); } },
  hasWaterActivity: { label:"hay actividades de agua",    test:function (c) { return WATER_RE.test(c.textBlob); } },
  hasWorkActivity:  { label:"hay actividades de trabajo", test:function (c) { return WORK_RE.test(c.textBlob); } },
  hasSnow:          { label:"hay nieve o esquí",          test:function (c) { return SNOW_RE.test(c.textBlob); } }
};

/* ============================================================
   REGLAS BASE — CAPA 1
   Cada regla es una entrada de datos:
     id       identificador de la regla (trazabilidad)
     key      clave canónica del ítem (matchea con el historial)
     label    cómo se llama para el viajero
     category una de CATEGORIES
     when     condición declarativa, opcional (sin when = siempre)
     qty      número, o {perDay|everyDays, extra, min, max}, o nada
     reason   texto, o función (qty, ctx, calc) => texto

   Agregar una regla es agregar una entrada acá abajo.
   ============================================================ */

var BASE_RULES = [

  /* ---------- DOCUMENTACIÓN ---------- */
  { id:"doc.dni", label:"DNI", category:"documentacion",
    reason:"Siempre, aunque el viaje sea en auto y a cien kilómetros." },

  { id:"doc.pasaporte", label:"Pasaporte", category:"documentacion",
    when:{ international:true },
    reason:"Viaje internacional. Revisá que la vigencia cubra seis meses después de la vuelta." },

  { id:"doc.visa", label:"Visa o autorización electrónica", category:"documentacion",
    when:{ international:true },
    reason:"Fijate si tu pasaporte necesita visa o permiso electrónico para este destino." },

  { id:"doc.seguro", label:"Seguro de viaje", category:"documentacion",
    when:{ international:true },
    reason:"Varios países lo piden en migraciones y la atención médica afuera se paga en dólares." },

  { id:"doc.tarjetas", label:"Tarjetas de débito y crédito", category:"documentacion",
    reason:"Guardadas en dos lugares distintos, no las dos en la misma billetera." },

  { id:"doc.efectivo", label:"Efectivo en moneda local", category:"documentacion",
    when:{ international:true },
    reason:"Para el primer traslado y las propinas, antes de encontrar un cajero." },

  { id:"doc.reservas", label:"Copias de reservas y vouchers", category:"documentacion",
    reason:"Descargadas o impresas: siguen sirviendo con el celular sin batería." },

  { id:"doc.licencia", label:"Licencia de conducir", category:"documentacion",
    when:{ facts:["hasRentalCar"] },
    reason:"Tenés un auto alquilado en el viaje." },

  { id:"doc.licencia-internacional", label:"Licencia de conducir internacional", category:"documentacion",
    when:{ facts:["hasRentalCar"], international:true },
    reason:"Auto alquilado en el exterior: muchos países la piden junto con la nacional." },

  /* ---------- ROPA ---------- */
  { id:"ropa.remeras", label:"Remeras", category:"ropa",
    qty:{ perDay:1, extra:1, min:2, max:8 },
    reason:function (n, ctx, calc) {
      return calc.capped
        ? "Con " + dias(ctx.days) + " no tiene sentido una por día: " + n + " y lavás en el viaje."
        : dias(ctx.days) + " más una de repuesto.";
    } },

  { id:"ropa.ropa-interior", label:"Ropa interior", category:"ropa",
    qty:{ perDay:1, extra:1, min:2, max:10 },
    reason:function (n, ctx, calc) {
      return calc.capped
        ? n + " juegos: con " + dias(ctx.days) + " vas a lavar igual."
        : "Un juego por día más uno de repuesto.";
    } },

  { id:"ropa.medias", label:"Medias", category:"ropa",
    qty:{ perDay:1, extra:1, min:2, max:10 },
    reason:function (n, ctx, calc) {
      return calc.capped
        ? n + " pares: con " + dias(ctx.days) + " vas a lavar igual."
        : "Un par por día más uno de repuesto.";
    } },

  { id:"ropa.pantalones", label:"Pantalones", category:"ropa",
    qty:{ everyDays:3, min:1, max:4 },
    reason:function (n, ctx) { return "Uno cada tres días de viaje, sobre " + dias(ctx.days) + "."; } },

  { id:"ropa.buzo", label:"Buzo o abrigo liviano", category:"ropa",
    qty:{ everyDays:10, min:1, max:2 },
    reason:"Las noches bajan de temperatura en casi cualquier destino." },

  { id:"ropa.pijama", label:"Pijama", category:"ropa",
    qty:{ everyDays:7, min:1, max:2 },
    reason:function (n) { return n === 1 ? "Uno alcanza." : "Uno por semana de viaje."; } },

  { id:"ropa.bolsa-sucia", label:"Bolsa para la ropa sucia", category:"ropa",
    reason:"Separa lo usado de lo limpio y te ahorra clasificar al volver." },

  { id:"ropa.malla", label:"Malla", category:"ropa",
    when:{ any:[{ tripTypes:["playa"] }, { facts:["hasWaterActivity"] }] },
    qty:{ fixed:2 },
    reason:"Dos, para no ponerte una mojada al día siguiente." },

  { id:"ropa.toallon", label:"Toallón de playa", category:"ropa",
    when:{ tripTypes:["playa"] },
    reason:"El del alojamiento casi nunca se puede sacar a la playa." },

  { id:"ropa.termica", label:"Primera capa térmica", category:"ropa",
    when:{ any:[{ tripTypes:["montana"] }, { facts:["hasSnow"] }] },
    qty:{ everyDays:4, min:1, max:3 },
    reason:"En montaña se abriga por capas, no con una prenda gruesa." },

  { id:"ropa.impermeable", label:"Campera impermeable", category:"ropa",
    when:{ any:[{ tripTypes:["montana","aventura"] }, { facts:["hasTrekking"] }] },
    reason:"En montaña el clima cambia en una hora." },

  { id:"ropa.gorro-abrigo", label:"Gorro y guantes de abrigo", category:"ropa",
    when:{ any:[{ tripTypes:["montana"] }, { facts:["hasSnow"] }] },
    reason:"La cabeza y las manos son por donde más calor se pierde." },

  { id:"ropa.gorra", label:"Gorra o sombrero", category:"ropa",
    when:{ tripTypes:["playa","aventura","montana"] },
    reason:"Sol directo muchas horas seguidas." },

  { id:"ropa.formal", label:"Muda formal", category:"ropa",
    when:{ any:[{ tripTypes:["trabajo"] }, { facts:["hasWorkActivity"] }] },
    qty:{ everyDays:2, min:1, max:4 },
    reason:function (n, ctx) { return "Una cada dos días de trabajo, sobre " + dias(ctx.days) + "."; } },

  { id:"ropa.salida", label:"Una muda para salir de noche", category:"ropa",
    when:{ tripTypes:["ciudad","playa","mixto"] },
    reason:"Para la cena o la salida que no estaba planeada." },

  /* ---------- CALZADO ---------- */
  { id:"calzado.diario", label:"Zapatillas cómodas", category:"calzado",
    reason:"El par que ya tenés usado. Un viaje no es para estrenar calzado." },

  { id:"calzado.trekking", label:"Botas o zapatillas de trekking", category:"calzado",
    when:{ any:[{ tripTypes:["montana","aventura"] }, { facts:["hasTrekking"] }] },
    reason:"Hay caminatas en el viaje: suela con agarre y tobillo sostenido." },

  { id:"calzado.ojotas", label:"Ojotas", category:"calzado",
    when:{ any:[{ tripTypes:["playa"] }, { facts:["hasWaterActivity"] }] },
    reason:"Para la arena, la pileta y el baño compartido." },

  { id:"calzado.formal", label:"Zapatos de vestir", category:"calzado",
    when:{ any:[{ tripTypes:["trabajo"] }, { facts:["hasWorkActivity"] }] },
    reason:"Van con la muda formal." },

  { id:"calzado.salida", label:"Un par para salir", category:"calzado",
    when:{ tripTypes:["ciudad","mixto"] },
    reason:"Algo que no sean las zapatillas de caminar todo el día." },

  /* ---------- HIGIENE ---------- */
  { id:"higiene.neceser", label:"Neceser armado", category:"higiene",
    reason:"Todo junto en un solo lugar: es lo primero que se busca al llegar." },

  { id:"higiene.cepillo", label:"Cepillo y pasta de dientes", category:"higiene",
    reason:"Lo más olvidado de la lista." },

  { id:"higiene.desodorante", label:"Desodorante", category:"higiene",
    reason:"Uno por viaje, del tamaño chico." },

  { id:"higiene.shampoo", label:"Shampoo y jabón", category:"higiene",
    reason:"En envases chicos: casi todos los alojamientos tienen los suyos." },

  { id:"higiene.protector-solar", label:"Protector solar", category:"higiene",
    when:{ any:[{ tripTypes:["playa","montana","aventura"] }, { facts:["hasWaterActivity","hasSnow"] }] },
    reason:function (n, ctx) {
      if (ctx.tripType === "montana" || ctx.facts.hasSnow) return "En altura y con nieve el sol pega mucho más fuerte.";
      return "Muchas horas de sol directo, todos los días del viaje.";
    } },

  { id:"higiene.repelente", label:"Repelente de mosquitos", category:"higiene",
    when:{ any:[{ tripTypes:["playa","aventura"] }, { facts:["hasWaterActivity"] }] },
    reason:"Zonas cálidas y con agua cerca." },

  { id:"higiene.liquidos", label:"Líquidos en envases de hasta 100 ml", category:"higiene",
    when:{ facts:["hasFlight"] },
    reason:"Hay vuelo: si llevás equipaje de mano, ese es el límite por envase." },

  /* ---------- ELECTRÓNICA ---------- */
  { id:"elec.celular", label:"Celular y cargador", category:"electronica",
    reason:"Es el pasaje, el mapa y la cámara." },

  { id:"elec.powerbank", label:"Batería portátil", category:"electronica",
    reason:"En el equipaje de mano: no se puede despachar." },

  { id:"elec.adaptador", label:"Adaptador de enchufe", category:"electronica",
    when:{ international:true },
    reason:"Viaje internacional: el enchufe del destino puede no ser el de acá." },

  { id:"elec.auriculares", label:"Auriculares", category:"electronica",
    reason:"Para el vuelo, el colectivo y la espera." },

  { id:"elec.notebook", label:"Notebook y cargador", category:"electronica",
    when:{ any:[{ tripTypes:["trabajo"] }, { facts:["hasWorkActivity"] }] },
    reason:"Viaje de trabajo." },

  { id:"elec.camara", label:"Cámara y cargador", category:"electronica",
    when:{ tripTypes:["montana","aventura"] },
    reason:"Paisaje que el celular no rinde." },

  { id:"elec.linterna", label:"Linterna frontal", category:"electronica",
    when:{ any:[{ tripTypes:["montana","aventura"] }, { facts:["hasTrekking"] }] },
    reason:"Salidas temprano, refugios y cortes de luz." },

  /* ---------- SALUD ---------- */
  { id:"salud.medicacion", label:"Medicación personal", category:"salud",
    reason:"Con la receta y en el equipaje de mano, por si la valija se pierde." },

  { id:"salud.botiquin", label:"Botiquín básico", category:"salud",
    reason:"Analgésico, curitas, antiséptico y algo para el estómago. Ocupa poco y siempre se usa." },

  { id:"salud.mareo", label:"Pastillas para el mareo", category:"salud",
    when:{ tripTypes:["montana","aventura"] },
    reason:"Rutas de montaña y caminos de ripio." },

  { id:"salud.botella", label:"Botella reutilizable", category:"salud",
    reason:"Se llena después del control de seguridad y en el alojamiento." }
];

/* Completa key faltante y valida el catálogo una sola vez al cargar. */
function prepareRules(rules) {
  return rules.map(function (r) {
    var key = r.key || slug(r.label);
    return Object.assign({}, r, { key:key });
  });
}
BASE_RULES = prepareRules(BASE_RULES);

/**
 * Chequeo de integridad del catálogo de reglas. Lo corre la prueba.
 * @returns {string[]} lista de problemas. Vacía = catálogo sano.
 */
function validateRules(rules) {
  rules = rules || BASE_RULES;
  var problems = [], ids = {}, keys = {};
  rules.forEach(function (r) {
    if (!r.id) problems.push("regla sin id: " + JSON.stringify(r));
    if (ids[r.id]) problems.push("id repetido: " + r.id);
    ids[r.id] = true;
    if (keys[r.key]) problems.push("key repetida: " + r.key + " (" + r.id + ")");
    keys[r.key] = true;
    if (!r.label) problems.push("regla sin label: " + r.id);
    if (CATEGORY_ORDER[r.category] === undefined) problems.push("categoría desconocida en " + r.id + ": " + r.category);
    if (!r.reason) problems.push("regla sin razón: " + r.id);
  });
  return problems;
}

/* ============================================================
   EVALUADOR DE CONDICIONES Y CANTIDADES
   ============================================================ */

/**
 * Evalúa una condición declarativa contra el contexto del viaje.
 * Operadores: international, tripTypes, notTripTypes, minDays, maxDays,
 * facts (todos), anyFacts (alguno), notFacts (ninguno), all, any, not, test.
 * @param {Object|Function|null} cond
 * @param {Object} ctx
 * @returns {boolean}
 */
function matchesCondition(cond, ctx) {
  if (cond == null) return true;
  if (typeof cond === "function") return !!cond(ctx);
  if (Array.isArray(cond)) return cond.every(function (c) { return matchesCondition(c, ctx); });

  if (cond.international !== undefined && ctx.international !== cond.international) return false;
  if (cond.tripTypes && cond.tripTypes.indexOf(ctx.tripType) < 0) return false;
  if (cond.notTripTypes && cond.notTripTypes.indexOf(ctx.tripType) >= 0) return false;
  if (cond.minDays !== undefined && !(ctx.days >= cond.minDays)) return false;
  if (cond.maxDays !== undefined && !(ctx.days <= cond.maxDays)) return false;
  if (cond.facts && !cond.facts.every(function (f) { return !!ctx.facts[f]; })) return false;
  if (cond.anyFacts && !cond.anyFacts.some(function (f) { return !!ctx.facts[f]; })) return false;
  if (cond.notFacts && !cond.notFacts.every(function (f) { return !ctx.facts[f]; })) return false;
  if (cond.all && !cond.all.every(function (c) { return matchesCondition(c, ctx); })) return false;
  if (cond.any && !cond.any.some(function (c) { return matchesCondition(c, ctx); })) return false;
  if (cond.not && matchesCondition(cond.not, ctx)) return false;
  if (cond.test && !cond.test(ctx)) return false;
  return true;
}

/**
 * Resuelve la cantidad de un ítem a partir de la duración del viaje.
 * @param {number|Object|undefined} spec {fixed} | {perDay|everyDays, extra, min, max}
 * @param {Object} ctx
 * @returns {{qty:number|null, raw:number|null, capped:boolean}}
 */
function computeQty(spec, ctx) {
  if (spec == null) return { qty:null, raw:null, capped:false };
  if (typeof spec === "number") return { qty:spec, raw:spec, capped:false };
  if (spec.fixed != null) return { qty:spec.fixed, raw:spec.fixed, capped:false };

  var base = 0;
  if (spec.perDay != null) base = ctx.days * spec.perDay;
  else if (spec.everyDays) base = ctx.days / spec.everyDays;
  var raw = Math.ceil(base) + (spec.extra || 0);
  var qty = clamp(raw, spec.min, spec.max);
  return { qty:qty, raw:raw, capped:qty !== raw };
}

function resolveReason(reason, qty, ctx, calc) {
  if (typeof reason === "function") return String(reason(qty, ctx, calc) || "");
  return String(reason || "");
}

/* ============================================================
   CONTEXTO DEL VIAJE
   ============================================================ */

/**
 * Arma el contexto sobre el que se evalúan todas las reglas.
 * @param {Object} trip   viaje {id,name,destination,startDate,endDate,notes,international?}
 * @param {Array}  items  reservas del viaje
 * @param {Object} [opts] {tripType} para forzar el tipo elegido por la persona
 * @returns {Object} contexto, con basis listo para guardar
 */
function tripContext(trip, items, opts) {
  trip = trip || {}; items = (items || []).filter(Boolean); opts = opts || {};

  var textBlob = norm([
    trip.name, trip.destination, trip.notes,
    items.map(function (i) { return [i.title, i.notes, i.provider].filter(Boolean).join(" "); }).join(" ")
  ].filter(Boolean).join(" "));

  var intl = deduceInternational(trip, items);
  var realDays = daysBetweenInclusive(trip.startDate, trip.endDate);
  var daysKnown = realDays != null;
  var days = daysKnown ? realDays : DEFAULT_DAYS;

  var ctx = {
    trip:trip, items:items, textBlob:textBlob,
    destination:String(trip.destination || "").trim(),
    startDate:trip.startDate || "", endDate:trip.endDate || "",
    days:days, nights:Math.max(0, days - 1), daysKnown:daysKnown,
    international:intl.value, internationalKnown:intl.known,
    internationalSource:intl.source, internationalDetail:intl.detail,
    facts:{}, tripType:null, tripTypeSource:"sugerido", tripTypeReason:""
  };

  Object.keys(FACTS).forEach(function (name) {
    try { ctx.facts[name] = !!FACTS[name].test(ctx); } catch (e) { ctx.facts[name] = false; }
  });

  var chosen = normalizeTripType(opts.tripType);
  if (chosen) {
    ctx.tripType = chosen; ctx.tripTypeSource = "elegido"; ctx.tripTypeReason = "Lo elegiste al generar la lista.";
  } else {
    var s = suggestTripType(trip, items, ctx);
    ctx.tripType = s.type; ctx.tripTypeSource = "sugerido"; ctx.tripTypeReason = s.reason; ctx.tripTypeConfidence = s.confidence;
  }
  return ctx;
}

/* ============================================================
   TIPO DE VIAJE SUGERIDO
   VAL-30: el tipo se propone según el destino y la duración.
   ============================================================ */

var TYPE_HINTS = [
  { type:"playa",    words:["playa","caribe","cancun","punta del este","copacabana","florianopolis","buzios","riviera","maldivas","bali","ibiza","mar del plata","pinamar","carilo","varadero","punta cana","camboriu","costa","isla","snorkel","balneario","aruba","curazao"] },
  { type:"montana",  words:["bariloche","ushuaia","cerro","aspen","andes","alpes","chapelco","angostura","chalten","calafate","nepal","cusco","montana","valle nevado","portillo","las lenas","ski","esqui","nieve","refugio","glaciar","el bolson","pucon"] },
  { type:"ciudad",   words:["madrid","paris","nueva york","new york","londres","roma","tokio","berlin","barcelona","santiago","montevideo","lisboa","amsterdam","milan","praga","budapest","ciudad","museo","teatro","capital"] },
  { type:"trabajo",  words:["congreso","conferencia","reunion","cliente","capacitacion","workshop","feria","summit","oficina","trabajo","laboral","entrevista"] },
  { type:"aventura", words:["trekking","senderismo","kayak","escalada","safari","camping","mochilero","rafting","selva","desierto","aventura","expedicion"] }
];

/**
 * Propone un tipo de viaje mirando el destino, las reservas y la duración.
 * @param {Object} trip
 * @param {Array} items
 * @param {Object} [ctx] contexto ya armado, para no recalcularlo
 * @returns {{type:string, confidence:"alta"|"media"|"baja", reason:string}}
 */
function suggestTripType(trip, items, ctx) {
  trip = trip || {}; items = items || [];
  var blob = ctx ? ctx.textBlob : norm([
    trip.name, trip.destination, trip.notes,
    items.map(function (i) { return [i.title, i.notes].filter(Boolean).join(" "); }).join(" ")
  ].filter(Boolean).join(" "));

  var days = ctx ? ctx.days : (daysBetweenInclusive(trip.startDate, trip.endDate) || DEFAULT_DAYS);
  var daysKnown = ctx ? ctx.daysKnown : daysBetweenInclusive(trip.startDate, trip.endDate) != null;

  var scores = {}, hits = {};
  TYPE_HINTS.forEach(function (h) {
    var found = h.words.filter(function (w) { return blob.indexOf(w) >= 0; });
    if (found.length) { scores[h.type] = found.length; hits[h.type] = found; }
  });

  var ranked = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });

  if (ranked.length) {
    var top = ranked[0];
    // dos familias fuertes a la vez: es un viaje mixto
    if (ranked.length > 1 && scores[ranked[1]] === scores[top]) {
      return { type:"mixto", confidence:"media",
               reason:"El viaje mezcla " + TRIP_TYPE_LABEL[top].toLowerCase() + " y " + TRIP_TYPE_LABEL[ranked[1]].toLowerCase() + "." };
    }
    return { type:top, confidence:scores[top] >= 2 ? "alta" : "media",
             reason:"Por \"" + hits[top][0] + "\" en el viaje." };
  }
  if (!daysKnown) return { type:"mixto", confidence:"baja", reason:"Sin fechas ni pistas del destino, armo una lista mixta." };
  if (days <= 4) return { type:"ciudad", confidence:"baja", reason:"Viaje corto de " + dias(days) + ", sin otras pistas." };
  return { type:"mixto", confidence:"baja", reason:"Viaje de " + dias(days) + " sin pistas del destino." };
}

/* ============================================================
   CAPA 3 · APRENDIZAJE DEL HISTORIAL  (VAL-32)
   ============================================================ */

function bump(map, key, item) {
  var e = map.get(key);
  if (!e) { e = { key:key, label:item.label || key, category:item.category || "otros", count:0 }; map.set(key, e); }
  e.count++;
  if (item.label) e.label = item.label;                       // el rótulo más reciente gana
  if (item.category) e.category = item.category;
  return e;
}

/**
 * Mira las listas de viajes anteriores del mismo tipo y decide qué promover
 * y qué suprimir. Un ítem cuenta una sola vez por viaje.
 *
 * Precedencia: si un ítem fue agregado a mano dos veces Y descartado dos veces,
 * gana la promoción. Agregarlo a mano es una acción más costosa que descartarlo,
 * así que es la señal más fuerte.
 *
 * @param {Array<Object>} history listas guardadas de viajes anteriores
 * @param {string} tripType tipo del viaje que se está armando
 * @returns {{tripType:string, sampleSize:number, promote:Array, suppress:Array}}
 */
function learnFromHistory(history, tripType) {
  var added = new Map(), dismissed = new Map(), sample = 0;

  (history || []).forEach(function (list) {
    if (!list || !Array.isArray(list.items)) return;
    if (normalizeTripType(list.tripType) !== normalizeTripType(tripType)) return;
    sample++;
    var seenAdd = {}, seenDis = {};
    list.items.forEach(function (it) {
      if (!it) return;
      var key = it.key || slug(it.label);
      if (!key) return;
      var isManual = it.manual === true || it.source === SOURCE.MANUAL;
      if (isManual && !seenAdd[key]) { seenAdd[key] = true; bump(added, key, it); }
      if (it.dismissed === true && !seenDis[key]) { seenDis[key] = true; bump(dismissed, key, it); }
    });
  });

  var promote = [];
  added.forEach(function (e) { if (e.count >= HISTORY_PROMOTE_AT) promote.push(e); });
  var promoteKeys = promote.reduce(function (m, e) { m[e.key] = true; return m; }, {});

  var suppress = [];
  dismissed.forEach(function (e) {
    if (e.count >= HISTORY_SUPPRESS_AT && !promoteKeys[e.key]) suppress.push(e);
  });

  var byCount = function (a, b) { return b.count - a.count || a.key.localeCompare(b.key); };
  return { tripType:normalizeTripType(tripType), sampleSize:sample,
           promote:promote.sort(byCount), suppress:suppress.sort(byCount) };
}

/* ============================================================
   ARMADO DE LA LISTA  (CAPA 1 + CAPA 3)
   ============================================================ */

function makeItem(fields, at) {
  return {
    id:fields.key, key:fields.key, label:fields.label, category:fields.category || "otros",
    qty:fields.qty == null ? null : fields.qty, reason:fields.reason || "",
    source:fields.source || SOURCE.RULE, ruleId:fields.ruleId || "",
    packed:false, dismissed:false, manual:!!fields.manual, qtyEdited:false, note:"",
    addedAt:at, updatedAt:at
  };
}

function sortItems(items) {
  return items.slice().sort(function (a, b) {
    var ca = CATEGORY_ORDER[a.category], cb = CATEGORY_ORDER[b.category];
    if (ca === undefined) ca = 99;
    if (cb === undefined) cb = 99;
    if (ca !== cb) return ca - cb;
    var sa = a.sortIndex == null ? 999 : a.sortIndex, sb = b.sortIndex == null ? 999 : b.sortIndex;
    if (sa !== sb) return sa - sb;
    return String(a.label).localeCompare(String(b.label), "es");
  });
}

/**
 * Contador de empacado. Los descartados no cuentan para el total.
 * @param {Object} list
 * @returns {{total:number, packed:number, pending:number, dismissed:number, pct:number}}
 */
function packingProgress(list) {
  var items = (list && list.items) || [];
  var live = items.filter(function (i) { return !i.dismissed; });
  var packed = live.filter(function (i) { return i.packed; }).length;
  return {
    total:live.length, packed:packed, pending:live.length - packed,
    dismissed:items.length - live.length,
    pct:live.length ? Math.round(packed / live.length * 100) : 0
  };
}

/**
 * CAPA 1 + CAPA 3. Genera la lista base, sin IA y sin red.
 *
 * @param {Object}  input
 * @param {Object}  input.trip      viaje
 * @param {Array}   [input.items]   reservas del viaje
 * @param {string}  [input.tripType] tipo elegido por la persona; si falta se sugiere
 * @param {Array}   [input.history] listas guardadas de viajes anteriores
 * @param {Object}  [input.previous] lista ya guardada de este viaje, para regenerar sin perder lo marcado
 * @param {string}  [input.now]     timestamp ISO, para pruebas determinísticas
 * @returns {Object} documento de lista, listo para guardar
 */
function buildPackingList(input) {
  input = input || {};
  var at = input.now || nowISO();
  var trip = input.trip || {};
  var items = input.items || [];
  var ctx = tripContext(trip, items, { tripType:input.tripType });
  var learned = learnFromHistory(input.history, ctx.tripType);

  var suppressed = learned.suppress.reduce(function (m, e) { m[e.key] = e; return m; }, {});
  var out = [], seen = {}, index = 0;

  BASE_RULES.forEach(function (rule) {
    index++;
    if (!matchesCondition(rule.when, ctx)) return;
    if (suppressed[rule.key]) return;                       // VAL-32: descartado dos veces
    var calc = computeQty(rule.qty, ctx);
    var it = makeItem({
      key:rule.key, label:rule.label, category:rule.category,
      qty:calc.qty, reason:resolveReason(rule.reason, calc.qty, ctx, calc),
      source:SOURCE.RULE, ruleId:rule.id
    }, at);
    it.sortIndex = index;
    out.push(it); seen[rule.key] = true;
  });

  learned.promote.forEach(function (e) {
    if (seen[e.key]) return;                                // ya lo pone una regla base
    var it = makeItem({
      key:e.key, label:e.label, category:e.category || "otros", qty:null,
      reason:"Lo agregaste a mano en " + e.count + " viajes de " + (TRIP_TYPE_LABEL[ctx.tripType] || ctx.tripType).toLowerCase() + ".",
      source:SOURCE.HISTORY, ruleId:"historial"
    }, at);
    it.sortIndex = 900;
    out.push(it); seen[e.key] = true;
  });

  var warnings = [];
  if (!ctx.daysKnown) warnings.push({ code:"sin-fechas",
    text:"El viaje no tiene fechas: calculé las cantidades sobre " + dias(DEFAULT_DAYS) + ". Cargá salida y regreso para ajustarlas." });
  if (!ctx.internationalKnown) warnings.push({ code:"destino-desconocido",
    text:"No pude deducir si el viaje es internacional. Cargá los vuelos o el destino para que aparezca la documentación que corresponde." });

  var fresh = {
    schemaVersion:SCHEMA_VERSION,
    tripId:trip.id || "",
    tripType:ctx.tripType,
    createdAt:at, generatedAt:at, updatedAt:at,
    basis:{
      destination:ctx.destination, startDate:ctx.startDate, endDate:ctx.endDate,
      days:ctx.days, nights:ctx.nights, daysKnown:ctx.daysKnown,
      international:ctx.international, internationalKnown:ctx.internationalKnown,
      internationalSource:ctx.internationalSource, internationalDetail:ctx.internationalDetail,
      tripTypeSource:ctx.tripTypeSource, tripTypeReason:ctx.tripTypeReason,
      facts:ctx.facts
    },
    ai:{ status:"sin-ajuste", at:null, note:"Lista base, sin ajuste por destino." },
    learning:{ sampleSize:learned.sampleSize, promoted:learned.promote, suppressed:learned.suppress },
    warnings:warnings,
    items:sortItems(out),
    stats:null
  };
  fresh.stats = packingProgress(fresh);

  return input.previous ? mergeLists(input.previous, fresh) : fresh;
}

/**
 * VAL-30: generar dos veces no duplica ni pierde nada.
 * Conserva de la lista anterior: empacado, descartado, notas, cantidad corregida
 * a mano, ítems propios, y los ítems ya empacados que una regla dejó de sugerir.
 *
 * @param {Object} previous lista guardada
 * @param {Object} fresh    lista recién generada
 * @returns {Object} lista fusionada
 */
function mergeLists(previous, fresh) {
  if (!previous || !Array.isArray(previous.items)) return fresh;

  var prev = new Map();
  previous.items.forEach(function (i) { if (i && i.key) prev.set(i.key, i); });

  var used = {}, merged = [];

  fresh.items.forEach(function (f) {
    var p = prev.get(f.key);
    if (!p) { merged.push(f); return; }
    used[f.key] = true;
    merged.push(Object.assign({}, f, {
      packed:!!p.packed,
      dismissed:!!p.dismissed,
      note:p.note || "",
      qty:p.qtyEdited ? p.qty : f.qty,
      qtyEdited:!!p.qtyEdited,
      reason:p.qtyEdited ? (p.reason || f.reason) : f.reason,
      manual:!!p.manual,
      source:p.manual ? SOURCE.MANUAL : f.source,
      addedAt:p.addedAt || f.addedAt,
      updatedAt:fresh.generatedAt
    }));
  });

  previous.items.forEach(function (p) {
    if (used[p.key]) return;
    // los ítems propios nunca se pierden; los ya empacados tampoco, aunque la regla ya no aplique
    if (p.manual || p.packed) {
      merged.push(Object.assign({}, p, { retained:!p.manual || undefined, sortIndex:p.sortIndex == null ? 950 : p.sortIndex }));
    }
  });

  var out = Object.assign({}, fresh, {
    createdAt:previous.createdAt || fresh.createdAt,
    items:sortItems(merged)
  });
  out.stats = packingProgress(out);
  return out;
}

/* ============================================================
   CAPA 2 · AJUSTE POR DESTINO CON IA  (VAL-33)
   El módulo no llama a claude.use. Recibe una función asíncrona
   `ask(prompt) -> objeto` y la app le pasa la implementación
   (en la app: sample.json). Así se prueba con node.
   ============================================================ */

/**
 * Arma el prompt de la capa de destino.
 * Lleva instrucción explícita de no inventar: antes una lista corta que un dato falso.
 * @param {Object} list lista base ya generada
 * @returns {string}
 */
function destinationPrompt(list) {
  var b = (list && list.basis) || {};
  var yaHay = (list.items || []).map(function (i) { return i.label; }).join(", ");
  var tipo = TRIP_TYPE_LABEL[list.tripType] || list.tripType || "mixto";

  return [
    "Sos parte de una app de viajes y ajustás una lista de equipaje al destino. Devolvés SOLO JSON.",
    "",
    "Viaje:",
    "- Destino: " + (b.destination || "sin especificar"),
    "- Fechas: " + (b.startDate ? b.startDate + " a " + (b.endDate || "sin regreso") : "sin fechas cargadas"),
    "- Duración: " + b.days + " días" + (b.daysKnown ? "" : " (estimados, el viaje no tiene fechas)"),
    "- Tipo de viaje: " + tipo,
    "- " + (b.international ? "Es un viaje internacional." : "Es un viaje dentro del país."),
    "",
    "La lista base ya incluye: " + (yaHay || "nada"),
    "",
    "Agregá hasta " + MAX_AI_ITEMS + " ítems que sean específicos de ESE destino en ESA época del año y que",
    "no estén ya en la lista base. Por ejemplo el tipo de enchufe del país, la amplitud térmica de la zona",
    "en ese mes, la temporada de lluvias, la altura, o un requisito de ingreso conocido.",
    "",
    "Devolvé este JSON exacto:",
    '{"items":[{"label":"nombre corto del ítem","category":"documentacion|ropa|calzado|higiene|electronica|salud|destino","qty":numero o null,"reason":"por qué, en una frase, mencionando el dato del destino"}],"clima":"una frase sobre el clima esperado, o vacío"}',
    "",
    "Reglas que no se rompen:",
    "1. Si no estás seguro de un dato del destino, NO lo incluyas. Es preferible una lista más corta que un dato inventado.",
    "2. Nunca inventes tipos de enchufe, temperaturas, requisitos de visa, nombres de lugares ni precios. Si no lo sabés con certeza, omitilo.",
    '3. Si no tenés nada seguro para agregar, devolvé {"items":[],"clima":""}.',
    "4. Cada ítem lleva su razón. Un ítem sin razón no sirve: no lo incluyas.",
    "5. Nada de marcas, links ni recomendaciones de compra.",
    "6. Escribí en español rioplatense, de vos, en frases cortas."
  ].join("\n");
}

/**
 * Valida y normaliza lo que devolvió la IA. Descarta todo lo que no cumple.
 * @param {Object|string} raw respuesta cruda
 * @param {Object} list lista base, para no duplicar
 * @returns {{items:Array, clima:string}}
 */
function parseDestinationItems(raw, list) {
  var data = raw;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = null; } }
  if (!data || !Array.isArray(data.items)) return { items:[], clima:"" };

  var have = {};
  (list && list.items || []).forEach(function (i) { have[i.key] = true; });
  var suppressed = {};
  ((list && list.learning && list.learning.suppressed) || []).forEach(function (e) { suppressed[e.key] = true; });

  var out = [];
  data.items.forEach(function (x) {
    if (out.length >= MAX_AI_ITEMS) return;
    if (!x || typeof x !== "object") return;
    var label = String(x.label || "").trim();
    var reason = String(x.reason || "").trim();
    if (!label || !reason) return;                 // sin razón no entra: VAL-33 lo exige
    var key = slug(label);
    if (!key || have[key] || suppressed[key]) return;
    var category = CATEGORY_ORDER[x.category] !== undefined ? x.category : "destino";
    var qty = (typeof x.qty === "number" && isFinite(x.qty) && x.qty > 0) ? Math.round(x.qty) : null;
    have[key] = true;
    out.push({ key:key, label:label, category:category, qty:qty, reason:reason });
  });

  return { items:out, clima:typeof data.clima === "string" ? data.clima.trim() : "" };
}

/**
 * CAPA 2. Nunca lanza: si la IA falla, devuelve la lista base con el aviso puesto.
 * @param {Object} list lista base
 * @param {Function} ask función asíncrona (prompt) => objeto o string JSON
 * @param {Object} [opts] {now}
 * @returns {Promise<Object>} lista, ajustada o no
 */
function enrichWithDestination(list, ask, opts) {
  opts = opts || {};
  var at = opts.now || nowISO();

  function withAi(status, note, extra) {
    var warnings = (list.warnings || []).filter(function (w) { return w.code !== "ia-no-disponible" && w.code !== "ia-fallo"; });
    if (status === "no-disponible") warnings = warnings.concat([{ code:"ia-no-disponible",
      text:"Falta el ajuste por destino: la lista es la base de reglas. Igual sirve." }]);
    if (status === "error") warnings = warnings.concat([{ code:"ia-fallo",
      text:"No pude ajustar la lista al destino. Te muestro la lista base, que ya cubre lo esencial." }]);
    return Object.assign({}, list, extra || {}, {
      ai:{ status:status, at:at, note:note || "" },
      warnings:warnings
    });
  }

  if (typeof ask !== "function") {
    return Promise.resolve(withAi("no-disponible", "La app no pasó una función para consultar al modelo."));
  }

  return Promise.resolve()
    .then(function () { return ask(destinationPrompt(list), { list:list, basis:list.basis }); })
    .then(function (raw) {
      var parsed = parseDestinationItems(raw, list);
      if (!parsed.items.length) {
        return withAi("vacio", "El modelo no agregó nada específico del destino.",
                      parsed.clima ? { clima:parsed.clima } : null);
      }
      var added = parsed.items.map(function (x, i) {
        var it = makeItem({ key:x.key, label:x.label, category:x.category, qty:x.qty,
                            reason:x.reason, source:SOURCE.DESTINATION, ruleId:"destino" }, at);
        it.sortIndex = 800 + i;
        return it;
      });
      var out = withAi("ok", "Ajustada al destino: " + added.length + (added.length === 1 ? " ítem agregado." : " ítems agregados."),
                       { items:sortItems((list.items || []).concat(added)), clima:parsed.clima || list.clima || "" });
      out.stats = packingProgress(out);
      return out;
    })
    .catch(function (e) {
      return withAi("error", (e && e.message) ? String(e.message) : "Error desconocido.");
    });
}

/* ============================================================
   ENTRADA PRINCIPAL — las tres capas
   ============================================================ */

/**
 * Genera la lista completa. Nunca lanza por culpa de la IA.
 *
 * @param {Object}   input
 * @param {Object}   input.trip       viaje
 * @param {Array}    [input.items]    reservas del viaje
 * @param {string}   [input.tripType] tipo elegido; si falta se sugiere
 * @param {Array}    [input.history]  listas de viajes anteriores
 * @param {Object}   [input.previous] lista guardada de este viaje (regeneración)
 * @param {Function} [input.ask]      async (prompt) => objeto; en la app, sample.json
 * @param {string}   [input.now]      timestamp ISO fijo, para pruebas
 * @returns {Promise<Object>} documento de lista listo para guardar
 */
function generatePackingList(input) {
  input = input || {};
  var base = buildPackingList(Object.assign({}, input, { previous:null }));
  if (typeof input.ask !== "function") {
    var solo = input.previous ? mergeLists(input.previous, base) : base;
    return Promise.resolve(solo);
  }
  return enrichWithDestination(base, input.ask, { now:input.now }).then(function (enriched) {
    return input.previous ? mergeLists(input.previous, enriched) : enriched;
  });
}

/* ============================================================
   TRANSICIONES DE ESTADO — VAL-31
   Puras: devuelven una lista nueva, no tocan la que reciben.
   ============================================================ */

function replaceItem(list, key, fn) {
  var found = false;
  var items = (list.items || []).map(function (i) {
    if (i.key !== key) return i;
    found = true;
    return fn(i);
  });
  if (!found) return list;
  var out = Object.assign({}, list, { items:items, updatedAt:nowISO() });
  out.stats = packingProgress(out);
  return out;
}

/** Marca o desmarca un ítem como empacado. */
function setPacked(list, key, packed) {
  return replaceItem(list, key, function (i) {
    return Object.assign({}, i, { packed:!!packed, updatedAt:nowISO() });
  });
}

/** Descarta o recupera un ítem sugerido. Descartar no es empacar: es la señal que alimenta VAL-32. */
function setDismissed(list, key, dismissed) {
  return replaceItem(list, key, function (i) {
    return Object.assign({}, i, { dismissed:!!dismissed, packed:dismissed ? false : i.packed, updatedAt:nowISO() });
  });
}

/** Corrige la cantidad a mano. Queda marcada para que regenerar no la pise. */
function setQty(list, key, qty) {
  return replaceItem(list, key, function (i) {
    return Object.assign({}, i, { qty:qty, qtyEdited:true, reason:"Lo ajustaste vos.", updatedAt:nowISO() });
  });
}

/**
 * Agrega un ítem propio. Es lo que después aprende el historial.
 * @returns {Object} lista nueva. Si el ítem ya existía, lo recupera en vez de duplicarlo.
 */
function addManualItem(list, fields) {
  fields = fields || {};
  var label = String(fields.label || "").trim();
  if (!label) return list;
  var key = slug(label);
  var exists = (list.items || []).some(function (i) { return i.key === key; });
  if (exists) return setDismissed(list, key, false);

  var it = makeItem({
    key:key, label:label,
    category:CATEGORY_ORDER[fields.category] !== undefined ? fields.category : "otros",
    qty:typeof fields.qty === "number" ? fields.qty : null,
    reason:fields.reason || "Lo agregaste vos.",
    source:SOURCE.MANUAL, ruleId:"", manual:true
  }, nowISO());
  it.sortIndex = 940;
  var out = Object.assign({}, list, { items:sortItems((list.items || []).concat([it])), updatedAt:it.addedAt });
  out.stats = packingProgress(out);
  return out;
}

/** Borra un ítem. Sólo los propios: los sugeridos se descartan, no se borran. */
function removeManualItem(list, key) {
  var items = (list.items || []).filter(function (i) { return !(i.key === key && i.manual); });
  if (items.length === (list.items || []).length) return list;
  var out = Object.assign({}, list, { items:items, updatedAt:nowISO() });
  out.stats = packingProgress(out);
  return out;
}

/**
 * Agrupa para mostrar. Devuelve sólo las categorías con ítems.
 * @returns {Array<{key:string,label:string,items:Array}>}
 */
function groupByCategory(list, opts) {
  opts = opts || {};
  var items = (list && list.items) || [];
  return CATEGORIES.map(function (c) {
    var inCat = items.filter(function (i) {
      return i.category === c.key && (opts.includeDismissed ? true : !i.dismissed);
    });
    return { key:c.key, label:c.label, items:inCat };
  }).filter(function (g) { return g.items.length; });
}

/* ============================================================
   EXPORTA
   ============================================================ */
return {
  // catálogos y constantes
  SCHEMA_VERSION:SCHEMA_VERSION, DEFAULT_DAYS:DEFAULT_DAYS, SOURCE:SOURCE,
  HISTORY_PROMOTE_AT:HISTORY_PROMOTE_AT, HISTORY_SUPPRESS_AT:HISTORY_SUPPRESS_AT,
  MAX_AI_ITEMS:MAX_AI_ITEMS,
  CATEGORIES:CATEGORIES, TRIP_TYPES:TRIP_TYPES, BASE_RULES:BASE_RULES, FACTS:FACTS,
  AR_IATA:AR_IATA, AR_HINTS:AR_HINTS, FOREIGN_HINTS:FOREIGN_HINTS, TYPE_HINTS:TYPE_HINTS,

  // motor
  generatePackingList:generatePackingList,
  buildPackingList:buildPackingList,
  enrichWithDestination:enrichWithDestination,
  mergeLists:mergeLists,
  learnFromHistory:learnFromHistory,
  suggestTripType:suggestTripType,
  tripContext:tripContext,
  deduceInternational:deduceInternational,

  // capa de IA, expuesta para poder probarla suelta
  destinationPrompt:destinationPrompt,
  parseDestinationItems:parseDestinationItems,

  // estado de la lista (VAL-31)
  setPacked:setPacked, setDismissed:setDismissed, setQty:setQty,
  addManualItem:addManualItem, removeManualItem:removeManualItem,
  packingProgress:packingProgress, groupByCategory:groupByCategory,

  // utilidades y control de calidad
  slug:slug, normalizeTripType:normalizeTripType, daysBetweenInclusive:daysBetweenInclusive,
  matchesCondition:matchesCondition, computeQty:computeQty, validateRules:validateRules
};
});
