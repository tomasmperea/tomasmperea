/* ============================================================
   LAS DOS COPIAS DEL MOTOR DICEN LO MISMO

   `app/parts/packing-engine.js` y `app/parts/adjuntos-engine.js` viven
   también embebidos dentro de `app/valija.html`, sin el envoltorio UMD.
   Desde VAL-87 también `aeropuertos-dato.js` y `aeropuertos-motor.js`,
   pegados tal cual entre dos marcas (ver el final de este archivo).
   La app corre la copia del HTML; las pruebas de `parts/` corren la otra.
   Entre las dos hay un paso a mano, y ese paso ya se quedó corto una vez.

   `motores-desde-html.js` cubre el comportamiento: corre las pruebas
   contra la copia del HTML. Esto cubre el TEXTO, que es distinto: una
   función puede comportarse igual en las pruebas que hay y haber quedado
   atrás en una rama que ninguna prueba toca todavía.

   POR QUÉ ESTE ARCHIVO EXISTE Y NO ES UN SCRIPT SUELTO: la versión de
   scratchpad de esta comparación buscaba los motores por número de línea.
   Al tercer parche los números quedaron viejos y reportó dos funciones
   distintas que eran idénticas. Estuve a un paso de anotarlo como
   hallazgo. Acá los límites se buscan por texto.

       node app/pruebas/las-dos-copias.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const fs = require("fs"), path = require("path");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");
const PARTS = path.resolve(__dirname, "..", "parts");

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

const html = fs.readFileSync(APP, "utf8");

function region(abre) {
  const i = html.indexOf(abre);
  if (i < 0) throw new Error("no encontré en el HTML: " + abre);
  const j = html.indexOf("\n})();", i);
  if (j < 0) throw new Error("no encontré el cierre de: " + abre);
  return html.slice(i + abre.length, j);
}

const limpiar = s => s.split("\n").map(l => l.replace(/\s+$/, "")).filter(l => l.trim() !== "").join("\n");

function funciones(src) {
  const out = {}, re = /^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm, marcas = [];
  let m;
  while ((m = re.exec(src))) marcas.push({ n:m[1], i:m.index });
  marcas.forEach((mk, k) => {
    out[mk.n] = limpiar(src.slice(mk.i, k + 1 < marcas.length ? marcas[k + 1].i : src.length));
  });
  return out;
}

/* La ÚLTIMA función de cada archivo absorbe lo que viene después de ella:
   en `parts/` eso es el cierre del UMD y, en adjuntos, una nota de
   integración que en el HTML no tiene sentido. No se pone en una lista de
   excepciones —eso taparía una diferencia real—: se exige que el texto del
   HTML sea un PREFIJO del de `parts/`, o sea que la función es la misma y
   lo único que sobra está al final. */
const MOTORES = [
  { archivo:"packing-engine.js",  abre:"const PackingEngine = (function () {" },
  { archivo:"adjuntos-engine.js", abre:"const AdjuntosEngine = (function () {" }
];

/* El archivo de `parts/` arranca con el envoltorio UMD, que existe sólo para
   poder correrlo con node y que al HTML no va. Lo que se compara es el CUERPO
   del módulo: de la apertura de la fábrica para abajo. Si el marcador no está
   —porque alguien cambió el envoltorio— esto revienta en vez de comparar el
   archivo entero y llenarse de diferencias falsas. */
const APERTURA = "this, function () {";
function cuerpoDelModulo(src, archivo) {
  const i = src.indexOf(APERTURA);
  if (i < 0) throw new Error("no encontré la apertura del UMD en " + archivo);
  return src.slice(src.indexOf("\n", i) + 1);
}

/* Todo lo que hay ANTES de la primera función —las constantes, los catálogos,
   los topes y los comentarios que explican por qué valen lo que valen— no lo
   veía la primera versión de este arnés: alguien podía cambiar
   `TOPE_LISTA_BYTES` en una sola copia y esto decía "verde".

   La SEGUNDA versión comparaba sólo las líneas que declaran algo, y el
   comentario decía "un bloque contra otro", que era más de lo que hacía. La
   auditoría lo falsificó con dos sabotajes que pasaban en verde: cambiar un
   número adentro de un comentario, y dar vuelta el orden de dos constantes.

   Ahora sí es un bloque contra otro: el texto entero de la cabecera,
   normalizando espacios al final de línea y líneas vacías, que es lo único
   que difiere a propósito entre un archivo suelto y uno embebido. */
