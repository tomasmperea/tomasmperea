"use strict";
/* ============================================================
   VAL-67 — Las categorías de la valija arrancan cerradas. Opción B del PM
   (docs/design/val67-categorias-cerradas.png): todo cerrado al entrar, salvo la
   categoría donde la IA agregó algo para el destino.

   Por gesto, sobre un viaje a Lisboa con un vuelo:
     1  Armar la lista tocando «Ciudad» y «Armar»: todas cerradas menos las que
        recibieron algo de la IA para el destino («Paraguas compacto» en
        Específicos del destino, «Campera impermeable» en Ropa), que se ven.
     2  Tocar «Higiene» la abre; marcar un ítem NO la cierra (antes del arreglo,
        cada marca volvía al valor por defecto, que ahora es cerrado).
     3  Marcar todo lo de «Higiene»: se pliega sola con «listo».
     4  Empacar desde el detalle la campera que agregó la IA: «Ropa» sigue
        abierta, porque le quedan pendientes (sin el arreglo, ya no le queda
        nada del destino y volvía a cerrada).
     5  «Agregar ítem» (el botón de abajo) en «Calzado», que está cerrada: se
        abre y el ítem nuevo se ve.
     6  Cargar un auto con el formulario y aplicar el plan: las categorías que
        reciben ítems nuevos siguen cerradas pero dicen «N nuevos» desde afuera.
     7  Sin IA: todas cerradas, ninguna abierta sola.

   Control negativo: `control` corre la v48 (`git show 1caf952`) y exige que
   fallen 1 y 2. `control-b` corre la v49 con el viejo `delete` en los gestos
   sobre un ítem y en el detalle (sin "hasta-listo") y exige que fallen 2 y 4.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val67-categorias-cerradas.js [ruta.html | control | control-b]
   ============================================================ */
const { chromium } = require("playwright");
const { llenarFechaHora } = require("./fecha-y-hora");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const MODO = process.argv[2];
const CONTROL = MODO === "control", CONTROL_B = MODO === "control-b";
let HTML = path.resolve(MODO && !CONTROL && !CONTROL_B ? MODO : path.join(RAIZ, "app", "valija.html"));
if (CONTROL) {
  HTML = path.join(os.tmpdir(), "valija-v48-1caf952.html");
  fs.writeFileSync(HTML, execSync("git show 1caf952:app/valija.html", { cwd:RAIZ, maxBuffer:64e6 }));
}
if (CONTROL_B) {
  const MARCA = `PK.openCats[it.categoria] = "hasta-listo";`;
  const actual = fs.readFileSync(HTML, "utf8");
  if ((actual.split(MARCA).length - 1) < 5) { console.log("CONTROL-B FALLÓ: no están las cinco marcas"); process.exit(1); }
  HTML = path.join(os.tmpdir(), "valija-v49-sin-hasta-listo.html");
  fs.writeFileSync(HTML, actual.split(MARCA).join("delete PK.openCats[it.categoria];"));
}
let fallos = 0, total = 0; const fallaron = new Set();
const ok = (c, m, caso) => { total++; if (c) console.log("  ok    " + m); else { fallos++; if (caso) fallaron.add(caso); console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

const DATOS = { trips:[{ id:"t1", name:"Lisboa", destination:"Lisboa", startDate:"2027-03-10", endDate:"2027-03-17", hue:200 }],
  items:{ t1:[{ id:"i1", type:"flight", title:"EZE > LIS", from:"EZE", to:"LIS", start:"2027-03-10T22:00", end:"2027-03-11T14:00", provider:"TAP", confirmation:"ABC123" }] },
  packing:{} };

function conIA() {
  let primera = true;
  const sample = {
    limits: async () => ({ maxPromptBytes:200000 }),
    json: async pr => {
      if (/equipaje/i.test(String(pr)) && primera) { primera = false;
        return { items:[{ nombre:"Paraguas compacto", categoria:"destino", cantidad:1, motivo:"llueve seguido" },
                         { nombre:"Campera impermeable", categoria:"ropa", cantidad:1, motivo:"llueve seguido" }], quitar:[] }; }
      return { items:[], quitar:[] };
    }
  };
  window.claude = { use: async k => (k === "sample" ? sample : null) };
}
function sinIA() { window.claude = { use: async () => null }; }

async function pagina(browser, ia) {
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; console.log("  !! pageerror: " + e.message); });
  await p.addInitScript(ia ? conIA : sinIA);
  await p.addInitScript(d => { try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
    localStorage.setItem("valija.aviso.local", "1"); } catch (e) {} }, DATOS);
  return p;
}
async function ir(p, hash) {
  await p.goto("file://" + HTML + hash);
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(400);
}
async function armar(p) {
  await ir(p, "#/trip/t1/valija");
  await p.waitForSelector("#pk-tp", { timeout:10000 });
  await p.locator('#pk-tp [data-t="ciudad"]').click(); await p.waitForTimeout(150);
  await p.locator("#pk-build").click();
  await p.waitForFunction(() => { const l = Store.packingOf("t1"); return l && l.items && Object.keys(l.items).length && !PK.generating; }, null, { timeout:15000 });
  await p.waitForTimeout(900);
}
const cat = (p, key) => p.locator(".pk-cat", { has:p.locator(`.pk-cat-hd[data-cat="${key}"]`) });
const abierta = async (p, key) => (await cat(p, key).getAttribute("data-open")) === "true";
const estados = p => p.$$eval(".pk-cat", cs => cs.map(c => c.querySelector(".pk-cat-hd").dataset.cat + ":" + c.dataset.open).join(" "));

