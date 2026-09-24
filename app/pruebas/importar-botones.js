const { chromium } = require("playwright");
const path = require("path");
/* La ruta por defecto, que hasta el 24/09 este arnés no tenía y los otros 32 sí.
   Sin ella, correrlo sin argumento navegaba a `file://undefined/` y moría con un
   error de node en vez de con una aserción roja. Al correr la suite entera daba
   UN ROJO que no era del producto, y perseguirlo cuesta lo mismo que perseguir
   uno de verdad — sólo que éste siempre termina en nada. */
const F = process.argv[2] ? path.resolve(process.argv[2])
                          : path.resolve(__dirname, "..", "valija.html");
const BLOQUEAR = process.argv[3] === "bloquear";
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await (await b.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true })).newPage();
  /* Se corta la red externa: este entorno bloquea cdnjs y las fuentes, y sin
     esto cada carga espera un handshake que no llega. Además deja explícito
     que acá pdf.js NO está, que es el caso de VAL-50 (ver importar-arranque.js). */
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  let fallos = 0; const ok = (c,m)=>{ console.log((c?"  ok   ":"  FALLA")+"  "+m); if(!c) fallos++; };
  p.on("pageerror", e => { console.log(">> PAGEERROR:", e.message); fallos++; });
  await p.addInitScript(() => {
    window.claude = { use: async n => n === "sample" ? { json: async()=>({reservas:[]}) } : null };
  });
  if (BLOQUEAR) await p.addInitScript(() => {
    // simula el teléfono roto: el navegador ignora el click() sobre el campo
    document.addEventListener("DOMContentLoaded", ()=>{
      const orig = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function(){ if(this.type==="file") return; return orig.apply(this, arguments); };
    });
  });
  await p.goto("file://" + F);
  await p.waitForTimeout(1200);
  await p.click("#newtrip"); await p.waitForTimeout(300);
  await p.fill("#t_name","Prueba"); await p.fill("#t_dest","Madrid");
  await p.fill("#t_from","2026-11-10"); await p.fill("#t_to","2026-11-20");
  await p.click("#save"); await p.waitForTimeout(600);
  const c = await p.$(".tag-card"); if(c){ await c.click(); await p.waitForTimeout(600); }
  await p.click("#imp"); await p.waitForTimeout(1000);
  ok(!!(await p.$('[data-pick="im_cam"]')), "la hoja de importar muestra los tres botones");

  for (const [id, lbl] of [["im_cam","Sacar foto"],["im_gal","Galería"],["im_doc","Archivo"]]) {
    let abrio = false;
    p.once("filechooser", ()=>{ abrio = true; });
    const box = await p.$eval(`[data-pick="${id}"]`, e => { const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}; });
    const encima = await p.evaluate(({x,y}) => { const el=document.elementFromPoint(x,y); return el ? (el.dataset && el.dataset.pick) || el.id || el.tagName : "NADA"; }, box);
    ok(encima === id || encima === "BUTTON" || encima === "SVG" || encima === "SPAN", `${lbl}: el toque cae sobre el botón (${encima}), no sobre un campo invisible`);
    ok(box.w > 44 && box.h > 44, `${lbl}: objetivo de ${Math.round(box.w)}x${Math.round(box.h)} px`);
    await p.touchscreen.tap(box.x, box.y);
    await p.waitForTimeout(400);
    if (BLOQUEAR) ok(!abrio, `${lbl}: (simulación) el selector no abre, como en el teléfono`);
    else ok(abrio, `${lbl}: TOCANDO EL BOTÓN se abre el selector de archivos`);
  }
  if (BLOQUEAR) {
    await p.waitForTimeout(1800);
    const vis = await p.$eval("#im-nopick", e => !e.hidden && e.textContent.trim().slice(0,60));
    ok(!!vis, "cuando el selector no abre, la app lo dice en vez de quedarse muda: " + JSON.stringify(vis));
    ok(await p.$eval(".imp-more", e => e.open), "y abre sola la vía de pegar el texto");
  } else {
    /* QUÉ SE PUEDE PROBAR ACÁ Y QUÉ NO — y por qué esta prueba está escrita así.

       El aviso de selector mudo se dispara a los 1500 ms si el foco nunca se
       fue y no llegó ningún archivo. Bajo Playwright el selector no es un
       diálogo del sistema, así que `blur` y `visibilitychange` NO se disparan
       nunca. Entonces "no aparece el aviso cuando el selector abre" mide la
       herramienta y no la app, y encima se aseveraba sin esperar los 1500 ms,
       o sea sin haber tenido nunca oportunidad de fallar.

       Lo que sí distingue un build bueno de uno roto es este caso, que además
       es el del teléfono: el archivo LLEGA, y el temporizador corre igual
       después. Con la guarda vieja —`!(input.files && input.files.length)`—
       el aviso aparecía encima de la pantalla que ya estaba leyendo el
       documento, porque `onchange` limpia `input.value` y eso vacía
       `input.files` antes de que el temporizador lo mire. Comprobado
       corriendo los dos builds: con la guarda vieja el aviso aparece a los
       2200 ms; con la guarda arreglada, no. */
    /* Pantalla limpia: los tres toques del bucle de arriba dejaron cada uno su
       temporizador corriendo y su aviso pintado. Sin recargar, lo que se
       mediría es ese aviso viejo y no el de este archivo. */
    await p.reload();
    await p.waitForTimeout(1200);
    const c2 = await p.$(".tag-card"); if(c2){ await c2.click(); await p.waitForTimeout(600); }
    await p.click("#imp"); await p.waitForTimeout(1000);
    ok(await p.evaluate(()=>{ const c=document.getElementById("im-nopick"); return !c || c.hidden; }),
       "la pantalla arranca sin ningún aviso, para que lo que se mida sea este archivo");

    p.once("filechooser", fc => fc.setFiles({
      name: "confirmacion.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 texto\n")
    }));
    await p.$eval('[data-pick="im_doc"]', e => e.click());
    await p.waitForTimeout(2200);          // pasado el temporizador de 1500 ms
    const miente = await p.evaluate(() => {
      const c = document.getElementById("im-nopick");
      return !!c && !c.hidden && /No se abri/.test(c.textContent || "");
    });
    ok(!miente, "un archivo que SÍ llegó no dispara el aviso de selector mudo 1500 ms después");
  }
  console.log(fallos ? `\n${fallos} FALLARON` : "\nTodo en verde");
  await b.close();
  process.exit(fallos ? 1 : 0);
})();
