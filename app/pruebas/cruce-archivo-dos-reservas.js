/* ============================================================
   QA · cruce VAL-58 × VAL-60: UN archivo produce DOS reservas.

   El prompt de lote de VAL-60 (línea ~4165 de valija.html) pide un JSON
   `{"documentos":[{"documento":1,"items":[...]}]}` donde cada `documento`
   puede traer VARIOS `items` -es el caso real de un itinerario en un solo
   PDF con ida y vuelta-. `doSaveReview` (~línea 9525) dice, en su propio
   comentario: "UNO por archivo, al destino de la PRIMERA reserva que salió
   de ese archivo". Este arnés comprueba, TOCANDO LOS CONTROLES, qué le
   queda a la persona cuando eso pasa: ¿se entera de que la segunda reserva
   se guardó sin su comprobante, o no hay ninguna señal?

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/cruce-archivo-dos-reservas.js
       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/cruce-archivo-dos-reservas.js /ruta/a/otra/copia.html

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA
   ------------------------------------------------------------
   · Que un modelo real, de verdad, devuelva dos vuelos de un itinerario en
     un solo `items`. Se lo fuerza a mano con el simulador, escrito contra
     el esquema documentado en el comentario de línea 4359 y siguientes.
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
  id: "t1", name: "Escapada a Río", destination: "Río de Janeiro",
  startDate: "2026-09-20", endDate: "2026-09-27", hue: 214,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", notes: ""
};

const MARCA = "MARCA-ITINERARIO";
const IDA = {
  type: "flight", title: "", start: "2026-09-20T06:40", end: "2026-09-20T09:05",
  from: "EZE", to: "GIG", provider: "GOL", flightNumber: "G3 1234",
  confirmation: "K7QXPL", seat: "", terminal: "", gate: "", boardingTime: "",
  docType: "", address: "", phone: "", cost: "", currency: "", notes: ""
};
const VUELTA = {
  type: "flight", title: "", start: "2026-09-27T21:10", end: "2026-09-27T23:55",
  from: "GIG", to: "EZE", provider: "GOL", flightNumber: "G3 1245",
  confirmation: "K7QXPL", seat: "", terminal: "", gate: "", boardingTime: "",
  docType: "", address: "", phone: "", cost: "", currency: "", notes: ""
};

function pdfDe(nombre, bytes) {
  const buf = Buffer.alloc(bytes || 20000, 0x41);
  buf.write("%PDF-1.4 " + MARCA);
  return { name: nombre, mimeType: "application/pdf", buffer: buf };
}

const LIMITS_SIN_IMAGENES = { maxPromptBytes: 200000 };

async function nuevaPagina(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(({ datos, marca, ida, vuelta, limits }) => {
    const sample = {
      limits: async () => limits,
      json: async (prompt) => {
        if (String(prompt).indexOf(marca) < 0) return { items: [] };
        // UN documento, DOS items: el caso de un itinerario de ida y vuelta
        // en un solo PDF, tal como lo documenta el esquema del prompt.
        if (/"documentos"/.test(String(prompt))) {
          return { documentos: [{ documento: 1, items: [ida, vuelta] }] };
        }
        return { items: [ida, vuelta] };
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
        const esMarca = cabeza.indexOf(marca) >= 0;
        const lineas = esMarca ? [
          "ITINERARIO DE VIAJE - " + marca,
          "GOL LINHAS AEREAS",
          "Vuelo de ida: G3 1234  EZE -> GIG  20 SEP 2026  06:40 a 09:05",
          "Vuelo de vuelta: G3 1245  GIG -> EZE  27 SEP 2026  21:10 a 23:55",
          "Codigo de reserva: K7QXPL",
          "Pasajero: Clara Sanchez. Presentarse dos horas antes del vuelo en el mostrador de la aerolinea."
        ] : [];
        return { promise: Promise.resolve({
          numPages: 1,
          getPage: () => Promise.resolve({
            getTextContent: () => Promise.resolve({
              items: lineas.map(str => ({ str: str, hasEOL: true })),
              styles: {}
            })
          }),
          destroy: function () {}
        }) };
      }
    };

    try {
      if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos));
    } catch (e) {}
  }, {
    datos: { trips: [TRIP], items: { t1: [] }, packing: {} },
    marca: MARCA, ida: IDA, vuelta: VUELTA,
    limits: LIMITS_SIN_IMAGENES
  });

  await page.goto(APP + "#/trip/t1");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);
  return page;
}

async function abrirImportar(page) {
  await page.locator("#imp").click();
  await page.waitForSelector("#imp-live", { state: "attached", timeout: 10000 });
  await page.waitForSelector('[data-pick="im_doc"]', { timeout: 10000 });
}
async function tocarYElegir(page, archivos) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    page.locator('[data-pick="im_doc"]').click()
  ]);
  await chooser.setFiles(archivos);
  await page.waitForTimeout(250);
}
async function interpretar(page) { await page.locator("#im-run").click(); }
const itemsDe = page => page.evaluate(() => Store.itemsOf("t1"));

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  await test("un archivo, dos reservas (itinerario ida y vuelta): ¿se avisa cuál se queda sin comprobante?", async () => {
    const page = await nuevaPagina(browser);
    await abrirImportar(page);
    await tocarYElegir(page, [pdfDe("itinerario-ida-y-vuelta.pdf")]);
    await interpretar(page);
    await page.waitForSelector("#im-save", { timeout: 20000 });

    const tarjetas = await page.evaluate(() => [...document.querySelectorAll(".imp-card")].length);
    assert(tarjetas === 2, `las dos reservas del itinerario están para revisar (hubo ${tarjetas})`);

    await page.locator("#im-save").click();
    await page.waitForTimeout(700);

    const items = await itemsDe(page);
    assert(items.length === 2, `se guardaron las dos reservas (hubo ${items.length})`);
    const conDoc = items.filter(i => (i.docs || []).length > 0);
    const sinDoc = items.filter(i => (i.docs || []).length === 0);
    console.log(`  info   con documento: ${conDoc.length} (${conDoc.map(i=>i.flightNumber).join(", ")}) · sin documento: ${sinDoc.length} (${sinDoc.map(i=>i.flightNumber).join(", ")})`);
    assert(conDoc.length === 1 && sinDoc.length === 1,
      "confirmado: sólo UNA de las dos reservas queda con el archivo adjunto (comportamiento documentado como deliberado en el código)");

    // ¿La persona se entera de cuál se quedó sin comprobante?
    const cierre = await page.locator(".sheet-bd, .toast").allInnerTexts().catch(() => []);
    const textoCompleto = cierre.join(" \n ");
    console.log("  info   texto visible al cerrar: " + JSON.stringify(textoCompleto.slice(0, 300)));
    const nombraSegundoVuelo = new RegExp(sinDoc[0] ? sinDoc[0].flightNumber : "NO-HAY").test(textoCompleto);
    assert(nombraSegundoVuelo,
      `el cierre debería nombrar que ${sinDoc[0] && sinDoc[0].flightNumber} se guardó SIN el comprobante — si esta aserción falla, no hay ninguna señal y la persona sólo lo nota si abre esa reserva y no ve la tira del documento`);

    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================");
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
