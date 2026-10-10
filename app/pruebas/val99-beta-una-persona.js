"use strict";
/* ============================================================
   VAL-99 + VAL-101 — Lo que necesita la beta cerrada con una persona.

   Decisión del PM (10/10): testers externos, empezar por una persona. La
   copia para testers se publica SIN base compartida: cada uno guarda en su
   teléfono. Esto prueba las dos piezas nuevas:

     1  «Contanos» aparece si la plataforma da `comments`, y tocarlo abre el
        comentario anclado a la pantalla (`openComposer({element})`).
     2  Sin `comments`, no aparece.
     3  `unavailable` (esta vista no admite comentarios): lo dice y el botón se va.
     4  `{opened:false}` (ya hay un comentario abierto): lo dice y el botón queda.
     5  Sin base compartida, la pantalla de inicio dice que los viajes quedan en
        este teléfono; «Entendido» lo saca, y recargar no lo trae de vuelta.
     6  CON base compartida (la app del PM) el aviso no aparece NUNCA, ni un
        instante al arrancar: se mira con un observador desde antes de cargar.
     7  Tema claro y oscuro: el aviso y el botón se leen.
     8  Sin base, «Compartir el viaje» no ofrece un link que no lleva el viaje;
        con base, sigue como antes.

   Los simuladores siguen los contratos: `comments.d.ts` (openComposer resuelve
   {opened} o rechaza con {code}) y `app/parts/db-mock.js` para la base.

   Controles negativos, cada uno comprueba que su sabotaje llegó:
     `control`    corre la v43 (`git show 0b40011`) y exige que fallen 1 y 5.
     `control-6`  saca la guarda de `modoResuelto` y exige que falle 6.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val99-beta-una-persona.js [ruta.html | control | control-6]
   ============================================================ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const MODO = process.argv[2] === "control" ? "v43" : process.argv[2] === "control-6" ? "6" : "";
const CONTROL = !!MODO;
const GUARDA = "soloEnEsteDispositivo(){ return this.modoResuelto && !this.db; },";
let HTML = path.resolve(process.argv[2] && !CONTROL ? process.argv[2] : path.join(RAIZ, "app", "valija.html"));
if (MODO === "v43") {
  HTML = path.join(os.tmpdir(), "valija-v43-0b40011.html");
  fs.writeFileSync(HTML, execSync("git show 0b40011:app/valija.html", { cwd:RAIZ, maxBuffer:64e6 }));
}
/* control-6: la guarda de `modoResuelto` reemplazada por preguntar sólo por
   `mode`. Tiene que fallar el caso 6: el aviso aparece un instante en la app
   del PM, antes de que la plataforma conteste. */
if (MODO === "6") {
  const actual = fs.readFileSync(HTML, "utf8");
  HTML = path.join(os.tmpdir(), "valija-sin-guarda-6.html");
  fs.writeFileSync(HTML, actual.split(GUARDA).join('soloEnEsteDispositivo(){ return this.mode !== "cloud"; },'));
}
const DB_MOCK = fs.readFileSync(path.join(RAIZ, "app", "parts", "db-mock.js"), "utf8");

