/* ============================================================
   VALIJA · MOTOR DE SUGERENCIA DE EQUIPAJE
   Épica VAL-30..VAL-33 (iteración 1) y VAL-43..VAL-46 (iteración 2,
   bloque B: "la valija razona sobre el viaje"). JavaScript puro:
   no toca el DOM, no pide red, no depende de nada. Recibe datos y
   devuelve datos.

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
       Desde VAL-44 también VE las reservas del viaje (resumidas y
       sin datos sensibles, ver `summarizeReservationsForAI`) y
       las notas del viaje (`base.notasViaje`, saneadas con
       `sanitizeNotesForAI` igual que las notas de una reserva) y
       puede razonar sobre combinaciones puntuales: una escala
       larga, un check-in de madrugada, un alojamiento sin
       lavandería en un viaje largo, una actividad con equipo
       propio. Desde VAL-43 también puede proponer SACAR ítems que
       no apliquen a ese destino puntual (VAL-43), con un piso que
       el código hace cumplir: un ítem marcado `critico:true` en
       BASE_RULES (la documentación de identidad) no se saca nunca
       por esta vía, aunque el modelo lo sugiera.

     CAPA 3 · aprendizaje del historial      (learnFromHistory)
       VAL-32. Un ítem agregado a mano en dos viajes del mismo tipo
       pasa a sugerirse. Un ítem descartado dos veces en el mismo
       tipo deja de sugerirse.

   Ningún ítem se repite entre capas (VAL-45): la comparación es por
   clave normalizada Y por sinónimo declarado (`SYNONYM_GROUPS`,
   `canonicalKey`). Cuando dos capas proponen lo mismo, se acredita
   siempre a la de menor precedencia: regla < historial < destino <
   manual (`ORIGEN_PRECEDENCIA`). `verifyNoDuplicateItems(list)` es
   la verificación exportada que confirma que una lista no tiene dos
   ítems que signifiquen lo mismo.

   La lista se actualiza cuando el viaje crece (VAL-46,
   `planListUpdate` / `planListUpdateAsync`): dada una lista ya
   generada y las reservas actuales, dicen si quedó desactualizada
   y qué ítems nuevos corresponden, cada uno con la reserva que lo
   motivó. Lo empacado sigue empacado, lo descartado nunca vuelve, y
   los ítems nuevos quedan marcados `nuevo:true` para que la interfaz
   los distinga (se limpia con `clearNewFlags`). Nunca se aplica
   sola: se ofrece, y quien integra decide cuándo mostrarla.

   ============================================================
   MODELO DE DATOS DE UNA LISTA GUARDADA
   ============================================================

   UN DOCUMENTO POR VIAJE:

       trips/{tripId}/packing/lista

   Cuelga del viaje, igual que `trips/{tripId}/items/{itemId}`, así
   hereda sus permisos y VAL-34 (compartir con quien viaja conmigo)
   sale sin trabajo extra.

   Un solo documento y no uno por ítem: una lista tiene entre 30 y 50
   ítems, diez viajes serían 500 documentos sólo de equipaje, y el tope
   de la base es 5000 documentos compartidos con las reservas.

   LOS ÍTEMS VAN EN UN OBJETO INDEXADO POR CLAVE, NO EN UN ARRAY.
   La base hace merge recursivo de objetos anidados en una escritura
   parcial, pero reemplaza los arrays enteros. Con un objeto, marcar un
   ítem escribe sólo ese ítem y dos personas marcando cosas distintas al
   mismo tiempo no se pisan. Con un array, el último en escribir borra
   el trabajo del otro.

   {
     version:      2,
     tripId:       "abc123",
     tipoViaje:    "playa",                 // playa|ciudad|montana|trabajo|aventura|mixto
     creadaEn:     "2026-09-05T12:00:00.000Z",
     generadaEn:   "2026-09-05T12:00:00.000Z",
     actualizadaEn:"2026-09-05T12:00:00.000Z",

     base: {                                // sobre qué se calculó, para poder explicarlo
       destino:"Florianópolis", desde:"2026-01-10", hasta:"2026-01-17",
       dias:8, noches:7, diasConocidos:true,
       internacional:true, internacionalConocido:true,
       internacionalFuente:"vuelos",        // vuelos|destino|explicito|desconocido
       internacionalDetalle:"Vuelo con código FLN, fuera del país.",
       tipoViajeFuente:"sugerido",          // elegido|sugerido
       tipoViajeMotivo:"Por \"florianopolis\" en el viaje.",
       hechos:{ hasFlight:true, hasRentalCar:false, ... },
       reservas:[ ... ],                    // VAL-44: resumen seguro de las reservas
       notasViaje:"Vamos a bucear dos días" // VAL-44: notas del viaje, saneadas
     },

     capaInteligente:{ estado:"ok", en:"...", nota:"", clima:"" },
                                            // ok|sin-ajuste|no-disponible|vacio|error
     aprendizaje:{ muestra:3, promovidos:[{clave,nombre,veces}], suprimidos:[...] },
     avisos:[{ codigo:"sin-fechas", texto:"..." }],
     conteo:{ total:34, empacados:0, descartados:0, pendientes:34, resueltos:0, pct:0 },
                                            // pct = (empacados+descartados)/total: descartar
                                            // también es progreso. Ver packingProgress().

     items:{
       "remera": {
         clave:      "remera",       // clave normalizada, guardada con el ítem a propósito:
                                     // motor y medición tienen que usar exactamente la misma
         nombre:     "Remeras",      // el texto que ve la persona
         categoria:  "ropa",         // documentacion|ropa|calzado|higiene|electronica|salud|destino|otros
         cantidad:   6,              // número o null cuando no aplica
         motivo:     "5 días más una de repuesto.",
         origen:     "regla",        // regla|destino|historial|manual
         estado:     "pendiente",    // pendiente|empacado|descartado
         empacadoEn: null,           // marca de tiempo del momento en que pasó a empacado
         regla:      "ropa.remeras", // qué regla lo puso, para trazabilidad
         cantidadEditada:false,      // true si la persona corrigió la cantidad a mano
         nota:       "",
         orden:      1009,           // para ordenar sin depender del orden de las claves
         agregadoEn:"...", actualizadoEn:"..."
       }
     }
   }

   TRES ESTADOS, NO UN BOOLEANO
   `pendiente` (no lo tocó), `empacado`, `descartado`. Un booleano
   colapsaría "lo descarté a propósito" con "todavía no lo toqué", y el
   descarte es el único insumo del aprendizaje de VAL-32.

   PRECEDENCIA DEL ORIGEN
   Un ítem puede venir de más de una capa. Se acredita SIEMPRE a la capa
   de menor precedencia: regla < historial < destino < manual (VAL-45).
   Si una regla base ya lo ponía, el origen es "regla" aunque el
   historial o la capa de destino también lo propusieran. Acreditarle a
   una capa más sofisticada lo que una más básica ya ponía haría que la
   métrica de aciertos por capa mida mejor de lo que es. Ver
   ORIGEN_PRECEDENCIA y lowestOrigin(). La comparación para decidir si
   "ya lo ponía" no es sólo por clave literal: pasa por `canonicalKey()`,
   así "adaptador de enchufe" y "adaptador de corriente" cuentan como el
   mismo ítem aunque el texto sea distinto.

   GARANTÍAS AL REGENERAR (mergeLists)
   1. Un ítem descartado nunca vuelve a estado pendiente.
   2. El origen de un ítem ya presente no se pisa con uno de mayor
      precedencia.
   3. Lo empacado sigue empacado, con su `empacadoEn` original.
   4. Los ítems propios y los ya empacados sobreviven aunque la regla
      que los ponía deje de aplicar.

   CÓMO SE MARCA UN SOLO ÍTEM SIN REESCRIBIR LA LISTA
   El motor devuelve el parche parcial listo para la base:

       await db.doc(`trips/${tripId}/packing/lista`)
               .update(PackingEngine.stateUpdatePatch("remera", "empacado"));

       // {items:{ remera:{ estado:"empacado", empacadoEn:"2026-...", actualizadoEn:"..." } },
       //  actualizadaEn:"2026-..."}

   Escribe una sola rama del objeto. Los otros ítems no se tocan, así que
   dos personas marcando ítems distintos al mismo tiempo no se pisan.
   Para la UI, el estado local se recalcula con setItemState(), que
   devuelve una lista nueva sin mutar la anterior.

   CLAVE NORMALIZADA
   slug(): minúsculas, sin acentos, en singular, separada por guiones.
   Determinística y estable: "Protector Solar", "protector solar" y
   "protectores solares" caen en la misma clave, que es lo que hace que
   el umbral de dos apariciones del historial se cumpla alguna vez.
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

var VERSION = 2;

/** Días que se asumen cuando el viaje todavía no tiene fechas. */
var DEFAULT_DAYS = 3;

/** VAL-32: cuántas repeticiones hacen falta para aprender. */
var HISTORY_PROMOTE_AT  = 2;   // agregado a mano en 2 viajes del mismo tipo -> se sugiere
var HISTORY_SUPPRESS_AT = 2;   // descartado en 2 viajes del mismo tipo -> deja de sugerirse

/** Tope de ítems que puede agregar la capa de IA. */
var MAX_AI_ITEMS = 8;

/** Los tres estados de un ítem. */
var ESTADO = { PENDIENTE:"pendiente", EMPACADO:"empacado", DESCARTADO:"descartado" };
var ESTADOS = [ESTADO.PENDIENTE, ESTADO.EMPACADO, ESTADO.DESCARTADO];

/** De qué capa viene un ítem. */
var ORIGEN = { REGLA:"regla", DESTINO:"destino", HISTORIAL:"historial", MANUAL:"manual" };

/**
 * Precedencia del origen: gana el número más chico, es decir la capa
 * más básica. Si una regla ya ponía el ítem, se acredita a la regla.
 * VAL-45: primero regla, después historial, después la capa de destino
 * con IA. Un ítem propio (manual) sólo se acredita a la persona cuando
 * ninguna otra capa lo cubre.
 */
var ORIGEN_PRECEDENCIA = { regla:0, historial:1, destino:2, manual:3 };

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

/** Saca acentos y baja a minúsculas. Base de todos los matcheos de texto. */
function norm(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

/**
 * Singular de una palabra, en castellano y por heurística.
 * No busca ser gramaticalmente perfecto: busca ser determinístico y que
 * la forma singular y la plural de la misma palabra caigan en la misma clave.
 *   remeras -> remera | pantalones -> pantalon | auriculares -> auricular
 */
function singularizeWord(w) {
  if (w.length <= 3) return w;
  if (/[^aeiou]es$/.test(w)) return w.slice(0, -2);   // consonante + "es": pantalones, auriculares
  if (/[aeiou]s$/.test(w))  return w.slice(0, -1);    // vocal + "s": remeras, líquidos
  return w;
}

/**
 * Clave normalizada y estable de un ítem: minúsculas, sin acentos,
 * en singular, separada por guiones. Es lo que permite reconocer
 * "Protector Solar" de un viaje anterior como el mismo ítem que
 * "protector solar" de este.
 * @param {string} label
 * @returns {string}
 */
function slug(label) {
  return norm(label)
    .replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeWord)
    .join("-");
}

