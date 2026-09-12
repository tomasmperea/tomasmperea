/* ============================================================
   Los motores, corridos DESDE EL HTML — no desde app/parts/

   Por qué existe: las pruebas de `app/parts/*.test.js` prueban el
   archivo suelto. La app no corre ese archivo: corre la copia
   embebida en `app/valija.html`. Entre los dos hay un paso manual
   (pegar el cuerpo del módulo sin el envoltorio UMD) y ese paso ya
   se quedó corto una vez — la auditoría del bloque B encontró que
   al HTML le faltaba parte del motor que sí estaba en `parts/`.

   Esto extrae el cuerpo de cada IIFE del HTML, lo envuelve como
   módulo de node y corre las MISMAS pruebas contra esa copia. Si el
   HTML quedó atrás, las pruebas fallan acá aunque pasen en `parts/`.

       node app/pruebas/motores-desde-html.js

   No necesita navegador ni red: es JavaScript puro, igual que los
   motores.
   ============================================================ */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const RAIZ = path.resolve(__dirname, "..", "..");
const HTML = path.join(RAIZ, "app", "valija.html");
const PARTS = path.join(RAIZ, "app", "parts");

/** Saca el cuerpo de `const NOMBRE = (function () { ... })();` del HTML. */
function extraerMotor(fuente, nombre) {
  const abre = "const " + nombre + " = (function () {";
  const i = fuente.indexOf(abre);
  if (i < 0) throw new Error("no encontré `" + abre + "` en valija.html");
  const desde = i + abre.length;
  const j = fuente.indexOf("\n})();", desde);
  if (j < 0) throw new Error("no encontré el cierre del IIFE de " + nombre);
  return fuente.slice(desde, j);
}

const html = fs.readFileSync(HTML, "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "valija-motores-"));

const MOTORES = [
  { nombre: "PackingEngine", archivo: "packing-engine.js", prueba: "packing-engine.test.js" },
  { nombre: "ImportEngine",  archivo: "import-engine.js",  prueba: "import-engine.test.js"  }
];

/* Cada motor extraído se escribe como módulo CommonJS con el mismo
   nombre de archivo que el de `parts/`, y se redirige el `require`
   del archivo de pruebas hacia él. El archivo de pruebas se sigue
   cargando desde `parts/`, así que su `__dirname` no cambia y las
   fixtures (`../pruebas/fixtures/...`) se siguen encontrando. */
const redirigir = {};
MOTORES.forEach(m => {
  const cuerpo = extraerMotor(html, m.nombre);
  const destino = path.join(tmp, m.archivo);
  fs.writeFileSync(destino,
    "/* extraído de app/valija.html por app/pruebas/motores-desde-html.js */\n" +
    "module.exports = (function () {" + cuerpo + "})();\n");
  redirigir[path.join(PARTS, m.archivo)] = destino;
});

const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (pedido, padre) {
  const resuelto = resolverOriginal.apply(this, arguments);
  return redirigir[resuelto] || resuelto;
};

/* Se corren en serie: las dos suites usan process.exitCode y escriben
   en la misma consola. Si una falla, el código de salida queda !=0. */
(async function () {
  for (const m of MOTORES) {
    console.log("\n############################################################");
    console.log("#  " + m.nombre + " extraído de app/valija.html");
    console.log("############################################################");
    require(path.join(PARTS, m.prueba));
    // Las suites son asincrónicas y fijan process.exitCode al terminar.
    await new Promise(r => setTimeout(r, 0));
    await esperarQueTermine();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
})();

/** Las suites encadenan promesas; alcanza con dejar vaciar la cola. */
function esperarQueTermine() {
  return new Promise(resolve => setImmediate(() => setImmediate(resolve)));
}
