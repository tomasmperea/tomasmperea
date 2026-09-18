/* ============================================================
   ¿LA APP PARSEA? — el chequeo más barato que existe

   De dónde sale: el 18/09, escribiendo un comentario que explicaba por
   qué la caja de pegar el texto arranca colapsada, lo puse adentro del
   template literal que arma esa pantalla. El comentario tenía backticks
   —citaba nombres de variables— y un backtick adentro de un template
   literal lo CIERRA. Error de sintaxis: la app entera dejó de cargar.

   Lo destapó un arnés de interfaz, pero tardó 15 segundos de Playwright
   en fallar por timeout y el mensaje que dio fue "no encontré el
   elemento", no "el script no parsea". Con quince arneses corriendo de a
   uno, un error así puede costar una vuelta entera de diagnóstico para
   algo que se detecta en milisegundos.

   Esto no prueba que la app funcione. Prueba lo anterior a todo: que el
   archivo es JavaScript válido. Corre en menos de un segundo, sin
   navegador, y va PRIMERO.

   Chequea además la trampa específica que ya pasó una vez, porque un
   parser no la distingue de código legítimo: un backtick adentro de lo
   que parece un comentario. Eso nunca es lo que alguien quiso escribir.

       node app/pruebas/el-script-parsea.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

const html = fs.readFileSync(APP, "utf8");

/* Los <script> propios: los que no tienen src. */
const bloques = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html)) !== null) bloques.push({ cuerpo: m[1], desde: m.index });

console.log("\n· los <script> del archivo son JavaScript válido");
info(`bloques propios encontrados: ${bloques.length}`);
ok(bloques.length > 0, "hay al menos un bloque que revisar");

bloques.forEach((b, i) => {
  const linea = html.slice(0, b.desde).split("\n").length;
  let error = null;
  try { new Function(b.cuerpo); } catch (e) { error = e.message; }
  ok(!error, error
    ? `el bloque ${i + 1} (línea ${linea}) NO parsea — ${error}`
    : `el bloque ${i + 1} (línea ${linea}, ${b.cuerpo.length} caracteres) parsea`);
});

/* ¿Agarra ESTE error? No alcanza con que el chequeo pueda fallar en general:
   tiene que fallar con la forma exacta que ya rompió la app una vez. Se
   reconstruye en chiquito y se exige que la rechace.

   (La primera versión de este arnés además buscaba backticks dentro de
   comentarios. Daba 154 avisos: los backticks en un comentario son normales
   —así se citan los nombres en JSDoc— y sólo molestan adentro de un template
   literal, que es justo lo que un buscador de texto no puede distinguir. Un
   chequeo que grita 154 veces se ignora, así que se sacó. El parser ya cubre
   el caso, y acá abajo está la prueba de que lo cubre.) */
console.log("\n· el chequeo agarra el error exacto que rompió la app el 18/09");

const comoRompi = [
  'function pinta(st){',
  '  return `<div>',
  '      <!-- el comentario que escribí, con `sinImagenes` citado adentro -->',
  '      <details ${st.abierta?"open":""}></details>`;',
  '}'
].join("\n");

let rompio = null;
try { new Function(comoRompi); } catch (e) { rompio = e.message; }
info("el parser dijo: " + JSON.stringify(rompio));
ok(!!rompio, "un comentario con backticks adentro de un template literal es RECHAZADO");

/* Y el control al revés: el mismo código sin los backticks tiene que pasar.
   Sin esto, el caso de arriba podría estar en rojo por cualquier otro motivo
   y no probaría nada sobre los backticks. */
const mismoSinBackticks = comoRompi.replace("`sinImagenes`", "sinImagenes");
let sano = null;
try { new Function(mismoSinBackticks); } catch (e) { sano = e.message; }
ok(!sano, "y el MISMO código sin los backticks parsea: lo que falla son ellos, no otra cosa");

console.log("\n====================================================");
console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — el archivo es JavaScript válido");
console.log("====================================================\n");
process.exit(fallos ? 1 : 0);
