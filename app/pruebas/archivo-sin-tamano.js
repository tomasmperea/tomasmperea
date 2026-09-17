/* ============================================================
   UN ARCHIVO QUE NO DICE CUÁNTO MIDE

   Tercera hipótesis sobre el mismo síntoma, después de que las dos
   anteriores resultaran falsas. Las dos primeras se probaron, se
   arreglaron, y el PM volvió a ver el mismo error: no eran la causa.

   El síntoma, en sus palabras y en su teléfono: un PDF que le llegó por
   mail da "Ese archivo está vacío: no tiene nada adentro", tanto al
   adjuntarlo a una reserva como al importarlo. Una foto de la cámara
   entra perfecta.

   La hipótesis de ahora: el archivo NO viene vacío — viene SIN TAMAÑO.
   En Android, un archivo que entrega un proveedor como Gmail o Drive
   puede no traer el dato de cuánto mide, y el navegador informa
   `size: 0`. El archivo se lee entero; lo único que falta es el número.

   Eso explica las dos mitades del síntoma, que es lo que las hipótesis
   anteriores no lograban:
     · importar FUNCIONA — pdf.js lee el archivo y nunca mira `size`;
     · adjuntar FALLA — el motor mira `size`, ve 0 y ni siquiera intenta
       leerlo.

   Este arnés no toca la app: hace que el navegador entregue un File que
   informa `size: 0` y se lee perfecto, que es exactamente lo que pasa
   en ese teléfono. Prueba los dos caminos.

       node app/pruebas/archivo-sin-tamano.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const LIBS = process.env.VALIJA_LIBS || "/tmp/valija-libs";
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");
const PDF = path.join(LIBS, "tarjeta-real.pdf");
if (!fs.existsSync(PDF)) { console.log("\nFalta preparar el entorno (ver app/pruebas/pdf-real.js).\n"); process.exit(2); }
const pdfMin    = fs.readFileSync(path.join(LIBS, "node_modules/pdfjs-dist/build/pdf.min.js"));
const pdfWorker = fs.readFileSync(path.join(LIBS, "node_modules/pdfjs-dist/build/pdf.worker.min.js"));

let fallos = 0;
const ok = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

(async () => {
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
  page.on("pageerror", e => { console.log("  >> PAGEERROR:", e.message); fallos++; });

  await page.addInitScript(() => {
    /* El proveedor que no informa el tamaño: `size` es 0, todo lo demás anda. */
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    Object.defineProperty(HTMLInputElement.prototype, "files", {
      configurable: true,
      get(){
        const reales = desc.get.call(this);
        if (!reales || !reales.length) return reales;
        const lista = Array.from(reales).map(f => {
          const p = {
            name: f.name, type: f.type, lastModified: f.lastModified,
            size: 0,                                   // <- lo único distinto
            slice: (...a) => f.slice(...a),
            arrayBuffer: () => f.arrayBuffer(),
            text: () => f.text(),
            stream: () => f.stream()
          };
          Object.setPrototypeOf(p, File.prototype);
          return p;
        });
        const l = lista.slice(); l.item = i => l[i];
        return l;
      }
    });
    window.claude = { use: async n => {
      if (n !== "sample") return null;
      return { limits: async () => ({ maxPromptBytes: 65536 }),
        json: async (prompt) => prompt.includes("XKD9P2") ? { items:[{ type:"flight",
          title:"Buenos Aires → Madrid", start:"2026-11-10T23:55", end:"", from:"EZE", to:"MAD",
          provider:"Aerolíneas Argentinas", flightNumber:"AR 1304", confirmation:"XKD9P2",
          seat:"14A", terminal:"A", gate:"B12", boardingTime:"23:05", docType:"boarding-pass",
          address:"", phone:"", cost:"", currency:"", notes:"" }]} : { items: [] } };
    }};
  });

  await page.goto("file://" + APP);
  await page.waitForTimeout(1500);
  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(900);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(700); }

  console.log("\n· camino 1 — adjuntar el PDF a una reserva (lo que el PM vio primero)");
  await page.click("#additem"); await page.waitForTimeout(700);
  await page.fill("#i_title","Vuelo a Madrid");
  const ch1 = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="doc_file"]', e => e.click());
  (await ch1).setFiles(PDF);
  await page.waitForTimeout(2500);

  const t1 = await page.evaluate(() => document.body.innerText);
  ok(!/está vacío|no tiene nada adentro/i.test(t1),
     "no dice que el archivo está vacío — sólo no sabe cuánto mide, que es otra cosa");
  const fila1 = await page.evaluate(() => {
    const f = document.querySelector("#doc-block .imp-file");
    return f ? f.innerText.replace(/\n+/g," · ").slice(0,80) : null;
  });
  info("fila del documento: " + JSON.stringify(fila1));
  await page.click("#save"); await page.waitForTimeout(1500);
  const g1 = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if(!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i=>({t:i.title, docs:(i.docs||[]).length}));
  });
  info("guardado: " + JSON.stringify(g1));
  ok(!!g1 && g1.some(i=>i.docs === 1), "la reserva quedó guardada CON su documento");

  console.log("\n· camino 2 — importar la tarjeta (lo que el PM vio después)");
  await page.click("#imp"); await page.waitForTimeout(1600);
  const ch2 = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="im_doc"]', e => e.click());
  (await ch2).setFiles(PDF);
  await page.waitForTimeout(1500);
  const run = await page.$("#im-run"); if (run) await run.click();
  await page.waitForTimeout(3500);

  const eligiendo = await page.$("#im-choice");
  if (eligiendo) {
    await page.evaluate(() => { const b = document.querySelector('#im-choice [data-c]'); if(b) b.click(); });
    await page.waitForTimeout(300);
    const el = await page.$("#im-choicesave"); if (el) { await el.click(); await page.waitForTimeout(1500); }
  } else {
    const crear = await page.$("#im-crear"); if (crear) { await crear.click(); await page.waitForTimeout(1500); }
  }
  const guardar = await page.$("#im-save"); if (guardar) { await guardar.click(); await page.waitForTimeout(2500); }

  const t2 = await page.evaluate(() => document.body.innerText);
  ok(!/quedó afuera|no tiene nada adentro/i.test(t2), "el documento NO queda afuera al importar");
  const g2 = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if(!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i=>({t:i.title, seat:i.seat, docs:(i.docs||[]).length}));
  });
  info("guardado: " + JSON.stringify(g2));
  ok(!!g2 && g2.some(i=>i.docs >= 1), "y el documento de la tarjeta quedó adjunto");

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — con un archivo que no dice cuánto mide");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
