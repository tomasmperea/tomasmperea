/* ============================================================
   UN ARCHIVO QUE SE PUEDE LEER UNA SOLA VEZ

   De dónde sale: el PM importó una tarjeta de embarque real desde su
   teléfono el 16/09. El vuelo se completó bien, pero el documento no
   quedó adjunto y la app le dijo "Ese archivo está vacío: no tiene nada
   adentro" — sobre un archivo que acababa de leerse entero.

   La causa no es el tamaño ni el tipo: es que el archivo se lee DOS
   veces. Una para interpretarlo y otra, más tarde, para adjuntarlo. En
   Android un archivo elegido desde el correo o desde Drive llega como
   `content://` y lo entrega un proveedor remoto: la primera lectura
   funciona y la segunda vuelve vacía. En una computadora el archivo es
   un archivo del disco y se puede leer todas las veces que uno quiera,
   por eso ningún arnés lo había visto, ni siquiera el que corre con el
   pdf.js real.

   Este arnés simula ese proveedor: envuelve el `File` que entrega el
   selector para que la PRIMERA lectura devuelva el archivo entero y
   toda lectura posterior devuelva cero bytes, que es exactamente lo que
   hace Android. No parchea la app: parchea el navegador.

       node app/pruebas/archivo-de-una-lectura.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const LIBS = process.env.VALIJA_LIBS || "/tmp/valija-libs";
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");
const PDF = path.join(LIBS, "tarjeta-real.pdf");

if (!fs.existsSync(PDF) || !fs.existsSync(path.join(LIBS, "node_modules/pdfjs-dist/build/pdf.min.js"))) {
  console.log("\nFalta preparar el entorno (ver app/pruebas/pdf-real.js).\n");
  process.exit(2);
}
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
    /* ---- EL PROVEEDOR DE ANDROID, SIMULADO ----
       Cada File que entrega un <input type=file> se envuelve: la primera
       lectura devuelve todo, la segunda devuelve vacío y `size` pasa a 0.
       Es lo que hace un content:// respaldado por Gmail o Drive. */
    window.__LECTURAS__ = [];
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    Object.defineProperty(HTMLInputElement.prototype, "files", {
      configurable: true,
      get() {
        const reales = desc.get.call(this);
        if (!reales || !reales.length) return reales;
        const envueltos = Array.from(reales).map(f => {
          if (f.__envuelto) return f;
          let consumido = false;
          const marcar = () => { const primera = !consumido; consumido = true;
            window.__LECTURAS__.push({nombre:f.name, primera}); return primera; };
          const proxy = {
            __envuelto: true,
            name: f.name, type: f.type, lastModified: f.lastModified,
            get size(){ return consumido ? 0 : f.size; },
            slice: (...a) => f.slice(...a),
            arrayBuffer(){ return marcar() ? f.arrayBuffer() : Promise.resolve(new ArrayBuffer(0)); },
            text(){ return marcar() ? f.text() : Promise.resolve(""); },
            stream(){ return marcar() ? f.stream() : new Blob([]).stream(); }
          };
          Object.setPrototypeOf(proxy, File.prototype);
          return proxy;
        });
        envueltos.item = i => envueltos[i];
        return envueltos;
      }
    });

    window.claude = { use: async n => {
      if (n !== "sample") return null;
      return {
        limits: async () => ({ maxPromptBytes: 65536 }),      // sin imágenes, como el visor del PM
        json: async (prompt) => {
          if (!prompt.includes("XKD9P2")) return { items: [] };
          return { items: [{ type:"flight", title:"Buenos Aires → Madrid",
            start:"2026-11-10T23:55", end:"", from:"EZE", to:"MAD",
            provider:"Aerolíneas Argentinas", flightNumber:"AR 1304",
            confirmation:"XKD9P2", seat:"14A", terminal:"A", gate:"B12",
            boardingTime:"23:05", docType:"boarding-pass",
            address:"", phone:"", cost:"", currency:"", notes:"" }]};
        }
      };
    }};
  });

  await page.goto("file://" + APP);
  await page.waitForTimeout(1500);
  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(800);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(700); }
  await page.click("#imp"); await page.waitForTimeout(1600);

  console.log("\n· se importa la tarjeta, igual que el PM desde su teléfono");
  const chooser = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="im_doc"]', e => e.click());
  (await chooser).setFiles(PDF);
  await page.waitForTimeout(1200);
  const runBtn = await page.$("#im-run");
  if (runBtn) await runBtn.click();
  await page.waitForTimeout(3000);

  const crear = await page.$("#im-crear");
  ok(!!crear, "reconoce la tarjeta sin vuelo y ofrece crearlo (VAL-59)");
  if (crear) { await crear.click(); await page.waitForTimeout(1500); }
  const guardar = await page.$("#im-save");
  if (guardar) { await guardar.click(); await page.waitForTimeout(2500); }

  /* EL SABOTAJE LLEGÓ: si el envoltorio no se aplicó, no hay ninguna lectura
     registrada y todo lo de abajo pasaría sin probar nada. Ver la regla en
     CLAUDE.md, "todo arnés que rompe algo a propósito". */
  const lecturas = await page.evaluate(() => window.__LECTURAS__ || []);
  ok(lecturas.length > 0, `el envoltorio registró ${lecturas.length} lectura(s): el sabotaje se aplicó`);
  info(`detalle: ${lecturas.map(l=>l.primera?"1ª":"posterior").join(", ")}`);

  const pantalla = await page.evaluate(() => document.body.innerText);
  const guardado = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if (!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i => ({conf:i.confirmation, docs:(i.docs||[]).length}));
  });
  info("guardado: " + JSON.stringify(guardado));

  console.log("\n· lo que el PM vio en su teléfono");
  ok(!/está vacío|no tiene nada adentro/i.test(pantalla),
     "NO dice que el archivo está vacío — porque no lo está");
  ok(!/quedó afuera/i.test(pantalla),
     "y el documento NO queda afuera");

  const g0 = (guardado && guardado[0]) || {};
  ok(g0.conf === "XKD9P2", "el vuelo se completó con los datos de la tarjeta");
  ok(g0.docs === 1, `y el documento original QUEDÓ ADJUNTO (docs: ${g0.docs === undefined ? "ninguno" : g0.docs})`);

  const cuerpos = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("valija.doc.")).length);
  ok(cuerpos === 1, `con su archivo guardado (${cuerpos})`);

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — con un archivo de una sola lectura");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
