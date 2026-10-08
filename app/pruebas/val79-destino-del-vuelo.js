"use strict";
/* ============================================================
   VAL-79 + VAL-92 — cuando el vuelo va a otro lado, la app pregunta;
   y Enter elige. Brief: docs/briefs/destino-del-vuelo.md.

   El reporte del PM (07/10): viaje a Bariloche, cargó un vuelo AEP → MAD, y la
   valija sugería por Madrid sin sacar ni proponer sacar lo de Bariloche.

   Todo por gesto: se escribe con el teclado, se toca la opción, se toca la
   respuesta y se toca Guardar. La valija se siembra en localStorage y la
   página se RECARGA (cambiar sólo el `#` no recarga, y la app no relee lo
   sembrado: la primera versión de esta prueba pasaba sin ítems por eso).

   Control negativo adentro: una copia de la app SIN el comparador de lugares
   tiene que fallar el caso del PM. Antes de correrla se comprueba que el
   sabotaje se aplicó (el texto a sacar aparece una sola vez).

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val79-destino-del-vuelo.js [ruta.html]
   ============================================================ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os");

const HTML = path.resolve(process.argv[2] || "app/valija.html");
let fallos = 0, total = 0;
const ok = (c, m) => { total++; if (c) console.log("  ok    " + m); else { fallos++; console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

const VUELO = { id:"f1", type:"flight", title:"Buenos Aires > Madrid", from:"AEP", to:"MAD",
  start:"2026-09-23T19:15", end:"2026-09-24T12:30", provider:"Iberia", confirmation:"IB6844" };
const viaje = (destino, items) => ({ trips:[{ id:"t1", name:"Escapada", destination:destino, startDate:"2026-09-23", endDate:"2026-10-09", hue:200 }],
  items:{ t1:items || [] }, packing:{} });

function simulador(vuelos) {
  const sample = {
    limits: async () => ({ maxPromptBytes:200000 }),
    json: async pr => {
      const p = String(pr);
      if (/valija|equipaje|empacar/i.test(p)) return { items:[], quitar:[] };
      return p.indexOf("VAL79") >= 0 ? { items:vuelos } : { items:[] };
    }
  };
  window.claude = { use: async k => (vuelos && k === "sample" ? sample : null) };
}

async function pagina(browser, archivo, datos, opts) {
  opts = opts || {};
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; console.log("  !! pageerror: " + e.message); });
  await p.addInitScript(simulador, opts.vuelosIA || null);
  await p.addInitScript(([d, tema]) => {
    try {
      if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
      if (tema) localStorage.setItem("valija.tema", tema);
    } catch (e) {}
  }, [datos, opts.tema || null]);
  p.__app = "file://" + archivo;
  return p;
}
async function ir(p, hash) {
  await p.goto(p.__app + hash);
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(400);
}
async function recargar(p) {
  await p.reload();
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(600);
}
async function escribir(p, sel, texto) {
  await p.locator(sel).click();
  await p.keyboard.press("Control+A"); await p.keyboard.press("Backspace");
  await p.keyboard.type(texto, { delay:10 });
  await p.waitForTimeout(150);
}

/* La valija armada con el dedo, más tres ítems de destino como los de la
   captura del PM: uno por Bariloche pendiente, uno por Bariloche EMPACADO
   (lo empacado no se toca, VAL-75) y uno por MAD. */