/* ============================================================
   VAL-45 · SINÓNIMOS Y CLAVE CANÓNICA
   Dos ítems pueden significar lo mismo sin ser el mismo texto:
   "adaptador de enchufe" y "adaptador de corriente" son un solo
   ítem. Los sinónimos se declaran como datos acá, no como
   condicionales sueltos en el motor.

   Cada grupo es una familia de ítems equivalentes:
     canon    el nombre "de referencia" de la familia (de acá sale
              la clave canónica, con el mismo slug() que usa todo
              el motor)
     palabras frases que, normalizadas con slug(), son ese ítem
     patron   (opcional) expresión regular para familias abiertas,
              donde enumerar cada variante es imposible: el tipo de
              enchufe cambia de país en país ("adaptador tipo F",
              "adaptador tipo C"...). Se usa sólo cuando la lista
              cerrada de `palabras` no alcanza, y a propósito con un
              patrón acotado (tiene que hablar de enchufe/corriente/
              toma/tipo de clavija) para no capturar de más un
              "adaptador HDMI" o un "adaptador de lente".

   ¿Hasta dónde llega esto? Hasta donde el diccionario declara.
   No hay comparación semántica ni embeddings: dos ítems que
   signifiquen lo mismo con palabras que no están acá (o con errores
   de tipeo) no se detectan. Es una limitación conocida, documentada
   en docs/design/packing-engine.md.
   ============================================================ */
var SYNONYM_GROUPS = [
  { canon:"Adaptador de enchufe",
    palabras:["Adaptador de enchufe","Adaptador de corriente","Adaptador universal","Adaptador universal de enchufe","Adaptador de viaje","Enchufe universal","Adaptador de toma corriente"],
    // patron trabaja sobre la CLAVE ya normalizada (slug: minúsculas, con
    // guiones en vez de espacios), no sobre el texto original.
    patron:/^adaptador-.*(enchufe|corriente|toma|clavija|universal|viaje|tipo-[a-n]\b)/ },
  { canon:"Celular y cargador",
    palabras:["Celular y cargador","Cargador de celular","Cargador de teléfono","Cargador para el celular","Cargador de celular y cable"] },
  { canon:"Protector solar",
    palabras:["Protector solar","Bloqueador solar","Crema solar","Filtro solar","Pantalla solar"] },
  { canon:"Repelente de mosquitos",
    palabras:["Repelente de mosquitos","Repelente de insectos","Repelente"] },
  { canon:"Batería portátil",
    palabras:["Batería portátil","Power bank","Cargador portátil","Batería externa","Batería de respaldo"] },
  { canon:"Botiquín básico",
    palabras:["Botiquín básico","Botiquín de primeros auxilios","Kit de primeros auxilios","Botiquín"] },
  { canon:"Gorra o sombrero",
    palabras:["Gorra o sombrero","Gorra","Sombrero","Gorro para el sol"] },
  { canon:"Toallón de playa",
    palabras:["Toallón de playa","Toalla de playa","Toalla para la playa"] },
  { canon:"Seguro de viaje",
    palabras:["Seguro de viaje","Seguro médico de viaje","Seguro de asistencia al viajero","Asistencia al viajero"] },
  { canon:"Efectivo en moneda local",
    palabras:["Efectivo en moneda local","Dinero en efectivo","Efectivo del destino","Moneda local"] },
  { canon:"Copias de las reservas",
    palabras:["Copias de las reservas","Copia de las reservas","Reservas impresas","Impresión de las reservas"] },
  { canon:"Linterna frontal",
    palabras:["Linterna frontal","Linterna","Frontal"] },
  { canon:"Botas o zapatillas de trekking",
    palabras:["Botas o zapatillas de trekking","Botas de trekking","Zapatillas de trekking","Calzado de montaña"] },
  { canon:"Campera impermeable",
    palabras:["Campera impermeable","Campera de lluvia","Piloto","Rompevientos impermeable"] },
  { canon:"Primera capa térmica",
    palabras:["Primera capa térmica","Ropa térmica","Térmica","Capa base térmica"] },
  { canon:"Muda formal",
    palabras:["Muda formal","Ropa formal","Vestimenta formal"] },
  { canon:"Notebook y cargador",
    palabras:["Notebook y cargador","Laptop y cargador","Computadora portátil y cargador"] },
  { canon:"Ojotas",
    palabras:["Ojotas","Sandalias","Chinelas","Chancletas"] },
  { canon:"Malla",
    palabras:["Malla","Traje de baño","Bikini","Vestido de baño"] },
  { canon:"Botella reutilizable",
    palabras:["Botella reutilizable","Botella de agua","Cantimplora"] }
];

/** clave canónica -> mapa de búsqueda exacta, armado una sola vez. */
var SYNONYM_MAP = SYNONYM_GROUPS.reduce(function (map, g) {
  var canon = slug(g.canon);
  (g.palabras || []).forEach(function (w) { map[slug(w)] = canon; });
  map[canon] = canon;
  return map;
}, {});

/**
 * La clave "de familia" de un ítem: dos ítems son el mismo si tienen
 * la misma clave canónica, aunque el texto original sea distinto.
 * @param {string} clave ya normalizada con slug()
 * @returns {string}
 */
function canonicalKey(clave) {
  if (!clave) return clave;
  if (SYNONYM_MAP[clave]) return SYNONYM_MAP[clave];
  for (var i = 0; i < SYNONYM_GROUPS.length; i++) {
    var g = SYNONYM_GROUPS[i];
    if (g.patron && g.patron.test(clave)) return slug(g.canon);
  }
  return clave;
}

/**
 * Busca, entre las claves de un objeto de ítems, una que signifique lo
 * mismo que `clave` (misma familia canónica). No exige coincidencia
 * literal.
 * @param {Object} itemsObj objeto indexado por clave
 * @param {string} clave clave (o su canónica) a buscar
 * @returns {string|null} la clave existente que coincide, o null
 */
function findCanonicalMatch(itemsObj, clave) {
  var canon = canonicalKey(clave);
  var keys = Object.keys(itemsObj || {});
  for (var i = 0; i < keys.length; i++) {
    if (canonicalKey(keys[i]) === canon) return keys[i];
  }
  return null;
}

/**
 * VAL-45: la verificación exportada. Dada una lista, confirma que no
 * hay dos ítems que signifiquen lo mismo (misma clave canónica).
 * @param {Object} list
 * @returns {{ok:boolean, duplicados:Array<{canon:string, claves:string[]}>}}
 */
