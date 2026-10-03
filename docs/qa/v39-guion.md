# v39 — el guion del PM

**Qué probar, en una sola ronda:**
- **VAL-87:** escribís la ciudad, la app te sugiere aeropuertos y guarda el código.
- **VAL-85:** viaja en el mismo build. Si todavía no corriste el guion de la v38, éste lo reemplaza: la parte B es
  ese mismo guion, sin cambios.

**Dónde:** el Artifact publicado, **abierto desde el teléfono**. **Arriba**, al lado de la cantidad de viajes, tiene
que decir **v39**. Si dice v38 o menos, el link está sirviendo una versión vieja: no sigas y avisame.

**Auditorías:** VAL-87 83/100 y VAL-85 85/100, las dos candidatas y sin bloqueantes.

---

## A · VAL-87, siempre con el teclado del teléfono abierto

Es lo único que acá no se pudo ver: si el teclado tapa la lista, si el corrector cambia lo que escribís, y si
los toques caen donde tienen que caer.

### A1 · Elegir

1. Entrá a un viaje y tocá **Agregar**. El tipo ya viene en **Vuelo**.
2. Tocá **Origen** y escribí `aeroparque`. ¿Aparece la lista? Tocá **Aeroparque**.
3. Tocá **Destino** y escribí `bari`. Fijate:
   - ¿El teclado tapa la lista?
   - ¿Ves Bariloche sin desplazar?
   - Desplazando la hoja con el dedo, ¿llegás a las cinco opciones?
   - ¿El corrector cambió «bari» por otra palabra?

   **Sacá captura de la lista con el teclado visible.**
4. Tocá **Bariloche**. Tiene que quedar «Bariloche» con el sello **BRC**. Anotá si el teclado quedó abierto.
5. Completá **Sale** y tocá **Guardar**. Abrí la reserva de nuevo: tiene que decir Bariloche con BRC.
6. Volvé a la lista de viajes. La etiqueta tiene que mostrar la ciudad debajo de cada código.

### A2 · Los bordes

1. **Agregar**. En **Destino** escribí `Villa La Angostura` y, con la lista abierta, tocá **Sale**.
   - ¿El toque cayó en «Sale»? Puede que el campo quede con el rótulo un poco cortado arriba.
   - Tiene que aparecer un aviso amarillo que nombre lo que escribiste.
2. En **Destino** borrá todo, escribí `eze` y tocá **Sale**. Tiene que quedar «Buenos Aires» con **EZE**.
3. En **Destino** escribí `bari` y apretá **una vez** la tecla **Enter / Ir** del teclado. Anotá qué hizo. Lo esperado
   es que no haga nada: ni guarda ni elige.

### A3 · Lo importado

1. Tocá **Importar**, pegá el texto de un mail de vuelo real y tocá **Interpretar**.
2. En la revisión, **Origen** y **Destino** tienen que verse como ciudad con sello (por ejemplo «Madrid» · MAD).
3. Corregí un destino: escribí `lon`, tocá una de las opciones de Londres y guardá. Abrí la reserva: tiene que
   decir lo que elegiste.

**Ya está anotado. No lo reportes:**
- **VAL-89:** en el formulario, «Llega» se corta a la derecha y la hoja puede correrse un poco de costado. Ya
  pasaba en la v38.
- **VAL-92:** Enter no elige la opción marcada.

---

## B · VAL-85: lo que la valija aprendió a sacar

El resultado no se ve en el viaje donde descartás, sino en otro. Hacen falta tres viajes, con **nombre y fechas**
alcanza.

1. **Viaje A:** en la valija marcá **Montaña** sola y armá la lista. No toques nada más.
2. **Viajes B y C:** igual, Montaña sola. En cada uno tocá el **círculo tachado** al lado de «Cámara y cargador».
3. **Cerrá la app, volvé a abrirla y entrá a la valija del viaje A.**
   - El aviso tiene que decir *«Por lo que descartaste en otros viajes, tengo una cosa para sacar de esta
     valija.»*
   - La tarjeta tiene que decir *«Por lo que descartaste en otros viajes»*.
   - Si cualquiera de los dos dice «El viaje cambió», es el defecto. **Captura de las dos.**
4. En el viaje A guardá una **nota**. Puede salir el texto nuevo, o «El viaje cambió: sumo… y saco…» si el
   modelo sumó algo del destino. Las dos son correctas. Captura.
5. **Control:** cargá un vuelo en A y borralo. Ahora sí tiene que decir «El viaje cambió».

**Ya está anotado como VAL-88. No lo reportes:** «Ver qué saco» abre una hoja titulada «Saco esto, que ya no
corresponde», y la tarjeta dice «1 cosa nueva».

---

## C · Claro y oscuro

Con el botón de la cabecera, mirá en tema claro y en oscuro la lista de sugerencias de aeropuertos (A1) y la
tarjeta de la valija del viaje A (B3). Nada tiene que cortarse ni taparse.

---

## Lo que me sirve de vuelta

- La captura de la lista con el teclado visible (A1.3).
- Qué hizo la tecla Enter/Ir (A2.3).
- Las capturas de B3 y B4.
- Un sí o no para el resto.
