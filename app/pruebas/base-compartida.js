/* ============================================================
   LA BASE COMPARTIDA — lo que sólo pasa cuando el viaje está en la nube

   Por qué existe: todos los demás arneses corren SIN `db`, así que el
   cuerpo de cada documento va a `localStorage` y hay una rama entera de
   la app que nunca se ejercía. Quedaba declarada como "no verificable",
   y no lo era: el contrato de `db` se puede simular con fidelidad, que
   es justo lo que hace `app/parts/db-mock.js` desde que un simulador
   escrito de memoria nos costó dos iteraciones.

   Qué se ejerce acá, y en ningún otro lado:
     · el rechazo REAL por 256 KiB (`invalid_argument`) y su traducción;
     · el borrado en cascada de los cuerpos al borrar la reserva y al
       borrar el viaje — si falla, cada documento queda ocupando cupo
       de los 5.000 para siempre y nadie lo puede borrar nunca;
     · `quota_exceeded`, que es lo que contesta la base cuando se llenó;
     · D4, el visor cuando el cuerpo no se puede traer.

   Reglas del simulador, tomadas del contrato y no de la memoria:
     · `data()` es un MÉTODO, y devuelve undefined si no existe;
     · `exists` es una propiedad;
     · un documento serializado de más de 256 KiB se rechaza con
       `invalid_argument`, que NO es reintentable;
     · toda entrega es asincrónica.

       node app/pruebas/base-compartida.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");

let fallos = 0;
const ok = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  >> PAGEERROR:", e.message); fallos++; });

  await page.addInitScript(() => {
    const TOPE = 262144;
    const store = new Map();
    const subs = [];
    const subsDoc = [];
    window.__DB__ = { store, fallarLectura:false, lleno:false, escrituras:[], borrados:[] };

    const bytes = o => new TextEncoder().encode(JSON.stringify(o)).length;
    const err = (code, msg) => { const e = new Error(msg); e.code = code; return e; };

    function docRef(ruta){
      return {
        async set(data){
          await 0;
          window.__DB__.escrituras.push(ruta);
          if (window.__DB__.lleno) throw err("quota_exceeded", "database is full");
          const n = bytes(data);
          if (n > TOPE) throw err("invalid_argument", `document too large: ${n} > ${TOPE}`);
          store.set(ruta, JSON.parse(JSON.stringify(data)));
          notificar();
        },
        async update(data){ const cur = store.get(ruta) || {}; return this.set(Object.assign({}, cur, data)); },
        async get(){
          await 0;
          if (window.__DB__.fallarLectura) throw err("unavailable", "backend unavailable");
          const v = store.get(ruta);
          return { exists: v !== undefined, data(){ return v; } };   // data() ES un método
        },
        async delete(){ await 0; window.__DB__.borrados.push(ruta); store.delete(ruta); notificar(); },
        /* El contrato también expone onSnapshot en un DOCUMENTO, no sólo en
           una colección: la lista de equipaje se mira así. Faltaba en la
           primera versión de este simulador y la app tiraba un error en
           consola — un hueco del simulador, no del producto, pero de los que
           dejan una rama sin ejercer. */
        onSnapshot(cb){ subsDoc.push({ruta, cb}); entregarDoc({ruta, cb}); return () => {}; }
      };
    }
    function colRef(pref){
      return {
        async get(){
          await 0;
          return { docs: [...store.keys()].filter(k => k.startsWith(pref + "/") && k.slice(pref.length+1).indexOf("/") < 0)
            .map(k => ({ id:k.slice(pref.length+1), data(){ return store.get(k); } })) };
        },
        onSnapshot(cb){ subs.push({pref, cb}); entregar({pref, cb}); return () => {}; }
      };
    }
    function entregar(s){
      Promise.resolve().then(() => s.cb({ docs: [...store.keys()]
        .filter(k => k.startsWith(s.pref + "/") && k.slice(s.pref.length+1).indexOf("/") < 0)
        .map(k => ({ id:k.slice(s.pref.length+1), data(){ return store.get(k); } })) }));
    }
    function entregarDoc(s){
      Promise.resolve().then(() => {
        const v = store.get(s.ruta);
        s.cb({ exists: v !== undefined, data(){ return v; } });
      });
    }
    function notificar(){ subs.forEach(entregar); subsDoc.forEach(entregarDoc); }

    window.claude = { use: async n => {
      if (n === "db") return { doc:docRef, collection:colRef };
      if (n === "sample") return { limits: async () => ({maxPromptBytes:65536}), json: async () => ({items:[]}) };
      return null;
    }};
  });

  await page.goto("file://" + APP);
  await page.waitForTimeout(1800);

  const modo = await page.evaluate(() => Store.mode);
  ok(modo === "cloud", `la app está corriendo CONTRA LA BASE, no contra localStorage (${modo})`);

  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Madrid"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(1200);
  const tripId = await page.evaluate(() => Store.tripList()[0] && Store.tripList()[0].id);
  ok(!!tripId, "el viaje se guardó en la base");

  console.log("\n· el tope REAL de 256 KiB de la base (nunca se había ejercido)");
  const cabe = await page.evaluate(async tripId => {
    // 190 KB crudos: el tope que el motor acepta. Tiene que ENTRAR.
    const b64 = "A".repeat(Math.ceil(194560 * 4 / 3));
    try { await Store.saveDocBody(tripId, {id:"d-justo", b64, mime:"application/pdf"}); return {ok:true}; }
    catch(e){ return {ok:false, code:e.code, msg:String(e.message).slice(0,80)}; }
  }, tripId);
  ok(cabe.ok, "un archivo de 190 KB —el tope del motor— ENTRA en un documento de la base");
  if (!cabe.ok) info("rechazo: " + JSON.stringify(cabe));

  const noCabe = await page.evaluate(async tripId => {
    const b64 = "A".repeat(Math.ceil(300000 * 4 / 3));   // muy por encima
    try { await Store.saveDocBody(tripId, {id:"d-grande", b64, mime:"application/pdf"}); return {ok:true}; }
    catch(e){
      const t = AdjuntosEngine.interpretarErrorDeLaBase(e);
      return {ok:false, code:e.code, codigo:t.codigo, mensaje:t.mensaje, reintentable:t.reintentable};
    }
  }, tripId);
  ok(!noCabe.ok, "uno de 300 KB NO entra: la base lo rechaza de verdad");
  ok(noCabe.code === "invalid_argument", `y el código es el del contrato: ${noCabe.code}`);
  ok(noCabe.reintentable === false, "la app sabe que NO sirve reintentar");
  ok(!!noCabe.mensaje && !/disculp|perdón|error/i.test(noCabe.mensaje), "y lo traduce a algo accionable, sin disculpas");
  info("mensaje al usuario: " + JSON.stringify(noCabe.mensaje));

  console.log("\n· quota_exceeded — la base llena");
  const llena = await page.evaluate(async tripId => {
    window.__DB__.lleno = true;
    let r;
    try { await Store.saveDocBody(tripId, {id:"d-x", b64:"AAAA", mime:"application/pdf"}); r = {ok:true}; }
    catch(e){ const t = AdjuntosEngine.interpretarErrorDeLaBase(e); r = {ok:false, code:e.code, mensaje:t.mensaje, reintentable:t.reintentable}; }
    window.__DB__.lleno = false;
    return r;
  }, tripId);
  ok(!llena.ok && llena.code === "quota_exceeded", `la base llena rechaza con quota_exceeded (${llena.code})`);
  ok(!!llena.mensaje, "con un mensaje propio: " + JSON.stringify(llena.mensaje));

  console.log("\n· D4 — el cuerpo no se puede traer");
  const d4 = await page.evaluate(async tripId => {
    window.__DB__.fallarLectura = true;
    let r;
    try { const c = await Store.loadDocBody(tripId, "d-justo"); r = {ok:true, vino:!!c}; }
    catch(e){ r = {ok:false, code:e.code}; }
    window.__DB__.fallarLectura = false;
    return r;
  }, tripId);
  ok(!d4.ok, "un fallo de red al traer el archivo se PROPAGA, no se traga en silencio");
  info("así el visor puede mostrar D4 y ofrecer reintentar · código: " + d4.code);

  console.log("\n· el borrado en cascada — lo que deja huérfanos si falla");
  const cascada = await page.evaluate(async tripId => {
    const itemId = "it-cascada";
    const docId  = "doc-cascada";
    await Store.saveDocBody(tripId, {id:docId, b64:"AAAA", mime:"application/pdf"});
    await Store.saveItem(tripId, {id:itemId, type:"flight", title:"Vuelo con adjunto",
      docs:[{id:docId, mime:"application/pdf", bytes:3, nombreCorto:"Pasaje"}]});
    await new Promise(r=>setTimeout(r,300));
    const ruta = AdjuntosEngine.rutaDelCuerpo(tripId, docId);
    const antes = window.__DB__.store.has(ruta);
    await Store.delItem(tripId, itemId);
    await new Promise(r=>setTimeout(r,400));
    return { antes, despues: window.__DB__.store.has(ruta), borrados: window.__DB__.borrados.slice(-3) };
  }, tripId);
  ok(cascada.antes === true, "el cuerpo estaba escrito en la base");
  ok(cascada.despues === false, "y BORRAR LA RESERVA borra también su cuerpo: no queda ocupando cupo para siempre");
  info("rutas borradas: " + JSON.stringify(cascada.borrados));

  const cascadaViaje = await page.evaluate(async tripId => {
    const docId = "doc-viaje";
    await Store.saveDocBody(tripId, {id:docId, b64:"AAAA", mime:"application/pdf"});
    await Store.saveItem(tripId, {id:"it-viaje", type:"stay", title:"Hotel",
      docs:[{id:docId, mime:"application/pdf", bytes:3, nombreCorto:"Comprobante"}]});
    await new Promise(r=>setTimeout(r,300));
    const ruta = AdjuntosEngine.rutaDelCuerpo(tripId, docId);
    const antes = window.__DB__.store.has(ruta);
    await Store.delTrip(tripId);
    await new Promise(r=>setTimeout(r,600));
    return { antes, despues: window.__DB__.store.has(ruta) };
  }, tripId);
  ok(cascadaViaje.antes === true, "otro cuerpo, en otra reserva");
  ok(cascadaViaje.despues === false, "y BORRAR EL VIAJE ENTERO también los borra");

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — contra la base compartida");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
