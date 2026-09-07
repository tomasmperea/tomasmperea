/* Base de datos simulada, FIEL AL CONTRATO de la plataforma.
 *
 * Existe por un bug que costó dos iteraciones encontrar: el contrato define el
 * cuerpo de un documento como `data()`, un MÉTODO. La app lo leía como
 * propiedad (`d.data`), y esparcir una función devuelve un objeto vacío, así
 * que cada documento llegaba de la nube sin un solo campo. La app se veía
 * vacía y parecía que no guardaba nada.
 *
 * El primer simulador que escribimos copiaba esa misma suposición equivocada,
 * con `data` como propiedad, así que las pruebas pasaban y el bug seguía vivo.
 * Un simulador que replica lo que uno cree en vez del contrato no prueba nada.
 *
 * Reglas de este archivo:
 *   - data() es un método y devuelve undefined si el documento no existe.
 *   - exists es una propiedad.
 *   - Toda entrega de snapshot es asincrónica, como en la vida real.
 *
 * Ante cualquier duda manda el contrato de la plataforma, no este archivo.
 * Para usarlo: cargalo con un <script> ANTES de la app y define window.claude.
 */
(function(){
  const store = {
    "trips/viaje-previo": {name:"Vacaciones con Clari", destination:"Brasil",
      startDate:"2027-04-10", endDate:"2027-04-20", travelers:"Clarita y Tomi",
      notes:"Cabo Frio y Arraial do Cabo", hue:200,
      createdAt:"2026-09-05T17:00:00.000Z", updatedAt:"2026-09-05T17:00:00.000Z"},
    "trips/viaje-previo/items/vuelo1": {type:"flight", title:"Buenos Aires → Río",
      from:"EZE", to:"GIG", start:"2027-04-10T08:00", provider:"GOL",
      confirmation:"AB12CD", createdAt:"x", updatedAt:"x"}
  };
  const colSubs=[]; const docSubs=[]; const LAT=250;
  const snapDoc = (path,id) => ({
    id, exists: !!store[path],
    data(){ return store[path] ? JSON.parse(JSON.stringify(store[path])) : undefined; },
    metadata:{hasPendingWrites:false}
  });
  function emitCol(){
    colSubs.forEach(s=>{
      const docs = Object.keys(store)
        .filter(p => p.startsWith(s.path+"/") && p.slice(s.path.length+1).indexOf("/")===-1)
        .map(p => snapDoc(p, p.slice(s.path.length+1)));
      setTimeout(()=> s.cb({docs, size:docs.length, empty:!docs.length,
                            docChanges:()=>[], metadata:{}}), LAT);
    });
  }
  function emitDoc(){
    docSubs.forEach(s=> setTimeout(()=> s.cb(snapDoc(s.path, s.path.split("/").pop())), LAT));
  }
  const docRef = path => ({
    id:path.split("/").pop(), path,
    get:()=> new Promise(r=> setTimeout(()=> r(snapDoc(path, path.split("/").pop())), LAT)),
    set:(d)=> new Promise(r=> setTimeout(()=>{ store[path]=JSON.parse(JSON.stringify(d)); emitCol(); emitDoc(); r(); }, LAT)),
    update:(d)=> new Promise(r=> setTimeout(()=>{ store[path]=Object.assign({},store[path],d); emitCol(); emitDoc(); r(); }, LAT)),
    delete:()=> new Promise(r=> setTimeout(()=>{ delete store[path]; emitCol(); emitDoc(); r(); }, LAT)),
    onSnapshot:(cb)=>{ const s={path,cb}; docSubs.push(s); emitDoc(); return ()=>{ const i=docSubs.indexOf(s); if(i>=0)docSubs.splice(i,1); }; },
    collection:(p)=> colRef(path+"/"+p)
  });
  const colRef = path => ({
    path,
    doc:(id)=> docRef(path+"/"+(id||("x"+Math.random().toString(36).slice(2)))),
    get:()=> new Promise(r=> setTimeout(()=> r({docs:Object.keys(store)
        .filter(p=>p.startsWith(path+"/") && p.slice(path.length+1).indexOf("/")===-1)
        .map(p=>snapDoc(p,p.slice(path.length+1)))}), LAT)),
    onSnapshot:(cb)=>{ const s={path,cb}; colSubs.push(s); emitCol(); return ()=>{ const i=colSubs.indexOf(s); if(i>=0)colSubs.splice(i,1); }; },
    where:()=>colRef(path), orderBy:()=>colRef(path), limit:()=>colRef(path)
  });
  window.claude = { use:(n)=> Promise.resolve(n==="db" ? {doc:docRef, collection:colRef} : null) };
  window.__store = store;
})();
