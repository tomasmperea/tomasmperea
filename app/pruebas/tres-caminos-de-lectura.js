/* ============================================================
   LOS TRES CAMINOS PARA LEER UN ARCHIVO

   Por qué existe. Tres arreglos seguidos fallaron sobre el mismo
   síntoma en el teléfono del PM. Los tres tenían el mismo defecto de
   método: cada uno suponía POR DÓNDE fallaba la lectura y se probaba
   contra un simulador escrito desde esa suposición. Un simulador así
   sólo puede darle la razón a quien lo escribió.

   Este arnés no prueba una hipótesis nueva. Prueba que la app YA NO
   DEPENDE de cuál sea la verdadera: se prueban los tres caminos que un
   navegador ofrece —arrayBuffer, slice y FileReader— hasta que uno
   traiga bytes, y se anota qué devolvió cada uno.

   Cada escenario apaga un camino distinto. Si la app sigue leyendo el
   archivo en los tres, deja de importar cuál de ellos esté roto en ese
   teléfono. Y el último escenario —los tres rotos— comprueba lo otro
   que hace falta: que cuando de verdad no se puede, la app NO invente
   una causa y muestre lo que observó.

       node app/pruebas/tres-caminos-de-lectura.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const LIBS = process.env.VALIJA_LIBS || "/tmp/valija-libs";
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");
const PDF = path.join(LIBS, "tarjeta-real.pdf");
if (!fs.existsSync(PDF)) { console.log("\nFalta preparar el entorno (ver app/pruebas/pdf-real.js).\n"); process.exit(2); }
/* Importar necesita el lector de PDF: sin él la app —con razón— ni siquiera
   ofrece subir un archivo, y el escenario no se podría correr. Se le sirve el
   real, el mismo que fija por <script>. */
const pdfMin    = fs.readFileSync(path.join(LIBS, "node_modules/pdfjs-dist/build/pdf.min.js"));
const pdfWorker = fs.readFileSync(path.join(LIBS, "node_modules/pdfjs-dist/build/pdf.worker.min.js"));

let fallos = 0;
const ok = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

/* Rompe los caminos que se le pidan, sobre los File del selector. Rompe el
   NAVEGADOR, no la app: la app no sabe que esto existe.

   OJO con cómo se pasa la lista: `addInitScript` serializa la función y NO se
   lleva las variables de su closure. La primera versión de este arnés hacía
   `romper(caminos)` devolviendo un closure, así que en la página `caminos`
   llegaba undefined y NO SE ROMPÍA NADA: tres escenarios pasaban en falso.
   Lo destapó el cuarto, que era el único que esperaba una falla. La lista va
   como ARGUMENTO, que es la única forma de que cruce. */
function romper(rotos) {
  {
    /* Se parchean los File REALES que entrega el selector, en vez de armar
       objetos que los imiten. Es la diferencia entre probar y creer que se
       prueba: un `FileReader` de verdad no acepta un objeto inventado —tira
       "parameter 1 is not of type 'Blob'"— así que con imitaciones el tercer
       camino nunca se ejercía y el arnés mentía. Con un File real, los tres
       caminos son los de verdad y lo único falso es lo que se rompe a mano. */
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    Object.defineProperty(HTMLInputElement.prototype, "files", {
      configurable: true,
      get() {
        const reales = desc.get.call(this);
        if (!reales || !reales.length) return reales;
        Array.from(reales).forEach(f => {
          if (f.__parcheado) return;
          Object.defineProperty(f, "__parcheado", { value: true });
          if (rotos.indexOf("size") >= 0) Object.defineProperty(f, "size", { value: 0, configurable: true });
          if (rotos.indexOf("arrayBuffer") >= 0) Object.defineProperty(f, "arrayBuffer", {
            configurable: true,
            value: () => Promise.reject(new DOMException("no se puede leer", "NotReadableError"))
          });
          if (rotos.indexOf("slice") >= 0) Object.defineProperty(f, "slice", {
            configurable: true, value: () => new Blob([])
          });
        });
        return reales;
      }
    });
    if (rotos.indexOf("FileReader") >= 0) {
      window.FileReader = function () {
        this.readAsArrayBuffer = () => {
          setTimeout(() => { this.error = new Error("roto"); if (this.onerror) this.onerror(); }, 0);
        };
      };
    }
    window.claude = { use: async n => n === "sample"
      ? { limits: async () => ({ maxPromptBytes: 65536 }), json: async () => ({ items: [] }) } : null };
  }
}

