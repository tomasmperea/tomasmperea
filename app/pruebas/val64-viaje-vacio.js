"use strict";
/* ============================================================
   VAL-64 — Un viaje vacío no puede estar 100% completo. Opción B del PM
   (docs/design/val64-viaje-vacio.png): sin reservas no hay anillo; la tarjeta
   dice «sin reservas».

   Por gesto: «Nuevo viaje» → nombre y fechas → Guardar; volver al inicio y
   mirar la tarjeta. Después «Agregar» una reserva con el formulario y volver.
     1  Recién creado: la tarjeta dice «sin reservas» y no hay anillo ni «100».
     2  Con una reserva: aparece el anillo con su número y se va «sin reservas».
     3  Borrar esa reserva vuelve a «sin reservas».
     4  Tema claro y oscuro: el chip se lee.

   Control negativo: `control` corre la v47 (`git show 01d2470`) y exige que
   falle 1.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val64-viaje-vacio.js [ruta.html | control]
   ============================================================ */
const { chromium } = require("playwright");
const { llenarFechaHora } = require("./fecha-y-hora");
const { abrirParaEditar } = require("./abrir-reserva");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const CONTROL = process.argv[2] === "control";
let HTML = path.resolve(process.argv[2] && !CONTROL ? process.argv[2] : path.join(RAIZ, "app", "valija.html"));
if (CONTROL) {
  HTML = path.join(os.tmpdir(), "valija-v47-01d2470.html");
  fs.writeFileSync(HTML, execSync("git show 01d2470:app/valija.html", { cwd:RAIZ, maxBuffer:64e6 }));
}
let fallos = 0, total = 0; const fallaron = new Set();
const ok = (c, m, caso) => { total++; if (c) console.log("  ok    " + m); else { fallos++; if (caso) fallaron.add(caso); console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

async function pagina(browser, tema) {
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; console.log("  !! pageerror: " + e.message); });
  await p.addInitScript(t => {
    try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify({ trips:[], items:{}, packing:{} }));
          localStorage.setItem("valija.aviso.local", "1"); if (t) localStorage.setItem("valija.tema", t); } catch (e) {}
    window.claude = { use: async () => null };
  }, tema || null);
  await p.goto("file://" + HTML + "#/");
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(400);
  return p;
}
async function inicio(p) {
  await p.goto("file://" + HTML + "#/"); await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready); await p.waitForTimeout(400);
}
const tarjeta = p => p.locator("[data-trip]").first();

(async () => {
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

  titulo("1, 2 y 3 · crear el viaje con el formulario, cargarle una reserva y borrarla");
  {
    const p = await pagina(browser);
    await p.locator("#newtrip").click(); await p.waitForSelector("#t_name");
    await p.locator("#t_name").fill("Bariloche");
    await p.locator("#t_dest").fill("Bariloche").catch(() => {});
    await p.locator("#t_from").fill("2027-01-10"); await p.locator("#t_to").fill("2027-01-17");
    await p.locator("#save").click(); await p.waitForTimeout(600);
    await inicio(p);
    const t1 = (await tarjeta(p).innerText()).replace(/\s+/g, " ");
    info("tarjeta: " + t1);
    ok(/sin reservas/.test(t1), "la tarjeta dice «sin reservas»", "1");
    ok(await tarjeta(p).locator(".ring").count() === 0 && !/\b100\b/.test(t1), "no hay anillo ni «100»", "1");

    // Una reserva, con el formulario.
    await tarjeta(p).click(); await p.waitForTimeout(400);
    await p.locator("#additem").click(); await p.waitForSelector("#i_title");
    await p.locator('#tp button[data-t="stay"]').click(); await p.waitForTimeout(150);
    await p.locator("#i_title").fill("Hotel Llao Llao");
    await llenarFechaHora(p, "i_start", "2027-01-10T15:00");
    await llenarFechaHora(p, "i_end", "2027-01-17T11:00");
    await p.locator("#save").click(); await p.waitForTimeout(600);
    await inicio(p);
    const t2 = (await tarjeta(p).innerText()).replace(/\s+/g, " ");
    info("tarjeta: " + t2);
    ok(await tarjeta(p).locator(".ring").count() === 1, "con una reserva aparece el anillo", "2");
    ok(!/sin reservas/.test(t2) && /1 reserva/.test(t2), "y dice «1 reserva» en vez de «sin reservas»", "2");

    // Borrarla.
    await tarjeta(p).click(); await p.waitForTimeout(400);
    await abrirParaEditar(p, p.locator("[data-item]").first());
    await p.locator("#delitem").click(); await p.waitForTimeout(600);
    await inicio(p);
    const t3 = (await tarjeta(p).innerText()).replace(/\s+/g, " ");
    ok(/sin reservas/.test(t3) && await tarjeta(p).locator(".ring").count() === 0, "borrada la reserva, vuelve «sin reservas» sin anillo", "3");
    await p.close();
  }

  for (const tema of ["claro", "oscuro"]) {
    titulo(`4 · tema ${tema}`);
    const p = await pagina(browser, tema);
    await p.evaluate(async () => { await Store.saveTrip({ id:"tv", name:"Vacío", destination:"Roma", startDate:"2027-03-01", endDate:"2027-03-05", hue:120 }); });
    await inicio(p);
    const chip = p.locator(".sin-reservas").first();
    if (await chip.count()) {
      const c = await chip.evaluate(e => { const s = getComputedStyle(e); return { color:s.color, fondo:s.backgroundColor }; });
      info(JSON.stringify(c));
      ok(c.color !== c.fondo, "el chip se lee", "4");
    } else ok(false, "está el chip «sin reservas»", "4");
    await p.screenshot({ path:path.join(os.tmpdir(), `val64-${tema}.png`) });
    await p.close();
  }

  await browser.close();
  console.log(`\n${total - fallos} de ${total} bien`);
  if (CONTROL) {
    const reproduce = fallaron.has("1");
    console.log(reproduce ? "CONTROL OK: la v47 falla 1" : "CONTROL FALLÓ: la v47 no falla 1");
    process.exit(reproduce ? 0 : 1);
  }
  process.exit(fallos ? 1 : 0);
})();
