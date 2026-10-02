/* ============================================================
   AEROPUERTOS — el motor. VAL-87.
   JavaScript puro, sin DOM. Recibe el dato, devuelve dos cosas:

   · buscar(texto)  → lo que escribe un viajero ("bari", "ezeiza",
     "suecia", "córdoba") → aeropuertos, el más probable primero.
   · porCodigo(cod) → el sentido inverso: "BRC" → Bariloche. Devuelve
     null si el código no está en el dato, y quien llama tiene que
     manejar ese null (un código fuera del dato sigue siendo un código).

   Cómo ordena, de más fuerte a más débil:
     1000  el texto ES el código ("arn" → ARN)
      500  cada palabra escrita es el comienzo de una palabra de la ciudad
      300  ídem, contando también el nombre del aeropuerto, su apodo y
           sus palabras clave ("Manhattan, New York City" en Newark)
      100  cada palabra es el comienzo de una palabra del país
       50  mezcla de los tres (sólo con palabras de 3 letras o más)
   Empate: el que tiene más rutas, que es el orden del dato.
   Sin tildes ni mayúsculas: "cordoba" y "Córdoba" son lo mismo.
   ============================================================ */
function crearMotorAeropuertos(dato, paises, ciudadEs, apodos) {
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  /* Cómo se nombra el aeropuerto en la segunda línea: su nombre OFICIAL,
     sin la ciudad adelante ("London Heathrow" → "Heathrow"), y nada si el
     nombre ES la ciudad: repetirla no dice nada.
     El apodo NO se muestra, sólo se busca. Decisión del PM (02/10): "buenos
     aires" tiene que devolver Ministro Pistarini y Jorge Newbery, que es
     como se llaman; "ezeiza" los sigue encontrando por el apodo. */
  function etiqueta(nombre, apodo, ciudadDato, ciudad) {
    var n = nombre, c = ciudadDato;
    if (n.toLowerCase().indexOf(c.toLowerCase()) === 0) n = n.slice(c.length);
    n = n.replace(/^[\s\-–,/]+/, "").trim();
    if (!n || norm(n) === norm(ciudad) || norm(n) === norm(ciudadDato)) return "";
    return n;
  }
  var lista = String(dato || "").split("\n").filter(Boolean).map(function (l, i) {
    var p = l.split("|"), code = p[0], ciudadDato = p[1], cc = p[2], nombre = p[3] || "", claves = p[4] || "";
    var ciudad = ciudadEs[ciudadDato] || ciudadDato, pais = paises[cc] || cc, apodo = apodos[code] || "";
    return {
      code: code, ciudad: ciudad, pais: pais, nombre: nombre, apodo: apodo, rango: i,
      aeropuerto: etiqueta(nombre, apodo, ciudadDato, ciudad),
      wCiudad: norm(ciudad + " " + ciudadDato).split(" "),
      wNombre: norm(nombre + " " + apodo + " " + claves).split(" "),
      wPais: norm(pais).split(" ")
    };
  });
  var indice = {};
  lista.forEach(function (a) { if (!indice[a.code]) indice[a.code] = a; });
  function tiene(ws, t) { return ws.some(function (w) { return w.indexOf(t) === 0; }); }
  function puntaje(a, ts) {
    if (ts.length === 1 && ts[0] === a.code.toLowerCase()) return 1000;
    if (ts.every(function (t) { return tiene(a.wCiudad, t); })) return 500;
    if (ts.every(function (t) { return tiene(a.wNombre, t) || tiene(a.wCiudad, t); })) return 300;
    if (ts.every(function (t) { return tiene(a.wPais, t); })) return 100;
    if (ts.every(function (t) { return t.length >= 3; }) &&
        ts.every(function (t) { return tiene(a.wPais, t) || tiene(a.wCiudad, t) || tiene(a.wNombre, t); })) return 50;
    return 0;
  }
  function buscar(texto, max) {
    var n = norm(texto);
    if (!n) return [];
    var ts = n.split(" "), out = [];
    lista.forEach(function (a) { var s = puntaje(a, ts); if (s) out.push([s, a]); });
    out.sort(function (x, y) { return y[0] - x[0] || x[1].rango - y[1].rango; });
    return out.slice(0, max || 6).map(function (x) { return x[1]; });
  }
  function porCodigo(code) { return indice[String(code || "").trim().toUpperCase()] || null; }
  return { buscar: buscar, porCodigo: porCodigo, norm: norm, total: lista.length };
}
if (typeof module !== "undefined") module.exports = { crearMotorAeropuertos: crearMotorAeropuertos };
