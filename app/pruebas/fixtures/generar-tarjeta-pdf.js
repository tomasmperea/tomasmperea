const { jsPDF } = require("jspdf");
const fs = require("fs");
const d = new jsPDF({unit:"pt", format:"a4"});
d.setFont("helvetica","bold"); d.setFontSize(18);
d.text("TARJETA DE EMBARQUE", 40, 60);
d.setFont("helvetica","normal"); d.setFontSize(11);
[["Pasajero","PEREA/TOMAS"],["Vuelo","AR 1304"],["Fecha","2026-11-10"],
 ["Origen","EZE  Buenos Aires"],["Destino","MAD  Madrid"],
 ["Sale","23:55"],["Embarque","23:05"],["Puerta","B12"],["Terminal","A"],
 ["Asiento","14A"],["Codigo de reserva","XKD9P2"]].forEach(([k,v],i)=>{
  d.text(k, 40, 100 + i*22);
  d.setFont("courier","normal"); d.text(String(v), 200, 100 + i*22); d.setFont("helvetica","normal");
});
d.setFontSize(8);
d.text("Presentarse en el mostrador 3 horas antes. Condiciones de transporte segun IATA.", 40, 360);
fs.writeFileSync("tarjeta-real.pdf", Buffer.from(d.output("arraybuffer")));
console.log("PDF generado:", fs.statSync("tarjeta-real.pdf").size, "bytes");
