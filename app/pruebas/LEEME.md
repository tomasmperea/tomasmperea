# Pruebas de interfaz

Las pruebas de los motores (`app/parts/*.test.js`) corren con `node` y no tocan el
navegador. **Estas no.** Estas abren `app/valija.html` en un navegador de verdad y
**tocan los controles**, que es la única forma de probar una función que se usa con el
dedo.

Existen en el repositorio por una razón concreta: durante la iteración 2 vivieron en el
directorio temporal de la sesión, y la auditoría del bloque B marcó que la afirmación
*"se probó tocando cada control"* no era verificable por nadie más. Una prueba que no
se puede volver a correr no respalda nada.

## Cómo se corren

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/valija-bloque-b.js
```

Necesitan Playwright y Chromium. En este entorno ya están: `PLAYWRIGHT_BROWSERS_PATH`
apunta a `/opt/pw-browsers`. **No corras `playwright install`.**

| Archivo | Qué cubre | Estado al commitear |
|---|---|---|
| `valija-bloque-b.js` | El bloque B completo: aviso de lista vieja, marca de ítem nuevo, propuestas de sacar, aplazamiento, recálculo al entrar | 111 aserciones |
| `hallazgos-qa-bloque-b.js` | Los dos hallazgos de `docs/qa/valija-bloque-b.md`, con los gestos del reporte | 31 aserciones |
| `auditoria-h1.js` | Reproducción independiente de H1: Ciudad → auto → Playa → aplicar el plan viejo | reproducción |
| `auditoria-h2.js` | Reproducción independiente de H2: categoría plegada a mano con ítems nuevos | reproducción |
| `importar-botones.js` | Los tres botones de origen de archivo, tocados. Con el argumento `bloquear` simula un navegador que ignora la apertura, para probar que el aviso aparece | 11 y 12 aserciones |

## La regla

**Tocá el gesto, no el evento.** Si la función se usa tocando un botón, la prueba hace
`click` sobre el botón. Disparar a mano el evento interno que ese botón debería
producir saltea justamente el tramo donde vive el bug: así se escaparon los botones de
importar, con todas las pruebas en verde.

## El límite que tienen

Chromium de escritorio sobre `file://` **no es el entorno real** de este proyecto. El
entorno real es el Artifact publicado abierto desde el teléfono. Estas pruebas son un
sustituto bueno y su brecha está declarada en `CLAUDE.md`, sección "La palabra
verificado". Hay al menos un bug vivo —el selector de archivos que no abre en el visor
del teléfono— que estas pruebas dan en verde y que en el teléfono falla.
