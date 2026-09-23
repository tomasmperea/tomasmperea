# v35 — el guion del PM

**Qué probar:** VAL-76 (cambiar el tipo desde donde se ve) y VAL-77a (un viaje puede ser de dos tipos).

**Dónde:** el Artifact publicado, **abierto desde el teléfono**. Arriba a la izquierda tiene que decir **v35**.
Si dice v34, el link quedó fijado a una versión vieja y no sirve probar: avisá y lo resolvemos antes.

**Por qué este guion y no otro:** los cinco pasos son exactamente lo que **sólo el teléfono puede contestar**.
Todo lo demás ya está probado acá con arneses que tocan los botones, y está declarado en la auditoría.

---

## 1 · ¿Ves el tipo, y lo encontrás sin buscarlo?

Abrí una valija ya armada.

- ¿El tipo de viaje está en **un renglón propio**, abajo del progreso, con los días y los viajeros al lado?
- ¿Te sigue entrando la lista, o la cabecera te come demasiado? (son unos 30px nuevos y es el costo declarado)

## 2 · Tocalo con el pulgar, sin apuntar

- ¿Se abre el selector **al primer toque**?

Esto es lo que ninguna prueba de acá puede contestar: el área táctil se amplía por debajo del borde visible,
y si la ampliación no funciona en tu Android el botón se va a sentir esquivo. Medimos la caja visible
(91×28 px con un tipo); el área efectiva sólo la mide un dedo.

## 3 · Marcá dos, después una tercera, después destildá

- Tocá una segunda opción: se marcan las dos con un tilde.
- Tocá una **tercera**: no tiene que pasar nada, y las apagadas tienen que **seguir en pantalla**.
- Tocá una de las dos marcadas: se destilda y las demás se vuelven a encender.

## 4 · Rehacé, y mirá los números antes de confirmar

Con dos marcadas, tocá **Rehacer la lista**.

- Antes de confirmar: **¿los números de qué se conserva coinciden con lo que vos marcaste?**
  (lo empacado, lo descartado, lo que agregaste a mano)
- Confirmá. ¿Lo que tenías empacado sigue empacado?
- ¿Entran ítems de **los dos** tipos? Un montaña+ciudad tiene que traer calzado de trekking **y** algo para
  salir de noche.

## 5 · El tema oscuro, y una valija vieja

- Cambiá el tema a oscuro **con el botón de la cabecera** (el explícito, no el del sistema) y volvé a la valija.
  ¿El botón del tipo se lee?
- Si tenés alguna valija que diga **«Mixto»**: ¿el chip ámbar y el cartel que pregunta se leen bien en oscuro?
  ¿La lista sigue funcionando igual que antes?

---

## Lo que NO se probó, y por qué se dice

Nada de esto corrió en un teléfono: todo fue Chromium de escritorio con el archivo local. Los dos temas se
miraron en capturas, no en un aparato, y el tercer estado del botón de tema (elección explícita) no se miró en
pantalla — por eso está en el paso 5.

El conteo de viajes por combinación se ejercitó con historiales fabricados, no con viajes guardados de verdad.

**Con tu respuesta, la historia pasa de candidato (81/100) a terminada.** Publicar no cierra nada.
