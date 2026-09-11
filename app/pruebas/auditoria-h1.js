/* AUDITORÍA — reproducción independiente del escenario H1 de docs/qa/valija-bloque-b.md
   Pasos textuales del reporte: Ciudad -> auto -> cambiar a Playa -> aplicar el plan viejo.
   Todo por gesto (click sobre el control real). */
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'valija.html');
const TRIP = { id:'t1', name:'Vacaciones', destination:'Madrid', startDate:'2026-10-05', endDate:'2026-10-15', hue:214 };
const VUELO = { id:'i1', type:'flight', title:'Vuelo a Madrid', start:'2026-10-05T22:00', end:'2026-10-06T14:00', from:'EZE', to:'MAD' };
const L=[]; const log=m=>{L.push(m);console.log(m);};
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:390,height:800} });
  page.on('pageerror', e=>log('  !! pageerror: '+e.message));
  await page.addInitScript(({trip,vuelo})=>{
    window.claude = { use: async k => null };   // sin capa de IA: peor caso honesto
    try{ localStorage.setItem('valija.v1', JSON.stringify({trips:[trip], items:{t1:[vuelo]}, packing:{}})); }catch(e){}
  }, {trip:TRIP, vuelo:VUELO});
  await page.goto(APP);
  await page.waitForFunction(()=>typeof Store!=='undefined' && Store.ready, null, {timeout:15000});

  const claves = ()=>page.evaluate(()=>Object.keys(Store.packingOf('t1').items).sort());
  const tipo   = ()=>page.evaluate(()=>Store.packingOf('t1').tipoViaje);
  const ir     = async h=>{ await page.goto(APP+h); await page.waitForTimeout(300); };

  // PASO 1 · viaje + valija tipo Ciudad, tocando "Armar la lista"
  await ir('#/trip/t1/valija');
  await page.locator('#pk-tp [data-t="ciudad"]').click();
  await page.locator('#pk-build').click();
  await page.waitForTimeout(1200);
  const ciudad = await claves();
  log('PASO 1 · tipo='+await tipo()+'  items='+ciudad.length);

  // PASO 2 · agregar el auto por el formulario real
  await ir('#/trip/t1');
  await page.locator('#additem').click(); await page.waitForTimeout(200);
  await page.locator('#tp button[data-t="car"]').click();
  await page.fill('#i_title','Auto en Madrid');
  await page.fill('#i_start','2026-10-07T10:00');
  await page.fill('#i_end','2026-10-12T10:00');
  await page.fill('#i_provider','Europcar');
  await page.locator('#save').click(); await page.waitForTimeout(1400);

  // PASO 3 · entrar a la valija: el aviso tiene que estar, SIN tocarlo
  await ir('#/trip/t1/valija');
  await page.waitForTimeout(900);
  const aviso1 = await page.locator('#main [data-pk="verplan"]').count();
  log('PASO 3 · aviso "Ver qué agrego" presente = '+(aviso1===1));
  await page.evaluate(()=>{ window.__VIEJO__ = App.plan; });
  const planViejo = await page.evaluate(()=> window.__VIEJO__ ? Object.keys(window.__VIEJO__.listaPropuesta.items).length : null);
  log('PASO 3 · el plan en memoria propone una lista de '+planViejo+' ítems');

  // PASO 4 · cambiar el tipo a Playa, con gestos
  await page.locator('#pk-info').click(); await page.waitForTimeout(300);
  await page.locator('#pk-changetype').click(); await page.waitForTimeout(400);
  await page.locator('#pk-tp [data-t="playa"]').click();
  await page.locator('#pk-confirmtype').click();
  await page.waitForTimeout(1800);
  const playa = await claves();
  log('PASO 4 · tipo='+await tipo()+'  items='+playa.length+'  nuevos de playa: '+playa.filter(k=>!ciudad.includes(k)).join(', '));
  const header = await page.locator('#main').innerText().catch(()=> '');
  log('PASO 4 · el encabezado dice Playa = '+/Playa/i.test(header));

  // PASO 5 · ¿sigue el aviso viejo? ¿se puede aplicar por gesto?
  const aviso2 = await page.locator('#main [data-pk="verplan"]').count();
  log('PASO 5 · el aviso viejo sigue ofrecido por gesto = '+(aviso2>0));
  if(aviso2>0){
    await page.locator('#main [data-pk="verplan"]').click(); await page.waitForTimeout(500);
    const apply = await page.locator('#pk-plan-apply').count();
    log('PASO 5 · botón "Sumar N" en la hoja = '+apply);
    if(apply){ await page.locator('#pk-plan-apply').click(); await page.waitForTimeout(2200); }
    else { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }

  // PASO 6 · el peor caso: aplicar a mano la MISMA foto vieja
  await page.evaluate(()=>{ if(window.__VIEJO__) aplicarPlan(Store.trips.get('t1'), window.__VIEJO__); });
  await page.waitForTimeout(2500);
  const fin = await claves();
  const perdidos = playa.filter(k=>!fin.includes(k));
  const toast = await page.locator('#toast .toast').innerText().catch(()=> '');
  log('PASO 6 · tipo final = '+await tipo());
  log('PASO 6 · items final = '+fin.length);
  log('PASO 6 · ítems de Playa perdidos = '+(perdidos.length?perdidos.join(', '):'ninguno'));
  log('PASO 6 · lo del auto sigue = '+fin.includes('licencia-de-conducir'));
  log('PASO 6 · mensaje visible = '+JSON.stringify(toast));
  log('');
  log('VEREDICTO H1: '+((await tipo())==='playa' && perdidos.length===0 && !/Sumé/.test(toast) ? 'NO pisa la lista — corregido' : 'SIGUE PISANDO'));
  await browser.close();
})().catch(e=>{console.error('CAYÓ:',e);process.exit(1);});
