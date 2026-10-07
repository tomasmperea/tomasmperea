const { chromium } = require("playwright");
const APP = "file:///home/user/tomasmperea/app/valija.html", OUT = __dirname + "/";
const VUELO = { id:"f1", type:"flight", title:"Buenos Aires > Madrid", from:"AEP", to:"MAD", start:"2026-09-23T19:15", end:"2026-09-24T12:30", provider:"Iberia", confirmation:"IB6844" };
const semilla = (dest, vuelo) => ({ trips:[{ id:"t1", name:"Escapada", destination:dest, startDate:"2026-09-23", endDate:"2026-10-09", hue:200, travelers:"Tomi" }], items:{ t1: vuelo ? [vuelo] : [] }, packing:{} });
const ICON_INFO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const ICON_OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
/* ===== el componente nuevo: lo único que no es la app de hoy ===== */
const CSS = `
.dv-preg .bd b.q{display:block;margin-bottom:2px}
.dv-ops{display:flex;flex-direction:column;gap:7px;margin-top:10px}
.dv-ops .btn{justify-content:flex-start;width:100%;min-height:44px;background:var(--surface);border-color:var(--line);color:var(--ink);font-size:13.5px}
.dv-ops .btn.con-nota{flex-direction:column;align-items:flex-start;gap:2px}
.dv-ops .btn small{font-family:var(--f-mono);font-size:10.5px;color:var(--ink-3);font-weight:400}
.dv-nota{display:block;margin-top:9px;font-size:11.5px;opacity:.85}
`;
const pregunta = (destViaje, ciudad, enValija) => `<div class="notice dv-preg">${ICON_INFO}<span class="bd">
  <b class="q">${enValija ? `Tenés un vuelo a ${ciudad} y el viaje dice ${destViaje}.` : `Tu viaje dice ${destViaje} y este vuelo va a ${ciudad}.`}</b>
  ${enValija ? `Mientras no me digas, sugiero para los dos lugares. ¿Qué pasó?` : `¿Qué pasó?`}
  <span class="dv-ops">
    <button class="btn sm">El viaje ahora es a ${ciudad}</button>
    <button class="btn sm">Voy a los dos lugares</button>
    <button class="btn sm con-nota">Es una escala<small>no cuenta para la valija</small></button>
  </span>
  ${enValija ? "" : `<span class="dv-nota">Si no contestás ahora, te lo pregunto en la valija.</span>`}
</span></div>`;
const listo = tx => `<div class="notice ok">${ICON_OK}<span class="bd">${tx} <button class="act" style="display:inline;margin:0 0 0 4px">Cambiar</button></span></div>`;

async function pagina(b, tema, datos, ia) {
  const p = await b.newPage({ viewport:{ width:390, height:844 }, hasTouch:true, deviceScaleFactor:2 });
  await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.addInitScript(([d, t, ia]) => {
    if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
    localStorage.setItem("valija.tema", t === "dark" ? "oscuro" : "claro");
    const sample = { limits: async () => ({ maxPromptBytes:200000 }),
      json: async pr => /valija|equipaje|empacar/i.test(String(pr)) ? { items:[], quitar:[] } : { items: ia || [] } };
    window.claude = { use: async k => (ia && k === "sample" ? sample : null) };
  }, [datos, tema, ia || null]);
  return p;
}
const ir = async (p, h) => { await p.goto(APP + h); await p.waitForFunction(() => typeof Store!=="undefined" && Store.ready); await p.waitForTimeout(400); await p.addStyleTag({ content: CSS }); };

