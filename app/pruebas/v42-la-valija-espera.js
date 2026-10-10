"use strict";
/* ============================================================
   v42 — La valija espera la respuesta (reporte del PM sobre v41, 10/10).

   Paso B del PM: «armo la valija y aparece la pregunta pero al mismo tiempo ya
   me sugirió qué agregar antes de responder si es destino o es escala».
   Paso A del PM: al sumar un vuelo Orlando → Miami, la valija propuso sacar lo
   de Orlando y después volvió a sugerir cosas parecidas.

   Qué se prueba, y con qué gesto:
     B1  Armar la valija (tocar el tipo y «Armar la lista») en un viaje a
         Australia con un vuelo a EDI: lo que se le pide al modelo NO trata a
         EDI como destino, y la línea del destino no miente sobre el código.
     B2  La pregunta de la valija dice que la valija sigue con Australia.
     B3  Una lista armada con v41 (con ítems pensados para EDI): entrar a la
         valija NO propone sacarlos mientras la pregunta está sin contestar.
     B4  Contestar «Voy a los dos lugares» tocando el botón: ahora sí EDI es
         destino, junto con Australia.
     A1  Una lista pensada para MCO y un vuelo MCO → MIA con fecha anterior a la
         ida: el panel «Saco…» (tocando «Ver qué saco») dice qué miró el motor.
     A2  Lo que el modelo vuelve a proponer con las palabras en otro orden no
         entra dos veces; lo que dice otra cosa sí.

   Controles negativos, cada uno comprueba primero que su sabotaje llegó:
     `control`     corre v41 (`git show 11e2230`) y EXIGE que B1 y A1 fallen.
     `control-b3`  corre el build de ahora sin la línea que protege B3 y EXIGE
                   que B3 falle. B3 no falla en v41 —ahí EDI era destino—: lo
                   que protege es un defecto que el arreglo de B1 podía traer.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/v42-la-valija-espera.js [ruta.html | control | control-b3]
   ============================================================ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

/* Dos controles, porque B3 no es un defecto de v41 sino uno que el arreglo de
   B1 podía introducir: en v41 EDI era destino y nada se sacaba.
     control       v41 tiene que fallar B1 y A1.
     control-b3    el build de ahora SIN la línea que hace que un lugar en duda
                   sostenga lo pensado para él tiene que fallar B3. */
const MODO = process.argv[2] === "control" ? "v41" : process.argv[2] === "control-b3" ? "b3" : "";
const CONTROL = !!MODO;
const LINEA_B3 = '  (actual.enDuda || []).forEach(function (l) { if (String(l || "").trim()) ahora.push(String(l).trim()); });\n';
let HTML = path.resolve(process.argv[2] && !CONTROL ? process.argv[2] : "app/valija.html");
if (MODO === "v41") {
  HTML = path.join(os.tmpdir(), "valija-v41-11e2230.html");
  fs.writeFileSync(HTML, execSync("git show 11e2230:app/valija.html", { maxBuffer:64e6 }));
}
if (MODO === "b3") {
  const actual = fs.readFileSync(HTML, "utf8");
  HTML = path.join(os.tmpdir(), "valija-sin-linea-b3.html");
  fs.writeFileSync(HTML, actual.split(LINEA_B3).join(""));
}
let fallos = 0, total = 0; const fallaron = new Set();
const ok = (c, m, caso) => { total++; if (c) console.log("  ok    " + m); else { fallos++; if (caso) fallaron.add(caso); console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

const viaje = (destino, items, desde, hasta) => ({ trips:[{ id:"t1", name:"Prueba", destination:destino,
  startDate:desde || "2026-10-20", endDate:hasta || "2026-10-30", hue:200 }], items:{ t1:items || [] }, packing:{} });
const vuelo = (id, from, to, start, end) => ({ id, type:"flight", title:from + " > " + to, from, to, start, end, provider:"", confirmation:"" });

/* El modelo simulado: anota cada pedido de valija y devuelve un ítem. El
   contrato es el de `claude.use("sample")` que ya usan las otras pruebas. */
function simulador() {
  window.__pedidos = [];
  const sample = {
    limits: async () => ({ maxPromptBytes:200000 }),
    json: async pr => {
      const p = String(pr);
      if (/equipaje/i.test(p)) { window.__pedidos.push(p);
        return { items:[{ nombre:"Paraguas compacto", categoria:"destino", cantidad:1, motivo:"llueve seguido" }], quitar:[] }; }
      return { items:[] };
    }
  };
  window.claude = { use: async k => (k === "sample" ? sample : null) };
}

async function pagina(browser, datos, tema) {
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; console.log("  !! pageerror: " + e.message); });
  await p.addInitScript(simulador);
  await p.addInitScript(([d, t]) => {
    try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
          if (t) localStorage.setItem("valija.tema", t); } catch (e) {}
  }, [datos, tema || null]);
  return p;
}
async function ir(p, hash) {
  await p.goto("file://" + HTML + hash);
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(400);
}
async function armarConElDedo(p) {
  await ir(p, "#/trip/t1/valija");
  await p.waitForSelector("#pk-tp", { timeout:10000 });
  await p.locator('#pk-tp [data-t="ciudad"]').click(); await p.waitForTimeout(150);
  await p.locator("#pk-build").click();
  await p.waitForFunction(() => { const l = Store.packingOf("t1"); return l && l.items && Object.keys(l.items).length && !PK.generating; }, null, { timeout:15000 });
  await p.waitForTimeout(800);
}
/* Una lista guardada con ítems de destino puestos a mano, por el mismo camino
   con el que la app guarda (Store.savePacking), y recarga de verdad. */
