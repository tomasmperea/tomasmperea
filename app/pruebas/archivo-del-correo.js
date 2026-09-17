/* ============================================================
   UN ARCHIVO ELEGIDO DESDE EL CORREO — el caso del PM

   De dónde sale: el 16/09 el PM adjuntó a una reserva un PDF que le
   había llegado por mail (RLB_CLARA_SANCHEZ…) desde su teléfono, y la
   app le dijo "Ese archivo está vacío: no tiene nada adentro". No lo
   estaba. En la misma sesión, una foto sacada con la cámara entró
   perfecto y hasta se redujo sola de 2,7 MB a 112 KB.

   Esa diferencia es el dato: la foto de la cámara es un archivo que el
   navegador acaba de crear y es suyo. El PDF del mail llega como
   `content://`, servido por Gmail o Drive, y no le pertenece al
   navegador: el sistema se lo presta mientras haga falta.

   Y la app le soltaba la mano antes de usarlo. `wireFilePick` limpiaba
   `input.value` —hace falta para poder volver a elegir el mismo
   archivo— ANTES de entregarle el archivo a quien lo iba a leer. En una
   computadora no pasa nada, porque el archivo es del disco y sigue ahí.
   En Android, limpiar el campo suelta el préstamo: el archivo que
   llega ya está vacío.

   Este arnés simula eso: envuelve los File del selector para que se
   vacíen en cuanto alguien limpia `input.value`. No parchea la app:
   parchea el navegador.

   Cubre los DOS caminos, porque el PM probó los dos:
     · adjuntar directo a una reserva;
     · importar y que el documento quede adjunto.

   Con la app arreglada —limpia el campo al ABRIR el selector, no al
   elegir— el sistema ya no llega a soltar nada, así que el arnés no
   puede medirse por "cuántos soltó". Mide otra cosa: que la app limpia,
   que ninguna limpieza pescó un archivo vivo, y —provocándolo a mano al
   final— que el sabotaje sigue funcionando. Ver el bloque de cierre.

       node app/pruebas/archivo-del-correo.js [ruta/al/valija.html]
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

const simularAndroid = () => {
  /* El préstamo del sistema: cada File del selector se vacía en cuanto
     alguien limpia el `value` del campo del que salió. */
  window.__SOLTADOS__ = 0;   // archivos que el sistema retiró de las manos de la app
  window.__LIMPIEZAS__ = 0;  // veces que la app limpió el campo del archivo
  const vivos = new Map();   // input -> [proxies]
  const descF = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
  const descV = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  Object.defineProperty(HTMLInputElement.prototype, "value", {
    configurable: true,
    get(){ return descV.get.call(this); },
    set(v){
      if (this.type === "file" && v === "") {
        window.__LIMPIEZAS__++;
        (vivos.get(this) || []).forEach(p => { if(!p.__muerto){ p.__muerto = true; window.__SOLTADOS__++; } });
        vivos.delete(this);
      }
      return descV.set.call(this, v);
    }
  });

  Object.defineProperty(HTMLInputElement.prototype, "files", {
    configurable: true,
    get(){
      const reales = descF.get.call(this);
      if (!reales || !reales.length) return reales;
      const ya = vivos.get(this);
      if (ya && ya.length === reales.length) { const l = ya.slice(); l.item = i => l[i]; return l; }
      const lista = Array.from(reales).map(f => {
        const p = {
          __muerto: false,
          name: f.name, type: f.type, lastModified: f.lastModified,
          get size(){ return p.__muerto ? 0 : f.size; },
          slice: (...a) => p.__muerto ? new Blob([]) : f.slice(...a),
          arrayBuffer(){ return p.__muerto ? Promise.resolve(new ArrayBuffer(0)) : f.arrayBuffer(); },
          text(){ return p.__muerto ? Promise.resolve("") : f.text(); },
          stream(){ return p.__muerto ? new Blob([]).stream() : f.stream(); }
        };
        Object.setPrototypeOf(p, File.prototype);
        return p;
      });
      vivos.set(this, lista);
      const l = lista.slice(); l.item = i => l[i];
      return l;
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
  await page.addInitScript(simularAndroid);
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
  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(900);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(700); }

  /* ---------- camino 1: adjuntar directo a una reserva ---------- */
  console.log("\n· camino 1 — adjuntar el PDF del mail a una reserva nueva");
  await page.click("#additem"); await page.waitForTimeout(700);
  await page.fill("#i_title","Vuelo a Madrid");
  await page.evaluate(() => { const b = document.querySelector('[data-pick="doc_file"]'); if(b) b.scrollIntoView(); });
  const ch1 = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="doc_file"]', e => e.click());
  (await ch1).setFiles(PDF);
  await page.waitForTimeout(2500);

  const t1 = await page.evaluate(() => document.body.innerText);
  info("archivos soltados por el sistema: " + await page.evaluate(() => window.__SOLTADOS__));
  ok(!/está vacío|no tiene nada adentro/i.test(t1), "no dice que el archivo está vacío — porque no lo está");
  const fila = await page.evaluate(() => {
    const f = document.querySelector("#doc-block .imp-file");
    return f ? f.innerText.replace(/\n+/g," · ").slice(0,90) : null;
  });
  ok(!!fila && /KB|MB/.test(fila), "la fila del documento muestra su peso: " + JSON.stringify(fila));

  await page.click("#save"); await page.waitForTimeout(1500);
  const g1 = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if(!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i=>({t:i.title, docs:(i.docs||[]).length}));
  });
  info("guardado: " + JSON.stringify(g1));
  ok(!!g1 && g1.some(i=>i.docs === 1), "la reserva quedó guardada CON su documento");

  /* ---------- camino 2: importar ---------- */
  console.log("\n· camino 2 — importar la tarjeta y que el documento quede adjunto");
  await page.click("#imp"); await page.waitForTimeout(1600);
  const ch2 = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval('[data-pick="im_doc"]', e => e.click());
  (await ch2).setFiles(PDF);
  await page.waitForTimeout(1200);
  const run = await page.$("#im-run"); if (run) await run.click();
  await page.waitForTimeout(3000);
  /* Como el camino 1 ya dejó un vuelo cargado, la tarjeta NO cae en "no hay
     vuelos" (V2) sino en "hay uno, ¿es este?" (V4). Se contesta que sí, que es
     el mismo vuelo: es lo que haría la persona, y además ejercita el camino
     donde la tarjeta COMPLETA un vuelo existente y le adjunta su archivo. */
  const eligiendo = await page.$("#im-choice");
  if (eligiendo) {
    const opciones = await page.evaluate(() => Array.from(document.querySelectorAll('#im-choice [data-c]')).map(b=>b.dataset.c));
    info('opciones de la pregunta: ' + JSON.stringify(opciones));
    await page.evaluate(() => { const b = document.querySelector('#im-choice [data-c]'); if(b) b.click(); });
    await page.waitForTimeout(300);
    const elegir = await page.$("#im-choicesave");
    if (elegir) { await elegir.click(); await page.waitForTimeout(1500); }
  } else {
    const crear = await page.$("#im-crear"); if (crear) { await crear.click(); await page.waitForTimeout(1500); }
  }
  const guardar = await page.$("#im-save"); if (guardar) { await guardar.click(); await page.waitForTimeout(2500); }

  const t2 = await page.evaluate(() => document.body.innerText);
  ok(!/quedó afuera|está vacío/i.test(t2), "el documento NO queda afuera al importar");
  const g2 = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if(!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return { conDoc: its.filter(i=>(i.docs||[]).length).length, total: its.length,
             detalle: its.map(i=>({t:i.title, seat:i.seat, gate:i.gate, docs:(i.docs||[]).length})) };
  });
  info("detalle: " + JSON.stringify(g2 && g2.detalle));
  console.log("  --- pantalla ---"); console.log("      " + t2.split("\n").filter(Boolean).slice(-6).join(" / "));
  info("reservas: " + JSON.stringify(g2));
  ok(g2 && g2.total === 1, `la tarjeta completó el vuelo que ya estaba, no creó uno duplicado (${g2 && g2.total})`);
  /* La tarjeta completa asiento, puerta, terminal y hora de embarque —los
     campos declarados en CAMPOS_COMPLETABLES— y NO pisa el resto. Que el
     número de vuelo siga vacío es deliberado: el vuelo lo cargó la persona. */
  const v2 = (g2 && g2.detalle[0]) || {};
  ok(v2.seat === "14A" && v2.gate === "B12",
     `el vuelo se completó con el asiento y la puerta de la tarjeta (${v2.seat} / ${v2.gate})`);
  ok(v2.docs === 2, `y quedó con sus DOS documentos, el de antes y el de la tarjeta (${v2.docs})`);

  /* ---------- que el sabotaje SÍ llegó ----------

     Acá hay una trampa, y la pisamos. La primera versión de este bloque
     exigía `__SOLTADOS__ > 0`: "si el sistema no soltó ningún archivo, el
     sabotaje no se aplicó y el arnés no probó nada". Era la regla correcta
     mal aplicada, porque mide la cosa equivocada.

     Cuando el arnés se escribió, la app limpiaba el campo DESPUÉS de elegir,
     con el archivo en la mano, así que el sistema soltaba y el contador
     subía. Arreglada la app —limpia al ABRIR—, ya no hay ningún momento en
     que una limpieza caiga sobre un archivo vivo, y `__SOLTADOS__` queda en
     cero. Cero es exactamente lo que queremos que pase. Exigirlo mayor que
     cero convierte el arreglo en una falla.

     Lo que hay que demostrar son tres cosas distintas, y ninguna es
     "soltados > 0":

       1. la app limpia el campo  → `__LIMPIEZAS__ > 0`. Si no limpiara
          nunca, este arnés no estaría pasando por el tramo del bug;
       2. ninguna limpieza pescó un archivo vivo → `__SOLTADOS__ === 0`;
       3. y el sabotaje funciona de verdad → se prueba abajo, provocándolo.

     El (3) es el caso que falla si el parche al navegador no llegó, que es
     lo que pedía la regla de `tres-caminos-de-lectura.js`. Antes venía
     gratis del propio bug; ahora hay que provocarlo a mano, porque la app
     dejó de provocarlo. */
  const limpiezas = await page.evaluate(() => window.__LIMPIEZAS__);
  const soltados  = await page.evaluate(() => window.__SOLTADOS__);
  info(`limpiezas del campo: ${limpiezas} · archivos soltados: ${soltados}`);
  ok(limpiezas > 0, `la app limpió el campo ${limpiezas} vez/veces: el arnés pasó por el tramo del bug`);
  ok(soltados === 0, `y ninguna limpieza cayó sobre un archivo vivo (${soltados} soltados)`);

  /* (3) El control: un campo propio, un archivo adentro, leído —para que el
     envoltorio lo registre como vivo— y recién entonces limpiado. Si el
     parche al navegador está puesto, el archivo se suelta y el contador
     sube. Si `addInitScript` no llegó, no sube, y este caso FALLA. */
  await page.evaluate(() => {
    const i = document.createElement("input");
    i.type = "file"; i.id = "__control__"; i.style.display = "none";
    document.body.appendChild(i);
  });
  const chC = page.waitForEvent("filechooser", {timeout:10000});
  await page.$eval("#__control__", e => e.click());
  (await chC).setFiles(PDF);
  await page.waitForTimeout(400);
  const control = await page.evaluate(() => {
    const i = document.getElementById("__control__");
    const antes = window.__SOLTADOS__;
    const f = (i.files || [])[0];          // leerlo lo registra como vivo
    const pesoAntes = f ? f.size : null;
    i.value = "";                          // y esto se lo tiene que llevar
    return { antes, despues: window.__SOLTADOS__, pesoAntes, pesoDespues: f ? f.size : null };
  });
  info("control del sabotaje: " + JSON.stringify(control));
  ok(control.despues > control.antes,
     `limpiar el campo con un archivo vivo adentro SÍ lo suelta (${control.antes} → ${control.despues}): el parche al navegador llegó`);
  ok(control.pesoAntes > 0 && control.pesoDespues === 0,
     `y el archivo soltado queda vacío, que es el síntoma del PM (${control.pesoAntes} B → ${control.pesoDespues} B)`);

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — con archivos prestados por el sistema");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