(async () => {
  const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
  for (const tema of ["light", "dark"]) {
    /* 1 · la valija de hoy, y 4 · la misma con la pregunta */
    let p = await pagina(b, tema, semilla("Bariloche", VUELO));
    await ir(p, "#/trip/t1/valija");
    await p.waitForSelector("#pk-tp", { timeout:10000 });
    await p.locator('#pk-tp [data-t="ciudad"]').click(); await p.waitForTimeout(150);
    await p.locator("#pk-build").click();
    await p.waitForFunction(() => { const l = Store.packingOf("t1"); return l && l.items && Object.keys(l.items).length && !PK.generating; }, null, { timeout:15000 });
    await p.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("valija.v1")); const l = d.packing.t1; const at = new Date().toISOString();
      const it = (clave, nombre, motivo, por, fuente, orden) => ({ clave, nombre, categoria:"ropa", cantidad:1, motivo, origen:"destino", estado:"pendiente", empacadoEn:null, regla:"", cantidadEditada:false, nota:"", orden, porDestino:por, porDestinoFuente:fuente, agregadoEn:at, actualizadoEn:at });
      l.items["dest-campera"] = it("dest-campera", "Campera o piloto impermeable liviano", "Es una zona de lluvias frecuentes en el fin del invierno, y el viento hace poco práctico el paraguas.", "Bariloche", "escrito", 1);
      l.items["dest-gorra"] = it("dest-gorra", "Gorra o sombrero liviano", "A fines de septiembre Madrid todavía tiene días soleados y calurosos para caminar la ciudad.", "MAD", "reservas", 0);
      localStorage.setItem("valija.v1", JSON.stringify(d));
    });
    await ir(p, "#/trip/t1/valija");
    const ropa = p.locator(".pk-cat", { hasText: "Ropa" }).first();
    if (await ropa.getAttribute("data-open") === "false") await ropa.locator(".pk-cat-hd").click();
    await p.waitForTimeout(200);
    await ropa.scrollIntoViewIfNeeded();
    await p.screenshot({ path: OUT + tema + "-1-hoy.png" });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.evaluate(h => { const m = document.querySelector("main"); const d = document.createElement("div"); d.innerHTML = h; m.prepend(d.firstElementChild); }, pregunta("Bariloche", "Madrid", true));
    await p.waitForTimeout(150);
    await p.screenshot({ path: OUT + tema + "-4-valija-pregunta.png" });

    /* 2 · el formulario: editar el vuelo */
    await ir(p, "#/trip/t1");
    await p.locator('[data-item="f1"]').first().click();
    await p.waitForSelector("#i_to");
    await p.addStyleTag({ content: CSS });
    await p.evaluate(h => { document.getElementById("i_ruta_aviso").innerHTML = h; }, pregunta("Bariloche", "Madrid", false));
    await p.locator("#i_ruta_aviso").scrollIntoViewIfNeeded();
    await p.evaluate(() => { document.querySelector(".sheet-bd").scrollTop -= 170; });
    await p.waitForTimeout(150);
    await p.screenshot({ path: OUT + tema + "-2-formulario.png" });
    /* 5 · las tres respuestas, en el mismo lugar */
    const respuestas = [
      ["cambia", "Listo: el viaje pasa a ser a <b>Madrid</b>. La valija saca lo que era para Bariloche y no empacaste."],
      ["dos", "Listo: el viaje es a <b>Bariloche y Madrid</b>. La valija sugiere para los dos."],
      ["escala", "Listo: este vuelo es una <b>escala</b>. No cuenta para la valija."]];
    for (const [k, tx] of respuestas) {
      await p.evaluate(h => { document.getElementById("i_ruta_aviso").innerHTML = h; }, listo(tx));
      await p.waitForTimeout(100);
      const r = await p.locator("#fields .ap").filter({ has: p.locator("#i_to") }).boundingBox();
      await p.screenshot({ path: OUT + tema + "-5-" + k + ".png", clip: { x:0, y:Math.max(0, r.y - 20), width:390, height:200 } });
    }
    await p.close();

    /* 3 · la revisión de lo importado */
    p = await pagina(b, tema, semilla("Bariloche", null), [Object.assign({}, VUELO, { id:undefined, seat:"", terminal:"", gate:"", boardingTime:"", address:"", phone:"", cost:"", currency:"", notes:"" })]);
    await ir(p, "#/trip/t1");
    await p.locator("#imp").click();
    await p.waitForSelector("#imp-live", { state:"attached", timeout:10000 }); await p.waitForTimeout(200);
    if (!(await p.locator(".imp-more").evaluate(e => e.open))) { await p.locator(".imp-more summary").click(); await p.waitForTimeout(150); }
    await p.locator("#im_text").fill("Reserva IB6844\nVuelo AEP Madrid");
    await p.locator("#im-run").click();
    await p.waitForSelector("#im-save", { timeout:15000 }); await p.waitForTimeout(200);
    await p.addStyleTag({ content: CSS });
    await p.evaluate(h => { document.querySelector(".imp-card [data-rutaaviso]").innerHTML = h; }, pregunta("Bariloche", "Madrid", false));
    await p.locator(".imp-card [data-rutaaviso]").first().scrollIntoViewIfNeeded();
    await p.evaluate(() => { const s = document.querySelector(".sheet-bd"); if (s) s.scrollTop -= 230; });
    await p.waitForTimeout(150);
    await p.screenshot({ path: OUT + tema + "-3-importado.png" });
    await p.close();

    /* 6 · no pregunta: el destino es Argentina y el vuelo va a Bariloche */
    p = await pagina(b, tema, semilla("Argentina", Object.assign({}, VUELO, { title:"Ida", to:"BRC" })));
    await ir(p, "#/trip/t1");
    await p.locator('[data-item="f1"]').first().click();
    await p.waitForSelector("#i_to");
    await p.locator("#i_ruta_aviso").scrollIntoViewIfNeeded();
    await p.evaluate(() => { document.querySelector(".sheet-bd").scrollTop -= 170; });
    await p.waitForTimeout(150);
    await p.screenshot({ path: OUT + tema + "-6-no-pregunta.png" });
    await p.close();
    console.log(tema, "listo");
  }
  await b.close();
})();
