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

  console.log("\n· el presupuesto sale de la base, en bytes, y no de una constante");
  const libresBase  = pe.bytesLibresDeLista(lista);
  const libresVacia = pe.bytesLibresDeLista({ items:{} });
  info(`bytes libres sobre la lista base: ${libresBase}`);
  info("bytes libres sobre una lista vacía: " + libresVacia);
  ok(libresBase > 100000, `queda lugar de sobra, no para 8 ítems (${libresBase} bytes)`);
  ok(libresVacia > libresBase, "y depende de cuánto ocupa YA la lista: una vacía admite más");
  ok(pe.MAX_AI_ITEMS === undefined, "la constante inventada ya no existe");
  ok(typeof pe.cupoDeItemsIA === "undefined",
     "y tampoco quedó la estimación por promedio que la reemplazó mal la primera vez");

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

  /* ─────────────────────────────────────────────────────────────
     EL CASO QUE ESTE ARNÉS NO PROBABA, Y POR ESO NO LO AGARRÓ.

     La primera versión medía con `JSON.stringify(x).length` —caracteres, no
     bytes— y con motivos ASCII cortos y parejos. O sea: tenía el MISMO punto
     ciego que el código que estaba auditando. Es la familia de error que
     `CLAUDE.md` llama "el simulador escrito de memoria", aplicada a una
     medición en vez de a un mock.

     La auditoría del 19/09 lo reprodujo en minutos con lo que el propio
     prompt pide —"por qué, en una frase, mencionando el dato del destino"—:
     la lista terminaba 32% arriba del tope y la base la habría rechazado.
     ───────────────────────────────────────────────────────────── */
  console.log("\n· motivos largos de verdad, medidos en BYTES y no en caracteres");
  const MOTIVO_REAL = "En Noruega en septiembre la temperatura baja de los diez grados al atardecer y llueve seguido, así que conviene llevarlo aunque el pronóstico diga otra cosa el día que salís de casa, porque el clima cambia rápido en la costa.";
  info(`el motivo mide ${MOTIVO_REAL.length} caracteres y ${pe.bytesUtf8(MOTIVO_REAL)} bytes UTF-8`);
  ok(pe.bytesUtf8(MOTIVO_REAL) > MOTIVO_REAL.length,
     "los acentos pesan más que un caracter: medir en caracteres subestima");

  const avalanchaReal = { items: Array.from({length:3000}, (_,k)=>({
    nombre: "Ítem número " + k, motivo: MOTIVO_REAL })) };
  const conMotivos = await pe.enrichWithDestination(lista, async () => avalanchaReal, {});
  const bytesReales = pe.bytesSerializados(conMotivos);
  info(`3000 propuestos con motivo real → ${Object.keys(conMotivos.items).length} ítems · ${bytesReales} bytes`);
  ok(bytesReales <= pe.TOPE_LISTA_BYTES,
     `la lista ENTRA en el documento de la base (${bytesReales} <= ${pe.TOPE_LISTA_BYTES})`);

  console.log("\n· y lo que escribe el modelo se recorta antes de medirlo");
  const largo = "x".repeat(12000);
  const unoSolo = { items: [{ nombre:"Cosa con nombre larguísimo ".repeat(20), motivo: largo }] };
  const recortada = await pe.enrichWithDestination(lista, async () => unoSolo, {});
  const nuevo = Object.keys(recortada.items).find(k => !lista.items[k]);
  const it = nuevo ? recortada.items[nuevo] : null;
  info("el ítem quedó: " + JSON.stringify(it && { nombre:it.nombre.slice(0,40)+"…", largoMotivo: it.motivo.length }));
  ok(!!it, "el ítem entró igual, recortado en vez de descartado");
  ok(it && it.motivo.length <= pe.MAX_MOTIVO_IA, `el motivo se recortó a ${pe.MAX_MOTIVO_IA} (quedó en ${it && it.motivo.length})`);
  ok(it && it.nombre.length <= pe.MAX_NOMBRE_IA, `y el nombre a ${pe.MAX_NOMBRE_IA} (quedó en ${it && it.nombre.length})`);
  ok(pe.bytesSerializados(recortada) <= pe.TOPE_LISTA_BYTES,
     "y un solo motivo de doce mil caracteres ya no tira la lista sola");

  /* El caso adversarial: MUCHOS ítems con motivo mínimo, para maximizar la
     cantidad y exponer cualquier sesgo por ítem. Lo trajo la auditoría: la
     versión anterior de `pesoGuardadoDeItem` escribía a mano una forma
     "parecida" a la guardada y se comía 8 bytes por ítem —el 82% del margen
     de seguridad con 838 ítems— sin cruzar el tope por pura aritmética. */
  /* ─────────────────────────────────────────────────────────────
     LO QUE SE MIDE TIENE QUE SER LO QUE SE GUARDA.

     `pesoGuardadoDeItem` se arregló TRES veces, siempre por lo mismo:
     enumeraba a mano los campos de otra función y se olvidaba de uno.
     Primero `regla` y `orden` (8 bytes por ítem, el 82% del margen), después
     `cantidad` (con veinte dígitos la lista se pasaba por 5.566 bytes).

     Arreglar el cuarto campo no habría servido: el error es enumerar. Ahora
     los campos vienen de quien los arma y van a la misma `makeItem`. Esta
     prueba es el candado: compara lo que la medición predijo contra lo que
     de verdad quedó guardado. Si alguien agrega un campo al ítem y la
     medición no lo cuenta, esto falla acá y no en el teléfono de alguien.
     ───────────────────────────────────────────────────────────── */
  console.log("\n· lo que se mide es exactamente lo que se guarda");
  const conCantidad = await pe.enrichWithDestination(lista, async () => ({
    items: [{ nombre:"Medias de lana", motivo:"hace frío en Noruega", cantidad:7, categoria:"ropa" }]
  }), {});
  const claveNueva = Object.keys(conCantidad.items).find(k => !lista.items[k]);
  const guardado = conCantidad.items[claveNueva];
  const medido = pe.pesoGuardadoDeItem({
    clave: guardado.clave, nombre: guardado.nombre, categoria: guardado.categoria,
    cantidad: guardado.cantidad, motivo: guardado.motivo, origen: guardado.origen,
    regla: guardado.regla, orden: guardado.orden
  });
  const real = pe.bytesSerializados(guardado) + pe.bytesUtf8(guardado.clave) + 4;
  info(`predicho: ${medido} bytes · guardado de verdad: ${real} bytes`);
  ok(medido === real,
     "la medición coincide EXACTO con el ítem guardado: no quedó ningún campo sin contar");
  ok(guardado.cantidad === 7, "y la cantidad que puso el modelo llegó tal cual (7)");

  console.log("\n· una cantidad absurda se acota antes de guardarse");
  const absurda = await pe.enrichWithDestination(lista, async () => ({
    items: [{ nombre:"Pinzas para tender", motivo:"por si acaso", cantidad:99999999999999999999 }]
  }), {});
  const kAbs = Object.keys(absurda.items).find(k => !lista.items[k]);
  info("el ítem: " + JSON.stringify(kAbs) + " · cantidad: " + (absurda.items[kAbs] || {}).cantidad);
  ok(!!kAbs, "el ítem entró (si no entra, la prueba de abajo no prueba nada)");
  ok((absurda.items[kAbs] || {}).cantidad === 99,
     "se acota a 99: nadie empaca más de noventa y nueve de nada");

  console.log("\n· muchos ítems chicos: el margen de seguridad sigue siendo un margen");
  const enjambre = { items: Array.from({length:5000}, (_,k)=>({ nombre:"I"+k, motivo:"m"+k })) };
  const conEnjambre = await pe.enrichWithDestination(lista, async () => enjambre, {});
  const bytesEnjambre = pe.bytesSerializados(conEnjambre);
  const margen = pe.TOPE_LISTA_BYTES - bytesEnjambre;
  info(`5000 chicos → ${Object.keys(conEnjambre.items).length} ítems · ${bytesEnjambre} bytes · margen ${margen}`);
  ok(bytesEnjambre <= pe.TOPE_LISTA_BYTES, "no se pasa del tope");
  ok(margen > 8000,
     `y el margen de seguridad sigue casi entero (${margen}): la medición por ítem no tiene sesgo acumulado`);

  console.log("\n· una lista que YA está en el borde no admite nada más");
  const relleno = {};
  Object.assign(relleno, lista.items);
  for (let k = 0; k < 600; k++) {
    relleno["relleno-" + k] = Object.assign({}, lista.items[Object.keys(lista.items)[0]],
      { clave:"relleno-"+k, nombre:"Relleno "+k, motivo: MOTIVO_REAL });
  }
  const casiLlena = Object.assign({}, lista, { items: relleno });
  const libres = pe.bytesLibresDeLista(casiLlena);
  info(`la lista de prueba pesa ${pe.bytesSerializados(casiLlena)} bytes · libres: ${libres}`);
  ok(libres < 0, "una lista pasada de tope informa bytes libres NEGATIVOS, no 1 «por las dudas»");
  const sobreLlena = await pe.enrichWithDestination(casiLlena, async () => ({
    items:[{nombre:"Algo más", motivo: MOTIVO_REAL}] }), {});
  const sumo = Object.keys(sobreLlena.items).length - Object.keys(casiLlena.items).length;
  ok(sumo === 0, `no le sumó nada a una lista que ya no entra (sumó ${sumo})`);

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
