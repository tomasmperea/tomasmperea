"use strict";
/* ============================================================
   VAL-105 — Camino B, opción 1 (decisión del PM, 12/10): sin IA, la app lo dice
   de entrada en vez de fallar al tocar.

   El PM lo comprobó abriendo la beta en incógnito: sin sesión en Claude,
   `claude.use("sample")` no da nada, Importar no lee y la valija no se ajusta.
   Diseño aprobado: docs/design/sin-ia-importar-opciones.png (opción 1) y
   docs/design/sin-ia-valija.png.

     1  Sin IA, el botón Importar dice «con cuenta de Claude».
     2  Tocarlo explica por qué y «Cargarla a mano» abre el formulario.
     3  Armar la valija (tocando el tipo y «Armar la lista») dice que ajustarla al
        destino necesita una cuenta de Claude, sin «Probar de nuevo».
     4  «Acerca de» aclara qué funciones necesitan cuenta (VAL-103).
     5  CON IA nada cambia, ni un instante al arrancar: botón normal, Importar
        abre la pantalla de siempre.
     6  Tema claro y oscuro: el botón se lee.

   Simulador de `sample` según `sample.d.ts`: `use("sample")` resuelve una
   función con `.json` y `.limits`, o null.

   Controles negativos, cada uno comprueba que su sabotaje llegó:
     `control`    corre la v45 (`git show fc9205f`) y exige que fallen 1, 3 y 4.
     `control-5`  arranca la IA en "no" y exige que falle 5 (el destello).

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val105-sin-ia.js [ruta.html | control | control-5]
   ============================================================ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const MODO = process.argv[2] === "control" ? "v45" : process.argv[2] === "control-5" ? "5" : "";
const CONTROL = !!MODO;
const ARRANQUE = 'const IA = { estado:"?" };';
let HTML = path.resolve(process.argv[2] && !CONTROL ? process.argv[2] : path.join(RAIZ, "app", "valija.html"));
if (MODO === "v45") {
  HTML = path.join(os.tmpdir(), "valija-v45-fc9205f.html");
  fs.writeFileSync(HTML, execSync("git show fc9205f:app/valija.html", { cwd:RAIZ, maxBuffer:64e6 }));
}
/* control-5: la IA arranca en "no" en vez de "?". Con IA, el aviso aparece un
   instante antes de que la plataforma conteste: tiene que fallar el caso 5. */
if (MODO === "5") {
  const actual = fs.readFileSync(HTML, "utf8");
  HTML = path.join(os.tmpdir(), "valija-ia-arranca-en-no.html");
  fs.writeFileSync(HTML, actual.split(ARRANQUE).join('const IA = { estado:"no" };'));
}
let fallos = 0, total = 0; const fallaron = new Set();
const ok = (c, m, caso) => { total++; if (c) console.log("  ok    " + m); else { fallos++; if (caso) fallaron.add(caso); console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

const SEMILLA = { trips:[{ id:"t1", name:"Madrid", destination:"Madrid", startDate:"2026-11-02", endDate:"2026-11-09", hue:200 }],
  items:{ t1:[{ id:"f1", type:"flight", title:"Buenos Aires → Madrid", from:"EZE", to:"MAD", start:"2026-11-02T22:10", end:"2026-11-03T14:35", provider:"Iberia", confirmation:"IB6844" }] }, packing:{} };

async function pagina(browser, { ia = false, tema = null, hash = "#/trip/t1" } = {}) {
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; console.log("  !! pageerror: " + e.message); });
  await p.addInitScript(() => {
    window.__sinIaVisto = false;
    new MutationObserver(() => { if (document.querySelector(".imp-sin-ia, #pk-sin-ia")) window.__sinIaVisto = true; })
      .observe(document, { childList:true, subtree:true });
  });
  await p.addInitScript(([conIa, d, t]) => {
    try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
          localStorage.setItem("valija.aviso.local", "1"); if (t) localStorage.setItem("valija.tema", t); } catch (e) {}
    let sample = null;
    if (conIa) {
      sample = async () => ({ text:"", truncated:false });
      sample.json = async pr => (/equipaje/i.test(String(pr)) ? { items:[{ nombre:"Adaptador tipo F", categoria:"electronica", cantidad:1, motivo:"España usa enchufe tipo F" }], quitar:[] } : { items:[] });
      sample.limits = async () => ({ maxPromptBytes:200000, images:true });
    }
    window.claude = { use: async n => (n === "sample" ? sample : null) };
  }, [ia, SEMILLA, tema]);
  await p.goto("file://" + HTML + hash);
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(700);
  return p;
}