async function escenario(nombre, caminos, esperaLeer) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  await page.addInitScript(romper, caminos);
  await page.goto("file://" + APP);
  await page.waitForTimeout(1300);
  await page.click("#newtrip"); await page.waitForTimeout(350);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(800);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(600); }
  await page.click("#additem"); await page.waitForTimeout(600);
  await page.fill("#i_title","Vuelo");
  const ch = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="doc_file"]', e => e.click());
  (await ch).setFiles(PDF);
  await page.waitForTimeout(2200);

  const estado = await page.evaluate(() => {
    const f = document.querySelector("#doc-block .imp-file");
    return { fila: f ? f.innerText.replace(/\n+/g, " · ") : null,
             pantalla: document.body.innerText };
  });

  console.log(`\n· ${nombre}`);
  if (esperaLeer) {
    ok(!/No pude leer ese archivo/i.test(estado.pantalla), "el archivo se lee igual");
    ok(/\d+\s*KB|\d+\s*B\b/i.test(estado.fila || ""), "y muestra su peso real: " + JSON.stringify((estado.fila||"").slice(0,70)));
    await page.click("#save"); await page.waitForTimeout(1200);
    const g = await page.evaluate(() => {
      const raw = localStorage.getItem("valija.v1"); if(!raw) return null;
      const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
      return its.map(i=>({docs:(i.docs||[]).length}));
    });
    ok(!!g && g.some(i=>i.docs === 1), "y queda adjunto al guardar");
  } else {
    console.log("  --- bloque del documento ---");
    console.log("      " + JSON.stringify((await page.evaluate(()=>{const b=document.getElementById("doc-block"); return b?b.innerText.replace(/\n+/g," / "):"(no hay bloque)";})).slice(0,300)));
    ok(/No pude leer ese archivo/i.test(estado.pantalla), "dice que no pudo leerlo, sin inventar por qué");
    ok(!/está vacío|no tiene nada adentro/i.test(estado.pantalla), "y NO afirma que el archivo esté vacío");
    const dato = await page.evaluate(() => {
      const d = document.querySelector("#doc-block .meta.dato");
      return d ? d.innerText : null;
    });
    info("dato observado en pantalla: " + JSON.stringify(dato));
    ok(!!dato && /arrayBuffer/.test(dato) && /slice/.test(dato) && /FileReader/.test(dato),
       "muestra lo que observó en los TRES caminos, para no tener que adivinar");
    ok(!!dato && /v\d+/.test(await page.evaluate(() => document.querySelector("#doc-block .meta.dato").innerText)),
       "y con qué versión de la app pasó");
  }
  await browser.close();
}

/* El MISMO archivo ilegible, por el otro gesto. Existe porque el arnés cubría
   sólo Adjuntar, y el PM reportó el bug por los DOS caminos: adjuntar directo
   e importar. Lo encontró la auditoría del 17/09: con los tres caminos rotos,
   Importar contestaba "Este PDF es un escaneo", que es una causa inventada
   —el archivo no es un escaneo, es ilegible— y encima sin el dato observado.
   Arreglar la lectura no alcanzaba: había que arreglar también qué se dice
   cuando la lectura no alcanza. */
async function escenarioImportar(nombre, caminos) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (/^file:/.test(u)) return r.continue();
    if (/pdf\.min\.js/.test(u))         return r.fulfill({ contentType:"application/javascript", body: pdfMin });
    if (/pdf\.worker\.min\.js/.test(u)) return r.fulfill({ contentType:"application/javascript", body: pdfWorker });
    return r.abort();
  });
  await page.addInitScript(romper, caminos);
  await page.goto("file://" + APP);
  await page.waitForTimeout(1500);
  await page.click("#newtrip"); await page.waitForTimeout(350);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(800);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(600); }
  await page.click("#imp");
  await page.waitForSelector('[data-pick="im_doc"]', {timeout:15000}).catch(()=>{});
  await page.waitForTimeout(600);
  if(!(await page.$('[data-pick="im_doc"]'))){
    console.log("  --- pantalla de importar ---");
    console.log("      " + (await page.evaluate(()=>document.body.innerText)).replace(/\n+/g," / ").slice(0,400));
  }
  const ch = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="im_doc"]', e => e.click());
  (await ch).setFiles(PDF);
  await page.waitForTimeout(2500);

  const pantalla = await page.evaluate(() => document.body.innerText);
  console.log(`\n· ${nombre}`);
  ok(!/es un escaneo/i.test(pantalla),
     "NO dice que el PDF es un escaneo: eso es una causa inventada sobre un archivo que no se pudo leer");
  ok(!/está vacío|no tiene nada adentro/i.test(pantalla), "ni que está vacío");
  ok(/no pude leer/i.test(pantalla), "dice que no lo pudo leer");
  const dato = await page.evaluate(() => {
    const d = document.querySelector(".dato, .meta.dato");
    return d ? d.innerText : null;
  });
  info("dato observado: " + JSON.stringify(dato));
  ok(!!dato && /arrayBuffer/.test(dato) && /FileReader/.test(dato),
     "y muestra qué observó en los tres caminos, igual que al adjuntar");
  const puedeSeguir = await page.evaluate(() => {
    const b = document.getElementById("im-run");
    return b ? !b.disabled : null;
  });
  ok(puedeSeguir === false, "y no deja mandarlo a interpretar: ya se sabe que no se puede leer");
  await browser.close();
}

(async () => {
  await escenario("el camino moderno falla (arrayBuffer rechaza)", ["arrayBuffer"], true);
  await escenario("fallan el moderno y la copia (queda FileReader)", ["arrayBuffer","slice"], true);
  await escenario("además el archivo no informa su tamaño", ["size","arrayBuffer","slice"], true);
  await escenario("fallan los tres: no se puede leer de ninguna forma", ["arrayBuffer","slice","FileReader"], false);
  await escenarioImportar("el mismo archivo ilegible, pero por IMPORTAR", ["arrayBuffer","slice","FileReader"]);

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — la app ya no depende de UN camino");
  console.log("====================================================\n");
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
