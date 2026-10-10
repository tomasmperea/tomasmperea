# Beta cerrada — qué hace falta antes de compartir Valija

**Pedido del PM (10/10):** *"si todas estas pruebas salen bien, me gustaría publicar la app y compartirla con
un grupo reducido de usuarios para testearla y empezar a mapear feedback"*.

**Estado:** propuesta del PO para decidir. Nada de esto está construido.

---

## Lo que hoy impide compartir el link

### 1. Todos ven los viajes de todos — bloquea

La base de datos de la app es **una sola para el Artifact entero**, y los viajes viven en la raíz
(`trips/…`, ver `docs/arquitectura.md`). La regla publicada hoy es: **lee quien pueda abrir la página,
escribe quien tenga permiso de edición**.

Concretamente: si le pasás el link a alguien, abre la app en «sólo lectura» y **ve todos tus viajes**, con
códigos de reserva, notas y documentos adjuntos. Si le das permiso de edición para que cargue los suyos, puede
también **editar y borrar los tuyos**, y todos ven los de todos.

La plataforma tiene la pieza para resolverlo: una carpeta privada por persona (`data/users/<id>/`), que ni
el dueño del Artifact puede leer. Mover los viajes ahí es una historia propia (**VAL-98**, abajo).

### 2. No sabemos todavía QUIÉN puede abrir el link — se averigua con una prueba de 5 minutos

Dos cosas que se contradicen, y acá no se puede saber cuál manda:

- El contrato de la plataforma dice que una página que usa base de datos es **interna de la organización**:
  sólo la abren personas con sesión iniciada en la organización del dueño.
- Al publicar, la herramienta informa que el Artifact es **«legible por cualquiera con el link»**.

Si vale lo primero y tu cuenta es personal, los testers de afuera no van a poder entrar, o van a entrar sin
base de datos. La app ya muestra cuál de los tres casos le toca a cada uno: **la etiqueta de arriba**, al
lado de la cantidad de viajes, dice **«sincronizada»**, **«sólo lectura»** o **«en este dispositivo»**.

**Experimento:** una persona de confianza abre el link en su teléfono y te manda una captura de la pantalla
de inicio. No hace falta construir nada. Ojo: si dice «sólo lectura», esa persona va a ver tus viajes (punto 1).
Elegí a alguien con quien eso no sea un problema, o esperá a VAL-98.

### 3. La inteligencia artificial la paga quien la usa

Armar la valija e importar reservas usan el modelo **con la cuenta de quien mira la página**: la primera vez
le pide permiso, y el consumo cuenta en su plan. Cada tester necesita cuenta de Claude, y hay que avisarle.

---

## Propuesta

| # | Qué | Por qué |
|---|---|---|
| 0 | La v43 aprobada en tu teléfono | No se comparte algo que el PM no dio por bueno |
| 1 | El experimento del punto 2, con una persona | Define si la beta es con gente de tu organización o de afuera, y cambia el diseño de VAL-98 |
| 2 | **VAL-98 · Cada persona ve sólo sus viajes** | Bloqueante de privacidad. Incluye pasar tus viajes actuales a tu carpeta sin perder nada |
| 3 | **VAL-99 · «Contanos»: feedback desde la app** | Un botón que guarda un comentario con la pantalla y la versión en una colección que sólo vos leés. Lo leo yo también y lo resumo |
| 4 | Métricas de la beta, con el analista | Tres o cuatro preguntas, no un tablero: ¿cargan reservas? ¿arman la valija? ¿vuelven? |
| 5 | Beta: 5 a 8 personas, 2 semanas | Un mensaje de bienvenida con qué probar y cómo reportar |

**Queda afuera, a propósito:** compartir **un** viaje con compañeros de viaje (hoy funciona porque todo es
compartido; con VAL-98 deja de funcionar y vuelve como historia propia si la beta lo pide).

## Lo que necesito que decidas

1. **¿Quiénes son los testers?** ¿Gente de tu organización en Claude, o de afuera?
2. **¿Cuántos?** La propuesta es 5 a 8.
3. **¿Hacemos el experimento del punto 2** apenas apruebes la v43?
