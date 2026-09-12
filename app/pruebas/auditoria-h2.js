/* AUDITORÍA — reproducción independiente del escenario H2 de docs/qa/valija-bloque-b.md */
const { chromium } = require('playwright');
const path=require('path');
const APP='file://'+path.resolve(__dirname, '..', 'valija.html');
const TRIP={id:'t1',name:'Vacaciones',destination:'Madrid',startDate:'2026-10-05',endDate:'2026-10-15',hue:214};
const VUELO={id:'i1',type:'flight',title:'Vuelo a Madrid',start:'2026-10-05T22:00',end:'2026-10-06T14:00',from:'EZE',to:'MAD'};
const log=console.log;
(async()=>{
  const b=await chromium.launch();
  const page=await b.newPage({viewport:{width:390,height:800}});
  /* Este entorno bloquea los hosts externos (fuentes, jspdf, pdf.js): sin
     cortarlos, cada carga espera un handshake que nunca llega y la corrida se
     cae a mitad de camino como si fuera un fallo del producto. Mismo corte que
     hacen los demás arneses de app/pruebas/. */
  await page.route('**/*', r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on('pageerror',e=>log('  !! pageerror: '+e.message));
  await page.addInitScript(({trip,vuelo})=>{
    window.claude={use:async k=>null};
    try{localStorage.setItem('valija.v1',JSON.stringify({trips:[trip],items:{t1:[vuelo]},packing:{}}));}catch(e){}
  },{trip:TRIP,vuelo:VUELO});
  await page.goto(APP);
  await page.waitForFunction(()=>typeof Store!=='undefined'&&Store.ready,null,{timeout:15000});
  const ir=async h=>{await page.goto(APP+h);await page.waitForTimeout(300);};

  // 1 · lista Ciudad
  await ir('#/trip/t1/valija');
  await page.locator('#pk-tp [data-t="ciudad"]').click();
  await page.locator('#pk-build').click(); await page.waitForTimeout(1200);

  // 2 · plegar "Documentación" A MANO, tocando el encabezado
  const hd = page.locator('.pk-cat-hd', {hasText:'Documentación'}).first();
  await hd.click(); await page.waitForTimeout(300);
  const abierta1 = await page.locator('.pk-cat', {has: page.locator('.pk-cat-hd', {hasText:'Documentación'})}).first().getAttribute('data-open');
  log('PASO 2 · Documentación data-open tras plegar a mano = '+abierta1);

  // 3 · agregar el auto (2 ítems nuevos caen en Documentación)
  await ir('#/trip/t1');
  await page.locator('#additem').click(); await page.waitForTimeout(200);
  await page.locator('#tp button[data-t="car"]').click();
  await page.fill('#i_title','Auto en Madrid');
  await page.fill('#i_start','2026-10-07T10:00'); await page.fill('#i_end','2026-10-12T10:00');
  await page.fill('#i_provider','Europcar');
  await page.locator('#save').click(); await page.waitForTimeout(1400);

  // 4 · entrar, "Ver qué agrego" -> "Sumar 2"
  await ir('#/trip/t1/valija'); await page.waitForTimeout(900);
  await page.locator('#main [data-pk="verplan"]').click(); await page.waitForTimeout(500);
  await page.locator('#pk-plan-apply').click(); await page.waitForTimeout(2200);

  const cat = page.locator('.pk-cat', {has: page.locator('.pk-cat-hd', {hasText:'Documentación'})}).first();
  log('PASO 5 · sigue plegada = '+(await cat.getAttribute('data-open')));
  const hdTxt = await cat.locator('.pk-cat-hd').innerText();
  log('PASO 5 · encabezado visible = '+JSON.stringify(hdTxt.replace(/\n/g,' | ')));
  log('PASO 5 · data-newclaves = '+JSON.stringify(await cat.locator('.pk-cat-hd').getAttribute('data-newclaves')));
  const nuevos = await page.evaluate(()=>PackingEngine.itemList(Store.packingOf('t1'),{includeDismissed:true}).filter(i=>i.nuevo).map(i=>i.clave));
  log('PASO 5 · ítems con nuevo:true = '+nuevos.join(', '));

  // cerrar el aviso de confirmación sin usar "Listo, ya las vi"
  await page.evaluate(()=>{ const x=document.querySelector('#main .notice .x, #main [data-pk="cerraraviso"]'); if(x) x.click(); });
  await page.waitForTimeout(300);

  // dejar el chip a la vista el tiempo de permanencia y salir tocando "volver"
  await page.locator('.pk-cat-hd', {hasText:'Documentación'}).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  /* El estado de la categoría se lee ANTES de salir: después de tocar
     "volver" la pantalla de la valija ya no está en el DOM y el locator se
     queda esperando para siempre un nodo que nadie va a volver a dibujar.
     (Este arnés caía acá desde antes, por eso nunca imprimía su veredicto.) */
  const sigueplegada = await cat.getAttribute('data-open');
  await page.locator('#pk-back').click(); await page.waitForTimeout(900);
  const quedan = await page.evaluate(()=>PackingEngine.itemList(Store.packingOf('t1'),{includeDismissed:true}).filter(i=>i.nuevo).map(i=>i.clave));
  log('SALIDA · ítems que siguen marcados nuevo = '+(quedan.length?quedan.join(', '):'ninguno'));
  log('');
  log('VEREDICTO H2: categoría plegada a mano NO se reabre ('+sigueplegada+') y el chip visible limpió la marca = '+(quedan.length===0));
  await b.close();
})().catch(e=>{console.error('CAYÓ:',e);process.exit(1);});
