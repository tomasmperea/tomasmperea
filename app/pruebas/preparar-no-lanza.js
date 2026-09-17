/* ============================================================
   PREPARAR UN ADJUNTO NUNCA LANZA — y la rama que se creía viva

   De dónde sale: la auditoría del 17/09 marcó como código muerto la rama
   `"no-se-pudo-leer"` de `prepararDocumento`. Contesté por escrito que sí
   se alcanzaba, "porque `normalizarBytes` puede lanzar sobre un valor
   inyectado por `opts.leerBytes`". Era falso y la auditoría siguiente lo
   agarró: esa rama tiene su propio manejador de rechazo. Había inventado
   una justificación en vez de comprobarla.

   Este arnés existe para que eso no se pueda volver a afirmar sin datos:
   intenta llegar a la rama por los cinco caminos que se me ocurrieron y
   deja escrito qué devuelve cada uno.

   Y de esos cinco intentos salió un defecto de verdad, que era el motivo
   para escribirlos: DOS se escapan SINCRÓNICAMENTE de `prepararDocumento`.
   `normalizarBytes` corre fuera de toda promesa, así que un `file.bytes`
   hostil —uno cuyo `length` lanza— sale disparado antes de que exista la
   promesa a la que `prepararAdjunto` engancha su `.catch`.

   Eso deja la app MUDA, que es el modo de falla que este proyecto ya pagó
   tres veces: `elegirAdjunto` pone `DOC.preparando` antes de llamar y lo
   limpia después; si el medio se va por un throw, el cartel de "preparando"
   queda para siempre y "Guardar" contesta "esperá a que termine" sin que
   nunca termine.

   El escenario 6 es el que importa: toca el gesto real —la hoja de la
   reserva, el botón de archivo— y exige que la app diga algo. Es el que
   falla si se revierte el arreglo de `prepararAdjunto`.

       node app/pruebas/preparar-no-lanza.js [ruta/absoluta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await page.addInitScript(() => { window.claude = { use: async () => null }; });
  const errores = [];
  page.on("pageerror", e => errores.push(e.message));
  await page.goto("file://" + APP);
  await page.waitForTimeout(1200);

  /* ---------- parte A: ¿es alcanzable la rama del motor? ---------- */
  console.log("\n· los cinco intentos de llegar a la rama \"no-se-pudo-leer\"");
  const intentos = await page.evaluate(async () => {
    const base = { name:"x.pdf", type:"application/pdf", size:100,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1,2,3]).buffer) };
    base.slice = () => base;
    const casos = [
      ["opts.leerBytes que RECHAZA",          {}, { leerBytes: () => Promise.reject(new Error("boom")) }],
      ["opts.leerBytes que devuelve basura",  {}, { leerBytes: () => "no soy bytes" }],
      ["opts.leerBytes que LANZA sincrónico", {}, { leerBytes: () => { throw new Error("sync"); } }],
      ["file.bytes con un valor raro",        { bytes: "no soy bytes" }, {}],
      ["file.bytes con un objeto hostil",     { bytes: { get length(){ throw new Error("hostil"); } } }, {}],
    ];
    const salida = [];
    for (const [nombre, extra, opts] of casos) {
      const f = Object.assign({}, base, extra);
      let codigo = null, sincronico = null;
      try {
        const r = await AdjuntosEngine.prepararDocumento(f, Object.assign({espacioUsado:0, cantidadActual:0}, opts));
        codigo = r && r.error && r.error.codigo;
      } catch (e) { sincronico = (e && e.name) + ": " + (e && e.message); }
      salida.push({ nombre, codigo, sincronico });
    }
    return salida;
  });

  intentos.forEach(i => info(
    i.nombre.padEnd(38) + (i.sincronico ? "LANZÓ AFUERA — " + i.sincronico : "codigo=" + i.codigo)));

  const llegaron = intentos.filter(i => i.codigo === "no-se-pudo-leer");
  ok(llegaron.length === 0,
     `ninguno de los cinco alcanza la rama, así que sigue siendo una red y no un camino vivo (${llegaron.length} llegaron)`);
  const sincronicos = intentos.filter(i => i.sincronico);
  ok(sincronicos.length > 0,
     `y ${sincronicos.length} de los cinco se escapan SINCRÓNICAMENTE del motor: por eso prepararAdjunto no puede confiar en un .catch pelado`);

  /* ---------- parte B: prepararAdjunto los absorbe ---------- */
  console.log("\n· prepararAdjunto nunca lanza, ni sincrónico");
  const absorbidos = await page.evaluate(async () => {
    const hostil = { name:"x.pdf", type:"application/pdf", size:100,
      bytes: { get length(){ throw new Error("hostil"); } } };
    hostil.slice = () => hostil;
    let lanzo = null, r = null;
    try { r = await prepararAdjunto(hostil, {origen:"manual", docsActuales:[], itemId:"i1"}); }
    catch (e) { lanzo = (e && e.name) + ": " + (e && e.message); }
    return { lanzo, ok: r && r.ok, codigo: r && r.error && r.error.codigo, mensaje: r && r.error && r.error.mensaje };
  });
  info("devolvió: " + JSON.stringify(absorbidos));
  ok(!absorbidos.lanzo, "no lanzó: el throw sincrónico quedó adentro de la cadena");
  ok(absorbidos.ok === false && !!absorbidos.codigo, `volvió como resultado fallido (${absorbidos.codigo})`);
  ok(!!absorbidos.mensaje && !/vacío|escaneo/i.test(absorbidos.mensaje),
     "con un mensaje que no inventa una causa: " + JSON.stringify(absorbidos.mensaje));

  /* ---------- parte C: EL GESTO. Esto es lo que toca la persona ----------
     Las partes A y B llaman funciones. Esta toca el botón, que es la regla
     del proyecto: si la app se queda muda, se ve acá y no allá. */
  console.log("\n· el gesto: la hoja de la reserva no queda colgada en \"preparando\"");
  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Prueba"); await page.fill("#t_dest","Madrid");
  await page.fill("#t_from","2026-11-10"); await page.fill("#t_to","2026-11-20");
  await page.click("#save"); await page.waitForTimeout(800);
  const card = await page.$(".tag-card"); if (card) { await card.click(); await page.waitForTimeout(600); }
  await page.click("#additem"); await page.waitForTimeout(700);
  await page.fill("#i_title","Vuelo a Madrid");

  /* El sabotaje: el campo entrega un archivo cuyo `bytes.length` lanza. Se
     parchea el navegador, no la app. Si este defineProperty no llega, el
     escenario no prueba nada — por eso abajo se verifica que llegó. */
  await page.evaluate(() => {
    window.__SABOTEADOS__ = 0;
    /* Se cuenta acá, con la hoja abierta y ANTES de tocar el botón. La
       primera versión contaba después de guardar, cuando la hoja ya estaba
       cerrada y no quedaba gesto que contar: daba cero y el caso fallaba por
       su propia premisa, no por la app. Es el mismo error de método que este
       arnés existe para no repetir. */
    window.__PORPREPARAR__ = 0;
    const origPA = window.prepararAdjunto;
    window.prepararAdjunto = function(){ window.__PORPREPARAR__++; return origPA.apply(this, arguments); };
    const inp = document.getElementById("doc_file");
    const hostil = { name:"del-mail.pdf", type:"application/pdf", size:100,
      bytes: { get length(){ throw new Error("hostil"); } } };
    hostil.slice = () => hostil;
    hostil.arrayBuffer = () => Promise.resolve(new ArrayBuffer(0));
    Object.setPrototypeOf(hostil, File.prototype);
    Object.defineProperty(inp, "files", {
      configurable: true,
      get(){ window.__SABOTEADOS__++; const l = [hostil]; l.item = i => l[i]; return l; }
    });
  });
  await page.$eval('[data-pick="doc_file"]', e => e.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.getElementById("doc_file").dispatchEvent(new Event("change", {bubbles:true}));
  });
  await page.waitForTimeout(2500);

  const saboteados = await page.evaluate(() => window.__SABOTEADOS__);
  ok(saboteados > 0, `el sabotaje se aplicó: el campo entregó ${saboteados} vez/veces un archivo hostil`);

  const pantalla = await page.evaluate(() => {
    const b = document.getElementById("doc-block");
    return b ? b.innerText.replace(/\n+/g, " / ") : "(sin bloque de documento)";
  });
  info("bloque del documento: " + JSON.stringify(pantalla.slice(0, 180)));
  ok(!/[Pp]reparando/.test(pantalla),
     "no quedó colgado en \"preparando\": la app contestó algo");
  ok(/no pude leer|no entra|no se pudo/i.test(pantalla),
     "y lo que contestó es que no pudo leerlo");

  /* Que "Guardar" siga usable es la mitad que se le nota al usuario, y es
     PEOR de lo que se creía: con la hoja colgada en `preparando` el botón
     queda `disabled`, no es que conteste "esperá a que termine". O sea: la
     reserva entera queda secuestrada por un documento que nunca va a llegar,
     sin nada que tocar para salir salvo cancelar y perder lo escrito.

     Se mira el estado del botón ANTES de tocarlo: si está deshabilitado,
     `page.click` se cuelga treinta segundos y el arnés muere por timeout en
     vez de reportar. Un control negativo tiene que fallar prolijo. */
  const botonSave = await page.evaluate(() => {
    const b = document.getElementById("save");
    return b ? { existe: true, deshabilitado: !!b.disabled } : { existe: false };
  });
  info("botón Guardar: " + JSON.stringify(botonSave));
  ok(botonSave.existe && !botonSave.deshabilitado,
     "\"Guardar\" quedó usable: la reserva no está secuestrada por el documento que falló");

  let toast = "";
  if (botonSave.existe && !botonSave.deshabilitado) {
    await page.click("#save"); await page.waitForTimeout(1200);
    toast = await page.evaluate(() => {
      const t = document.querySelector(".toast, #toast");
      return t ? t.innerText : "";
    });
  } else {
    info("no se toca Guardar porque está deshabilitado — eso ya es la falla");
  }
  const guardo = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if (!raw) return null;
    const d = JSON.parse(raw); const its = Object.values(d.items||{})[0] || [];
    return its.map(i => i.title);
  });
  info("toast: " + JSON.stringify(toast) + " · guardado: " + JSON.stringify(guardo));
  ok(!/[Ee]sperá a que termine/.test(toast),
     "\"Guardar\" no contesta \"esperá a que termine\" para siempre");
  ok(!!guardo && guardo.includes("Vuelo a Madrid"),
     "y la reserva se guardó igual, sin el documento que no se pudo leer");

  /* ---------- parte D: TODOS los gestos, no sólo el que probé ----------

     La auditoría marcó dos rondas seguidas que `doc_repl` —reemplazar un
     documento ya adjunto— comparte este código y no tenía escenario propio.
     Agregar un escenario más lo cubriría a él y dejaría al siguiente gesto
     afuera otra vez.

     Así que en vez de un escenario, la propiedad: que NADIE llame al motor
     sin pasar por `prepararAdjunto`, que es la única función blindada contra
     el throw sincrónico. Eso cubre `doc_file`, `doc_repl`, `im_doc` y
     cualquier gesto que alguien agregue mañana, que es justo lo que un
     escenario por gesto no puede hacer.

     `reemplazar` importa por lo mismo que `elegirAdjunto`: pone
     `st.preparando = true` antes de llamar, así que un throw en el medio deja
     colgada la hoja del visor igual que la de la reserva. */
  console.log("\n· ningún gesto llega al motor sin pasar por la función blindada");
  const fuente = require("fs").readFileSync(APP, "utf8");
  const llamadas = (fuente.match(/AdjuntosEngine\.prepararDocumento\s*\(/g) || []).length;
  info(`llamadas a AdjuntosEngine.prepararDocumento en la app: ${llamadas}`);
  ok(llamadas === 1,
     `hay exactamente UNA, la de prepararAdjunto (${llamadas}): si aparece otra, este caso falla y hay que blindarla también`);

  const blindada = /function prepararAdjunto\(file, opts\)\{\s*return Promise\.resolve\(\)\.then\(/.test(fuente);
  ok(blindada, "y esa única llamada está dentro de la cadena de promesas, no suelta");

  /* Las dos aserciones de arriba leen el código. Esta cuenta lo que pasó de
     verdad cuando la parte C tocó el botón: el contador se instaló antes del
     gesto, con la hoja abierta. */
  const porAhi = await page.evaluate(() => window.__PORPREPARAR__);
  ok(porAhi > 0,
     `y el gesto de la parte C pasó por prepararAdjunto (${porAhi} llamada/s), no por el motor directo`);

  if (errores.length) { console.log("  >> PAGEERROR:", errores.join(" | ")); }

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — preparar un adjunto nunca deja la app muda");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