async function sembrarItems(p, items) {
  await p.waitForFunction(() => { try { const d = JSON.parse(localStorage.getItem("valija.v1")); return !!(d.packing && d.packing.t1 && d.packing.t1.items); } catch (e) { return false; } }, null, { timeout:10000 });
  await p.evaluate(async its => {
    const l = JSON.parse(JSON.stringify(Store.packingOf("t1"))), at = new Date().toISOString();
    its.forEach(([clave, nombre, por, fuente]) => { l.items[clave] = { clave, nombre, categoria:"ropa", cantidad:1, motivo:"x",
      origen:"destino", estado:"pendiente", empacadoEn:null, regla:"", cantidadEditada:false, nota:"", orden:0,
      porDestino:por, porDestinoFuente:fuente, agregadoEn:at, actualizadoEn:at }; });
    await Store.savePacking("t1", l);
  }, items);
  await p.reload();
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await ir(p, "#/trip/t1/valija");
  await p.waitForTimeout(1500);
}
const sacadosDelPlan = p => p.evaluate(() => { const x = (typeof planDe === "function" && planDe("t1")) || App.plan; return x ? (x.sacados || []).map(i => i.nombre) : []; });

(async () => {
  if (MODO === "v41") {
    const sab = fs.readFileSync(HTML, "utf8");
    ok(sab.indexOf("vueloEnDuda") < 0, "control: el build de v41 no tiene vueloEnDuda (el sabotaje llegó)", "sabotaje");
  }
  if (MODO === "b3") {
    const sab = fs.readFileSync(HTML, "utf8");
    ok(sab.indexOf("vueloEnDuda") >= 0 && sab.indexOf(LINEA_B3) < 0, "control: el build tiene vueloEnDuda y no la línea de B3 (el sabotaje llegó)", "sabotaje");
  }
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

  titulo("B1 · armar la valija con un vuelo sin contestar: el modelo no recibe EDI como destino");
  {
    const p = await pagina(browser, viaje("Australia", [vuelo("f1", "EZE", "EDI", "2026-10-20T10:00", "2026-10-21T08:00")]));
    await armarConElDedo(p);
    const pedido = await p.evaluate(() => window.__pedidos[window.__pedidos.length - 1] || "");
    const linea = (pedido.split("\n").find(l => /^- Destino/.test(l)) || "");
    info("línea del destino: " + linea);
    ok(/^- Destino: Australia/.test(linea), "la línea del destino es Australia, lo escrito", "B1");
    ok(!/EDI/.test(linea.split("Lo escribió")[0]), "EDI no figura como destino", "B1");
    ok(!/ninguno de los vuelos cargados trae un código/.test(linea), "no afirma que ningún vuelo trae código (EDI lo trae)", "B1");
    ok(/todavía no dijo si EDI es un destino o una escala/.test(linea), "dice que falta la respuesta sobre EDI", "B1");
    ok(/"destino":"EDI"[^}]*"enDuda":"la persona todavía no dijo/.test(pedido), "el vuelo va crudo, con la marca de que falta la respuesta", "B1");

    titulo("B2 · la pregunta dice con qué sigue la valija");
    const tx = (await p.locator(".dv-preg").innerText().catch(() => "")).replace(/\s+/g, " ");
    info("pregunta: " + tx.slice(0, 160));
    ok(/Mientras no me digas, la valija sigue con Australia/.test(tx), "«Mientras no me digas, la valija sigue con Australia»", "B2");

    titulo("B4 · contestar «Voy a los dos lugares» con el dedo: EDI pasa a ser destino");
    const antes = await p.evaluate(() => window.__pedidos.length);
    const boton = p.locator('.dv-preg [data-dvop="suma"]');
    ok(await boton.count() === 1, "está el botón «Voy a los dos lugares»", "B4");
    if (await boton.count()) {
      await boton.click();
      await p.waitForFunction(n => window.__pedidos.length > n && !PK.generating, antes, { timeout:10000 }).catch(() => {});
      await p.waitForTimeout(800);
      const ped2 = await p.evaluate(() => window.__pedidos[window.__pedidos.length - 1] || "");
      const l2 = (ped2.split("\n").find(l => /^- Destino/.test(l)) || "");
      info("línea después de contestar: " + l2.slice(0, 160));
      ok(/EDI/.test(l2) && /Australia/.test(l2) && /^- Destinos, sacados de los vuelos/.test(l2), "la línea lista EDI y Australia como destinos", "B4");
      ok(!/"enDuda"/.test(ped2), "ya no hay vuelos sin contestar en el pedido", "B4");
      ok(await p.locator(".dv-preg").count() === 0, "la pregunta se fue", "B4");
    }
    await p.close();
  }

  titulo("B3 · una lista armada con v41 (ítems pensados para EDI): mientras no contestes, no se propone sacarlos");
  {
    const p = await pagina(browser, viaje("Australia", [vuelo("f1", "EZE", "EDI", "2026-10-20T10:00", "2026-10-21T08:00")]));
    await armarConElDedo(p);
    await sembrarItems(p, [["dest-kilt", "Abrigo para Escocia", "EDI", "reservas"]]);
    const preg = await p.locator(".dv-preg").count();
    const sac = await sacadosDelPlan(p);
    info("sacados: " + JSON.stringify(sac));
    ok(preg === 1, "la pregunta está", "B3");
    ok(sac.indexOf("Abrigo para Escocia") < 0, "no propone sacar «Abrigo para Escocia» antes de la respuesta", "B3");
    // Y después de contestar «Es una escala» sí: la persona dijo que no cuenta.
    const b = p.locator('.dv-preg [data-dvop="escala"]');
    if (await b.count()) {
      await b.click();
      await p.waitForFunction(() => !PK.generating, null, { timeout:10000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const sac2 = await sacadosDelPlan(p);
      info("sacados después de «Es una escala»: " + JSON.stringify(sac2));
      ok(sac2.indexOf("Abrigo para Escocia") >= 0, "contestado «Es una escala», ahora sí propone sacarlo", "B3");
    } else ok(false, "está el botón «Es una escala»", "B3");
    await p.close();
  }

  for (const tema of ["claro", "oscuro"]) {
    titulo(`A1 · tema ${tema} · vuelo MCO → MIA con fecha anterior a la ida: «Ver qué saco» dice qué miró el motor`);
    const p = await pagina(browser, viaje("EEUU", [
      vuelo("f1", "EZE", "MCO", "2026-10-20T10:00", "2026-10-20T20:00"),
      vuelo("f2", "MCO", "MIA", "2026-10-14T10:00", "2026-10-14T11:00")]), tema);
    await armarConElDedo(p);
    await sembrarItems(p, [["dest-parque", "Entradas a los parques", "MCO", "reservas"]]);
    const sac = await sacadosDelPlan(p);
    info("sacados: " + JSON.stringify(sac));
    const ver = p.locator('[data-pk="verplan"]').first();
    ok(await ver.count() === 1, "está el botón para ver el plan", "A1");
    if (await ver.count()) {
      await ver.click(); await p.waitForTimeout(500);
      const obs = p.locator(".pk-plan-obs");
      const t = (await obs.innerText().catch(() => "")).replace(/\s+/g, " ");
      info("línea: " + t);
      ok(/Ahora va para: MIA/.test(t), "dice para dónde va ahora la valija (MIA)", "A1");
      ok(/vuelos por fecha: MCO→MIA 14 oct, EZE→MCO 20 oct/.test(t), "dice los vuelos en el orden que los leyó el motor", "A1");
      ok(/· v\d+$/.test(t), "dice la versión", "A1");
      if (await obs.count()) {
        const c = await obs.evaluate(e => { const s = getComputedStyle(e), b = getComputedStyle(e.closest(".sheet") || document.body);
          return { color:s.color, fondo:b.backgroundColor }; });
        info(`color ${c.color} sobre ${c.fondo}`);
        ok(c.color !== c.fondo, "se lee: el color no es el del fondo", "A1");
        await p.screenshot({ path:path.join(os.tmpdir(), `v42-saco-${tema}.png`) });
      }
    }
    await p.close();
  }

  titulo("A2 · lo que el modelo repite con las palabras en otro orden no entra dos veces");
  {
    const p = await pagina(browser, viaje("EEUU", [vuelo("f1", "EZE", "MCO", "2026-10-20T10:00", "2026-10-20T20:00")]));
    await ir(p, "#/");
    const r = await p.evaluate(() => {
      const pe = PackingEngine, trip = Store.trips.get("t1");
      let l = pe.buildPackingList({ trip, items:Store.itemsOf("t1"), tipoViaje:"ciudad" });
      const it = (n) => ({ nombre:n, categoria:"ropa", cantidad:1, motivo:"x" });
      const a = pe.parseDestinationItems({ items:[it("Piloto o poncho de lluvia liviano"), it("Mochila chica para el día")] }, l);
      a.items.forEach(x => { l.items[x.clave] = Object.assign({ estado:"pendiente" }, x); });
      const b = pe.parseDestinationItems({ items:[it("Poncho o piloto de lluvia liviano"), it("Mochila chica o riñonera"),
        it("Liviano piloto lluvia poncho"), it("Piloto liviano para lluvia")] }, l);
      return { primera:a.items.map(x => x.nombre), segunda:b.items.map(x => x.nombre) };
    });
    info(JSON.stringify(r));
    ok(r.primera.length === 2, "la primera pasada entra entera", "A2");
    ok(r.segunda.indexOf("Poncho o piloto de lluvia liviano") < 0, "«Poncho o piloto de lluvia liviano» no entra: ya está «Piloto o poncho…»", "A2");
    ok(r.segunda.indexOf("Liviano piloto lluvia poncho") < 0, "las mismas palabras sin conectores tampoco", "A2");
    ok(r.segunda.indexOf("Mochila chica o riñonera") >= 0, "«Mochila chica o riñonera» sí entra: dice otra cosa", "A2");
    ok(r.segunda.indexOf("Piloto liviano para lluvia") >= 0, "«Piloto liviano para lluvia» sí entra: no son las mismas palabras", "A2");
    await p.close();
  }

  await browser.close();
  console.log(`\n${total - fallos} de ${total} bien`);
  if (CONTROL) {
    const deben = MODO === "v41" ? ["B1", "A1"] : ["B3"];
    const reproduce = deben.every(c => fallaron.has(c)) && !fallaron.has("sabotaje");
    console.log(reproduce ? `CONTROL OK (${MODO}): falla ${deben.join(", ")}` : `CONTROL FALLÓ (${MODO}): no falla ${deben.filter(c => !fallaron.has(c)).join(", ") || "— el sabotaje no llegó"}`);
    process.exit(reproduce ? 0 : 1);
  }
  process.exit(fallos ? 1 : 0);
})();