(async () => {
  if (MODO === "5") ok(fs.readFileSync(HTML, "utf8").indexOf(ARRANQUE) < 0, "control: el arranque en \"?\" no está (el sabotaje llegó)", "sabotaje");
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

  titulo("1 y 2 · sin IA: Importar avisa, y tocarlo explica y ofrece cargar a mano");
  {
    const p = await pagina(browser);
    const t = (await p.locator("#imp").innerText()).replace(/\s+/g, " ");
    info("botón: " + t);
    ok(/con cuenta de Claude/.test(t), "el botón dice «con cuenta de Claude»", "1");
    await p.locator("#imp").click(); await p.waitForTimeout(400);
    const hoja = await p.locator("#imp-sin-ia").innerText().catch(() => "");
    ok(/necesita una cuenta de Claude/.test(hoja) && /sesión iniciada/.test(hoja), "la hoja dice por qué y qué hacer", "2");
    if (await p.locator("#imp-a-mano").count()) {
      await p.locator("#imp-a-mano").click(); await p.waitForTimeout(400);
      ok(await p.locator("#i_title").count() === 1, "«Cargarla a mano» abre el formulario de la reserva", "2");
    } else ok(false, "está «Cargarla a mano»", "2");
    await p.close();
  }

  titulo("3 · sin IA: la valija dice por qué no se ajustó, sin «Probar de nuevo»");
  {
    const p = await pagina(browser, { hash:"#/trip/t1/valija" });
    await p.waitForSelector("#pk-tp", { timeout:10000 });
    await p.locator('#pk-tp [data-t="ciudad"]').click(); await p.waitForTimeout(150);
    await p.locator("#pk-build").click();
    await p.waitForFunction(() => { const l = Store.packingOf("t1"); return l && l.items && Object.keys(l.items).length && !PK.generating; }, null, { timeout:15000 });
    await p.waitForTimeout(600);
    const aviso = await p.locator("#pk-sin-ia").innerText().catch(() => "");
    info("aviso: " + aviso.replace(/\s+/g, " "));
    ok(/Ajustarla a Madrid necesita una cuenta de Claude/.test(aviso), "dice que ajustarla a Madrid necesita una cuenta de Claude", "3");
    ok(await p.locator("#pk-retry").count() === 0, "no ofrece «Probar de nuevo»", "3");
    await p.close();
  }

  titulo("4 · sin IA: «Acerca de» aclara qué necesita cuenta");
  {
    const p = await pagina(browser, { hash:"#/" });
    await p.locator("#about").click(); await p.waitForTimeout(300);
    const hoja = await p.locator(".sheet").last().innerText();
    ok(/Lectura de confirmaciones · con cuenta de Claude/.test(hoja) && /Foto de tarjeta de embarque · con cuenta de Claude/.test(hoja),
       "«Lectura de confirmaciones» y «Foto de tarjeta de embarque» dicen «con cuenta de Claude»", "4");
    await p.close();
  }

  titulo("5 · CON IA: nada cambia, ni un instante");
  {
    const p = await pagina(browser, { ia:true });
    const t = (await p.locator("#imp").innerText()).replace(/\s+/g, " ").trim();
    ok(t === "Importar", `el botón dice «Importar» (dice «${t}»)`, "5");
    await p.locator("#imp").click(); await p.waitForTimeout(800);
    ok(await p.locator("#imp-sin-ia").count() === 0 && (await p.locator("#imp-live, #im_text, .imp-more").count()) > 0,
       "Importar abre la pantalla de siempre", "5");
    await p.keyboard.press("Escape");
    await p.goto("file://" + HTML + "#/"); await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready); await p.waitForTimeout(500);
    await p.locator("#about").click(); await p.waitForTimeout(300);
    ok(!/con cuenta de Claude/.test(await p.locator(".sheet").last().innerText()), "«Acerca de» no agrega la aclaración", "5");
    ok(await p.evaluate(() => window.__sinIaVisto) === false, "nada de «sin IA» apareció en ningún momento", "5");
    await p.close();
  }

  for (const tema of ["claro", "oscuro"]) {
    titulo(`6 · tema ${tema}`);
    const p = await pagina(browser, { tema });
    const c = await p.locator("#imp").evaluate(e => { const s = getComputedStyle(e); return { color:s.color, fondo:s.backgroundColor, op:s.opacity }; });
    info(JSON.stringify(c));
    ok(c.color !== c.fondo, "el botón se lee", "6");
    await p.screenshot({ path:path.join(os.tmpdir(), `val105-${tema}.png`) });
    await p.close();
  }

  await browser.close();
  console.log(`\n${total - fallos} de ${total} bien`);
  if (CONTROL) {
    const deben = MODO === "v45" ? ["1", "3", "4"] : ["5"];
    const reproduce = deben.every(c => fallaron.has(c)) && !fallaron.has("sabotaje");
    console.log(reproduce ? `CONTROL OK (${MODO}): falla ${deben.join(", ")}` : `CONTROL FALLÓ (${MODO}): no falla ${deben.filter(c => !fallaron.has(c)).join(", ") || "— el sabotaje no llegó"}`);
    process.exit(reproduce ? 0 : 1);
  }
  process.exit(fallos ? 1 : 0);
})();
