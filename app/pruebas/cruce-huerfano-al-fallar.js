/* ============================================================
   H1, segunda puerta: el cuerpo se escribió y el ítem NO.

   El arnés de QA (`cruce-adjunto-huerfano.js`) cubre el huérfano que nacía de
   atribuir los documentos por NOMBRE de archivo. Queda la otra puerta al mismo
   huérfano: `doSaveReview` escribe primero el cuerpo del documento
   (`Store.saveDocBody`) y recién después el ítem que lo nombra
   (`Store.saveItem`). Si el segundo falla, el cuerpo ya está en la base y
   ningún `item.docs` lo referencia: ni `delItem` ni `delTrip` lo borran nunca.

   Este arnés fuerza exactamente eso y comprueba que no quede nada escrito.

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/cruce-huerfano-al-fallar.js
       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/cruce-huerfano-al-fallar.js /ruta/a/otra/copia.html

   El control negativo —que la aserción pueda fallar de verdad— se corre contra
   una copia del HTML sin el barrido:

       sed 's/if(t.guardado && !t.referenciado) await Store.delDocBody(trip.id, t.r.doc.id);//' \
         app/valija.html > /tmp/sin-barrido.html
       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/cruce-huerfano-al-fallar.js /tmp/sin-barrido.html
       → FALLA  no quedó ningún cuerpo de documento escrito

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA
   ------------------------------------------------------------
   · No hay ningún gesto, en este entorno, que haga rechazar a la base: acá no
     existe `claude.use("db")` y el camino de `localStorage` se traga su propia
     cuota (`Store.saveLocal` atrapa y sigue). Así que la falla se inyecta en
     la COSTURA entre la app y la capa de datos —`Store.saveItem` rechaza—, que
     es el punto exacto donde la base real rechazaría. Eso es un sustituto: lo
     que se prueba es la reacción de `doSaveReview`, no que la base falle así.
   · Chromium de escritorio no es el teléfono del PM.
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const path = require("path");

const APP = "file://" + (process.argv[2] || path.resolve(__dirname, "..", "valija.html"));

let ok = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { ok++; console.log("  ok     " + msg); }
  else { fail++; console.log("  FALLA  " + msg); }
}
async function test(nombre, fn) {
  console.log("\n· " + nombre);
  try { await fn(); }
  catch (e) { fail++; console.log("  FALLA (excepción) " + (e && e.message)); console.log(e && e.stack); }
}

const TRIP = {
  id: "t1", name: "Escapada a Lobos", destination: "Lobos",
  startDate: "2026-09-13", endDate: "2026-09-15", hue: 214,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", notes: ""
};

const MARCA = "MARCA-VOUCHER-A";
const TEXTO = [
  "COMPROBANTE DE PASAJE - " + MARCA,
  "LOBOS BUS   Codigo de reserva LB0AAA11",
  "Lobos  ->  Buenos Aires    13/09/2026 19:01 a 20:31",
  "Pasajero: Clara Sanchez. Presentarse quince minutos antes de la salida en la boleteria."
].join("\n");
const RESERVA = {
  type: "transfer", title: "Lobos → Buenos Aires", start: "2026-09-13T19:01", end: "2026-09-13T20:31",
  from: "Lobos", to: "Buenos Aires", provider: "Lobos Bus", confirmation: "LB0AAA11",
  flightNumber: "", seat: "", terminal: "", gate: "", boardingTime: "",
  address: "", phone: "", cost: "", currency: "", notes: ""
};

function pdfDe(nombre) {
  const buf = Buffer.alloc(20000, 0x41);
  buf.write("%PDF-1.4 " + MARCA);
  return { name: nombre, mimeType: "application/pdf", buffer: buf };
}

async function nuevaPagina(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(({ datos, marca, texto, reserva }) => {
    const sample = {
      limits: async () => ({ maxPromptBytes: 200000 }),
      json: async (prompt) => {
        if (String(prompt).indexOf(marca) < 0) return { items: [] };
        if (/"documentos"/.test(String(prompt))) return { documentos: [{ documento: 1, items: [reserva] }] };
        return { items: [reserva] };
      }
    };
    window.claude = { use: async k => (k === "sample" ? sample : null) };

    window.pdfjsLib = {
      version: "3.11.174-simulado",
      GlobalWorkerOptions: {},
      getDocument: function (params) {
        const bytes = new Uint8Array(params.data);
        let cabeza = "";
        for (let i = 0; i < Math.min(bytes.length, 200); i++) cabeza += String.fromCharCode(bytes[i]);
        const lineas = cabeza.indexOf(marca) >= 0 ? String(texto).split("\n") : [];
        return { promise: Promise.resolve({
          numPages: 1,
          getPage: () => Promise.resolve({
            getTextContent: () => Promise.resolve({
              items: lineas.map(str => ({ str: str, hasEOL: true })), styles: {}
            })
          }),
          destroy: function () {}
        }) };
      }
    };

    try {
      if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos));
    } catch (e) {}
  }, { datos: { trips: [TRIP], items: { t1: [] }, packing: {} }, marca: MARCA, texto: TEXTO, reserva: RESERVA });

  await page.goto(APP + "#/trip/t1");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  await test("si la reserva no se puede escribir, el cuerpo del documento tampoco queda", async () => {
    const page = await nuevaPagina(browser);

    // Gesto real hasta el último toque: abrir, tocar "Archivo", elegir el PDF,
    // interpretar y llegar a la revisión.
    await page.locator("#imp").click();
    await page.waitForSelector('[data-pick="im_doc"]', { timeout: 10000 });
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 10000 }),
      page.locator('[data-pick="im_doc"]').click()
    ]);
    await chooser.setFiles([pdfDe("comprobante.pdf")]);
    await page.waitForTimeout(250);
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout: 20000 });

    // La única parte que no es un gesto: la base rechaza la escritura del ítem
    // DESPUÉS de que el cuerpo del documento ya se guardó. Se inyecta en la
    // costura con la capa de datos, que es donde la base real rechazaría.
    await page.evaluate(() => {
      window.__ITEMS__ = 0;
      Store.saveItem = async () => { window.__ITEMS__++; throw Object.assign(new Error("unavailable"), { code: "unavailable" }); };
    });

    await page.locator("#im-save").click();
    await page.waitForTimeout(900);

    const intentos = await page.evaluate(() => window.__ITEMS__);
    assert(intentos > 0, `se intentó escribir la reserva (intentos: ${intentos})`);

    const claves = await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf("valija.doc.") === 0));
    console.log(`  info   cuerpos de documento en localStorage: ${claves.length}`);
    assert(claves.length === 0,
      `no quedó ningún cuerpo de documento escrito (quedaron ${claves.length}: ${JSON.stringify(claves)}) — si la reserva no se guardó, nadie puede referenciar ese cuerpo y nadie lo va a borrar nunca`);

    const items = await page.evaluate(() => Store.itemsOf("t1"));
    assert(items.length === 0, `no quedó ninguna reserva a medias (hubo ${items.length})`);

    const toast = await page.locator(".toast").allInnerTexts().catch(() => []);
    assert(toast.join(" ").trim().length > 0, `se le dice a la persona que la escritura falló: ${JSON.stringify(toast.join(" ").slice(0, 120))}`);

    const btn = await page.locator("#im-save").innerText().catch(() => "");
    assert(/Guardar/i.test(btn), `el botón vuelve a quedar disponible para reintentar ("${btn.trim()}")`);

    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================");
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