let fallos = 0, total = 0; const fallaron = new Set();
const ok = (c, m, caso) => { total++; if (c) console.log("  ok    " + m); else { fallos++; if (caso) fallaron.add(caso); console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

const SEMILLA = { trips:[{ id:"t1", name:"Escapada", destination:"Madrid", startDate:"2026-11-02", endDate:"2026-11-09", hue:200 }], items:{ t1:[] }, packing:{} };

/* `comentarios`: null (no hay capacidad), "abre", "ocupado" ({opened:false}) o
   "no-disponible" (rechaza `unavailable`). `base`: true usa db-mock. */
async function pagina(browser, { comentarios = "abre", base = false, tema = null } = {}) {
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; console.log("  !! pageerror: " + e.message); });
  // El observador va PRIMERO: tiene que ver el aviso aunque aparezca un instante.
  await p.addInitScript(() => {
    window.__avisoVisto = false;
    new MutationObserver(() => { if (document.getElementById("aviso-local")) window.__avisoVisto = true; })
      .observe(document, { childList:true, subtree:true });
  });
  if (base) await p.addInitScript(DB_MOCK);
  await p.addInitScript(([modo, conBase, d, t]) => {
    try { if (!conBase && !localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
          if (t) localStorage.setItem("valija.tema", t); } catch (e) {}
    window.__composer = [];
    const comments = modo ? {
      async openComposer(target) {
        window.__composer.push(target && target.element ? (target.element.id || target.element.tagName) : "?");
        if (modo === "no-disponible") { const e = new Error("no comments here"); e.code = "unavailable"; throw e; }
        return { opened: modo !== "ocupado" };
      },
      async anchorFor() { return {}; }
    } : null;
    const previo = window.claude && window.claude.use;
    window.claude = { use: async n => {
      if (n === "comments") return comments;
      if (n === "db" && previo) return previo(n);
      return null;
    } };
  }, [comentarios, base, SEMILLA, tema]);
  await p.goto("file://" + HTML + "#/");
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(600);
  return p;
}
const ultimoToast = p => p.locator(".toast").last().innerText().catch(() => "");

(async () => {
  if (MODO === "6") ok(fs.readFileSync(HTML, "utf8").indexOf(GUARDA) < 0, "control: la guarda no está (el sabotaje llegó)", "sabotaje");
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

  titulo("1 · «Contanos» aparece y abre el comentario anclado a la pantalla");
  {
    const p = await pagina(browser);
    const b = p.locator("#contanos");
    ok(await b.count() === 1, "el botón está en la cabecera", "1");
    if (await b.count()) {
      ok(/Contanos/.test(await b.getAttribute("aria-label")), "con un nombre que se lee en voz alta", "1");
      await b.click(); await p.waitForTimeout(300);
      const llamadas = await p.evaluate(() => window.__composer);
      ok(llamadas.length === 1 && llamadas[0] === "main", `abre el comentario sobre la pantalla (${JSON.stringify(llamadas)})`, "1");
    }
    await p.close();
  }

  titulo("2 · sin la capacidad de comentarios, no aparece");
  {
    const p = await pagina(browser, { comentarios:null });
    ok(await p.locator("#contanos").count() === 0, "no hay botón", "2");
    await p.close();
  }

  titulo("3 · si esta vista no admite comentarios, lo dice y el botón se va");
  {
    const p = await pagina(browser, { comentarios:"no-disponible" });
    if (await p.locator("#contanos").count()) {
      await p.locator("#contanos").click(); await p.waitForTimeout(400);
      const t = await ultimoToast(p);
      info("cartel: " + t);
      ok(/no se pueden dejar comentarios/.test(t) && /captura/.test(t), "dice qué pasó y qué hacer", "3");
      ok(await p.locator("#contanos").count() === 0, "el botón se fue", "3");
    } else ok(false, "el botón estaba", "3");
    await p.close();
  }

  titulo("4 · si ya hay un comentario abierto, lo dice y el botón queda");
  {
    const p = await pagina(browser, { comentarios:"ocupado" });
    if (await p.locator("#contanos").count()) {
      await p.locator("#contanos").click(); await p.waitForTimeout(400);
      ok(/ya hay un comentario abierto/.test(await ultimoToast(p)), "lo dice", "4");
      ok(await p.locator("#contanos").count() === 1, "el botón sigue", "4");
    } else ok(false, "el botón estaba", "4");
    await p.close();
  }

  titulo("5 · sin base compartida: el aviso de que los viajes quedan en este teléfono");
  {
    const p = await pagina(browser);
    const aviso = p.locator("#aviso-local");
    ok(await aviso.count() === 1, "el aviso está en la pantalla de inicio", "5");
    if (await aviso.count()) {
      const t = (await aviso.innerText()).replace(/\s+/g, " ");
      info(t);
      ok(/se guardan en este teléfono/.test(t) && /No los ve nadie más/.test(t) && /se pierden/.test(t), "dice dónde quedan, quién los ve y cuándo se pierden", "5");
      await p.locator("#aviso-local-ok").click(); await p.waitForTimeout(200);
      ok(await aviso.count() === 0, "«Entendido» lo saca", "5");
      await p.reload(); await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready); await p.waitForTimeout(600);
      ok(await p.locator("#aviso-local").count() === 0, "recargar no lo trae de vuelta", "5");
      // Entrar a un viaje y volver tampoco lo trae (se dibuja en cada inicio).
      await p.locator("[data-trip]").first().click(); await p.waitForTimeout(300);
      await p.goBack(); await p.waitForTimeout(400);
      ok(await p.locator("#aviso-local").count() === 0, "ni ir y volver de un viaje", "5");
    }
    await p.close();
  }

  titulo("6 · con base compartida (la app del PM) el aviso no aparece nunca, ni un instante");
  {
    const p = await pagina(browser, { base:true });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({ modo:Store.mode, visto:window.__avisoVisto }));
    info(JSON.stringify(r));
    ok(r.modo === "cloud", "la app está en la base compartida (el simulador llegó)", "6");
    ok(r.visto === false, "el aviso no apareció en ningún momento", "6");
    await p.close();
  }

  titulo("8 · «Compartir el viaje» no promete un link que no lleva el viaje");
  for (const base of [false, true]) {
    const p = await pagina(browser, { base });
    if (base) await p.evaluate(async d => { await Store.saveTrip(Object.assign({}, d.trips[0])); }, SEMILLA);
    await p.goto("file://" + HTML + "#/trip/t1"); await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready);
    await p.waitForSelector("#sharetrip", { timeout:10000 }).catch(() => {});
    if (!(await p.locator("#sharetrip").count())) { ok(false, `${base ? "con" : "sin"} base: está el botón Compartir`, "8"); await p.close(); continue; }
    await p.locator("#sharetrip").click(); await p.waitForTimeout(300);
    const local = await p.locator("#sh_local").count(), link = await p.locator("#sh_url").count(), resumen = await p.locator("#sh_txt").count();
    await p.locator("#cancel").click().catch(() => {}); await p.waitForTimeout(200);
    await p.goto("file://" + HTML + "#/"); await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready); await p.waitForTimeout(400);
    await p.locator("#about").click(); await p.waitForTimeout(300);
    const chip = /Compartir ver \/ editar/.test(await p.locator(".sheet").last().innerText().catch(() => ""));
    ok(base ? chip : !chip, `«Acerca de» ${base ? "sigue diciendo" : "no dice"} «Compartir ver / editar»`, "8");
    if (!base) {
      ok(local === 1 && link === 0, "sin base: dice que el link no lleva el viaje y no ofrece el link", "8");
      ok(resumen === 1, "sin base: el resumen para pegar en un chat sigue", "8");
    } else {
      ok(local === 0 && link === 1, "con base: el link al viaje sigue como antes", "8");
    }
    await p.close();
  }

  for (const tema of ["claro", "oscuro"]) {
    titulo(`7 · tema ${tema}`);
    const p = await pagina(browser, { tema });
    for (const sel of ["#aviso-local", "#contanos"]) {
      if (!(await p.locator(sel).count())) { ok(false, `${sel} está`, "7"); continue; }
      const c = await p.locator(sel).evaluate(e => { const s = getComputedStyle(e); return { color:s.color, fondo:s.backgroundColor }; });
      ok(c.color !== c.fondo, `${sel} se lee (${c.color} sobre ${c.fondo})`, "7");
    }
    await p.screenshot({ path:path.join(os.tmpdir(), `val99-${tema}.png`) });
    await p.close();
  }

  await browser.close();
  console.log(`\n${total - fallos} de ${total} bien`);
  if (CONTROL) {
    const deben = MODO === "v43" ? ["1", "5"] : ["6"];
    const reproduce = deben.every(c => fallaron.has(c)) && !fallaron.has("sabotaje");
    console.log(reproduce ? `CONTROL OK (${MODO}): falla ${deben.join(", ")}` : `CONTROL FALLÓ (${MODO}): no falla ${deben.filter(c => !fallaron.has(c)).join(", ") || "— el sabotaje no llegó"}`);
    process.exit(reproduce ? 0 : 1);
  }
  process.exit(fallos ? 1 : 0);
})();
