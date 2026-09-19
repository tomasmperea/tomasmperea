/* ============================================================
   LAS DOS COPIAS DEL MOTOR DICEN LO MISMO

   `app/parts/packing-engine.js` y `app/parts/adjuntos-engine.js` viven
   también embebidos dentro de `app/valija.html`, sin el envoltorio UMD.
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

MOTORES.forEach(function (mot) {
  console.log("\n· " + mot.archivo + " contra su copia en el HTML");
  const enHtml  = funciones(region(mot.abre));
  const enParts = funciones(fs.readFileSync(path.join(PARTS, mot.archivo), "utf8"));

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

console.log("\n====================================================");
console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — las dos copias dicen lo mismo");
console.log("====================================================\n");
process.exit(fallos ? 1 : 0);
