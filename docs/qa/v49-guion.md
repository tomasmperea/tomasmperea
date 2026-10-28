# v49 — el guion del PM (VAL-64 y VAL-67)

**Auditoría:** 80/100, candidato, sin bloqueantes (`docs/auditoria/2026-10-28-v49.md`).

**Qué probar:** dos cambios chicos juntos, unos cuatro minutos, en tu app. Arriba tiene que decir **v49**.

**VAL-64 · un viaje vacío**

1. En el inicio, tocá **Nuevo viaje**, poné nombre y fechas y guardá. Volvé al inicio: la tarjeta dice
   **«sin reservas»** y no tiene el anillo con el número. **Captura.**
2. Entrá a ese viaje y cargá una reserva cualquiera. Volvé al inicio: aparece el anillo con su número y dice
   «1 reserva».
3. (Opcional) Borrá ese viaje de prueba.

**VAL-67 · las categorías de la valija**

4. Entrá a un viaje con destino y abrí **Valija**. Si todavía no está armada, armala. Todas las categorías
   están cerradas, con su cuenta, salvo las que recibieron algo de la IA para el destino, que se ven
   abiertas. **Captura.**
   - Si la lista ya estaba armada de antes, puede que ninguna se abra sola: se abre la que tiene algo
     **pendiente** agregado para el destino.
5. Abrí **Ropa** y marcá un par de cosas: la categoría **no se cierra** mientras marcás. Después, en la misma
   categoría, **descartá** uno con el circulito tachado y **deslizá** otro hacia un costado: tampoco se cierra.
6. Tocá **Agregar ítem** (abajo), escribí algo, elegí una categoría que esté cerrada y tocá **Agregar**:
   la categoría se abre y lo que agregaste se ve.
7. Pasá a tema oscuro y mirá la valija. **Captura.**

**Qué me mandás:** las tres capturas, y si algo de los pasos 5 o 6 no hizo lo que dice (sobre todo descartar y deslizar, que no tienen prueba automática).