async function valijaComoLaDelPM(p) {
  await ir(p, "#/trip/t1/valija");
  await p.waitForSelector("#pk-tp", { timeout:10000 });
  await p.locator('#pk-tp [data-t="ciudad"]').click(); await p.waitForTimeout(150);
  await p.locator("#pk-build").click();
  await p.waitForFunction(() => { const l = Store.packingOf("t1"); return l && l.items && Object.keys(l.items).length && !PK.generating; }, null, { timeout:15000 });
  /* La auditoría vio caer esta prueba 3 veces con "reading 'items'": la lista ya
     estaba en memoria y todavía no en localStorage. Se espera la escritura, y si
     no llega se dice con el nombre que tiene (VAL-86) en vez de reventar. */
  const escrita = await p.waitForFunction(() => {
    try { const d = JSON.parse(localStorage.getItem("valija.v1")); return !!(d && d.packing && d.packing.t1 && d.packing.t1.items); }
    catch (e) { return false; }
  }, null, { timeout:10000 }).then(() => true, () => false);
  ok(escrita, "la valija armada llegó a localStorage antes de sembrar (si falla: es VAL-86, no esta historia)");
  if (!escrita) return;
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("valija.v1")), l = d.packing.t1, at = new Date().toISOString();
    const it = (clave, nombre, por, fuente, estado) => ({ clave, nombre, categoria:"ropa", cantidad:1, motivo:"x",
      origen:"destino", estado, empacadoEn:estado === "empacado" ? at : null, regla:"", cantidadEditada:false, nota:"",
      orden:0, porDestino:por, porDestinoFuente:fuente, agregadoEn:at, actualizadoEn:at });
    l.items["dest-campera"] = it("dest-campera", "Campera impermeable", "Bariloche", "escrito", "pendiente");
    l.items["dest-guantes"] = it("dest-guantes", "Guantes de abrigo", "Bariloche", "escrito", "empacado");
    l.items["dest-gorra"]   = it("dest-gorra", "Gorra liviana", "MAD", "reservas", "pendiente");
    localStorage.setItem("valija.v1", JSON.stringify(d));
  });
  await recargar(p);
  await ir(p, "#/trip/t1/valija");
  const hay = await p.evaluate(() => Object.keys(Store.packingOf("t1").items).filter(k => /^dest-/.test(k)).length);
  ok(hay === 3, `la siembra llegó: ${hay} de 3 ítems de destino en la lista`);
}
/** Contestar en la valija y leer lo que el plan propone sacar. */
async function contestarEnValija(p, k) {
  const boton = p.locator(`.dv-preg [data-dvop="${k}"]`);
  ok(await boton.count() === 1, `la pregunta está arriba de la valija con la opción «${k}»`);
  if (!(await boton.count())) return null;
  await boton.click();
  await p.waitForFunction(() => !PK.generating, null, { timeout:10000 }).catch(() => {});
  await p.waitForTimeout(1500);
  return p.evaluate(() => {
    const x = App.plan, trip = Store.trips.get("t1"), f = Store.itemsOf("t1").find(i => i.id === "f1");
    return { destino:trip.destination, decision:f.destinoDecision, para:f.destinoDecisionPara,
             sacados:x ? (x.sacados || []).map(i => i.nombre) : [] };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
  try {
    /* ---------------------------------------------------------- */
    titulo("¿Son el mismo lugar? (con el dato de VAL-87)");
    {
      const p = await pagina(browser, HTML, viaje("Bariloche"));
      await ir(p, "#/");
      const r = await p.evaluate(() => [
        ["Bariloche", "MAD"], ["Argentina", "BRC"], ["Noruega", "OSL"], ["Patagonia", "BRC"],
        ["EZE", "AEP"], ["Córdoba", "COR"], ["Bariloche", "Madrid"], ["Bariloche", "BRC"]
      ].map(([a, b]) => PackingEngine.coincidenLugares(a, b)));
      const esperado = [false, true, true, null, true, true, false, true];
      ["Bariloche/MAD", "Argentina/BRC", "Noruega/OSL", "Patagonia/BRC", "EZE/AEP", "Córdoba/COR", "Bariloche/Madrid", "Bariloche/BRC"]
        .forEach((n, i) => ok(r[i] === esperado[i], `${n} → ${r[i]} (se espera ${esperado[i]})`));
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIO 1 · formulario: el vuelo a Madrid en un viaje a Bariloche pregunta");
    for (const [destViaje, cod, buscar, pregunta] of [["Bariloche", "MAD", "madrid", true], ["Bariloche", "BRC", "bariloche", false], ["Argentina", "BRC", "bariloche", false]]) {
      const p = await pagina(browser, HTML, viaje(destViaje));
      await ir(p, "#/trip/t1");
      await p.locator("#additem").click(); await p.waitForSelector("#i_to");
      await escribir(p, "#i_title", "Ida");
      await escribir(p, "#i_from", "aeroparque"); await p.locator('#fields .ap-op[data-cod="AEP"]').click();
      await escribir(p, "#i_to", buscar); await p.locator(`#fields .ap-op[data-cod="${cod}"]`).click();
      await p.waitForTimeout(200);
      const hay = await p.locator("#i_dv .dv-preg").count();
      ok(!!hay === pregunta, `viaje «${destViaje}», vuelo a ${cod} → ${pregunta ? "pregunta" : "no pregunta"}`);
      if (hay) {
        const tx = (await p.locator("#i_dv").innerText()).replace(/\s+/g, " ");
        ok(/Tu viaje dice Bariloche y este vuelo va a Madrid/.test(tx), "dice el destino escrito y la ciudad del vuelo");
        ok(/Si no contestás ahora, te lo pregunto en la valija/.test(tx), "avisa que si no contesta se pregunta en la valija");
      }
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIO 3 · cada respuesta se guarda en el vuelo, y «cambia» actualiza el viaje");
    for (const k of ["cambia", "suma", "escala"]) {
      const p = await pagina(browser, HTML, viaje("Bariloche"));
      await ir(p, "#/trip/t1");
      await p.locator("#additem").click(); await p.waitForSelector("#i_to");
      await escribir(p, "#i_title", "Ida");
      await escribir(p, "#i_from", "aeroparque"); await p.locator('#fields .ap-op[data-cod="AEP"]').click();
      await escribir(p, "#i_to", "madrid"); await p.locator('#fields .ap-op[data-cod="MAD"]').click();
      await p.locator(`#i_dv [data-dvop="${k}"]`).click(); await p.waitForTimeout(150);
      const listo = (await p.locator("#i_dv").innerText()).replace(/\s+/g, " ");
      ok(/^Listo/.test(listo.trim()) && /Cambiar/.test(listo), `«${k}»: la línea verde con «Cambiar» → ${listo.trim().slice(0, 70)}…`);
      ok(!/La valija/.test(listo), `«${k}»: sin valija armada, la línea no promete nada de la valija`);
      ok(/Se aplica al guardar/.test(listo), `«${k}»: dice que se aplica al guardar`);
      await p.locator("#save").click(); await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ f:Store.itemsOf("t1").find(i => i.type === "flight"), d:Store.trips.get("t1").destination }));
      ok(r.f && r.f.destinoDecision === k && r.f.destinoDecisionPara === "MAD", `«${k}» queda en el vuelo, para MAD`);
      ok(r.d === (k === "cambia" ? "Madrid" : "Bariloche"), `el destino del viaje queda en «${r.d}»`);
      await p.close();
    }
    {
      titulo("CRITERIO 3 · «Cambiar» borra la respuesta antes de guardar");
      const p = await pagina(browser, HTML, viaje("Bariloche"));
      await ir(p, "#/trip/t1");
      await p.locator("#additem").click(); await p.waitForSelector("#i_to");
      await escribir(p, "#i_title", "Ida");
      await escribir(p, "#i_to", "madrid"); await p.locator('#fields .ap-op[data-cod="MAD"]').click();
      await p.locator('#i_dv [data-dvop="escala"]').click();
      await p.locator('#i_dv [data-dvop=""]').click();
      ok(await p.locator("#i_dv .dv-preg").count() === 1, "tocar «Cambiar» vuelve a mostrar la pregunta");
      await p.locator("#save").click(); await p.waitForTimeout(500);
      const f = await p.evaluate(() => Store.itemsOf("t1").find(i => i.type === "flight"));
      ok(f && !f.destinoDecision, "y al guardar sin contestar, el vuelo no lleva respuesta");
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIO 2 · lo mismo en la revisión de lo importado");
    for (const k of ["cambia", "escala"]) {
      const p = await pagina(browser, HTML, viaje("Bariloche"), { vuelosIA:[Object.assign({}, VUELO, { id:undefined,
        seat:"", terminal:"", gate:"", boardingTime:"", address:"", phone:"", cost:"", currency:"", notes:"" })] });
      await ir(p, "#/trip/t1");
      await p.locator("#imp").click();
      await p.waitForSelector("#imp-live", { state:"attached", timeout:10000 }); await p.waitForTimeout(200);
      if (!(await p.locator(".imp-more").evaluate(e => e.open))) { await p.locator(".imp-more summary").click(); await p.waitForTimeout(150); }
      await p.locator("#im_text").fill("Reserva VAL79\nVuelo AEP Madrid");
      await p.locator("#im-run").click();
      await p.waitForSelector("#im-save", { timeout:15000 }); await p.waitForTimeout(300);
      const tx = (await p.locator(".imp-card [data-dvslot]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
      ok(/Tu viaje dice Bariloche y este vuelo va a Madrid/.test(tx), "la tarjeta del vuelo importado pregunta");
      await p.locator(`.imp-card [data-dvslot] [data-dvop="${k}"]`).first().click(); await p.waitForTimeout(150);
      await p.locator("#im-save").click();
      await p.waitForFunction(() => Store.itemsOf("t1").some(i => i.type === "flight"), null, { timeout:8000 });
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ f:Store.itemsOf("t1").find(i => i.type === "flight"), d:Store.trips.get("t1").destination }));
      ok(r.f && r.f.destinoDecision === k && r.f.destinoDecisionPara === "MAD", `importado: «${k}» queda en el vuelo`);
      ok(r.d === (k === "cambia" ? "Madrid" : "Bariloche"), `importado: el destino del viaje queda en «${r.d}»`);
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIOS 2 y 8 · importar la ida y la vuelta JUNTAS: sólo la ida pregunta (bloqueante B1)");
    {
      const extra = { seat:"", terminal:"", gate:"", boardingTime:"", address:"", phone:"", cost:"", currency:"", notes:"" };
      const ida = Object.assign({}, VUELO, extra, { id:undefined });
      const vuelta = Object.assign({}, VUELO, extra, { id:undefined, title:"Madrid > Buenos Aires", from:"MAD", to:"AEP",
        start:"2026-10-09T10:00", end:"2026-10-09T20:00", confirmation:"IB6845" });
      const p = await pagina(browser, HTML, viaje("Bariloche"), { vuelosIA:[vuelta, ida] });   // la vuelta primero, a propósito
      await ir(p, "#/trip/t1");
      await p.locator("#imp").click();
      await p.waitForSelector("#imp-live", { state:"attached", timeout:10000 }); await p.waitForTimeout(200);
      if (!(await p.locator(".imp-more").evaluate(e => e.open))) { await p.locator(".imp-more summary").click(); await p.waitForTimeout(150); }
      await p.locator("#im_text").fill("Reserva VAL79\nIda y vuelta");
      await p.locator("#im-run").click();
      await p.waitForSelector("#im-save", { timeout:15000 }); await p.waitForTimeout(300);
      const tarjetas = await p.locator(".imp-card").evaluateAll(cs => cs.map(c => ({
        to:(c.querySelector('[data-f="to"]') || {}).value || "", preg:(c.querySelector("[data-dvslot]") || {}).innerText || "" })));
      info("tarjetas: " + JSON.stringify(tarjetas.map(t => [t.to, t.preg.replace(/\s+/g, " ").slice(0, 50)])));
      const tIda = tarjetas.find(t => /Madrid/.test(t.to)), tVuelta = tarjetas.find(t => /Buenos Aires/.test(t.to));
      ok(tIda && /este vuelo va a Madrid/.test(tIda.preg), "la tarjeta de la ida pregunta");
      ok(tVuelta && tVuelta.preg.trim() === "", "la tarjeta de la vuelta NO pregunta: llega a casa");
      const idaSlot = p.locator(".imp-card", { has:p.locator('[data-f="to"][data-cod="MAD"]') }).locator("[data-dvslot]");
      await idaSlot.locator('[data-dvop="cambia"]').click(); await p.waitForTimeout(150);
      ok(/Se aplica al guardar/.test(await idaSlot.innerText()), "la línea de la ida dice que se aplica al guardar");
      await p.locator("#im-save").click();
      await p.waitForFunction(() => Store.itemsOf("t1").filter(i => i.type === "flight").length === 2, null, { timeout:8000 });
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ d:Store.trips.get("t1").destination,
        vs:Store.itemsOf("t1").filter(i => i.type === "flight").map(f => f.to + ":" + (f.destinoDecision || "")) }));
      ok(r.d === "Madrid", `contestar «cambia» en la ida deja el viaje en Madrid, como dijo la línea (${r.d})`);
      ok(r.vs.indexOf("AEP:") >= 0, "la vuelta se guarda sin respuesta");
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("ESCALA · el prompt no dice que los vuelos «no traen código» (anotado por la auditoría)");
    {
      const p = await pagina(browser, HTML, viaje("Bariloche"));
      await ir(p, "#/");
      const linea = await p.evaluate(v => {
        const trip = Store.trips.get("t1");
        const lista = PackingEngine.buildPackingList({ trip, items:[Object.assign({}, v, { destinoDecision:"escala", destinoDecisionPara:"MAD" })] });
        const pr = PackingEngine.destinationPrompt(lista);
        return { destino:(pr.split("\n").find(l => /^- Destino/.test(l)) || ""), escala:/marcó este vuelo como escala/.test(pr) };
      }, VUELO);
      info("línea: " + linea.destino);
      ok(!/ninguno de los vuelos cargados trae un código/.test(linea.destino), "con una escala no afirma que los vuelos no traen código");
      ok(/marcó como escala/.test(linea.destino), "dice que la persona marcó la escala");
      ok(linea.escala, "y el vuelo va marcado como escala en las reservas que ve el modelo");
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIOS 4, 5 y 6 · en la valija de un viaje que ya tiene el vuelo (el caso del PM)");
    const casos = [
      ["cambia", "Madrid", ["Campera impermeable"], ["Guantes de abrigo", "Gorra liviana"]],
      ["suma",   "Bariloche", [], ["Campera impermeable", "Guantes de abrigo", "Gorra liviana"]],
      ["escala", "Bariloche", ["Gorra liviana"], ["Campera impermeable", "Guantes de abrigo"]]];
    for (const [k, destino, saca, noSaca] of casos) {
      const p = await pagina(browser, HTML, viaje("Bariloche", [VUELO]));
      await valijaComoLaDelPM(p);
      const tx = (await p.locator(".dv-preg").innerText().catch(() => "")).replace(/\s+/g, " ");
      ok(/Tenés un vuelo a Madrid y el viaje dice Bariloche\. Mientras no me digas, sugiero para los dos lugares/.test(tx),
         `«${k}»: la pregunta de la valija dice lo del diseño`);
      const r = await contestarEnValija(p, k);
      if (!r) { await p.close(); continue; }
      info(`«${k}» → viaje «${r.destino}», plan saca ${JSON.stringify(r.sacados)}`);
      ok(r.decision === k && r.para === "MAD", `«${k}» queda guardado en el vuelo al tocar`);
      ok(r.destino === destino, `«${k}»: el destino del viaje queda en «${destino}»`);
      saca.forEach(n => ok(r.sacados.indexOf(n) >= 0, `«${k}»: el plan propone sacar «${n}»`));
      noSaca.forEach(n => ok(r.sacados.indexOf(n) < 0, `«${k}»: el plan NO propone sacar «${n}»`));
      ok(await p.locator(".dv-preg").count() === 0, `«${k}»: contestada, la pregunta se va`);
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIO 8 · la vuelta a casa no pregunta");
    {
      const vuelta = Object.assign({}, VUELO, { id:"f2", title:"Vuelta", from:"MAD", to:"AEP", start:"2026-10-09T10:00", end:"2026-10-09T20:00" });
      const p = await pagina(browser, HTML, viaje("Madrid", [VUELO, vuelta]));
      await valijaComoLaDelPMSinSiembra(p);
      ok(await p.locator(".dv-preg").count() === 0, "viaje a Madrid con ida AEP→MAD y vuelta MAD→AEP: no hay pregunta");
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIO 9 · VAL-92 en el campo de aeropuerto");
    {
      const p = await pagina(browser, HTML, viaje("Madrid"));
      await ir(p, "#/trip/t1");
      await p.locator("#additem").click(); await p.waitForSelector("#i_to");
      const sello = () => p.locator("#fields .ap").filter({ has:p.locator("#i_to") }).locator(".ap-sello").innerText().catch(() => "");
      const valor = () => p.locator("#i_to").inputValue();

      await escribir(p, "#i_to", "bari"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok(await sello() === "BRI", `Enter elige la primera opción marcada (sello ${await sello()})`);

      await escribir(p, "#i_to", "bari"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok(await sello() === "BRC", `flecha abajo y Enter elige la segunda: Bariloche (sello ${await sello()})`);

      await escribir(p, "#i_to", "aeroparqu"); await p.locator("#i_title").click(); await p.waitForTimeout(400);
      ok(await sello() === "AEP" && await valor() === "Buenos Aires", `salir con UNA sola opción la toma («${await valor()}», ${await sello()})`);

      await escribir(p, "#i_to", "bari"); await p.locator("#i_title").click(); await p.waitForTimeout(400);
      ok(await sello() === "" && await valor() === "bari", `salir con VARIAS opciones deja lo escrito («${await valor()}»)`);

      await escribir(p, "#i_to", "toj"); await p.locator("#i_title").click(); await p.waitForTimeout(400);
      ok(await sello() === "TOJ", `«toj» con «Tojo» como única opción: al salir queda TOJ como código (${await sello()})`);

      await escribir(p, "#i_to", "toj"); await p.keyboard.press("Enter"); await p.locator("#i_title").click(); await p.waitForTimeout(400);
      ok(await sello() === "TOJ", `«toj» + Enter: tampoco elige Tojo, queda TOJ (${await sello()})`);
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CRITERIO 11 · las tres respuestas en claro y oscuro: 44 px y colores de los tokens");
    for (const tema of ["claro", "oscuro"]) {
      const p = await pagina(browser, HTML, viaje("Bariloche"), { tema });
      await ir(p, "#/trip/t1");
      await p.locator("#additem").click(); await p.waitForSelector("#i_to");
      await escribir(p, "#i_to", "madrid"); await p.locator('#fields .ap-op[data-cod="MAD"]').click();
      const m = await p.evaluate(() => [...document.querySelectorAll("#i_dv [data-dvop]")].map(b => {
        const r = b.getBoundingClientRect(); return { h:Math.round(r.height), right:Math.round(r.right), bg:getComputedStyle(b).backgroundColor };
      }));
      const fondo = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim());
      ok(m.length === 3 && m.every(x => x.h >= 44), `${tema}: tres botones de 44 px o más (${m.map(x => x.h).join(", ")})`);
      ok(m.every(x => x.right <= 390), `${tema}: no se salen de los 390 px`);
      info(`${tema}: --surface ${fondo}, fondo de los botones ${m[0] && m[0].bg}`);
      await p.close();
    }

    /* ---------------------------------------------------------- */
    titulo("CONTROL NEGATIVO · sin el comparador de lugares, el caso del PM vuelve a fallar");
    {
      const s = fs.readFileSync(HTML, "utf8");
      const quitar = "PackingEngine.setComparadorDeLugares(Lugares.coinciden);";
      const n = s.split(quitar).length - 1;
      ok(n === 1, `el sabotaje encontró qué sacar (${n} vez)`);
      const copia = path.join(os.tmpdir(), "val79-sin-comparador.html");
      fs.writeFileSync(copia, s.replace(quitar, ""));
      const p = await pagina(browser, copia, viaje("Bariloche", [VUELO]));
      await valijaComoLaDelPM(p);
      const r = await contestarEnValija(p, "cambia");
      info(`sin comparador → plan saca ${JSON.stringify(r && r.sacados)}`);
      ok(r && r.sacados.indexOf("Campera impermeable") < 0, "sin comparador, «El viaje ahora es a Madrid» NO saca la campera: la prueba distingue");
      await p.close();
    }
  } finally {
    await browser.close();
  }
  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON de ${total}` : `  Todo en verde — ${total} aserciones`);
  console.log("====================================================");
  process.exit(fallos ? 1 : 0);

  async function valijaComoLaDelPMSinSiembra(p) {
    await ir(p, "#/trip/t1/valija");
    await p.waitForSelector("#pk-tp", { timeout:10000 });
    await p.locator('#pk-tp [data-t="ciudad"]').click(); await p.waitForTimeout(150);
    await p.locator("#pk-build").click();
    await p.waitForFunction(() => { const l = Store.packingOf("t1"); return l && l.items && Object.keys(l.items).length && !PK.generating; }, null, { timeout:15000 });
    await p.waitForTimeout(300);
  }
})();