function cabecera(src) {
  const m = /^\s*function\s+[A-Za-z0-9_$]+\s*\(/m.exec(src);
  return limpiar(m ? src.slice(0, m.index) : src);
}

MOTORES.forEach(function (mot) {
  console.log("\n· " + mot.archivo + " contra su copia en el HTML");
  const crudoHtml  = region(mot.abre);
  const crudoParts = cuerpoDelModulo(fs.readFileSync(path.join(PARTS, mot.archivo), "utf8"), mot.archivo);
  const enHtml  = funciones(crudoHtml);
  const enParts = funciones(crudoParts);

  const cabHtml = cabecera(crudoHtml), cabParts = cabecera(crudoParts);
  info(`cabecera: ${cabParts.split("\n").length} líneas en parts, ${cabHtml.split("\n").length} en el HTML`);
  ok(cabParts.length > 0, "hay cabecera que comparar antes de la primera función");
  if (cabHtml === cabParts) {
    ok(true, "la cabecera entera es idéntica: constantes, catálogos y comentarios");
  } else {
    const A = cabParts.split("\n"), B = cabHtml.split("\n");
    let k = 0;
    while (k < Math.max(A.length, B.length) && A[k] === B[k]) k++;
    ok(false, `la cabecera DIVERGE en la línea ${k + 1}`);
    console.log("     parts: " + (A[k] === undefined ? "(nada)" : A[k]));
    console.log("     html : " + (B[k] === undefined ? "(nada)" : B[k]));
  }

  const nombresParts = Object.keys(enParts);
  const nombresHtml  = Object.keys(enHtml);
  ok(nombresParts.length > 0, `el archivo de parts tiene funciones que comparar (${nombresParts.length})`);

  const faltan = nombresParts.filter(n => !(n in enHtml));
  ok(faltan.length === 0, faltan.length ? `FALTAN en el HTML: ${faltan.join(", ")}` : "ninguna función falta en el HTML");

  const sobran = nombresHtml.filter(n => !(n in enParts));
  ok(sobran.length === 0, sobran.length ? `sólo en el HTML: ${sobran.join(", ")}` : "el HTML no tiene funciones de más");

  const distintas = nombresParts.filter(n => n in enHtml && enHtml[n] !== enParts[n]);
  const soloCola  = distintas.filter(n => enParts[n].startsWith(enHtml[n]));
  const de_verdad = distintas.filter(n => !enParts[n].startsWith(enHtml[n]));

  info(`${nombresParts.length - distintas.length} idénticas · ${soloCola.length} con cola de más en parts · ${de_verdad.length} realmente distintas`);
  if (soloCola.length) info("cola de más (el cierre del UMD y notas que no van al HTML): " + soloCola.join(", "));
  ok(de_verdad.length === 0,
     de_verdad.length ? `DIVERGEN: ${de_verdad.join(", ")}` : "ninguna función divergió: las dos copias dicen lo mismo");

  de_verdad.forEach(function (n) {
    const a = enParts[n].split("\n"), b = enHtml[n].split("\n");
    console.log("    --- " + n + " ---");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.log("     parts: " + (a[i] === undefined ? "(nada)" : a[i]));
        console.log("     html : " + (b[i] === undefined ? "(nada)" : b[i]));
      }
    }
  });
});

/* EL CONTROL: si este arnés no pudiera ver una diferencia, todo lo de
   arriba pasaría por vacío. Se le mete un cambio a mano a una copia y se
   comprueba que lo detecta. */
console.log("\n· el control de la cabecera: los tres sabotajes que la auditoría usó");
(function () {
  const crudo = cuerpoDelModulo(fs.readFileSync(path.join(PARTS, MOTORES[0].archivo), "utf8"), MOTORES[0].archivo);
  const cab = cabecera(crudo);
  ok(cab.length > 0, "hay cabecera sobre la que probar el control");

  // 1 · un tope cambiado — lo único que la versión anterior detectaba.
  ok(cabecera(crudo.replace("262144", "999999")) !== cab, "un tope cambiado se ve");

  // 2 · un número adentro de un comentario — pasaba en verde antes.
  const conComentario = cab.replace(/(\/\*|\/\/)/, "$1 nota colada:");
  ok(conComentario !== cab, "el sabotaje del comentario se aplicó");
  ok(limpiar(conComentario) !== limpiar(cab), "un comentario cambiado se ve");

  // 3 · dos constantes dadas vuelta — también pasaba en verde antes.
  const lineas = cab.split("\n");
  const idx = lineas.map((l, k) => /^\s*var\s+MAX_/.test(l) ? k : -1).filter(k => k >= 0);
  ok(idx.length >= 2, `hay al menos dos constantes para intercambiar (${idx.length})`);
  const vuelta = lineas.slice();
  const t = vuelta[idx[0]]; vuelta[idx[0]] = vuelta[idx[1]]; vuelta[idx[1]] = t;
  ok(limpiar(vuelta.join("\n")) !== limpiar(cab), "dos constantes dadas vuelta se ven");
})();

console.log("\n· el control: el arnés detecta una diferencia metida a mano");
(function () {
  const real = funciones(region(MOTORES[0].abre));
  const nombre = Object.keys(real)[0];
  const saboteada = Object.assign({}, real);
  saboteada[nombre] = real[nombre].replace(/^/, "  var colado = 1;\n");
  ok(saboteada[nombre] !== real[nombre], `el sabotaje se aplicó sobre «${nombre}»`);
  ok(!real[nombre].startsWith(saboteada[nombre]),
     "y la comparación que usa el arnés lo ve como divergencia, no como cola de más");
})();

