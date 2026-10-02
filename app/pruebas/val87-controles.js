/* ============================================================
   VAL-87 — LOS CONTROLES NEGATIVOS, CORRIDOS

   Un arnés que no puede fallar no prueba nada. Cada control mete UN defecto
   plausible en una copia del HTML —el que alguien podría escribir mañana
   "simplificando"—, corre el arnés sobre esa copia y exige que falle, y que
   falle en la aserción que corresponde.

   Y cada uno asevera primero que el sabotaje LLEGÓ: el texto a reemplazar
   tiene que aparecer exactamente una vez y la copia tiene que quedar
   distinta. Un sabotaje que no se aplica deja todo en verde y parece que el
   arnés funciona (CLAUDE.md: los cuatro escenarios de
   `tres-caminos-de-lectura.js` que pasaron en falso).

   Se corren DE A UNO, nunca en paralelo: dos navegadores a la vez dan rojos
   falsos en este entorno.

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val87-controles.js
   ============================================================ */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "..", "..");
const HTML = path.join(RAIZ, "app", "valija.html");
const ARNES = path.join(__dirname, "val87-ciudad-o-aeropuerto.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "val87-controles-"));
const original = fs.readFileSync(HTML, "utf8");

let fallos = 0;
const ok = (c, m) => { console.log((c ? "  ok     " : "  FALLA  ") + m); if (!c) fallos++; };

const CONTROLES = [
  { nombre:"1 · lo guardado es lo que se VE (la ciudad), no el código",
    de:"  return inp.dataset.cod || apResolver(inp.value).guarda;",
    a: "  return inp.value.trim();",
    solo:"CRITERIO 1 ", espera:/FALLA  se guardó to: "Bariloche"/ },
  { nombre:"2 · editar después de elegir NO borra la elección",
    de:"    delete inp.dataset.cod;            // editar después de elegir borra la elección\n",
    a: "",
    solo:"CRITERIO 6 ", espera:/FALLA  y el sello se fue en la primera tecla/ },
  { nombre:"3 · la revisión de lo importado lee lo que se ve",
    de:'c.reserva[inp.dataset.f] = inp.closest("[data-ap]") ? apValor(inp) : inp.value.trim();',
    a: "c.reserva[inp.dataset.f] = inp.value.trim();",
    solo:"CRITERIO 2 ", espera:/FALLA  se guardó to: "Bariloche"/ },
  { nombre:"4 · vuelve el texto viejo del aviso de VAL-80",
    de:'${cuales}, que no ${uno?"es un aeropuerto":"son aeropuertos"}',
    a: '${cuales}. Ahí va el código de tres letras, y todavía no sé traducir el nombre de una ciudad. Y no ${uno?"es un aeropuerto":"son aeropuertos"}',
    solo:"CRITERIO 12 ", espera:/FALLA  y no dice nada de traducir/ },
  { nombre:"5 · la lista se cierra en el mismo instante en que baja el dedo",
    de:"function apDespues(fn){\n",
    a: "function apDespues(fn){ fn(); return;\n",
    solo:"VECINO · al salir", espera:/FALLA  tocar la cruz de la segunda la descarta/ },
  { nombre:"6 · la etiqueta le pregunta al dato por lo RECORTADO (VIL → Dakhla)",
    de:"  const par = [ciudad(f.from), ciudad(f.to)];",
    a: "  const par = [ciudad(String(f.from).slice(0,3)), ciudad(String(f.to).slice(0,3))];",
    solo:"CRITERIO 9 ", espera:/FALLA  y no se le inventa ciudad/ },
  { nombre:"7 · la revisión vuelve a guardar todo en mayúsculas",
    de:'to:   type==="flight" ? apResolver(r.to).guarda   : (r.to||"").toUpperCase(),',
    a: 'to:   (r.to||"").toUpperCase(),',
    solo:"CRITERIO 5 · revisión de lo importado · fila «cualquier", espera:/FALLA  se guardó to: "VILLA LA ANGOSTURA"/ },
  { nombre:"8 · el formulario decide por `it.type` y no por el campo",
    de:'return el && el.closest("[data-ap]") ? apValor(el) : g(id); };',
    a: 'return it.type==="flight" ? apValor(el) : g(id); };',
    solo:"VECINO · cambiar de tipo", espera:/FALLA  en Traslado, «Hasta» recibe el código y no la ciudad \("Bariloche"\)/ },
  { nombre:"9 · el campo deja de aplicar la tabla al salir (sólo al elegir)",
    de:"    if(r.codigo){ inp.dataset.cod = r.guarda; inp.value = apVisible(r); }\n",
    a: "",
    solo:"CRITERIO 5 · formulario manual · fila «tres letras de un", espera:/FALLA  se ve "Buenos Aires"/ }
];

function correr(archivo, solo) {
  const r = spawnSync(process.execPath, [ARNES, archivo], {
    env: Object.assign({}, process.env, { VAL87_SOLO: solo }), encoding:"utf8", timeout: 600000
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const m = /(\d+) pasaron, (\d+) fallaron/.exec(out);
  return { out, pasaron: m ? +m[1] : -1, fallaron: m ? +m[2] : -1, codigo: r.status };
}

console.log("\n· primero, el arnés en verde sobre el HTML real, con los mismos bloques");
for (const c of CONTROLES) {
  const r = correr(HTML, c.solo);
  ok(r.fallaron === 0 && r.pasaron > 0, `«${c.solo}» en verde sobre el original (${r.pasaron} pasaron)`);
}

for (const c of CONTROLES) {
  console.log("\n· CONTROL " + c.nombre);
  const veces = original.split(c.de).length - 1;
  ok(veces === 1, `el texto a sabotear aparece una sola vez (${veces})`);
  if (veces !== 1) continue;
  const roto = original.replace(c.de, c.a);
  ok(roto !== original, "el sabotaje se aplicó: la copia es distinta");
  const archivo = path.join(tmp, "control-" + c.nombre.split(" ")[0] + ".html");
  fs.writeFileSync(archivo, roto);
  const r = correr(archivo, c.solo);
  console.log(`  info   ${r.pasaron} pasaron, ${r.fallaron} fallaron`);
  ok(r.fallaron > 0, "el arnés FALLA con el defecto puesto");
  ok(c.espera.test(r.out), "y falla en la aserción que corresponde: " + c.espera);
  if (!c.espera.test(r.out)) console.log(r.out.split("\n").filter(l => /FALLA/.test(l)).slice(0, 8).join("\n"));
}

/* Las dos copias: una letra cambiada en el dato embebido. */
console.log("\n· CONTROL 10 · una letra cambiada en el dato embebido (las-dos-copias.js)");
{
  const de = "BRC|San Carlos De Bariloche", veces = original.split(de).length - 1;
  ok(veces === 1, `el texto a sabotear aparece una sola vez (${veces})`);
  const archivo = path.join(tmp, "control-10.html");
  fs.writeFileSync(archivo, original.replace(de, "BRX|San Carlos De Bariloche"));
  const r = spawnSync(process.execPath, [path.join(__dirname, "las-dos-copias.js"), archivo], { encoding:"utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  ok(r.status !== 0, "las-dos-copias.js FALLA");
  ok(/la copia DIVERGE/.test(out), "y dice que la copia del dato diverge");
}

console.log("\n====================================================");
console.log(fallos ? `  ${fallos} FALLARON` : "  Todos los controles muerden");
console.log("====================================================\n");
process.exitCode = fallos ? 1 : 0;
