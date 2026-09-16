/* ============================================================
   EL pdf.js REAL, DENTRO DEL NAVEGADOR — no un simulador

   Por qué existe: todos los demás arneses CORTAN la red externa y le
   inyectan al motor un pdf.js escrito contra la API documentada. Eso
   prueba que el motor respeta el contrato, pero NO que el contrato sea
   cierto. La diferencia ya nos costó una iteración: el primer simulador
   copió una suposición equivocada y las pruebas pasaban mientras la app
   se veía vacía.

   Acá la red externa sigue cortada, pero el pedido a cdnjs se RESPONDE
   con la librería real (pdfjs-dist 3.11.174 de npm, la misma versión que
   la app fija) en vez de abortarse. El PDF tampoco es inventado: lo
   genera jsPDF y trae los datos de una tarjeta de embarque.

   Qué prueba que ningún otro arnés puede probar:
     · que getTextContent() del pdf.js real devuelva la forma que el
       motor supone, dentro del navegador y no sólo en node;
     · que el visor del documento DIBUJE la página del PDF (el estado D3
       completo del diseño), que hasta hoy figuraba como no verificable;
     · que la importación entera funcione con la librería de verdad.

   Lo que sigue sin cubrir: el teléfono. Esto es Chromium de escritorio.

       node app/pruebas/pdf-real.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

/* La librería real no está en el repo: se baja de npm, que este entorno SÍ
   permite (cdnjs no: el proxy lo rechaza con 403). Es la misma versión que la
   app fija por <script>. Preparar el entorno, una vez:

     mkdir -p /tmp/valija-libs && cd /tmp/valija-libs
     npm install pdfjs-dist@3.11.174 jspdf@2.5.1
     node -e '...'   # genera tarjeta-real.pdf, ver `generarPdf` abajo

   O más simple: correr este archivo, que si falta algo lo dice y sale. */
const LIBS = process.env.VALIJA_LIBS || "/tmp/valija-libs";
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");
const PDF = path.join(LIBS, "tarjeta-real.pdf");

function faltan(){
  const req = ["node_modules/pdfjs-dist/build/pdf.min.js",
               "node_modules/pdfjs-dist/build/pdf.worker.min.js",
               "node_modules/jspdf/dist/jspdf.umd.min.js",
               "tarjeta-real.pdf"];
  return req.filter(f => !fs.existsSync(path.join(LIBS, f)));
}
const falta = faltan();
if (falta.length) {
  console.log("\nFalta preparar el entorno de este arnés. En " + LIBS + " no están:");
  falta.forEach(f => console.log("  · " + f));
  console.log("\nPrepararlo (una vez por sesión):");
  console.log("  mkdir -p " + LIBS + " && cd " + LIBS);
  console.log("  npm install pdfjs-dist@3.11.174 jspdf@2.5.1 --no-audit --no-fund");
  console.log("  node " + path.join(__dirname, "fixtures", "generar-tarjeta-pdf.js"));
  console.log("\nNo se corre nada y no se da nada por probado.\n");
  process.exit(2);
}

const pdfMin    = fs.readFileSync(path.join(LIBS, "node_modules/pdfjs-dist/build/pdf.min.js"));
const pdfWorker = fs.readFileSync(path.join(LIBS, "node_modules/pdfjs-dist/build/pdf.worker.min.js"));
const jspdfMin  = fs.readFileSync(path.join(LIBS, "node_modules/jspdf/dist/jspdf.umd.min.js"));
const pdfBytes  = fs.readFileSync(PDF);

