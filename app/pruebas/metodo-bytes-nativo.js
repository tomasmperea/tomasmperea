/* ============================================================
   EL MÉTODO `bytes()` DE BLOB — la causa de los cuatro reportes

   De dónde sale: la v18 le puso a la app una línea que dice qué observó.
   El PM sacó la captura desde su teléfono y la línea decía:

       informa 123129 B · memoria 0 B · application/pdf · v18

   Un solo intento. "memoria", cero bytes, sobre un archivo que informa
   123 KB. Los tres caminos de lectura —arrayBuffer, slice, FileReader—
   no aparecen porque nunca corrieron.

   Por qué: `leerBytesConDiagnostico` empezaba con

       if (file && file.bytes) { ...usar esos bytes...; return; }

   y `bytes` es el nombre de un MÉTODO de Blob. `Blob.prototype.bytes()`
   existe en los navegadores nuevos y devuelve una promesa de bytes; en el
   Chromium de este entorno no existe, y por eso ningún arnés lo vio. En
   el teléfono del PM `file.bytes` era esa función: verdadera, así que la
   guarda entraba, y `normalizarBytes` de una función da cero bytes.

   Todo archivo que pasaba por ahí volvía vacío antes de que existiera
   cualquier otro camino. Los tres arreglos anteriores tocaban código
   debajo de ese `return`.

   ESTE ARNÉS SE ESCRIBE DESDE EL CONTRATO, NO DESDE LA HIPÓTESIS. Instala
   `bytes` donde el navegador lo pone —en `Blob.prototype`, como método que
   devuelve `Promise<Uint8Array>`— y no toca nada de la app. Si el arreglo
   está, el archivo se lee igual. Si no, vuelve vacío.

   Y cubre la otra mitad de la explicación: un archivo MÁS GRANDE que el
   tope nunca pasaba por esa compuerta, porque se va a recomprimir por
   canvas. Eso es lo que hacía entrar la foto de la cámara de 2,7 MB
   mientras un PDF de 20 KB fallaba. La diferencia era el tamaño, no el
   origen del archivo.

       node app/pruebas/metodo-bytes-nativo.js [ruta/absoluta/al/valija.html]
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
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

/* El contrato, tal como lo define la plataforma: un método de instancia en
   Blob.prototype que devuelve Promise<Uint8Array>. No se parchea la app; se
   le agrega al navegador lo que a este Chromium le falta. */
