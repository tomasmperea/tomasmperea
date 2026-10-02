# v38 — el guion del PM

**Qué probar:** VAL-85. Si descartaste una cosa en otros viajes, la valija aprende a no sugerirla. Cuando
la saca de un viaje que no tocaste, tiene que decir que es por lo que descartaste, no que «el viaje cambió».

**Dónde:** el Artifact publicado, **abierto desde el teléfono**. Arriba a la izquierda tiene que decir
**v38**. Si dice v37, el link está sirviendo la versión vieja: no sigas y avisame.

**Auditoría:** 85/100, candidato, sin bloqueantes (`docs/auditoria/2026-10-02-val85.md`).

---

## Antes de empezar: esta prueba es distinta

Como en la v37, **el resultado no se ve en el viaje donde descartás: se ve en otro.** Hacen falta tres
viajes, y alcanza con **nombre y fechas**, sin reservas. El orden importa: **el viaje A se arma primero**,
antes de descartar nada.

---

## 1 · Tres viajes de montaña

1. **Viaje A** («Prueba A», cualquier fecha). En la valija marcá **Montaña sola** y armá la lista. No toques
   nada más. «Cámara y cargador» queda en la lista, en Electrónica.
2. **Viaje B** y **viaje C**, igual: Montaña sola, armá la lista. En cada uno, tocá el **círculo tachado** al
   lado de «Cámara y cargador» para descartarla.

## 2 · El texto nuevo: entrando a la valija

**Cerrá la app y volvé a abrirla.** Entrá al viaje A y a su valija.

- El aviso tiene que decir: *«Por lo que descartaste en otros viajes, tengo una cosa para sacar de esta
  valija.»*
- La tarjeta tiene que decir: *«Por lo que descartaste en otros viajes»*.

Si cualquiera de los dos dice **«El viaje cambió»**, es el defecto. **Sacá captura de las dos cosas.**

## 3 · Guardando una reserva

En el viaje A guardá una **nota** cualquiera y volvé a la valija.

Puede pasar una de dos cosas, y **las dos son correctas**:
- el texto nuevo del paso 2;
- *«El viaje cambió: sumo… y saco…»*, si el modelo sumó algo del destino. Cuando hay un cambio que no viene
  de lo que descartaste, el texto de siempre es el correcto.

Sacá captura de lo que veas.

## 4 · El control: un cambio de verdad sigue diciendo que cambió

En el viaje A cargá un **vuelo** y después **borralo**. Ahora la valija **sí** tiene que decir
«El viaje cambió».

**Esto ya está anotado (VAL-88). No lo reportes:**
- **«Ver qué saco»** abre una hoja titulada *«Saco esto, que ya no corresponde»*.
- La tarjeta dice **«1 cosa nueva»** aunque lo único que hay es algo para sacar.

## 5 · Claro y oscuro

Con el botón de la cabecera, pasá a tema claro y a oscuro sobre la valija del viaje A. El texto largo de la
tarjeta (*«Por lo que descartaste en otros viajes»*) tiene que partirse en renglones **sin cortarse ni
taparse**. Esto acá no se pudo medir.

---

**Lo que me sirve de vuelta:** las capturas de los pasos 2 y 3, y un sí o no para los pasos 4 y 5.
