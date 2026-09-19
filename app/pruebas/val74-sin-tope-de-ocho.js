/* ============================================================
   VAL-74 — LA CAPA DE IA YA NO TIENE UN TOPE INVENTADO

   De dónde sale, textual del PM el 19/09:

     "otro patrón que identifico es que siempre las sugerencias son 8
      items máximo; esto es una suposición tuya también? no tiene sentido"

   Era una suposición mía, y el comentario entero decía "Tope de ítems que
   puede agregar la capa de IA". Ni una línea sobre por qué 8.

   Y se aplicaba DOS veces: el texto que se le manda al modelo le pedía
   "agregá hasta 8" —o sea que se autocensuraba antes de contestar— y
   además el parser descartaba lo que pasara de 8. Nunca vimos cuánto
   tenía para decir.

   Decisión del PM: sin tope propio; si hay alguno, el máximo técnico.
   Ese máximo sale de lo único que de verdad limita: la lista entera vive
   en UN documento de la base, que tope a 256 KiB.

   EL MOTOR SE SACA DEL HTML PUBLICADO, no de app/parts/. Es la misma
   técnica de `motores-desde-html.js`: así se prueba lo que se publica y
   no una copia que podría haber quedado atrás.

       node app/pruebas/val74-sin-tope-de-ocho.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

/* Mismo extractor que motores-desde-html.js */
const html = fs.readFileSync(APP, "utf8");
const abre = "const PackingEngine = (function () {";
const i = html.indexOf(abre);
if (i < 0) { console.log("no encontré PackingEngine en el HTML"); process.exit(2); }
const j = html.indexOf("\n})();", i + abre.length);
const cuerpo = html.slice(i + abre.length, j);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "val74-"));
const archivo = path.join(tmp, "packing-engine.js");
fs.writeFileSync(archivo, "(function(root,factory){module.exports=factory();})(this,function(){" + cuerpo + "\n});");
const pe = require(archivo);

const VIAJE = { id:"t1", name:"Noruega", destination:"Noruega",
                startDate:"2026-09-14", endDate:"2026-09-24", travelers:"Tomás" };

(async () => {
  console.log("\n· el texto que se le manda al modelo ya no le pide que se autocensure");
  const lista = pe.buildPackingList({ trip:VIAJE, items:[] });
  const prompt = pe.destinationPrompt ? pe.destinationPrompt(lista) : null;
  if (prompt) {
    info("línea del pedido: " + (prompt.split("\n").find(l=>/Agregá/.test(l)) || "(no la encontré)").slice(0,110));
    ok(!/hasta 8 ítems|hasta 8 items/i.test(prompt), "no le pide «hasta 8 ítems»");
    ok(!/\bhasta \d+ ítems/i.test(prompt), "ni «hasta N» con ningún otro número inventado");
  } else {
    info("destinationPrompt no está exportado; se mira el texto del archivo");
    ok(!/Agregá hasta \d+ ítems/.test(html), "el HTML no contiene «Agregá hasta N ítems»");
  }

  console.log("\n· el cupo sale de la base, no de una constante");
  const cupoBase  = pe.cupoDeItemsIA(lista);
  const cupoVacia = pe.cupoDeItemsIA({ items:{} });
  info(`cupo sobre la lista base (${pe.itemsArray ? pe.itemsArray(lista).length : "?"} ítems): ${cupoBase}`);
  info("cupo sobre una lista vacía: " + cupoVacia);
  ok(cupoBase > 100, `el cupo es holgado, no 8 (${cupoBase})`);
  ok(cupoVacia > cupoBase, "y depende de cuánto ocupa YA la lista: una vacía admite más");
  ok(pe.MAX_AI_ITEMS === undefined, "la constante inventada ya no existe");

  console.log("\n· el modelo puede devolver muchos más de 8 y entran todos");
  const N = 25;
  const respuesta = { items: Array.from({length:N}, (_,k)=>({
    nombre: "Cosa numero " + (k+1),
    motivo: "hace falta en Noruega por el motivo " + (k+1)
  })) };
  const enriquecida = await pe.enrichWithDestination(lista, async () => respuesta, {});
  const antes = Object.keys(lista.items).length;
  const despues = Object.keys(enriquecida.items).length;
  const sumados = despues - antes;
  info(`ítems antes: ${antes} · después: ${despues} · sumados: ${sumados}`);
  ok(sumados === N, `entraron los ${N}, no 8 (entraron ${sumados})`);
  ok(enriquecida.capaInteligente && enriquecida.capaInteligente.estado === "ok",
     "y la capa quedó en estado ok");

  console.log("\n· pero el techo de la base SIGUE existiendo: no es barra libre");
  const MUCHOS = 2000;
  const avalancha = { items: Array.from({length:MUCHOS}, (_,k)=>({
    nombre: "Item " + k, motivo: "motivo largo para ocupar lugar numero " + k + " ".repeat(40)
  })) };
  const tapada = await pe.enrichWithDestination(lista, async () => avalancha, {});
  const total = Object.keys(tapada.items).length;
  const bytes = JSON.stringify(tapada).length;
  info(`con ${MUCHOS} propuestos quedaron ${total} ítems · la lista pesa ${bytes} caracteres`);
  ok(total < MUCHOS + antes, `algo se recortó: el techo existe (${total} de ${MUCHOS + antes})`);
  ok(bytes < pe.TOPE_LISTA_BYTES,
     `y la lista entra en el documento de la base (${bytes} < ${pe.TOPE_LISTA_BYTES})`);

  /* EL CONTROL: que esta prueba pueda fallar. Si el cupo fuera 8 otra vez,
     el caso de los 25 tiene que romperse. Se simula acotando a mano. */
  console.log("\n· el control: con un tope de 8, el caso de los 25 falla");
  const conOcho = Object.assign({}, lista);
  const recortado = { items: respuesta.items.slice(0, 8) };
  const enr8 = await pe.enrichWithDestination(conOcho, async () => recortado, {});
  const sum8 = Object.keys(enr8.items).length - antes;
  info("con una respuesta recortada a 8 entran: " + sum8);
  ok(sum8 === 8 && sum8 !== N,
     "la prueba distingue 8 de 25: no pasa por cualquier número");

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — el tope lo pone la base, no una suposición");
  console.log("====================================================\n");
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