/* ============================================================
   VAL-87 · EL DATO Y EL MOTOR DE AEROPUERTOS

   Éstos no tienen envoltorio UMD ni IIFE: son dos archivos de JavaScript
   plano que la app lleva pegados TAL CUAL, entre dos marcas de texto. Así
   que acá no hace falta comparar función por función: se exige que lo que
   hay entre las marcas sea el archivo de `parts/` byte por byte. Es la
   comparación más dura posible y la más simple de leer.

   Las marcas se buscan por su texto exacto y cada una tiene que aparecer
   UNA vez: dos copias pegadas serían dos verdades, y la segunda pisaría a
   la primera sin que nadie lo vea.
   ============================================================ */
const COPIAS = ["aeropuertos-dato.js", "aeropuertos-motor.js"];
const abreCopia  = a => "/* >>> COPIA DE app/parts/" + a + " >>> */\n";
const cierraCopia = a => "/* <<< FIN DE LA COPIA DE app/parts/" + a + " <<< */";
function copiaEmbebida(fuente, archivo) {
  const abre = abreCopia(archivo), cierra = cierraCopia(archivo);
  const veces = s => fuente.split(s).length - 1;
  if (veces(abre) !== 1) throw new Error(`la marca de apertura de ${archivo} aparece ${veces(abre)} veces en el HTML`);
  if (veces(cierra) !== 1) throw new Error(`la marca de cierre de ${archivo} aparece ${veces(cierra)} veces en el HTML`);
  const i = fuente.indexOf(abre) + abre.length, j = fuente.indexOf(cierra);
  if (j < i) throw new Error(`la marca de cierre de ${archivo} está antes que la de apertura`);
  return fuente.slice(i, j);
}
/** Dónde difieren dos textos, para que una falla diga algo útil. */
function primeraDiferencia(a, b) {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  return { k, parts: JSON.stringify(a.slice(Math.max(0, k - 30), k + 30)), html: JSON.stringify(b.slice(Math.max(0, k - 30), k + 30)) };
}

COPIAS.forEach(function (archivo) {
  console.log("\n· " + archivo + " contra su copia en el HTML (byte por byte)");
  const enParts = fs.readFileSync(path.join(PARTS, archivo), "utf8");
  let enHtml = null;
  try { enHtml = copiaEmbebida(html, archivo); ok(true, "las dos marcas están, una vez cada una"); }
  catch (e) { ok(false, e.message); return; }
  info(`${enParts.length} caracteres en parts, ${enHtml.length} en el HTML`);
  ok(enParts.length > 1000, "el archivo de parts tiene contenido que comparar");
  if (enHtml === enParts) ok(true, "la copia del HTML es idéntica al archivo de parts");
  else {
    const d = primeraDiferencia(enParts, enHtml);
    ok(false, `la copia DIVERGE en el carácter ${d.k}`);
    console.log("     parts: " + d.parts);
    console.log("     html : " + d.html);
  }
});

/* EL CONTROL de la copia de aeropuertos. Tres sabotajes, y cada uno asevera
   primero que se APLICÓ: un sabotaje que no llega deja todo en verde y
   parece que el arnés funciona. */
console.log("\n· el control de las copias de aeropuertos: el arnés ve lo que se le mete a mano");
(function () {
  const dato = copiaEmbebida(html, COPIAS[0]);
  const parts = fs.readFileSync(path.join(PARTS, COPIAS[0]), "utf8");

  // 1 · una letra cambiada adentro del renglón de 150 KB del dato.
  const unaLetra = html.replace("BRC|San Carlos De Bariloche", "BRX|San Carlos De Bariloche");
  ok(unaLetra !== html, "el sabotaje de una letra en el dato se aplicó");
  ok(copiaEmbebida(unaLetra, COPIAS[0]) !== parts, "y una letra cambiada en el dato se ve");

  // 2 · un alias de ciudad agregado sólo en la copia del HTML.
  const alias = html.replace('"Cordoba":"Córdoba"', '"Cordoba":"Córdoba","Lobos":"Lobos"');
  ok(alias !== html, "el sabotaje del alias de más se aplicó");
  ok(copiaEmbebida(alias, COPIAS[0]) !== parts, "y un alias que está sólo en el HTML se ve");

  // 3 · la copia pegada dos veces: la segunda pisaría a la primera.
  const i = html.indexOf(abreCopia(COPIAS[1]));
  const j = html.indexOf(cierraCopia(COPIAS[1])) + cierraCopia(COPIAS[1]).length;
  ok(i > 0 && j > i, "el sabotaje de la copia duplicada encontró qué duplicar");
  const doble = html.slice(0, j) + "\n" + html.slice(i, j) + html.slice(j);
  let tiro = false;
  try { copiaEmbebida(doble, COPIAS[1]); } catch (e) { tiro = /2 veces/.test(e.message); }
  ok(tiro, "y una copia pegada dos veces se rechaza");
  ok(dato.length > 0, "(la copia real sigue leyéndose bien)");
})();

console.log("\n====================================================");
console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — las dos copias dicen lo mismo");
console.log("====================================================\n");
process.exit(fallos ? 1 : 0);
