# Backlog pendiente — resumen para priorizar (14/10/2026)

Hecho a partir de `docs/backlog.md`, cruzado con `docs/roadmap.md` y el historial de commits. La prioridad
entre paréntesis es la que tiene escrita cada historia; la columna «Sugerencia» es la propuesta del PO.

## Lo último que se cerró (v38 a v46, verificado en tu teléfono)

Ciudad o aeropuerto con autocompletado (VAL-87, VAL-92) · la pregunta del destino del vuelo en la valija
(VAL-79, tres rondas) · fechas que se veían un día antes (VAL-96) · día y hora por separado (VAL-95) · beta con
«Contanos» y datos en el teléfono (VAL-99, VAL-101) · sin IA lo dice de entrada (VAL-105, VAL-103).

## 1 · La beta y la decisión de salir de Claude — en curso

| Historia | Qué es | Estado |
|---|---|---|
| Primera persona | Feedback del primer tester externo | Esperando su respuesta |
| VAL-102 | Valija para cualquiera, sin cuenta de Claude | Para decidir con datos de la beta. Costos en `docs/decisiones/` |
| VAL-98 | Cada persona ve sólo sus viajes en la nube | En espera: vuelve si los datos no sobreviven en el teléfono o se pide usar dos dispositivos |
| VAL-104 | La valija le pide algo a la IA en cada guardado | P2. Importa si la IA la pagamos nosotros |

## 2 · Experiencia de uso — reportadas por vos, sin construir

| Historia | Qué es | Prio. | Sugerencia |
|---|---|---|---|
| VAL-70 | Tocar una reserva la **muestra**; editarla es aparte | P1 | **Próxima** |
| VAL-52 | Tocar un pendiente lleva a resolverlo | P1 | Próxima |
| VAL-64 | Un viaje vacío marca 100% completo | P3 | **Próxima**: es lo primero que ve un tester nuevo |
| VAL-67 | Las categorías de la valija arrancan cerradas | P2 | Próxima (barata) |
| VAL-71 | El PDF exportado sale desprolijo | P3 | Después: un tester lo va a probar |
| VAL-68 + VAL-62 | Más de 3 documentos por reserva + avisar antes de que se llene | P1 / P2 | Después |
| VAL-65 | El campo «Notas» del viaje no se usa para nada | P2 | Decisión tuya: ¿alimenta la valija o se saca? |
| VAL-78 | Avisar que algo **ya empacado** no sirve para el viaje nuevo | P1 | Después |
| VAL-69 + VAL-51 | Mostrar la hora sólo donde importa (auto sí; actividad, nota no) | P2 | Revisar con vos: la opción B (VAL-95) cambió el formulario |

## 3 · Que la valija sea inteligente

| Historia | Qué es | Prio. | Sugerencia |
|---|---|---|---|
| VAL-66 | La valija sabe del destino: **documentación de entrada**, clima de esa época | P0 | Iteración siguiente a la de UX. Ojo: sin IA no hay ajuste por destino |
| VAL-88 | Cinco textos viejos de la valija (concordancia, etc.) | P2 | Junto con la próxima que toque la valija |
| VAL-84 | Un ítem propio pierde su origen cuando el historial lo sugiere | P2 | Después |
| VAL-97 | El modelo repite cosas con otras palabras | P3 | Sólo si molesta en el uso |
| VAL-94 | Decisiones chicas que midió la auditoría de VAL-79 | P2 | Revisar con vos |

## 4 · Defectos conocidos

| Historia | Qué es | Prio. | Sugerencia |
|---|---|---|---|
| VAL-100 | Un Guardar rechazado igual cambia la reserva en pantalla | P1 | **Próxima** (va con VAL-70) |
| VAL-83 | El campo «Agregar a ropa» se vacía si la pantalla se redibuja | P1 | Próxima |
| VAL-90 | En «sólo lectura» se ven Guardar y Eliminar | P1 | Sólo pasa en tu app compartida, no en la beta |
| VAL-50 | El generador de PDF a veces no carga | P1 | Junto con VAL-71 |
| VAL-89 | El formulario se corría de costado a 390 px | P2 | **Probablemente resuelta por VAL-95** (la causa era el campo de fecha); falta confirmar el corrimiento |
| VAL-81, VAL-91, VAL-93 | Detalles: la etiqueta abrevia a 3 letras, mayúsculas en traslados, nombres de ciudades raros | P3 | De a poco |

## 5 · Importar — lo que quedó bloqueado o diferido

| Historia | Qué es | Estado |
|---|---|---|
| VAL-57 | Llevar a pegar el texto del correo como camino principal | Diferida dos veces; el roadmap la pone primera en la iteración 5 |
| VAL-41, VAL-42, VAL-55, VAL-56, VAL-61 | Fotos, capturas, PDF escaneado, tarjeta de embarque fotografiada | Bloqueadas: la vista de Claude no acepta imágenes. Se reabren si Valija sale de Claude |

## 6 · Las iteraciones grandes que vienen (roadmap 5 y 6)

Todas necesitan servidor propio, o sea que **dependen de VAL-102**:

- **VAL-13** Cuentas y backend (va primero) → **VAL-10** avisos por correo → **VAL-11** reenviar mails a la app →
  **VAL-12** compartir un viaje puntual → **VAL-14** calendario.
- **VAL-20** a **VAL-23**: subir cualquier documento, mapa, conflictos de agenda, estado del vuelo en vivo.

## 7 · Deuda de pruebas (no la ve nadie de afuera)

VAL-73, VAL-86 (arneses que fallan a veces) y VAL-82 (un fixture con un tipo que no existe).

## Propuesta para la próxima iteración: «Que un tester nuevo no se tropiece»

Mientras la primera persona prueba la beta, cerrar lo que más va a ver alguien que llega sin contexto:

1. **VAL-70 + VAL-100** — ver una reserva sin entrar a editarla, y que un Guardar fallido no cambie nada.
2. **VAL-64** — un viaje vacío no puede decir 100%.
3. **VAL-67** — las categorías de la valija arrancan cerradas.
4. **VAL-52** — los pendientes llevan a resolverlos.
5. **VAL-83** — el campo de agregar a la valija no se vacía solo.

Después, con el feedback de la beta en la mano: VAL-66 (documentación por destino) o lo que la beta pida.