let fallos = 0;
const ok = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();

  /* La red externa sigue cortada. La diferencia con los otros arneses: los
     tres archivos de cdnjs se RESPONDEN con la librería real del disco. */
  let servidos = [];
  await page.route("**/*", route => {
    const url = route.request().url();
    if (/^file:/.test(url)) return route.continue();
    if (/pdf\.min\.js/.test(url))        { servidos.push("pdf.min.js");    return route.fulfill({ contentType:"application/javascript", body: pdfMin }); }
    if (/pdf\.worker\.min\.js/.test(url)){ servidos.push("pdf.worker.min.js"); return route.fulfill({ contentType:"application/javascript", body: pdfWorker }); }
    if (/jspdf/.test(url))               { servidos.push("jspdf");         return route.fulfill({ contentType:"application/javascript", body: jspdfMin }); }
    return route.abort();
  });

  page.on("pageerror", e => { console.log("  >> PAGEERROR:", e.message); fallos++; });

  /* La capa inteligente responde lo que un modelo respondería con ESTE texto.
     No inventa: lee el texto que le llega y sólo devuelve lo que está ahí. */
  await page.addInitScript(() => {
    window.__PROMPTS__ = [];
    window.claude = { use: async n => {
      if (n !== "sample") return null;
      return {
        limits: async () => ({ maxPromptBytes: 65536 }),   // sin `images`: la vista del PM
        json: async (prompt) => {
          window.__PROMPTS__.push(prompt);
          const tiene = s => prompt.includes(s);
          if (!tiene("XKD9P2")) return { items: [] };
          return { items: [{
            type:"flight", title:"Buenos Aires → Madrid",
            start:"2026-11-10T23:55", end:"", from:"EZE", to:"MAD",
            provider:"Aerolíneas Argentinas", flightNumber:"AR 1304",
            confirmation:"XKD9P2", seat:"14A", terminal:"A", gate:"B12",
            boardingTime:"23:05", address:"", phone:"", cost:"", currency:"", notes:""
          }]};
        }
      };
    }};
  });

  await page.goto("file://" + APP);
  await page.waitForTimeout(1500);

  console.log("\n· la librería real carga en la página");
  ok(servidos.includes("pdf.min.js"), "la app pidió pdf.min.js y se le sirvió el real");
  const libOk = await page.evaluate(() => !!(window.pdfjsLib && typeof window.pdfjsLib.getDocument === "function"));
  ok(libOk, "window.pdfjsLib quedó definida con getDocument");
  const ver = await page.evaluate(() => window.pdfjsLib && window.pdfjsLib.version);
  ok(ver === "3.11.174", `y es la versión que la app fija: ${ver}`);

  console.log("\n· el motor extrae el texto con el pdf.js REAL, dentro del navegador");
  const extraido = await page.evaluate(async bytes => {
    const blob = new Blob([new Uint8Array(bytes)], {type:"application/pdf"});
    const r = await ImportEngine.extractPdfText(blob);
    const ev = ImportEngine.evaluateText(r.texto, "normal");
    return { paginas:r.paginas, caracteres:r.texto.length, suficiente:ev.suficiente,
             medida:ev.medida, tieneCodigo:r.texto.includes("XKD9P2"),
             tieneAsiento:r.texto.includes("14A"), tieneVuelo:r.texto.includes("AR 1304") };
  }, Array.from(pdfBytes));
  ok(extraido.paginas === 1, `una página (${extraido.paginas})`);
  ok(extraido.suficiente, `la capa de texto alcanza: ${JSON.stringify(extraido.medida)}`);
  ok(extraido.tieneCodigo, "el código de reserva sobrevive la extracción");
  ok(extraido.tieneAsiento && extraido.tieneVuelo, "el asiento y el número de vuelo también");

  console.log("\n· el pdf.js real DIBUJA la página (el visor D3 que nunca se había corrido)");
  const render = await page.evaluate(async bytes => {
    const blob = new Blob([new Uint8Array(bytes)], {type:"application/pdf"});
    const imgs = await ImportEngine.renderPdfPagesToImages(blob, {scale:1.6});
    if (!imgs.length) return { n:0 };
    const b = imgs[0];
    // ¿la imagen tiene tinta, o es un rectángulo blanco?
    const url = URL.createObjectURL(b);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const c = document.createElement("canvas");
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext("2d").drawImage(im, 0, 0);
    const d = c.getContext("2d").getImageData(0,0,c.width,c.height).data;
    let oscuros = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128 && d[i+3] > 0) oscuros++;
    URL.revokeObjectURL(url);
    return { n:imgs.length, bytes:b.size, tipo:b.type, w:im.naturalWidth, h:im.naturalHeight, oscuros };
  }, Array.from(pdfBytes));
  ok(render.n === 1, `devolvió una imagen por página (${render.n})`);
  ok(render.bytes > 3000, `y pesa de verdad: ${render.bytes} bytes (${render.tipo})`);
  ok(render.w > 800 && render.h > 1100, `con el tamaño de una A4 a escala 1.6: ${render.w}x${render.h}`);
  ok(render.oscuros > 500, `LA PÁGINA TIENE TINTA: ${render.oscuros} píxeles oscuros — no es una hoja en blanco`);

  console.log("\n· la importación entera, tocando los botones, con la librería real");
  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(800);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(700); }
  await page.click("#imp"); await page.waitForTimeout(1600);

  const chooser = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="im_doc"]', e => e.click());
  (await chooser).setFiles(PDF);
  await page.waitForTimeout(1200);

  // Encolar el archivo NO es interpretarlo: hay que tocar el botón, como la persona.
  const runBtn = await page.$("#im-run");
  ok(!!runBtn, "el botón de interpretar aparece con el archivo en la cola");
  if (runBtn) await runBtn.click();
  await page.waitForFunction(() => (window.__PROMPTS__||[]).length > 0, null, {timeout:25000}).catch(()=>{});
  await page.waitForTimeout(2000);

  /* El PDF es una tarjeta de embarque y el viaje no tiene vuelos: la app entra
     en V2 de VAL-59 (el bug que el PM reportó). Se sigue el camino que él
     seguiría: crear el vuelo con lo que dice la tarjeta. */
  const pantalla = await page.evaluate(() => document.body.innerText);
  ok(/no tiene vuelo al que engancharse/i.test(pantalla),
     "reconoce que es una tarjeta de embarque sin vuelo, en vez de crear una reserva suelta (VAL-59)");
  const crear = await page.$("#im-crear");
  ok(!!crear, "ofrece crear el vuelo con los datos de la tarjeta");
  if (crear) { await crear.click(); await page.waitForTimeout(1500); }

  const enRevision = await page.evaluate(() => document.body.innerText);
  ok(/Vuelo nuevo|Revisá|Guardar/i.test(enRevision), "pasa a la revisión antes de escribir nada");

  const guardar = await page.$("#im-save");
  ok(!!guardar, "hay un botón de guardar en la revisión");
  if (guardar) { await guardar.click(); await page.waitForTimeout(2500); }

  const guardado = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if (!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i => ({type:i.type, conf:i.confirmation, seat:i.seat, gate:i.gate,
                          fn:i.flightNumber, from:i.from, to:i.to, docs:(i.docs||[]).length}));
  });
  info("reservas guardadas: " + JSON.stringify(guardado));
  const g0 = (guardado && guardado[0]) || {};
  ok(guardado && guardado.length === 1, `quedó UNA reserva, no dos (${guardado ? guardado.length : "ninguna"})`);
  ok(g0.type === "flight", "y es un vuelo, no una nota suelta");
  ok(g0.conf === "XKD9P2", "con el código de reserva que estaba impreso en el PDF");
  ok(g0.seat === "14A" && g0.gate === "B12", "con el asiento y la puerta de la tarjeta");
  ok(g0.from === "EZE" && g0.to === "MAD", "y con la ruta");
  ok(g0.docs === 1, "el documento original quedó adjunto a la reserva (VAL-58)");

  const cuerpos = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("valija.doc.")).length);
  ok(cuerpos === 1, `y su archivo está guardado, uno solo, sin huérfanos (${cuerpos})`);

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — con el pdf.js REAL");
  console.log("====================================================");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