(async () => {
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

  titulo("1, 2, 3, 5 y 6 · con IA");
  {
    const p = await pagina(browser, true);
    let caso = "1";
    try {
    await armar(p);
    info(await estados(p));
    const keys = await p.$$eval(".pk-cat-hd", hs => hs.map(h => h.dataset.cat));
    const otras = keys.filter(k => k !== "destino" && k !== "ropa");
    let cerradas = 0; for (const k of otras) if (!(await abierta(p, k))) cerradas++;
    ok(otras.length >= 4 && cerradas === otras.length, `al entrar, las ${otras.length} categorías sin nada del destino están cerradas`, "1");
    ok(await abierta(p, "destino") && await cat(p, "destino").getByText("Paraguas compacto").isVisible(),
      "«Específicos del destino» arranca abierta y «Paraguas compacto» se ve", "1");
    ok(await abierta(p, "ropa") && await cat(p, "ropa").getByText("Campera impermeable").isVisible(),
      "«Ropa» también, porque la IA le agregó «Campera impermeable»", "1");

    // 2 · abrir Higiene y marcar
    caso = "2";
    await p.locator('.pk-cat-hd[data-cat="higiene"]').click(); await p.waitForTimeout(300);
    ok(await abierta(p, "higiene"), "tocar «Higiene» la abre", "2");
    await cat(p, "higiene").locator("[data-mark]").first().click(); await p.waitForTimeout(700);
    ok(await abierta(p, "higiene"), "marcar un ítem no la cierra", "2");
    ok(/^1 de /.test((await cat(p, "higiene").locator(".cnt").innerText()).trim()), "y la cuenta dice «1 de …»", "2");

    // 3 · marcar todo lo que queda
    caso = "3";
    for (let i = 0; i < 20; i++) {
      const pend = cat(p, "higiene").locator('.pk-row[data-row] [data-mark]:not(.on)');
      const resto = await p.evaluate(() => Object.values(Store.packingOf("t1").items).filter(i => i.categoria === "higiene" && i.estado === "pendiente").length);
      if (!resto) break;
      const rows = cat(p, "higiene").locator(".pk-row[data-row]");
      const n = await rows.count(); let hecho = false;
      for (let j = 0; j < n && !hecho; j++) {
        const clave = await rows.nth(j).getAttribute("data-row");
        const est = await p.evaluate(c => Store.packingOf("t1").items[c].estado, clave);
        if (est === "pendiente") { await rows.nth(j).locator("[data-mark]").click(); await p.waitForTimeout(500); hecho = true; }
      }
      if (!hecho) break;
    }
    ok(!(await abierta(p, "higiene")) && /listo/.test(await cat(p, "higiene").locator(".cnt").innerText()),
      "con todo marcado, «Higiene» se pliega sola con «listo»", "3");

    // 5 · Agregar ítem en Calzado, que está cerrada
    caso = "5";
    ok(!(await abierta(p, "calzado")), "«Calzado» está cerrada antes de agregar", "5");
    await p.locator("#pk-additem").click(); await p.waitForSelector("#pk_new_nombre");
    await p.locator("#pk_new_nombre").fill("Ojotas");
    await p.locator("#pk_new_cat").selectOption("calzado");
    await p.locator("#save").click(); await p.waitForTimeout(900);
    ok(await abierta(p, "calzado") && await cat(p, "calzado").getByText("Ojotas").isVisible(),
      "agregado en «Calzado», la categoría se abre y «Ojotas» se ve", "5");

    caso = "6";
    // 6 · cargar un auto y aplicar el plan: ítems nuevos en categorías cerradas
    await ir(p, "#/trip/t1");
    await p.locator("#additem").click(); await p.waitForTimeout(150);
    await p.locator('#tp button[data-t="car"]').click();
    await p.fill("#i_title", "Auto en Lisboa");
    await llenarFechaHora(p, "i_start", "2027-03-12T10:00");
    await llenarFechaHora(p, "i_end", "2027-03-15T10:00");
    await p.fill("#i_provider", "Europcar");
    await p.locator("#save").click(); await p.waitForTimeout(1200);
    await ir(p, "#/trip/t1/valija");
    if (await p.locator('#main [data-pk="verplan"]').count()) {
      await p.locator('#main [data-pk="verplan"]').click(); await p.waitForTimeout(300);
      if (await p.locator("#pk-plan-apply").count()) { await p.locator("#pk-plan-apply").click(); await p.waitForTimeout(1800); }
    }
    const conNuevos = await p.evaluate(() => {
      const l = Store.packingOf("t1"); const s = new Set();
      Object.values(l.items).forEach(i => { if (i.nuevo && i.estado !== "descartado") s.add(i.categoria); });
      return [...s];
    });
    info("categorías con ítems nuevos: " + conNuevos.join(", "));
    let bien = conNuevos.length > 0;
    for (const k of conNuevos) {
      const txt = await cat(p, k).locator(".pk-cat-hd .cnt").innerText();
      if (!(await abierta(p, k)) && !/nuevo/.test(txt)) bien = false;
    }
    ok(bien, "toda categoría cerrada con ítems nuevos lo dice desde afuera («N nuevos»)", "6");
    } catch (e) { ok(false, `se cortó en el caso ${caso}: ${String(e.message).split("\n")[0]}`, caso); }
    await p.close();
  }

  titulo("4 · empacar desde el detalle lo que agregó la IA en «Ropa»");
  {
    const p = await pagina(browser, true);
    try {
    await armar(p);
    const fila = cat(p, "ropa").locator(".pk-row[data-row]", { hasText:"Campera impermeable" });
    await fila.locator("[data-detail]").click(); await p.waitForTimeout(400);
    ok(await p.locator(".sheet").isVisible(), "tocar «Campera impermeable» abre su detalle", "4");
    await p.locator('.pk-states [data-s="empacado"]').click();
    await p.locator("#save").click(); await p.waitForTimeout(800);
    const quedan = await p.evaluate(() => Object.values(Store.packingOf("t1").items).filter(i => i.categoria === "ropa" && i.estado === "pendiente").length);
    info("pendientes en «Ropa»: " + quedan);
    ok(quedan > 0 && await abierta(p, "ropa"), "empacada desde el detalle, «Ropa» sigue abierta con lo que le falta", "4");
    } catch (e) { ok(false, `se cortó en el caso 4: ${String(e.message).split("\n")[0]}`, "4"); }
    await p.close();
  }

  titulo("7 · sin IA");
  {
    const p = await pagina(browser, false);
    await armar(p);
    info(await estados(p));
    ok(await p.locator('.pk-cat[data-open="true"]').count() === 0 && await p.locator(".pk-cat").count() >= 5,
      "sin IA, todas cerradas", "7");
    await p.close();
  }

  await browser.close();
  console.log(`\n${total - fallos} de ${total} bien`);
  if (CONTROL) {
    const r = fallaron.has("1") && fallaron.has("2");
    console.log(r ? "CONTROL OK: la v48 falla 1 y 2" : "CONTROL FALLÓ: la v48 no falla 1 y 2 (" + [...fallaron].join(",") + ")");
    process.exit(r ? 0 : 1);
  }
  if (CONTROL_B) {
    const r = fallaron.has("2") && fallaron.has("4");
    console.log(r ? "CONTROL-B OK: sin \"hasta-listo\" fallan 2 y 4" : "CONTROL-B FALLÓ: sin \"hasta-listo\" no fallan 2 y 4 (" + [...fallaron].join(",") + ")");
    process.exit(r ? 0 : 1);
  }
  process.exit(fallos ? 1 : 0);
})();
