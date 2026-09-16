/* ============================================================
   EL FORMATO DE LOTE, CONTESTADO POR UN MODELO REAL A CIEGAS

   Por qué existe: hasta el 16/09 el formato de lote de VAL-60 nunca lo
   había contestado un modelo. El simulador devolvía lo que el prompt
   pedía porque estaba escrito contra el mismo contrato, así que probaba
   que el parser entiende al simulador y nada más. Es exactamente la
   trampa que ya costó una iteración.

   Cómo se rompió el círculo: se generó el prompt REAL de un lote de tres
   documentos (`fixtures/prompt-lote.txt`) y se le pasó a un modelo que
   NO vio el parser, ni el motor, ni ningún archivo del repositorio —
   sólo el prompt—. Su respuesta, tal cual salió y sin retocar, es
   `fixtures/respuesta-lote-modelo-real.json`. Acá se corre el parser de
   verdad contra ella.

   Los tres documentos son distintos a propósito: una tarjeta de embarque
   (tiene que salir `boarding-pass` y disparar VAL-59), una reserva de
   hotel, y el voucher de micro REAL que subió el PM, que es el que
   verifica que 13/9/2026 se lea como 13 de septiembre y que un micro sea
   "transfer" y no "flight".

   Lo que NO prueba: que el modelo del visor del teléfono conteste igual.
   Es otro modelo y otra vista. Pero deja de ser cierto que "ningún
   modelo contestó nunca este formato".

       node app/pruebas/lote-modelo-real.js
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const M = require(path.resolve(__dirname, "..", "parts", "import-engine.js"));

const raw = fs.readFileSync(path.join(__dirname, "fixtures", "respuesta-lote-modelo-real.json"), "utf8");
let fallos = 0;
const ok = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };

console.log("\n· el parser de la app contra la respuesta cruda del modelo");
const porDoc = M.parseBatchResponse(raw, 3);
ok(porDoc !== null, "la acepta — `null` habría significado: no se entiende de qué documento sale cada reserva");
if (!porDoc) { console.log("\n  1 FALLARON\n"); process.exit(1); }
ok(porDoc.length === 3, `una entrada por documento (${porDoc.length})`);

const [d1, d2, d3] = porDoc;

console.log("\n· documento 1 — la tarjeta de embarque");
ok(d1.length === 1, `una reserva (${d1.length})`);
ok(d1[0].type === "flight", "tipo vuelo: " + d1[0].type);
ok(d1[0].confirmation === "XKD9P2", "código de reserva: " + d1[0].confirmation);
ok(d1[0].seat === "14A" && d1[0].gate === "B12", `asiento ${d1[0].seat}, puerta ${d1[0].gate}`);
ok(d1[0].boardingTime === "23:05" && d1[0].start.endsWith("23:55"),
   `distinguió la hora de EMBARQUE (${d1[0].boardingTime}) de la de SALIDA (${d1[0].start.slice(-5)})`);
const cl = M.clasificarTarjetaDeEmbarque(d1[0]);
ok(cl.esTarjeta === true, `la reconoce como tarjeta de embarque (regla "${cl.regla}", certeza "${cl.certeza}")`);

console.log("\n· documento 2 — la reserva de hotel");
ok(d2.length === 1, `una reserva (${d2.length})`);
ok(d2[0].type === "stay", "tipo alojamiento: " + d2[0].type);
ok(d2[0].start.startsWith("2026-11-11") && d2[0].end.startsWith("2026-11-15"),
   `check-in ${d2[0].start} y check-out ${d2[0].end}, en el orden correcto`);
ok(d2[0].confirmation === "HTL88231", "localizador: " + d2[0].confirmation);
ok(M.esTarjetaDeEmbarque(d2[0]) === false, "y NO la confunde con una tarjeta de embarque");

console.log("\n· documento 3 — el voucher de micro real del PM");
ok(d3.length === 1, `una reserva (${d3.length})`);
ok(d3[0].type === "transfer", "tipo traslado, no vuelo: " + d3[0].type);
ok(d3[0].confirmation === "LB0TKCV5", "código: " + d3[0].confirmation);
ok(d3[0].start.startsWith("2026-09-13"), "leyó 13/9/2026 como 13 de SEPTIEMBRE, no 9 de marzo: " + d3[0].start);
ok(d3[0].end.startsWith("2026-09-13"), "y la segunda hora como llegada: " + d3[0].end);

console.log("\n· la regla que más importa: ningún dato cruzado entre documentos");
const s1 = JSON.stringify(d1), s2 = JSON.stringify(d2), s3 = JSON.stringify(d3);
ok(!s2.includes("XKD9P2") && !s3.includes("XKD9P2"), "el código de la tarjeta no aparece en los otros dos");
ok(!s1.includes("HTL88231") && !s3.includes("HTL88231"), "el del hotel tampoco");
ok(!s1.includes("LB0TKCV5") && !s2.includes("LB0TKCV5"), "ni el del micro");

console.log("\n====================================================");
console.log(fallos ? `  ${fallos} FALLARON` : "  " + (3) + " documentos, 1 llamada, contestado por un modelo REAL");
console.log("====================================================\n");
process.exit(fallos ? 1 : 0);