function verifyNoDuplicateItems(list) {
  var porCanon = {};
  itemsArray(list).forEach(function (i) {
    if (!i || !i.clave) return;
    var canon = canonicalKey(i.clave);
    (porCanon[canon] = porCanon[canon] || []).push(i.clave);
  });
  var duplicados = Object.keys(porCanon)
    .filter(function (c) { return uniq(porCanon[c]).length > 1; })
    .map(function (c) { return { canon:c, claves:uniq(porCanon[c]) }; });
  return { ok:duplicados.length === 0, duplicados:duplicados };
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

/** Gana el origen de menor precedencia: la capa más básica. */
function lowestOrigin(a, b) {
  var pa = ORIGEN_PRECEDENCIA[a], pb = ORIGEN_PRECEDENCIA[b];
  if (pa === undefined) return b;
  if (pb === undefined) return a;
  return pa <= pb ? a : b;
}

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

/**
 * Los ítems de una lista como array. Acepta el objeto indexado por clave
 * (la forma que se guarda) y también un array, por si viene de una versión
 * vieja del documento o de una prueba.
 */
function itemsArray(list) {
  var items = list && list.items;
  if (!items) return [];
  if (Array.isArray(items)) return items.filter(Boolean);
  return Object.keys(items).map(function (k) {
    var it = items[k];
    return it && !it.clave ? Object.assign({ clave:k }, it) : it;
  }).filter(Boolean);
}

/** Índice por clave a partir de un array de ítems. */
function indexItems(arr) {
  var out = {};
  arr.forEach(function (i) { if (i && i.clave) out[i.clave] = i; });
  return out;
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
  "cafayate","purmamarca","tilcara","gualeguaychu","colon","concordia","la plata",
  "mar de ajo","monte hermoso","las grutas","el bolson","catamarca","la rioja","san juan",
  "santa fe","corrientes","chaco","formosa","misiones","posadas","rio gallegos","comodoro"];

/** Pistas de destino internacional. */
var FOREIGN_HINTS = ["brasil","brazil","florianopolis","rio de janeiro","sao paulo","buzios",
  "camboriu","chile","santiago de chile","pucon","valparaiso","atacama","uruguay","punta del este",
  "montevideo","colonia del sacramento","jose ignacio","paraguay","asuncion","bolivia","la paz",
  "peru","lima","cusco","machu picchu","colombia","cartagena","medellin","bogota","mexico",
  "cancun","tulum","riviera maya","estados unidos","eeuu","usa","miami","nueva york","new york",
  "orlando","los angeles","san francisco","las vegas","chicago","canada","toronto","espana",
  "madrid","barcelona","sevilla","valencia","mallorca","ibiza","francia","paris","niza","italia",
  "roma","milan","florencia","venecia","napoli","portugal","lisboa","oporto","inglaterra",
  "londres","reino unido","escocia","irlanda","alemania","berlin","munich","holanda","amsterdam",
  "belgica","suiza","austria","viena","praga","republica checa","hungria","budapest","polonia",
  "grecia","atenas","santorini","croacia","turquia","estambul","marruecos","egipto","sudafrica",
  "japon","tokio","kioto","china","tailandia","bangkok","vietnam","indonesia","bali","india",
  "australia","sidney","nueva zelanda","dubai","emiratos","israel","cuba","varadero","punta cana",
  "republica dominicana","caribe","aruba","curazao","panama","costa rica","ecuador","galapagos",
  "venezuela","noruega","suecia","dinamarca","copenhague","finlandia","islandia"];

/**
 * @param {Object} trip
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
     clave    clave normalizada del ítem; si falta, se calcula del nombre
     nombre   cómo se llama para el viajero
     categoria una de CATEGORIES
     when     condición declarativa, opcional (sin when = siempre)
     cantidad número, o {fixed} o {perDay|everyDays, extra, min, max}
     motivo   texto, o función (cantidad, ctx, calc) => texto

   Agregar una regla es agregar una entrada acá abajo.
   ============================================================ */

var BASE_RULES = [

  /* ---------- DOCUMENTACIÓN ---------- */
  { id:"doc.dni", nombre:"DNI", categoria:"documentacion", critico:true,
    motivo:"Siempre, aunque el viaje sea en auto y a cien kilómetros." },

  { id:"doc.pasaporte", nombre:"Pasaporte", categoria:"documentacion", critico:true,
    when:{ international:true },
    motivo:"Viaje internacional. Revisá que la vigencia cubra seis meses después de la vuelta." },

  { id:"doc.visa", nombre:"Visa o autorización electrónica", categoria:"documentacion",
    when:{ international:true },
    motivo:"Fijate si tu pasaporte necesita visa o permiso electrónico para este destino." },

  { id:"doc.seguro", nombre:"Seguro de viaje", categoria:"documentacion",
    when:{ international:true },
    motivo:"Varios países lo piden en migraciones y la atención médica afuera se paga en dólares." },

  { id:"doc.tarjetas", nombre:"Tarjetas de débito y crédito", categoria:"documentacion",
    motivo:"Guardadas en dos lugares distintos, no las dos en la misma billetera." },

  { id:"doc.efectivo", nombre:"Efectivo en moneda local", categoria:"documentacion",
    when:{ international:true },
    motivo:"Para el primer traslado y las propinas, antes de encontrar un cajero." },

  { id:"doc.reservas", nombre:"Copias de las reservas", categoria:"documentacion",
    motivo:"Descargadas o impresas: siguen sirviendo con el celular sin batería." },

  { id:"doc.licencia", nombre:"Licencia de conducir", categoria:"documentacion",
    when:{ facts:["hasRentalCar"] },
    motivo:"Tenés un auto alquilado en el viaje." },

  { id:"doc.licencia-internacional", nombre:"Licencia de conducir internacional", categoria:"documentacion",
    when:{ facts:["hasRentalCar"], international:true },
    motivo:"Auto alquilado en el exterior: muchos países la piden junto con la nacional." },

  /* ---------- ROPA ---------- */
  { id:"ropa.remeras", nombre:"Remeras", categoria:"ropa",
    cantidad:{ perDay:1, extra:1, min:2, max:8 },
    motivo:function (n, ctx, calc) {
      return calc.capped
        ? "Con " + dias(ctx.days) + " no tiene sentido una por día: " + n + " y lavás en el viaje."
        : dias(ctx.days) + " más una de repuesto.";
    } },

  { id:"ropa.ropa-interior", nombre:"Ropa interior", categoria:"ropa",
    cantidad:{ perDay:1, extra:1, min:2, max:10 },
    motivo:function (n, ctx, calc) {
      return calc.capped
        ? n + " juegos: con " + dias(ctx.days) + " vas a lavar igual."
        : "Un juego por día más uno de repuesto.";
    } },

  { id:"ropa.medias", nombre:"Medias", categoria:"ropa",
    cantidad:{ perDay:1, extra:1, min:2, max:10 },
    motivo:function (n, ctx, calc) {
      return calc.capped
        ? n + " pares: con " + dias(ctx.days) + " vas a lavar igual."
        : "Un par por día más uno de repuesto.";
    } },

  { id:"ropa.pantalones", nombre:"Pantalones", categoria:"ropa",
    cantidad:{ everyDays:3, min:1, max:4 },
    motivo:function (n, ctx) { return "Uno cada tres días de viaje, sobre " + dias(ctx.days) + "."; } },

  { id:"ropa.buzo", nombre:"Buzo o abrigo liviano", categoria:"ropa",
    cantidad:{ everyDays:10, min:1, max:2 },
    motivo:"Las noches bajan de temperatura en casi cualquier destino." },

  { id:"ropa.pijama", nombre:"Pijama", categoria:"ropa",
    cantidad:{ everyDays:7, min:1, max:2 },
    motivo:function (n) { return n === 1 ? "Uno alcanza." : "Uno por semana de viaje."; } },

  { id:"ropa.bolsa-sucia", nombre:"Bolsa para la ropa sucia", categoria:"ropa",
    motivo:"Separa lo usado de lo limpio y te ahorra clasificar al volver." },

  { id:"ropa.malla", nombre:"Malla", categoria:"ropa",
    when:{ any:[{ tripTypes:["playa"] }, { facts:["hasWaterActivity"] }] },
    cantidad:{ fixed:2 },
    motivo:"Dos, para no ponerte una mojada al día siguiente." },

  { id:"ropa.toallon", nombre:"Toallón de playa", categoria:"ropa",
    when:{ tripTypes:["playa"] },
    motivo:"El del alojamiento casi nunca se puede sacar a la playa." },

  { id:"ropa.termica", nombre:"Primera capa térmica", categoria:"ropa",
    when:{ any:[{ tripTypes:["montana"] }, { facts:["hasSnow"] }] },
    cantidad:{ everyDays:4, min:1, max:3 },
    motivo:"En montaña se abriga por capas, no con una prenda gruesa." },

  { id:"ropa.impermeable", nombre:"Campera impermeable", categoria:"ropa",
    when:{ any:[{ tripTypes:["montana","aventura"] }, { facts:["hasTrekking"] }] },
    motivo:"En montaña el clima cambia en una hora." },

  { id:"ropa.gorro-abrigo", nombre:"Gorro y guantes de abrigo", categoria:"ropa",
    when:{ any:[{ tripTypes:["montana"] }, { facts:["hasSnow"] }] },
    motivo:"La cabeza y las manos son por donde más calor se pierde." },

  { id:"ropa.gorra", nombre:"Gorra o sombrero", categoria:"ropa",
    when:{ tripTypes:["playa","aventura","montana"] },
    motivo:"Sol directo muchas horas seguidas." },

  { id:"ropa.formal", nombre:"Muda formal", categoria:"ropa",
    when:{ any:[{ tripTypes:["trabajo"] }, { facts:["hasWorkActivity"] }] },
    cantidad:{ everyDays:2, min:1, max:4 },
    motivo:function (n, ctx) { return "Una cada dos días de trabajo, sobre " + dias(ctx.days) + "."; } },

  { id:"ropa.salida", nombre:"Una muda para salir de noche", categoria:"ropa",
    when:{ tripTypes:["ciudad","playa","mixto"] },
    motivo:"Para la cena o la salida que no estaba planeada." },

  /* ---------- CALZADO ---------- */
  { id:"calzado.diario", nombre:"Zapatillas cómodas", categoria:"calzado",
    motivo:"El par que ya tenés usado. Un viaje no es para estrenar calzado." },

  { id:"calzado.trekking", nombre:"Botas o zapatillas de trekking", categoria:"calzado",
    when:{ any:[{ tripTypes:["montana","aventura"] }, { facts:["hasTrekking"] }] },
    motivo:"Hay caminatas en el viaje: suela con agarre y tobillo sostenido." },

  { id:"calzado.ojotas", nombre:"Ojotas", categoria:"calzado",
    when:{ any:[{ tripTypes:["playa"] }, { facts:["hasWaterActivity"] }] },
    motivo:"Para la arena, la pileta y el baño compartido." },

  { id:"calzado.formal", nombre:"Zapatos de vestir", categoria:"calzado",
    when:{ any:[{ tripTypes:["trabajo"] }, { facts:["hasWorkActivity"] }] },
    motivo:"Van con la muda formal." },

  { id:"calzado.salida", nombre:"Un par para salir", categoria:"calzado",
    when:{ tripTypes:["ciudad","mixto"] },
    motivo:"Algo que no sean las zapatillas de caminar todo el día." },

  /* ---------- HIGIENE ---------- */
  { id:"higiene.neceser", nombre:"Neceser armado", categoria:"higiene",
    motivo:"Todo junto en un solo lugar: es lo primero que se busca al llegar." },

  { id:"higiene.cepillo", nombre:"Cepillo y pasta de dientes", categoria:"higiene",
    motivo:"Lo más olvidado de la lista." },

  { id:"higiene.desodorante", nombre:"Desodorante", categoria:"higiene",
    motivo:"Uno por viaje, del tamaño chico." },

  { id:"higiene.shampoo", nombre:"Shampoo y jabón", categoria:"higiene",
    motivo:"En envases chicos: casi todos los alojamientos tienen los suyos." },

  { id:"higiene.protector-solar", nombre:"Protector solar", categoria:"higiene",
    when:{ any:[{ tripTypes:["playa","montana","aventura"] }, { facts:["hasWaterActivity","hasSnow"] }] },
    motivo:function (n, ctx) {
      if (ctx.tripType === "montana" || ctx.facts.hasSnow) return "En altura y con nieve el sol pega mucho más fuerte.";
      return "Muchas horas de sol directo, todos los días del viaje.";
    } },

  { id:"higiene.repelente", nombre:"Repelente de mosquitos", categoria:"higiene",
    when:{ any:[{ tripTypes:["playa","aventura"] }, { facts:["hasWaterActivity"] }] },
    motivo:"Zonas cálidas y con agua cerca." },

  { id:"higiene.liquidos", nombre:"Líquidos de hasta 100 ml", categoria:"higiene",
    when:{ facts:["hasFlight"] },
    motivo:"Hay vuelo: si llevás equipaje de mano, ese es el límite por envase." },

  /* ---------- ELECTRÓNICA ---------- */
  { id:"elec.celular", nombre:"Celular y cargador", categoria:"electronica",
    motivo:"Es el pasaje, el mapa y la cámara." },

  { id:"elec.powerbank", nombre:"Batería portátil", categoria:"electronica",
    motivo:"En el equipaje de mano: no se puede despachar." },

  { id:"elec.adaptador", nombre:"Adaptador de enchufe", categoria:"electronica",
    when:{ international:true },
    motivo:"Viaje internacional: el enchufe del destino puede no ser el de acá." },

  { id:"elec.auriculares", nombre:"Auriculares", categoria:"electronica",
    motivo:"Para el vuelo, el colectivo y la espera." },

  { id:"elec.notebook", nombre:"Notebook y cargador", categoria:"electronica",
    when:{ any:[{ tripTypes:["trabajo"] }, { facts:["hasWorkActivity"] }] },
    motivo:"Viaje de trabajo." },

  { id:"elec.camara", nombre:"Cámara y cargador", categoria:"electronica",
    when:{ tripTypes:["montana","aventura"] },
    motivo:"Paisaje que el celular no rinde." },

  { id:"elec.linterna", nombre:"Linterna frontal", categoria:"electronica",
    when:{ any:[{ tripTypes:["montana","aventura"] }, { facts:["hasTrekking"] }] },
    motivo:"Salidas temprano, refugios y cortes de luz." },

  /* ---------- SALUD ---------- */
  { id:"salud.medicacion", nombre:"Medicación personal", categoria:"salud",
    motivo:"Con la receta y en el equipaje de mano, por si la valija se pierde." },

  { id:"salud.botiquin", nombre:"Botiquín básico", categoria:"salud",
    motivo:"Analgésico, curitas, antiséptico y algo para el estómago. Ocupa poco y siempre se usa." },

  { id:"salud.mareo", nombre:"Pastillas para el mareo", categoria:"salud",
    when:{ tripTypes:["montana","aventura"] },
    motivo:"Rutas de montaña y caminos de ripio." },

  { id:"salud.botella", nombre:"Botella reutilizable", categoria:"salud",
    motivo:"Se llena después del control de seguridad y en el alojamiento." }
];

/* Completa la clave que falte y fija el orden de presentación. */
BASE_RULES = BASE_RULES.map(function (r, i) {
  return Object.assign({}, r, { clave:r.clave || slug(r.nombre), orden:orderOf(r.categoria, i), critico:!!r.critico });
});

/**
 * VAL-43: claves de los ítems que ninguna capa puede sacar automáticamente,
 * ni siquiera cuando lo propone la capa de destino con IA. Se declaran en
 * el catálogo (`critico:true` en la regla), no como una lista aparte que
 * se pueda desincronizar: la documentación de identidad (DNI, pasaporte)
 * es el piso que no se toca.
 */
var CRITICAL_CLAVES = BASE_RULES.reduce(function (m, r) {
  if (r.critico) m[r.clave] = true;
  return m;
}, {});

/** VAL-43: ¿este ítem (por clave o su familia de sinónimos) es intocable? */
function isCriticalClave(clave) {
  if (!clave) return false;
  if (CRITICAL_CLAVES[clave]) return true;
  var canon = canonicalKey(clave);
  return Object.keys(CRITICAL_CLAVES).some(function (c) { return canonicalKey(c) === canon; });
}

/** Orden de presentación: primero la categoría, después la posición dentro de ella. */
function orderOf(categoria, sub) {
  var c = CATEGORY_ORDER[categoria];
  return (c === undefined ? 90 : c) * 1000 + sub;
}

/**
 * Chequeo de integridad del catálogo de reglas. Lo corre la prueba.
 * @returns {string[]} lista de problemas. Vacía = catálogo sano.
 */
function validateRules(rules) {
  rules = rules || BASE_RULES;
  var problems = [], ids = {}, claves = {}, canones = {};
  rules.forEach(function (r) {
    if (!r.id) problems.push("regla sin id: " + JSON.stringify(r));
    if (ids[r.id]) problems.push("id repetido: " + r.id);
    ids[r.id] = true;
    if (claves[r.clave]) problems.push("clave repetida: " + r.clave + " (" + r.id + ")");
    claves[r.clave] = true;
    if (!r.nombre) problems.push("regla sin nombre: " + r.id);
    if (CATEGORY_ORDER[r.categoria] === undefined) problems.push("categoría desconocida en " + r.id + ": " + r.categoria);
    if (!r.motivo) problems.push("regla sin motivo: " + r.id);
    // VAL-45: dos reglas del catálogo no pueden significar lo mismo, ni
    // siquiera por sinónimo declarado — sería una regla duplicada disfrazada.
    var canon = canonicalKey(r.clave);
    if (canones[canon] && canones[canon] !== r.clave) {
      problems.push("dos reglas apuntan al mismo ítem por sinónimo: \"" + canones[canon] + "\" y \"" + r.clave + "\" (" + r.id + ")");
    }
    canones[canon] = r.clave;
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

function resolveReason(motivo, qty, ctx, calc) {
  if (typeof motivo === "function") return String(motivo(qty, ctx, calc) || "");
  return String(motivo || "");
}

/* ============================================================
   CONTEXTO DEL VIAJE
   ============================================================ */

/**
 * Arma el contexto sobre el que se evalúan todas las reglas.
 * @param {Object} trip   viaje {id,name,destination,startDate,endDate,notes,international?}
 * @param {Array}  items  reservas del viaje
 * @param {Object} [opts] {tipoViaje} para forzar el tipo elegido por la persona
 * @returns {Object} contexto
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

  var chosen = normalizeTripType(opts.tipoViaje || opts.tripType);
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

function bump(map, clave, item) {
  var e = map.get(clave);
  if (!e) { e = { clave:clave, nombre:item.nombre || clave, categoria:item.categoria || "otros", veces:0 }; map.set(clave, e); }
  e.veces++;
  if (item.nombre) e.nombre = item.nombre;              // el rótulo más reciente gana
  if (item.categoria) e.categoria = item.categoria;
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
 * @param {string} tipoViaje tipo del viaje que se está armando
 * @returns {{tipoViaje:string, muestra:number, promover:Array, suprimir:Array}}
 */
function learnFromHistory(history, tipoViaje) {
  var added = new Map(), dismissed = new Map(), muestra = 0;
  var tipo = normalizeTripType(tipoViaje);

  (history || []).forEach(function (list) {
    if (!list) return;
    var arr = itemsArray(list);
    if (!arr.length) return;
    if (normalizeTripType(list.tipoViaje || list.tripType) !== tipo) return;
    muestra++;
    var seenAdd = {}, seenDis = {};
    arr.forEach(function (it) {
      if (!it) return;
      var clave = it.clave || slug(it.nombre || it.label);
      if (!clave) return;
      if (it.origen === ORIGEN.MANUAL && !seenAdd[clave]) { seenAdd[clave] = true; bump(added, clave, it); }
      if (it.estado === ESTADO.DESCARTADO && !seenDis[clave]) { seenDis[clave] = true; bump(dismissed, clave, it); }
    });
  });

  var promover = [];
  added.forEach(function (e) { if (e.veces >= HISTORY_PROMOTE_AT) promover.push(e); });
  var promoverClaves = promover.reduce(function (m, e) { m[e.clave] = true; return m; }, {});

  var suprimir = [];
  dismissed.forEach(function (e) {
    if (e.veces >= HISTORY_SUPPRESS_AT && !promoverClaves[e.clave]) suprimir.push(e);
  });

  var porVeces = function (a, b) { return b.veces - a.veces || a.clave.localeCompare(b.clave); };
  return { tipoViaje:tipo, muestra:muestra, promover:promover.sort(porVeces), suprimir:suprimir.sort(porVeces) };
}

/* ============================================================
   ARMADO DE LA LISTA  (CAPA 1 + CAPA 3)
   ============================================================ */

function makeItem(fields, at) {
  return {
    clave:fields.clave,
    nombre:fields.nombre,
    categoria:fields.categoria || "otros",
    cantidad:fields.cantidad == null ? null : fields.cantidad,
    motivo:fields.motivo || "",
    origen:fields.origen || ORIGEN.REGLA,
    estado:ESTADO.PENDIENTE,
    empacadoEn:null,
    regla:fields.regla || "",
    cantidadEditada:false,
    nota:"",
    orden:fields.orden == null ? orderOf(fields.categoria, 500) : fields.orden,
    agregadoEn:at,
    actualizadoEn:at
  };
}

/**
 * Los ítems de la lista, ordenados y listos para mostrar.
 * @param {Object} list
 * @param {Object} [opts] {includeDismissed:true} para incluir los descartados
 * @returns {Array}
 */
function itemList(list, opts) {
  opts = opts || {};
  return itemsArray(list)
    .filter(function (i) { return opts.includeDismissed ? true : i.estado !== ESTADO.DESCARTADO; })
    .sort(function (a, b) {
      if (a.orden !== b.orden) return (a.orden || 0) - (b.orden || 0);
      return String(a.nombre).localeCompare(String(b.nombre), "es");
    });
}

/**
 * Contador de la lista. El porcentaje mide cuánto de la lista la persona ya
 * RESOLVIÓ, no cuánto entra en el bolso: descartar es una decisión tomada,
 * tan resuelta como empacar. Por eso entra en `resueltos` y en el `pct`,
 * y por eso `total` incluye los descartados en vez de restarlos.
 *
 * Decisión de producto (no es un detalle de implementación): si descartar
 * no mueve el progreso, la persona deja de descartar y en cambio marca como
 * empacado lo que no va a llevar, sólo para sacarse el pendiente de encima.
 * Ahí se pierden dos cosas a la vez: el dato de descarte, que es el único
 * insumo del aprendizaje de VAL-32, y la confiabilidad de lo que dice estar
 * empacado. La fórmula tiene que premiar la conducta que se quiere: descartar
 * lo que no corresponde es tan válido como empacar lo que sí.
 *
 * Corregido con el producto en la mano: sumar el descartado al total dejaba el
 * contador trabado, porque descartabas algo y el "de 42" no bajaba nunca. Lo
 * descartado sale del total: dejó de ser parte de la valija. El motivo de
 * arriba se cumple igual, porque descartar sube el porcentaje al achicar lo
 * que falta, en vez de sumar al numerador.
 *
 *     total     = todos los ítems MENOS los descartados
 *     resueltos = empacados
 *     pct       = empacados / total    (100 si se descartó todo)
 *
 * `totalConDescartados` conserva el total crudo, para la barra y para poder
 * recuperar lo descartado.
 *
 * @param {Object} list
 * @returns {{total:number, empacados:number, descartados:number, pendientes:number, resueltos:number, pct:number}}
 */
function packingProgress(list) {
  var arr = itemsArray(list);
  var empacados = arr.filter(function (i) { return i.estado === ESTADO.EMPACADO; }).length;
  var descartados = arr.filter(function (i) { return i.estado === ESTADO.DESCARTADO; }).length;
  /* Lo descartado sale del total. Si alguien decidió que algo no va, dejó de
     ser parte de su valija: no tiene que inflar el denominador ni quedar como
     un pendiente eterno. Descartar igual hace avanzar el porcentaje, porque
     achica lo que falta. */
  var total = arr.length - descartados;
  var pendientes = total - empacados;
  return {
    total:total,
    empacados:empacados,
    descartados:descartados,
    pendientes:pendientes,
    resueltos:empacados,
    totalConDescartados:arr.length,
    pct:total ? Math.round(empacados / total * 100) : (arr.length ? 100 : 0)
  };
}

/**
 * CAPA 1 + CAPA 3. Genera la lista base, sin IA y sin red.
 *
 * @param {Object}  input
 * @param {Object}  input.trip       viaje
 * @param {Array}   [input.items]    reservas del viaje
 * @param {string}  [input.tipoViaje] tipo elegido por la persona; si falta se sugiere
 * @param {Array}   [input.history]  listas guardadas de viajes anteriores
 * @param {Object}  [input.previous] lista ya guardada de este viaje, para regenerar sin perder nada
 * @param {string}  [input.now]      timestamp ISO, para pruebas determinísticas
 * @returns {Object} documento de lista, listo para guardar
 */
function buildPackingList(input) {
  input = input || {};
  var at = input.now || nowISO();
  var trip = input.trip || {};
  var items = input.items || [];
  var ctx = tripContext(trip, items, { tipoViaje:input.tipoViaje || input.tripType });
  var aprendido = learnFromHistory(input.history, ctx.tripType);

  var suprimidos = aprendido.suprimir.reduce(function (m, e) { m[e.clave] = e; return m; }, {});
  var out = {}, orden = 0;

  BASE_RULES.forEach(function (rule) {
    if (!matchesCondition(rule.when, ctx)) return;
    if (suprimidos[rule.clave]) return;                     // VAL-32: descartado dos veces
    var calc = computeQty(rule.cantidad, ctx);
    out[rule.clave] = makeItem({
      clave:rule.clave, nombre:rule.nombre, categoria:rule.categoria,
      cantidad:calc.qty, motivo:resolveReason(rule.motivo, calc.qty, ctx, calc),
      origen:ORIGEN.REGLA, regla:rule.id, orden:rule.orden
    }, at);
  });

  aprendido.promover.forEach(function (e, i) {
    // PRECEDENCIA: si una regla base ya lo puso, el origen sigue siendo "regla".
    // VAL-45: "ya lo puso" no es sólo la clave literal, es la familia de sinónimos.
    if (out[e.clave] || findCanonicalMatch(out, e.clave)) return;
    out[e.clave] = makeItem({
      clave:e.clave, nombre:e.nombre, categoria:e.categoria || "otros", cantidad:null,
      motivo:"Lo agregaste a mano en " + e.veces + " viajes de " + (TRIP_TYPE_LABEL[ctx.tripType] || ctx.tripType).toLowerCase() + ".",
      origen:ORIGEN.HISTORIAL, regla:"historial", orden:orderOf(e.categoria || "otros", 900 + i)
    }, at);
  });

  var avisos = [];
  if (!ctx.daysKnown) avisos.push({ codigo:"sin-fechas",
    texto:"El viaje no tiene fechas: calculé las cantidades sobre " + dias(DEFAULT_DAYS) + ". Cargá salida y regreso para ajustarlas." });
  if (!ctx.internationalKnown) avisos.push({ codigo:"destino-desconocido",
    texto:"No pude deducir si el viaje es internacional. Cargá los vuelos o el destino para que aparezca la documentación que corresponde." });

  var fresh = {
    version:VERSION,
    tripId:trip.id || "",
    tipoViaje:ctx.tripType,
    creadaEn:at, generadaEn:at, actualizadaEn:at,
    base:{
      destino:ctx.destination, desde:ctx.startDate, hasta:ctx.endDate,
      dias:ctx.days, noches:ctx.nights, diasConocidos:ctx.daysKnown,
      internacional:ctx.international, internacionalConocido:ctx.internationalKnown,
      internacionalFuente:ctx.internationalSource, internacionalDetalle:ctx.internationalDetail,
      tipoViajeFuente:ctx.tripTypeSource, tipoViajeMotivo:ctx.tripTypeReason,
      hechos:ctx.facts,
      reservas:summarizeReservationsForAI(trip, items),     // VAL-44: lo que ve la capa de IA, sin datos sensibles
      notasViaje:sanitizeNotesForAI(trip.notes)             // VAL-44: las notas del viaje, con el mismo saneado
    },
    capaInteligente:{ estado:"sin-ajuste", en:null, nota:"Lista base, sin ajuste por destino.", clima:"" },
    aprendizaje:{ muestra:aprendido.muestra, promovidos:aprendido.promover, suprimidos:aprendido.suprimir },
    avisos:avisos,
    items:out,
    conteo:null
  };
  fresh.conteo = packingProgress(fresh);

  return input.previous ? mergeLists(input.previous, fresh) : fresh;
}

/**
 * VAL-30: generar dos veces no duplica ni pierde nada.
 *
 * Garantiza que regenerar NO:
 *   - resucita un ítem descartado (el estado de la lista anterior manda),
 *   - pisa el origen de un ítem ya presente con uno de mayor precedencia,
 *   - pierde lo empacado, su `empacadoEn`, las notas, las cantidades
 *     corregidas a mano ni los ítems propios,
 *   - duplica un ítem que en la lista anterior tenía otro texto pero
 *     significa lo mismo (VAL-45: la comparación es por clave canónica,
 *     no sólo literal — dos generaciones no pueden llamar distinto a lo
 *     mismo y terminar con dos filas).
 *
 * @param {Object} previous lista guardada
 * @param {Object} fresh    lista recién generada
 * @returns {Object} lista fusionada
 */
function mergeLists(previous, fresh) {
  if (!previous) return fresh;
  var prevArr = itemsArray(previous);
  var prev = indexItems(prevArr);
  if (!Object.keys(prev).length) return fresh;

  // VAL-45: además del índice literal, uno por familia canónica, para
  // encontrar el ítem anterior aunque esta generación lo nombre distinto.
  var prevPorCanon = {};
  prevArr.forEach(function (p) {
    if (!p || !p.clave) return;
    var c = canonicalKey(p.clave);
    if (!prevPorCanon[c]) prevPorCanon[c] = p;
  });

  var merged = {}, usados = {};

  itemsArray(fresh).forEach(function (f) {
    var p = prev[f.clave] || prevPorCanon[canonicalKey(f.clave)];
    if (!p) { merged[f.clave] = f; return; }
    usados[p.clave] = true;
    merged[f.clave] = Object.assign({}, f, {
      // el estado de la persona manda: lo descartado no revive, lo empacado sigue empacado
      estado:ESTADOS.indexOf(p.estado) >= 0 ? p.estado : ESTADO.PENDIENTE,
      empacadoEn:p.empacadoEn || null,
      // PRECEDENCIA: nunca se pisa el origen con una capa de mayor precedencia
      origen:lowestOrigin(p.origen, f.origen),
      nota:p.nota || "",
      cantidad:p.cantidadEditada ? p.cantidad : f.cantidad,
      cantidadEditada:!!p.cantidadEditada,
      motivo:p.cantidadEditada ? (p.motivo || f.motivo) : f.motivo,
      agregadoEn:p.agregadoEn || f.agregadoEn,
      actualizadoEn:fresh.generadaEn
    });
  });

  var claveCanonEnMerged = {};
  Object.keys(merged).forEach(function (k) { claveCanonEnMerged[canonicalKey(k)] = true; });

  // Lo que la persona tocó o agregó sobrevive aunque la regla ya no aplique.
  // Incluye los descartados: si desaparecieran, la próxima generación los resucitaría.
  itemsArray(previous).forEach(function (p) {
    if (!p || !p.clave) return;
    if (usados[p.clave] || merged[p.clave]) return;
    var canon = canonicalKey(p.clave);
    if (claveCanonEnMerged[canon]) return;    // VAL-45: ya hay un equivalente en la lista fusionada
    if (p.origen === ORIGEN.MANUAL || p.estado !== ESTADO.PENDIENTE) {
      merged[p.clave] = Object.assign({}, p, { retenido:true });
      claveCanonEnMerged[canon] = true;
    }
  });

  var out = Object.assign({}, fresh, {
    creadaEn:previous.creadaEn || fresh.creadaEn,
    items:merged
  });
  out.conteo = packingProgress(out);
  return out;
}

/* ============================================================
   VAL-44 · RESUMEN SEGURO DE RESERVAS PARA LA CAPA DE IA
   Lo que se manda a la capa de destino nunca puede ser el objeto de
   la reserva tal cual: tiene código de reserva, teléfono y dirección
   exacta. Esta función arma el resumen que SÍ se puede mandar: tipo,
   fechas, ciudades, duración y notas. Nada más. Se computa una vez
   (en buildPackingList) y queda en `list.base.reservas`, así
   `destinationPrompt` no necesita las reservas completas para armar
   el prompt — sólo puede ver lo que ya pasó por este filtro.
   ============================================================ */

/* Formas de dato de contacto que se tapan antes de que una nota libre
   viaje al modelo. Son datos personales -casi siempre de un tercero- que
   no aportan nada para decidir qué llevar en la valija, que es el criterio
   con el que está escrita esta regla. Se declaran como datos: agregar una
   forma nueva es agregar una entrada, no tocar la función.

   El orden importa: el correo se tapa ANTES que la corrida de dígitos,
   porque un correo puede tener números adentro y quedaría medio tapado
   y medio no. */
var CONTACT_PATTERNS = [
  /** Correo electrónico. Decisión de producto del Product Owner: el brief
   *  sólo nombra código de reserva, teléfono y dirección, pero un correo es
   *  un dato personal de un tercero y no sirve para armar la valija. */
  { nombre:"correo", re:/[A-Za-z0-9._%+-]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}/g },
  /** Secuencia larga de dígitos, por si alguien pegó un teléfono. */
  { nombre:"telefono", re:/(\+?\d[\d\s\-().]{5,}\d)/g }
];

/**
 * Saca de una nota libre los datos de contacto antes de mandarla a la capa
 * de IA, y la recorta. Defensa en profundidad, no la única barrera: el
 * resumen de reservas ya arma cada objeto campo por campo.
 * @param {string} text nota tal como la escribió la persona
 * @returns {string} la nota con cada dato de contacto reemplazado por
 *   "[dato omitido]", recortada a 240 caracteres
 */
function sanitizeNotesForAI(text) {
  var t = String(text == null ? "" : text).trim();
  if (!t) return "";
  CONTACT_PATTERNS.forEach(function (p) {
    p.re.lastIndex = 0;                       // las regex son /g y se reusan
    t = t.replace(p.re, "[dato omitido]");
  });
  return t.slice(0, 240);
}

function hoursBetween(a, b) {
  var da = Date.parse(a), db = Date.parse(b);
  if (isNaN(da) || isNaN(db)) return null;
  return (db - da) / 3600000;
}

/**
 * VAL-44: arma el resumen seguro de reservas que ve la capa de IA.
 * NUNCA incluye `confirmation`, `phone` ni `address`: esos campos ni
 * se leen acá. Sólo tipo, fechas, ciudades (código de vuelo, no
 * dirección) y notas, que es lo que sirve para decidir qué llevar.
 * @param {Object} trip
 * @param {Array} items reservas completas del viaje
 * @returns {Array<Object>} resumen, listo para ir en el prompt
 */
function summarizeReservationsForAI(trip, items) {
  items = (items || []).filter(Boolean);
  var out = [];

  var flights = items.filter(function (i) { return i && i.type === "flight"; })
    .slice()
    .sort(function (a, b) { return String(a.start || "").localeCompare(String(b.start || "")); });

  flights.forEach(function (f) {
    out.push({
      tipo:"vuelo", desde:f.start || "", hasta:f.end || "",
      origen:String(f.from || "").trim().toUpperCase(),
      destino:String(f.to || "").trim().toUpperCase(),
      notas:sanitizeNotesForAI(f.notes)
    });
  });

  // Escala: dos vuelos consecutivos donde el primero llega adonde sale el
  // segundo, con una espera real en el medio. Es justo el dato puntual que
  // ninguna regla podía anticipar (VAL-44).
  for (var i = 0; i < flights.length - 1; i++) {
    var a = flights[i], b = flights[i + 1];
    if (!a.to || !b.from || String(a.to).toUpperCase() !== String(b.from).toUpperCase()) continue;
    var horas = hoursBetween(a.end, b.start);
    if (horas == null || horas <= 0) continue;
    out.push({ tipo:"escala", ciudad:String(a.to).toUpperCase(), duracionHoras:Math.round(horas * 10) / 10 });
  }

  items.filter(function (i) { return i && i.type === "stay"; }).forEach(function (s) {
    var noches = daysBetweenInclusive(s.start, s.end);
    out.push({
      tipo:"alojamiento", desde:s.start || "", hasta:s.end || "",
      noches:noches != null ? Math.max(0, noches - 1) : null,
      notas:sanitizeNotesForAI(s.notes)
    });
  });

  items.filter(function (i) { return i && i.type === "car"; }).forEach(function (c) {
    var dias = daysBetweenInclusive(c.start, c.end);
    out.push({ tipo:"auto", desde:c.start || "", hasta:c.end || "", dias:dias, notas:sanitizeNotesForAI(c.notes) });
  });

  items.filter(function (i) { return i && i.type === "act"; }).forEach(function (a) {
    out.push({
      tipo:"actividad", fecha:a.start || "",
      titulo:String(a.title || "").trim().slice(0, 80),
      notas:sanitizeNotesForAI(a.notes)
    });
  });

  return out;
}

/* ============================================================
   CAPA 2 · AJUSTE POR DESTINO CON IA  (VAL-33, ampliada en VAL-44 y VAL-43)
   El módulo no llama a claude.use. Recibe una función asíncrona
   `ask(prompt) -> objeto` y la app le pasa la implementación
   (en la app: sample.json). Así se prueba con node.
   ============================================================ */

/**
 * Arma el prompt de la capa de destino.
 * Lleva instrucción explícita de no inventar: antes una lista corta que un dato falso.
 * Desde VAL-44 incluye el resumen seguro de reservas (`list.base.reservas`,
 * armado por `summarizeReservationsForAI`), así el modelo puede razonar
 * sobre combinaciones puntuales del viaje y no sólo sobre el destino.
 * Desde VAL-43 también puede proponer sacar ítems que no apliquen.
 * @param {Object} list lista base ya generada
 * @returns {string}
 */
function destinationPrompt(list) {
  var b = (list && list.base) || {};
  var yaHay = itemsArray(list).map(function (i) { return i.nombre; }).join(", ");
  var tipo = TRIP_TYPE_LABEL[list.tipoViaje] || list.tipoViaje || "mixto";
  var reservas = b.reservas || [];
  var lineasReservas = reservas.length
    ? reservas.map(function (r) { return "  - " + JSON.stringify(r); }).join("\n")
    : "  (todavía no hay reservas cargadas)";

  // VAL-44: las notas del viaje son parte del contexto, no sólo las de cada
  // reserva. Ahí es donde la persona escribe la actividad que todavía no
  // reservó ("vamos a bucear dos días"), que es justo lo que ninguna regla
  // podía anticipar. Llegan ya saneadas desde `buildPackingList`; si la
  // lista viene de una versión anterior del motor, el bloque no se arma.
  var notasViaje = String(b.notasViaje || "").trim();
  var bloqueNotasViaje = notasViaje ? [
    "",
    "Notas del viaje (las escribió la persona en el viaje; mismo resumen seguro que las reservas):",
    "  " + notasViaje
  ] : [];

  return [
    "Sos parte de una app de viajes y ajustás una lista de equipaje al destino. Devolvés SOLO JSON.",
    "",
    "Viaje:",
    "- Destino: " + (b.destino || "sin especificar"),
    "- Fechas: " + (b.desde ? b.desde + " a " + (b.hasta || "sin regreso") : "sin fechas cargadas"),
    "- Duración: " + b.dias + " días" + (b.diasConocidos ? "" : " (estimados, el viaje no tiene fechas)"),
    "- Tipo de viaje: " + tipo,
    "- " + (b.internacional ? "Es un viaje internacional." : "Es un viaje dentro del país."),
    "",
    "Reservas del viaje (resumen seguro: nunca incluye código de reserva, teléfono ni dirección exacta):",
    lineasReservas
  ].concat(bloqueNotasViaje).concat([
    "",
    "La lista base ya incluye: " + (yaHay || "nada"),
    "",
    "Agregá hasta " + MAX_AI_ITEMS + " ítems que sean específicos de ESE destino en ESA época del año, o de",
    "una combinación puntual de ESTE viaje que ninguna regla genérica podría anticipar: una escala larga,",
    "un check-in de madrugada, un alojamiento sin lavandería en un viaje largo, una actividad que pide",
    "equipo propio. También sirve el tipo de enchufe del país, la amplitud térmica de la zona en ese mes,",
    "la temporada de lluvias, la altura, o un requisito de ingreso conocido. Ningún ítem que agregues puede",
    "estar ya en la lista base.",
    "",
    "Cuando el motivo venga de una reserva puntual o de las notas del viaje, citá el dato concreto: \"tu",
    "escala en Lima es de ocho horas\", no \"las escalas largas cansan\". Una generalidad sin el dato del",
    "viaje no sirve.",
    "",
    "También podés proponer SACAR ítems de \"La lista base ya incluye\" que no apliquen a este destino",
    "puntual (por ejemplo, no hace falta visa si el país no la pide). Usá el nombre EXACTO tal como aparece",
    "arriba. Nunca pongas documentación de identidad (DNI, pasaporte) en \"quitar\": no tiene ningún efecto,",
    "el sistema la conserva siempre pase lo que pase acá.",
    "",
    "Devolvé este JSON exacto:",
    '{"items":[{"nombre":"nombre corto del ítem","categoria":"documentacion|ropa|calzado|higiene|electronica|salud|destino","cantidad":numero o null,"motivo":"por qué, en una frase, mencionando el dato del destino o de la reserva"}],"quitar":[{"nombre":"nombre EXACTO tal como aparece en la lista base","motivo":"por qué no aplica a este destino puntual"}],"clima":"una frase sobre el clima esperado, o vacío"}',
    "",
    "Reglas que no se rompen:",
    "1. Si no estás seguro de un dato del destino o de la reserva, NO lo incluyas. Es preferible una lista más corta que un dato inventado.",
    "2. Nunca inventes tipos de enchufe, temperaturas, requisitos de visa, nombres de lugares ni precios. Si no lo sabés con certeza, omitilo.",
    '3. Si no tenés nada seguro para agregar ni para sacar, devolvé {"items":[],"quitar":[],"clima":""}.',
    "4. Cada ítem y cada sugerencia de \"quitar\" lleva su motivo. Sin motivo, no sirve: no lo incluyas.",
    "5. Nada de marcas, links ni recomendaciones de compra.",
    "6. Escribí en español rioplatense, de vos, en frases cortas.",
    "7. \"quitar\" nunca lleva documentación de identidad, aunque te parezca que sobra."
  ]).join("\n");
}

/**
 * Valida y normaliza lo que devolvió la IA. Descarta todo lo que no cumple.
 *
 * VAL-45: un ítem que la IA propone no entra si ya existe en la lista, ni
 * literal ni por sinónimo (`canonicalKey`) — así nunca se acredita a la IA
 * lo que una regla o el historial ya pusieron.
 *
 * VAL-43: `quitar` sólo puede apuntar a un ítem que existe en la lista, que
 * no sea propio de la persona (`origen:"manual"`, eso no lo toca nadie más
 * que ella) y que no esté marcado crítico (`isCriticalClave`) — el piso de
 * la documentación de identidad se hace cumplir acá, no sólo en el prompt.
 *
 * @param {Object|string} raw respuesta cruda
 * @param {Object} list lista base, para no duplicar ni resucitar lo suprimido
 * @returns {{items:Array, quitar:Array, clima:string}}
 */
function parseDestinationItems(raw, list) {
  var data = raw;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = null; } }
  if (!data || typeof data !== "object") return { items:[], quitar:[], clima:"" };

  var haveOriginal = indexItems(itemsArray(list));
  var haveCanonOriginal = {};
  Object.keys(haveOriginal).forEach(function (k) { haveCanonOriginal[canonicalKey(k)] = k; });

  var suprimidos = {};
  ((list && list.aprendizaje && list.aprendizaje.suprimidos) || []).forEach(function (e) { suprimidos[e.clave] = true; });

  // copia mutable: se va completando con lo que la propia IA agrega en esta
  // pasada, para que dos ítems de la misma respuesta tampoco se dupliquen entre sí
  var have = Object.assign({}, haveOriginal);
  var haveCanon = Object.assign({}, haveCanonOriginal);

  var items = [];
  if (Array.isArray(data.items)) {
    data.items.forEach(function (x) {
      if (items.length >= MAX_AI_ITEMS) return;
      if (!x || typeof x !== "object") return;
      var nombre = String(x.nombre || x.label || "").trim();
      var motivo = String(x.motivo || x.reason || "").trim();
      if (!nombre || !motivo) return;                 // sin motivo no entra: VAL-33 lo exige
      var clave = slug(nombre);
      if (!clave || suprimidos[clave]) return;
      var canon = canonicalKey(clave);
      if (have[clave] || haveCanon[canon]) return;     // VAL-45: ya está, literal o por sinónimo
      var categoria = CATEGORY_ORDER[x.categoria] !== undefined ? x.categoria : "destino";
      var cantidad = (typeof x.cantidad === "number" && isFinite(x.cantidad) && x.cantidad > 0) ? Math.round(x.cantidad) : null;
      have[clave] = true; haveCanon[canon] = clave;
      items.push({ clave:clave, nombre:nombre, categoria:categoria, cantidad:cantidad, motivo:motivo });
    });
  }

  var quitar = [];
  if (Array.isArray(data.quitar)) {
    var vistos = {};
    data.quitar.forEach(function (x) {
      if (!x || typeof x !== "object") return;
      var nombre = String(x.nombre || x.clave || x.label || "").trim();
      var motivo = String(x.motivo || x.reason || "").trim();
      if (!nombre || !motivo) return;
      var clave = slug(nombre);
      if (!clave) return;
      var target = haveOriginal[clave] ? clave : haveCanonOriginal[canonicalKey(clave)];
      if (!target || vistos[target]) return;
      if (isCriticalClave(target)) return;                          // VAL-43: piso que no se toca, en código
      var actual = haveOriginal[target];
      if (!actual || actual.origen === ORIGEN.MANUAL || actual.estado === ESTADO.DESCARTADO) return;
      vistos[target] = true;
      quitar.push({ clave:target, motivo:motivo });
    });
  }

  return { items:items, quitar:quitar, clima:typeof data.clima === "string" ? data.clima.trim() : "" };
}

/**
 * CAPA 2. Nunca lanza: si la IA falla, devuelve la lista base con el aviso puesto.
 *
 * Además de agregar ítems (VAL-33/VAL-44), puede sugerir sacarlos (VAL-43):
 * no los elimina ni los descarta sola — nada se guarda sin revisar — deja la
 * propuesta en `item.sugerenciaQuitar:{motivo,en}` para que la persona decida.
 * Aceptarla es un `dismissItem` común; rechazarla, `clearRemovalSuggestion`.
 *
 * @param {Object} list lista base
 * @param {Function} ask función asíncrona (prompt) => objeto o string JSON
 * @param {Object} [opts] {now}
 * @returns {Promise<Object>} lista, ajustada o no
 */
function enrichWithDestination(list, ask, opts) {
  opts = opts || {};
  var at = opts.now || nowISO();

  function conCapa(estado, nota, extra) {
    var avisos = (list.avisos || []).filter(function (w) { return w.codigo !== "ia-no-disponible" && w.codigo !== "ia-fallo"; });
    if (estado === "no-disponible") avisos = avisos.concat([{ codigo:"ia-no-disponible",
      texto:"Falta el ajuste por destino: la lista es la base de reglas. Igual sirve." }]);
    if (estado === "error") avisos = avisos.concat([{ codigo:"ia-fallo",
      texto:"No pude ajustar la lista al destino. Te muestro la lista base, que ya cubre lo esencial." }]);
    var previaClima = (list.capaInteligente && list.capaInteligente.clima) || "";
    return Object.assign({}, list, extra || {}, {
      capaInteligente:{ estado:estado, en:at, nota:nota || "",
                        clima:(extra && extra.clima != null) ? extra.clima : previaClima },
      avisos:avisos
    });
  }

  if (typeof ask !== "function") {
    return Promise.resolve(conCapa("no-disponible", "La app no pasó una función para consultar al modelo."));
  }

  return Promise.resolve()
    .then(function () { return ask(destinationPrompt(list), { list:list, base:list.base }); })
    .then(function (raw) {
      var parsed = parseDestinationItems(raw, list);
      if (!parsed.items.length && !parsed.quitar.length) {
        return conCapa("vacio", "El modelo no encontró ajustes específicos para este destino.",
                       parsed.clima ? { clima:parsed.clima } : null);
      }
      var items = Object.assign({}, list.items);
      parsed.items.forEach(function (x, i) {
        items[x.clave] = makeItem({
          clave:x.clave, nombre:x.nombre, categoria:x.categoria, cantidad:x.cantidad,
          motivo:x.motivo, origen:ORIGEN.DESTINO, regla:"destino",
          orden:orderOf(x.categoria, 800 + i)
        }, at);
      });
      parsed.quitar.forEach(function (q) {
        var actual = items[q.clave];
        if (!actual) return;
        items[q.clave] = Object.assign({}, actual, { sugerenciaQuitar:{ motivo:q.motivo, en:at } });
      });

      var notaPartes = [];
      if (parsed.items.length) notaPartes.push(parsed.items.length + (parsed.items.length === 1 ? " ítem agregado" : " ítems agregados"));
      if (parsed.quitar.length) notaPartes.push(parsed.quitar.length + (parsed.quitar.length === 1 ? " sugerencia para sacar" : " sugerencias para sacar"));

      var out = conCapa("ok", "Ajustada al destino: " + notaPartes.join(", ") + ".",
        { items:items, clima:parsed.clima || "" });
      out.conteo = packingProgress(out);
      return out;
    })
    .catch(function (e) {
      return conCapa("error", (e && e.message) ? String(e.message) : "Error desconocido.");
    });
}

/**
 * VAL-43: la persona rechaza la sugerencia de sacar un ítem. El ítem sigue
 * en la lista, tal como estaba; sólo se borra la propuesta para que la
 * interfaz deje de mostrarla. Aceptarla, en cambio, es un `dismissItem`
 * común — no hace falta una función especial para eso.
 * @param {Object} list
 * @param {string} clave
 * @returns {Object} lista nueva
 */
function clearRemovalSuggestion(list, clave) {
  return replaceItem(list, clave, function (i) {
    if (!i.sugerenciaQuitar) return i;
    var out = Object.assign({}, i);
    delete out.sugerenciaQuitar;
    return out;
  });
}

/* ============================================================
   ENTRADA PRINCIPAL — las tres capas
   ============================================================ */

/**
 * Genera la lista completa. Nunca lanza por culpa de la IA.
 *
 * @param {Object}   input
 * @param {Object}   input.trip        viaje
 * @param {Array}    [input.items]     reservas del viaje
 * @param {string}   [input.tipoViaje] tipo elegido; si falta se sugiere
 * @param {Array}    [input.history]   listas de viajes anteriores
 * @param {Object}   [input.previous]  lista guardada de este viaje (regeneración)
 * @param {Function} [input.ask]       async (prompt) => objeto; en la app, sample.json
 * @param {string}   [input.now]       timestamp ISO fijo, para pruebas
 * @returns {Promise<Object>} documento de lista listo para guardar
 */
function generatePackingList(input) {
  input = input || {};
  var base = buildPackingList(Object.assign({}, input, { previous:null }));
  if (typeof input.ask !== "function") {
    return Promise.resolve(input.previous ? mergeLists(input.previous, base) : base);
  }
  return enrichWithDestination(base, input.ask, { now:input.now }).then(function (enriched) {
    return input.previous ? mergeLists(input.previous, enriched) : enriched;
  });
}

/* ============================================================
   ESTADO DE LOS ÍTEMS — VAL-31
   Puras: devuelven una lista nueva, no tocan la que reciben.
   ============================================================ */

function replaceItem(list, clave, fn) {
  var actual = (list.items || {})[clave];
  if (!actual) return list;
  var items = Object.assign({}, list.items);
  items[clave] = fn(actual);
  var out = Object.assign({}, list, { items:items, actualizadaEn:nowISO() });
  out.conteo = packingProgress(out);
  return out;
}

/**
 * Cambia el estado de un ítem. Tres estados: pendiente, empacado, descartado.
 * `empacadoEn` se sella al pasar a empacado y se limpia al salir, para que
 * analítica no lea como empacado algo que la persona después desmarcó.
 *
 * @param {Object} list
 * @param {string} clave clave normalizada del ítem
 * @param {string} estado uno de ESTADO
 * @param {Object} [opts] {now}
 * @returns {Object} lista nueva
 */
function setItemState(list, clave, estado, opts) {
  opts = opts || {};
  if (ESTADOS.indexOf(estado) < 0) return list;
  var at = opts.now || nowISO();
  return replaceItem(list, clave, function (i) {
    return Object.assign({}, i, {
      estado:estado,
      empacadoEn:estado === ESTADO.EMPACADO ? (i.empacadoEn || at) : null,
      actualizadoEn:at
    });
  });
}

/** Azúcar sobre setItemState. */
function packItem(list, clave, opts)    { return setItemState(list, clave, ESTADO.EMPACADO, opts); }
function dismissItem(list, clave, opts) { return setItemState(list, clave, ESTADO.DESCARTADO, opts); }
function resetItem(list, clave, opts)   { return setItemState(list, clave, ESTADO.PENDIENTE, opts); }

/**
 * El parche parcial para marcar UN ítem en la base sin reescribir la lista.
 * La base hace merge recursivo de objetos, así que esto toca sólo esa rama:
 *
 *   db.doc(`trips/${tripId}/packing/lista`).update(stateUpdatePatch(clave, "empacado"))
 *
 * @param {string} clave
 * @param {string} estado uno de ESTADO
 * @param {Object} [opts] {now}
 * @returns {Object|null} objeto para pasarle a update(), o null si el estado no existe
 */
function stateUpdatePatch(clave, estado, opts) {
  opts = opts || {};
  if (!clave || ESTADOS.indexOf(estado) < 0) return null;
  var at = opts.now || nowISO();
  var parche = { estado:estado, empacadoEn:estado === ESTADO.EMPACADO ? at : null, actualizadoEn:at };
  var items = {}; items[clave] = parche;
  return { items:items, actualizadaEn:at };
}

/** Corrige la cantidad a mano. Queda marcada para que regenerar no la pise. */
function setQty(list, clave, cantidad, opts) {
  opts = opts || {};
  var at = opts.now || nowISO();
  return replaceItem(list, clave, function (i) {
    return Object.assign({}, i, { cantidad:cantidad, cantidadEditada:true,
                                  motivo:"Lo ajustaste vos.", actualizadoEn:at });
  });
}

/**
 * Agrega un ítem propio. Es lo que después aprende el historial.
 * Si el ítem ya existía, no lo duplica: lo vuelve a pendiente y NO le cambia
 * el origen, porque la precedencia dice que gana la capa más básica.
 * VAL-45: "ya existía" incluye un sinónimo declarado (`canonicalKey`), no
 * sólo el mismo texto — así tampoco se duplica a mano lo que ya puso otra capa.
 * @returns {Object} lista nueva
 */
function addManualItem(list, fields, opts) {
  fields = fields || {}; opts = opts || {};
  var at = opts.now || nowISO();
  var nombre = String(fields.nombre || fields.label || "").trim();
  if (!nombre) return list;
  var clave = slug(nombre);
  if (!clave) return list;
  var existente = (list.items || {})[clave] ? clave : findCanonicalMatch(list.items, clave);
  if (existente) return setItemState(list, existente, ESTADO.PENDIENTE, { now:at });

  var categoria = CATEGORY_ORDER[fields.categoria] !== undefined ? fields.categoria : "otros";
  var it = makeItem({
    clave:clave, nombre:nombre, categoria:categoria,
    cantidad:typeof fields.cantidad === "number" ? fields.cantidad : null,
    motivo:fields.motivo || "Lo agregaste vos.",
    origen:ORIGEN.MANUAL, regla:"", orden:orderOf(categoria, 950)
  }, at);

  var items = Object.assign({}, list.items);
  items[clave] = it;
  var out = Object.assign({}, list, { items:items, actualizadaEn:at });
  out.conteo = packingProgress(out);
  return out;
}

/** Borra un ítem. Sólo los propios: los sugeridos se descartan, no se borran. */
function removeManualItem(list, clave) {
  var actual = (list.items || {})[clave];
  if (!actual || actual.origen !== ORIGEN.MANUAL) return list;
  var items = Object.assign({}, list.items);
  delete items[clave];
  var out = Object.assign({}, list, { items:items, actualizadaEn:nowISO() });
  out.conteo = packingProgress(out);
  return out;
}

/**
 * Agrupa para mostrar. Devuelve sólo las categorías con ítems.
 * @returns {Array<{key:string,label:string,items:Array}>}
 */
function groupByCategory(list, opts) {
  var todos = itemList(list, opts);
  return CATEGORIES.map(function (c) {
    return { key:c.key, label:c.label,
             items:todos.filter(function (i) { return i.categoria === c.key; }) };
  }).filter(function (g) { return g.items.length; });
}

/* ============================================================
   VAL-46 · LA LISTA SE ACTUALIZA CUANDO EL VIAJE CRECE
   No escribe nada sola: `planListUpdate` sólo dice qué cambió y por
   qué, y la app decide cuándo ofrecerlo. Lo empacado sigue empacado,
   lo descartado nunca vuelve (las mismas garantías de `mergeLists`,
   que es lo que arma el plan por dentro) y cada ítem nuevo declara
   qué reserva lo motivó.
   ============================================================ */

/** Para cada hecho de FACTS, la reserva puntual que lo hizo verdadero
 *  (la primera que matchea), para poder citarla al explicar un ítem nuevo. */
function findFactSource(name, ctx) {
  var items = (ctx && ctx.items) || [];
  function texto(i) { return norm([i && i.title, i && i.notes, i && i.provider].filter(Boolean).join(" ")); }
  switch (name) {
    case "hasFlight":        return items.filter(function (i) { return i && i.type === "flight"; })[0] || null;
    case "hasRentalCar":     return items.filter(function (i) { return i && i.type === "car"; })[0] || null;
    case "hasStay":          return items.filter(function (i) { return i && i.type === "stay"; })[0] || null;
    case "hasInternationalFlight":
      return ctx.international ? (items.filter(function (i) { return i && i.type === "flight"; })[0] || null) : null;
    case "hasTrekking":      return items.filter(function (i) { return i && TREK_RE.test(texto(i)); })[0] || null;
    case "hasWaterActivity": return items.filter(function (i) { return i && WATER_RE.test(texto(i)); })[0] || null;
    case "hasWorkActivity":  return items.filter(function (i) { return i && WORK_RE.test(texto(i)); })[0] || null;
    case "hasSnow":          return items.filter(function (i) { return i && SNOW_RE.test(texto(i)); })[0] || null;
    default: return null;
  }
}

/** Recorre una condición declarativa y junta los nombres de hechos que pide en positivo
 *  (`facts`, `anyFacts`). `notFacts` queda afuera a propósito: la ausencia de un hecho
 *  no es una reserva que "motive" nada. */
function collectFactNames(cond) {
  var out = [];
  (function walk(c) {
    if (c == null || typeof c === "function") return;
    if (Array.isArray(c)) { c.forEach(walk); return; }
    if (c.facts) out.push.apply(out, c.facts);
    if (c.anyFacts) out.push.apply(out, c.anyFacts);
    if (c.all) c.all.forEach(walk);
    if (c.any) c.any.forEach(walk);
  })(cond);
  return out;
}

/**
 * Describe una reserva en un texto corto para citarla como motivo de un
 * ítem nuevo. Esto no sale nunca hacia la capa de IA (esa restricción es de
 * `summarizeReservationsForAI`); es sólo para que la persona entienda por
 * qué apareció el ítem, así que puede usar cualquier dato de la reserva.
 * @param {Object} it
 * @returns {string|null}
 */
function describeReservation(it) {
  if (!it) return null;
  var LABEL = { flight:"el vuelo", stay:"el alojamiento", car:"el auto", act:"la actividad" };
  var base = LABEL[it.type] || "la reserva";
  if (it.type === "flight" && (it.from || it.to)) base += " " + [it.from, it.to].filter(Boolean).join(" – ");
  else if (it.type === "act" && it.title) base += " \"" + String(it.title).trim() + "\"";
  else if ((it.type === "stay" || it.type === "car") && it.provider) base += " (" + String(it.provider).trim() + ")";
  return base;
}

/**
 * Por qué apareció un ítem nuevo, citando la reserva puntual si se puede
 * rastrear una regla-hecho-reserva; si no, el motivo genérico de la regla.
 * @param {Object} it   ítem nuevo, ya armado
 * @param {Object} ctx  contexto del viaje (de tripContext)
 * @returns {{texto:string, reserva:string|null}}
 */
function explainNewItem(it, ctx) {
  if (it.origen === ORIGEN.HISTORIAL) return { texto:it.motivo, reserva:null };
  var rule = BASE_RULES.filter(function (r) { return r.id === it.regla; })[0];
  if (rule && rule.when) {
    var nombres = collectFactNames(rule.when);
    for (var i = 0; i < nombres.length; i++) {
      var src = findFactSource(nombres[i], ctx);
      if (src) return { texto:it.motivo, reserva:describeReservation(src) };
    }
  }
  return { texto:it.motivo, reserva:null };
}

/**
 * VAL-46: compara la lista ya guardada contra las reservas ACTUALES del
 * viaje (capas 1 + 3, sin IA — sincrónica a propósito) y arma el plan de
 * qué cambió. No toca `list`: devuelve un plan que la app ofrece aplicar.
 *
 * Garantías, iguales a las de `mergeLists` porque se apoya en ella:
 *   - lo empacado sigue empacado, lo descartado sigue descartado,
 *   - un ítem descartado nunca vuelve, aunque el viaje crezca,
 *   - cada ítem nuevo queda marcado `nuevo:true` y dice qué reserva lo motivó.
 *
 * @param {Object}  input
 * @param {Object}  input.list        lista ya guardada
 * @param {Object}  input.trip
 * @param {Array}   [input.items]     reservas ACTUALES del viaje
 * @param {string}  [input.tipoViaje]
 * @param {Array}   [input.history]
 * @param {string}  [input.now]
 * @returns {{desactualizada:boolean, nuevos:Array, motivo:string, listaPropuesta:Object|null}}
 */
function planListUpdate(input) {
  input = input || {};
  var list = input.list;
  if (!list) return { desactualizada:false, nuevos:[], motivo:"No hay una lista previa para comparar.", listaPropuesta:null };

  var at = input.now || nowISO();
  var trip = input.trip || {};
  var items = input.items || [];
  var freshBase = buildPackingList({
    trip:trip, items:items, tipoViaje:input.tipoViaje, history:input.history, now:at
  });
  var merged = mergeLists(list, freshBase);
  var ctx = tripContext(trip, items, { tipoViaje:input.tipoViaje });

  var yaHabia = {};
  itemsArray(list).forEach(function (i) { if (i && i.clave) yaHabia[canonicalKey(i.clave)] = true; });

  var nuevos = [];
  var itemsConFlag = Object.assign({}, merged.items);
  itemsArray(merged).forEach(function (it) {
    if (yaHabia[canonicalKey(it.clave)]) return;         // ya estaba, activo o descartado: no es nuevo
    var explicacion = explainNewItem(it, ctx);
    itemsConFlag[it.clave] = Object.assign({}, it, { nuevo:true });
    nuevos.push({
      clave:it.clave, nombre:it.nombre, categoria:it.categoria,
      motivo:explicacion.texto, reserva:explicacion.reserva, origen:it.origen
    });
  });

  var desactualizada = nuevos.length > 0;
  var listaPropuesta = Object.assign({}, merged, { items:itemsConFlag });

  return {
    desactualizada:desactualizada,
    nuevos:nuevos,
    motivo:desactualizada
      ? (nuevos.length === 1 ? "Hay 1 ítem nuevo por lo que cargaste." : "Hay " + nuevos.length + " ítems nuevos por lo que cargaste.")
      : "La lista sigue al día con lo que cargaste.",
    listaPropuesta:listaPropuesta
  };
}

/**
 * Igual que `planListUpdate`, pero además corre la capa de IA (VAL-44) sobre
 * la lista propuesta, así los ítems nuevos por combinaciones puntuales del
 * viaje (una escala que recién apareció, un alojamiento sin lavandería)
 * también entran en el plan. Nunca lanza por culpa de la IA: si `ask` falla
 * o no está, el plan sale igual con capas 1 + 3.
 * @param {Object} input mismos campos que planListUpdate, más `ask`
 * @returns {Promise<Object>} mismo shape que planListUpdate
 */
function planListUpdateAsync(input) {
  input = input || {};
  var base = planListUpdate(input);
  if (!base.listaPropuesta || typeof input.ask !== "function") return Promise.resolve(base);

  return enrichWithDestination(base.listaPropuesta, input.ask, { now:input.now }).then(function (enriched) {
    var yaHabia = {};
    itemsArray(base.listaPropuesta).forEach(function (i) { if (i && i.clave) yaHabia[canonicalKey(i.clave)] = true; });

    var nuevosIA = [];
    var itemsConFlag = Object.assign({}, enriched.items);
    itemsArray(enriched).forEach(function (it) {
      if (it.origen !== ORIGEN.DESTINO) return;
      if (yaHabia[canonicalKey(it.clave)]) return;
      itemsConFlag[it.clave] = Object.assign({}, it, { nuevo:true });
      nuevosIA.push({ clave:it.clave, nombre:it.nombre, categoria:it.categoria, motivo:it.motivo, reserva:null, origen:it.origen });
    });

    var nuevos = base.nuevos.concat(nuevosIA);
    var desactualizada = nuevos.length > 0;
    return {
      desactualizada:desactualizada,
      nuevos:nuevos,
      motivo:desactualizada
        ? (nuevos.length === 1 ? "Hay 1 ítem nuevo por lo que cargaste." : "Hay " + nuevos.length + " ítems nuevos por lo que cargaste.")
        : "La lista sigue al día con lo que cargaste.",
      listaPropuesta:Object.assign({}, enriched, { items:itemsConFlag })
    };
  });
}

/**
 * Saca el flag `nuevo` de todos los ítems: la persona ya vio la actualización.
 * Se llama después de mostrar la lista propuesta de `planListUpdate`, cuando
 * la persona la revisó (no antes: "nada se guarda sin revisar").
 * @param {Object} list
 * @returns {Object} lista nueva
 */
function clearNewFlags(list) {
  if (!list) return list;
  var cambio = false;
  var items = {};
  Object.keys(list.items || {}).forEach(function (k) {
    var it = list.items[k];
    if (it && it.nuevo) {
      cambio = true;
      var copia = Object.assign({}, it);
      delete copia.nuevo;
      items[k] = copia;
    } else {
      items[k] = it;
    }
  });
  return cambio ? Object.assign({}, list, { items:items }) : list;
}

/* ============================================================
   EXPORTA
   ============================================================ */
return {
  // catálogos y constantes
  VERSION:VERSION, DEFAULT_DAYS:DEFAULT_DAYS,
  ESTADO:ESTADO, ESTADOS:ESTADOS, ORIGEN:ORIGEN, ORIGEN_PRECEDENCIA:ORIGEN_PRECEDENCIA,
  HISTORY_PROMOTE_AT:HISTORY_PROMOTE_AT, HISTORY_SUPPRESS_AT:HISTORY_SUPPRESS_AT,
  MAX_AI_ITEMS:MAX_AI_ITEMS,
  CATEGORIES:CATEGORIES, TRIP_TYPES:TRIP_TYPES, BASE_RULES:BASE_RULES, FACTS:FACTS,
  AR_IATA:AR_IATA, AR_HINTS:AR_HINTS, FOREIGN_HINTS:FOREIGN_HINTS, TYPE_HINTS:TYPE_HINTS,
  SYNONYM_GROUPS:SYNONYM_GROUPS, CRITICAL_CLAVES:CRITICAL_CLAVES,

  // motor
  generatePackingList:generatePackingList,
  buildPackingList:buildPackingList,
  enrichWithDestination:enrichWithDestination,
  mergeLists:mergeLists,
  learnFromHistory:learnFromHistory,
  suggestTripType:suggestTripType,
  tripContext:tripContext,
  deduceInternational:deduceInternational,

  // capa de IA, expuesta para poder probarla suelta (VAL-33, VAL-44, VAL-43)
  destinationPrompt:destinationPrompt,
  parseDestinationItems:parseDestinationItems,
  summarizeReservationsForAI:summarizeReservationsForAI,
  sanitizeNotesForAI:sanitizeNotesForAI,
  clearRemovalSuggestion:clearRemovalSuggestion,

  // VAL-46: la lista se actualiza cuando el viaje crece
  planListUpdate:planListUpdate,
  planListUpdateAsync:planListUpdateAsync,
  clearNewFlags:clearNewFlags,

  // estado de la lista (VAL-31)
  setItemState:setItemState, packItem:packItem, dismissItem:dismissItem, resetItem:resetItem,
  stateUpdatePatch:stateUpdatePatch, setQty:setQty,
  addManualItem:addManualItem, removeManualItem:removeManualItem,
  packingProgress:packingProgress, itemList:itemList, groupByCategory:groupByCategory,

  // utilidades y control de calidad
  slug:slug, normalizeTripType:normalizeTripType, daysBetweenInclusive:daysBetweenInclusive,
  matchesCondition:matchesCondition, computeQty:computeQty, validateRules:validateRules,
  lowestOrigin:lowestOrigin, itemsArray:itemsArray,
  canonicalKey:canonicalKey, findCanonicalMatch:findCanonicalMatch,
  verifyNoDuplicateItems:verifyNoDuplicateItems, isCriticalClave:isCriticalClave
};
});