const instalarBytesNativo = () => {
  if ("bytes" in Blob.prototype) { window.__YATENIA__ = true; return; }
  window.__BYTESLLAMADO__ = 0;
  Object.defineProperty(Blob.prototype, "bytes", {
    configurable: true, writable: true, enumerable: false,
    value: function bytes() {
      window.__BYTESLLAMADO__++;
      return this.arrayBuffer().then(b => new Uint8Array(b));
    }
  });
};

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
  await page.addInitScript(instalarBytesNativo);
  await page.addInitScript(() => {
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

  /* EL SABOTAJE LLEGÓ. Sin esto, todo lo de abajo puede pasar porque el
     método no se instaló y el arnés no probó nada. */
  console.log("\n· el navegador ahora tiene el método, como el del PM");
  const estado = await page.evaluate(() => {
    const f = new File([new Uint8Array([1,2,3])], "x.pdf", {type:"application/pdf"});
    return { enPrototipo: "bytes" in Blob.prototype, tipo: typeof f.bytes,
             esVerdadero: !!f.bytes, yaLoTenia: !!window.__YATENIA__ };
  });
  info("estado: " + JSON.stringify(estado));
  ok(estado.enPrototipo && estado.tipo === "function",
     "`bytes` está en Blob.prototype y es una función: el sabotaje se aplicó");
  ok(estado.esVerdadero,
     "y es VERDADERA, que es exactamente lo que engañaba a la compuerta");

  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(900);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(700); }

  /* ---------- gesto 1: adjuntar a una reserva ---------- */
  console.log("\n· gesto 1 — adjuntar el PDF a una reserva (lo que el PM vio en la captura 2 y 3)");
  await page.click("#additem"); await page.waitForTimeout(700);
  await page.fill("#i_title","Vuelo a Madrid");
  const ch1 = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="doc_file"]', e => e.click());
  (await ch1).setFiles(PDF);
  await page.waitForTimeout(2500);

  const bloque = await page.evaluate(() => {
    const b = document.getElementById("doc-block");
    return b ? b.innerText.replace(/\n+/g," / ") : "(sin bloque)";
  });
  info("bloque: " + JSON.stringify(bloque.slice(0,150)));
  ok(!/no pude leer|vac[íi]o/i.test(bloque), "no dice que no lo pudo leer");
  ok(/KB|MB/.test(bloque), "y muestra el peso real del documento");
  /* La línea de observación NO tiene que aparecer, porque no hubo falla. Si
     apareciera con "memoria", sería el defecto del PM reproducido. */
  ok(!/memoria/.test(bloque), "y no quedó ninguna línea de observación que hable de `memoria`");

  await page.click("#save"); await page.waitForTimeout(1500);
  const g1 = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if(!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i=>({t:i.title, docs:(i.docs||[]).length}));
  });
  info("guardado: " + JSON.stringify(g1));
  ok(!!g1 && g1.some(i=>i.docs === 1), "la reserva quedó guardada CON su documento");

  /* ---------- gesto 2: importar ---------- */
  console.log("\n· gesto 2 — importar el mismo PDF (lo que el PM vio en la captura 1)");
  await page.click("#imp"); await page.waitForTimeout(1600);
  const ch2 = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="im_doc"]', e => e.click());
  (await ch2).setFiles(PDF);
  await page.waitForTimeout(1800);

  const cola = await page.evaluate(() => {
    const f = document.querySelector("#im-queue, .imp-files");
    return f ? f.innerText.replace(/\n+/g," / ") : document.body.innerText.slice(0,300);
  });
  info("cola: " + JSON.stringify(cola.slice(0,170)));
  ok(!/no pude leer/i.test(cola), "la cola de importar no dice que no lo pudo leer");
  ok(!/memoria \d+ B/.test(cola), "ni muestra `memoria N B`, que era la firma del defecto");

  /* Se mira si el botón está habilitado ANTES de tocarlo. Con el defecto
     presente el archivo queda ilegible y "Interpretar" queda apagado; un
     click a ciegas cuelga treinta segundos y mata el arnés en vez de
     reportar. Un control negativo tiene que fallar prolijo. */
  const runEstado = await page.evaluate(() => {
    const b = document.getElementById("im-run");
    return b ? { existe:true, off: !!b.disabled } : { existe:false };
  });
  info("botón Interpretar: " + JSON.stringify(runEstado));
  ok(runEstado.existe && !runEstado.off,
     "\"Interpretar\" quedó habilitado: el archivo se pudo leer");
  if (runEstado.existe && !runEstado.off) {
    await page.click("#im-run");
    await page.waitForTimeout(3000);
  } else {
    info("no se toca Interpretar porque está apagado — eso ya es la falla");
  }
  const eligiendo = await page.$("#im-choice");
  if (eligiendo) {
    await page.evaluate(() => { const b = document.querySelector('#im-choice [data-c]'); if(b) b.click(); });
    await page.waitForTimeout(300);
    const elegir = await page.$("#im-choicesave");
    if (elegir) { await elegir.click(); await page.waitForTimeout(1500); }
  } else {
    const crear = await page.$("#im-crear"); if (crear) { await crear.click(); await page.waitForTimeout(1500); }
  }
  const guardar = await page.$("#im-save"); if (guardar) { await guardar.click(); await page.waitForTimeout(2500); }

  const g2 = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if(!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i=>({t:i.title, seat:i.seat, docs:(i.docs||[]).length}));
  });
  info("guardado: " + JSON.stringify(g2));
  ok(!!g2 && g2.some(i=>(i.docs||0) >= 2), "el documento de la tarjeta quedó adjunto también");

  /* ---------- la otra mitad de la explicación ----------
     Por qué la foto de la cámara de 2,7 MB entraba mientras un PDF de 20 KB
     fallaba: un archivo más grande que el tope no pasa por la compuerta, se
     va a recomprimir. No es una conjetura sobre el origen del archivo; es el
     tope, y se mide. */
  console.log("\n· por qué la foto de 2,7 MB entraba y el PDF de 20 KB no");
  const caminos = await page.evaluate(async () => {
    const tope = AdjuntosEngine.TOPE_ARCHIVO_BYTES;
    const vias = [];
    const hacer = (n) => { const a = new Uint8Array(n); for (let i=0;i<n;i++) a[i] = i & 255; return a; };
    for (const [nombre, n] of [["chico, como el PDF del mail", 20855], ["grande, como la foto", 2700000]]) {
      const f = new File([hacer(n)], "x.png", {type:"image/png"});
      const r = await AdjuntosEngine.prepararDocumento(f, {espacioUsado:0, cantidadActual:0});
      vias.push({ nombre, size: f.size, estado: r.estado,
                  detalle: (r.error && r.error.detalle) || null,
                  paso: r.recompresion ? "recomprimido" : "leído" });
    }
    return { tope, vias };
  });
  info("tope del archivo: " + caminos.tope + " B");
  caminos.vias.forEach(v => info(`${v.nombre}: ${v.size} B → ${v.paso} (${v.estado})`));
  const chico = caminos.vias[0], grande = caminos.vias[1];
  ok(chico.size < caminos.tope && grande.size > caminos.tope,
     `uno está debajo del tope (${caminos.tope} B) y el otro arriba: es la única diferencia entre los dos`);
  ok(!/memoria/.test(chico.detalle || ""),
     "el chico, que SÍ pasa por la compuerta de lectura, ya no vuelve vacío por `memoria`");
  /* El grande no llega a la compuerta: se va a recomprimir. Acá no hay
     recompresor configurado, así que termina en "sin-recompresor" — y eso
     mismo lo demuestra, porque es un código que sólo existe del lado de
     rutaGrande. Lo que importa es que su motivo NO sea la lectura. */
  info("motivo del grande: " + grande.estado + " · " + JSON.stringify(grande.detalle));
  ok(!/memoria/.test(grande.detalle || ""),
     "y el grande ni siquiera pasa por la lectura: por eso la foto de 2,7 MB entraba en el teléfono");

  const llamado = await page.evaluate(() => window.__BYTESLLAMADO__);
  info(`el método nativo bytes() se llamó ${llamado} vez/veces: la app no lo usa, lo ignora`);

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — con el método bytes() del navegador nuevo");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
