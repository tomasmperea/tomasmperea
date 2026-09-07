# Valija — Roadmap

Cuatro iteraciones. Cada una tiene un objetivo único y se puede cortar después de cualquiera de ellas con un
producto que se sostiene solo.

---

## Iteración 1 — Consolidar (entregada)

**Objetivo:** que toda la información de un viaje esté en un solo lugar y se sepa qué falta.

Entregado: viajes en paralelo, carga manual por tipo, lectura automática de confirmaciones por texto e
imagen, itinerario por día, motor de pendientes con seis reglas, compartir para ver o editar, resumen en PDF.

**Pregunta que responde:** ¿la gente carga sus viajes acá?

---

## Iteración 1.5 — Preparar (entregada)

**Objetivo:** que la app sirva también la noche anterior al viaje, cuando se arma el bolso.

Se adelanta a la iteración 2 por una razón concreta: **no necesita backend.** Usa la base de datos y la capa
de inteligencia que el MVP ya tiene. Entregar valor sin esperar infraestructura es preferible a respetar el
orden del plan.

**Alcance:** épica VAL-30, especificada en `docs/briefs/valija-inteligente.md`.

- Lista de equipaje sugerida según tipo de viaje, destino, fechas y duración.
- Motor híbrido: reglas locales que funcionan siempre, más ajuste por destino con inteligencia encima.
- Checklist de empacado con progreso.
- Aprendizaje del historial: lo que la persona agrega y descarta cambia las sugerencias siguientes.

Entregado: lista sugerida por tipo, destino, fechas y duración; motor híbrido con reglas locales que
funcionan siempre más ajuste por destino con inteligencia encima; tres estados por ítem con progreso que
cuenta el descarte como resuelto; aprendizaje del historial con umbral de dos apariciones.

Fuera: VAL-34 por falta de identidad por visitante y VAL-35 por no estar diseñada.

**Pregunta que responde:** ¿la app se abre también el día antes de viajar, y no solo mientras se planifica?

---

## Iteración 2 — Interpretar

**Objetivo:** que cargar un viaje deje de ser trabajo. Es la iteración que decide si la app se usa o se
abandona.

**Se adelantó por feedback de uso.** El plan original ponía los avisos por correo acá. Después de probar el
MVP, el PM fue explícito: importar es lo más potente que puede tener la app, y copiar los datos del correo a
mano es incómodo. Ninguna cantidad de avisos salva a un producto que cuesta llenar, así que la fricción de
carga va primero.

**Alcance:** VAL-40 a VAL-43 en el backlog.

- Importar desde PDF, renderizando las páginas a imagen en el propio navegador.
- Importar el correo completo y capturas de pantalla, además del texto pegado.
- Completar un vuelo ya cargado con los datos de la tarjeta de embarque, sin duplicarlo.
- La lista de equipaje se adapta al destino de verdad: la capa inteligente puede sacar ítems que no
  corresponden, no solo agregar.

Sigue sin necesitar servidor. Todo se resuelve en el navegador con la capa de inteligencia que ya existe.

**Pregunta que responde:** ¿se puede cargar un viaje entero sin tipear?

---

## Iteración 3 — Avisar

**Objetivo:** que el producto te busque en lugar de esperar a que lo abras. Es la iteración de retención, y
la primera que necesita infraestructura propia.

**Alcance:**

- **Correos de aviso.** Un proceso diario evalúa las reglas de pendientes y manda un correo solo cuando hay
  algo nuevo que decir. Nunca un correo vacío.
- **Cadencia por cercanía.** Semanal a 30 días, repaso a 7, check-in a 48 horas, hoja de ruta el día previo.
- **Buzón de reenvío.** Una dirección propia a la que reenviar la confirmación sin abrir la app. Después de
  la iteración 2 es el complemento natural: interpretar ya funciona, falta que llegue solo.
- **Cuentas propias.** Habilitan el permiso por viaje en lugar de por valija, y la vista de quién empacó qué
  que quedó diseñada y esperando.
- **Sincronización con el calendario.**

**Stack propuesto:** Next.js sobre Vercel, Postgres con Supabase para datos y autenticación, Resend para los
correos, un cron diario para el evaluador de reglas, e Inbound Parse para el buzón.

**Pregunta que responde:** ¿vuelven sin que se lo pidamos?

---

## Iteración 4 — Acompañar

**Objetivo:** pasar de organizador a compañero de viaje.

**Alcance:**

- Mapas del viaje y detección de conflictos de agenda: un check-out a las 10 y un vuelo a las 11 desde un
  aeropuerto a una hora es un problema, y el producto debería decirlo.
- Estado de vuelo en vivo con avisos de retraso y cambio de puerta.
- Modo sin conexión, porque el momento de mayor necesidad suele ser el de peor señal.
- Gastos compartidos entre los participantes.

**Pregunta que responde:** ¿es la app que se abre durante el viaje y no solo antes?

---

## Lo que decide seguir o parar

Al cierre de cada iteración se mira una sola cosa antes de arrancar la siguiente:

| Después de | Seguimos si |
|---|---|
| Iteración 1 | Hay viajes con más de tres reservas cargadas |
| Iteración 1.5 | Las listas llegan al día del viaje con más de la mitad marcada |
| Iteración 2 | La carga manual baja frente a la automática |
| Iteración 3 | Los correos se abren y traen gente de vuelta a la app |
