# v40 — el guion del PM

**Qué probar, en una sola ronda:**
- **VAL-79:** cuando un vuelo va a otro lado que el destino del viaje, la app pregunta.
- **VAL-92:** Enter elige, y salir con una sola opción la toma.
- **VAL-94:** el multidestino, con tu decisión del 08/10.
- **Lo que quedó sin probar en la v39:** lo importado de VAL-87 y la valija de VAL-85.

**Dónde:** el Artifact publicado, **desde el teléfono**. Arriba, al lado de la cantidad de viajes, tiene que
decir **v40**. Si dice otra cosa, no sigas y avisame.

**Auditoría:** VAL-79 + VAL-92, 79/100, candidato y sin bloqueantes.

---

## A · Tu viaje de Bariloche con el vuelo a Madrid (el caso de tu reporte)

1. Entrá a «escapada con el gordo» y abrí la **Valija**.
2. Arriba tiene que aparecer: *«Tenés un vuelo a Madrid y el viaje dice Bariloche. Mientras no me digas,
   sugiero para los dos lugares. ¿Qué pasó?»*, con tres botones. **Captura.**
3. Tocá **«El viaje ahora es a Madrid»**.
   - La pregunta se va.
   - El viaje pasa a decir Madrid.
   - Aparece el aviso de la valija para sacar lo de Bariloche. Abrilo con **«Ver qué saco»**: tienen que estar los
     ítems «por Bariloche» **que no empacaste**, y ninguno empacado. **Captura.**

Si no querés tocar tu viaje real, hacé lo mismo con un viaje de prueba: destino escrito «Bariloche», un vuelo
AEP → MAD, y la valija armada.

## B · El formulario y las otras dos respuestas

1. Viaje nuevo «Prueba 40», destino **Bariloche**. **Agregar** → Vuelo.
2. En **Destino** escribí `madrid` y tocá Madrid. Debajo aparece la pregunta. Tocá **«Voy a los dos lugares»**.
   Sale una línea verde que termina en **«Se aplica al guardar.»** Tocá **Guardar**.
3. Otro vuelo en el mismo viaje, a `roma` (Roma). Esta vez tocá **«Es una escala»** y Guardar.

## C · Importar la ida y la vuelta juntas

En un viaje con destino **Bariloche**, **Importar** el mail de un vuelo de ida y vuelta (o pegá el texto) y
**Interpretar**.
- La tarjeta de la **ida** pregunta.
- La de la **vuelta**, la que vuelve a Buenos Aires, **no** pregunta.

Aprovechá para lo que faltó de VAL-87: corregí un destino escribiendo `lon`, tocá una opción de Londres y
guardá. Al abrir la reserva tiene que decir lo que elegiste.

## D · El campo de aeropuerto (VAL-92), con el teclado abierto

1. Escribí `aeroparqu` y tocá afuera del campo. Tiene que quedar **Buenos Aires · AEP**.
2. Escribí `bari` y apretá la tecla de la esquina del teclado (en Gboard es **«→|»**). **Anotá qué hizo**:
   - elegir **Bari** es lo esperado si esa tecla manda un Enter;
   - pasar al campo siguiente dejando «bari» escrito también está bien.
3. Escribí `toj` y tocá afuera. Tiene que quedar **TOJ** como código, no «Tojo».

## E · Lo que faltó de VAL-85 (la valija aprende a sacar)

El guion de la v39, parte B, sin cambios (`docs/qa/v39-guion.md`):
- **Tres viajes de Montaña:** en uno armás la valija sin tocar nada; en los otros dos descartás «Cámara y
  cargador».
- **Cerrás la app**, la volvés a abrir y entrás a la valija del primero.
- Tiene que decir *«Por lo que descartaste en otros viajes…»*. **Captura.**

## F · Claro y oscuro

La pregunta de A y la de B, en los dos temas: nada cortado ni tapado.

---

**Ya anotado. No lo reportes:**
- «Llega» se corta a la derecha del formulario (VAL-89).
- Un destino escrito «USA» pregunta de más con un vuelo a JFK (VAL-94).

**Lo que me sirve de vuelta:**
- Las capturas de A2 y A3.
- Qué hizo la tecla de D2.
- La captura de E.
- Un sí o no para el resto.
