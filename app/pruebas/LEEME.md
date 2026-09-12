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
| `importar-sin-imagenes.js` | El motor de importación v2 desde la pantalla: una vista sin imágenes lo dice **antes** de subir nada, una vista con imágenes sigue igual, y un PDF con capa de texto se interpreta sin mandar ni una imagen | 45 aserciones |
| `importar-arranque.js` | El arranque de la pantalla de importar (hallazgos A y B de la auditoría del 12/09): que el toque reaccione **en el acto** aunque la plataforma tarde, que lo que resuelve tarde no reabra ni pise nada, y que sin `pdf.js` se diga antes de subir nada | 59 aserciones |
| `motores-desde-html.js` | Las pruebas de los dos motores corridas contra la copia **embebida en `valija.html`**, no contra `app/parts/` | 68 + 69 casos |
| `tier-del-modelo.js` | Qué `modelTier` pide cada camino, aseverado sobre las opciones que **efectivamente recibe** `sample.json()`: texto `"default"`, imágenes `"complex"`, equipaje `"complex"`. Y qué queda registrado, incluido que `modelTierApplied` no llega por `json()` | 42 aserciones |

`importar-botones.js` recibe la ruta del HTML como argumento:

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-botones.js "$PWD/app/valija.html"
```

`motores-desde-html.js` no necesita navegador: corre con `node` solo.

`tier-del-modelo.js` también acepta la ruta del HTML, y por el mismo motivo: una prueba de
configuración que no puede fallar no prueba nada. Los tres controles negativos:

```
sed 's/texto:"default"/texto:"complex"/'   app/valija.html > /tmp/t1.html   # → 5 FALLA
sed 's/imagenes:"complex"/imagenes:"default"/' app/valija.html > /tmp/t2.html   # → 1 FALLA
sed 's/equipaje:"complex"/equipaje:"quick"/'   app/valija.html > /tmp/t3.html   # → 2 FALLA
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js /tmp/t1.html
```

`importar-arranque.js` también acepta la ruta del HTML como argumento, y eso no es
un adorno: es el **control negativo** de su aserción más importante. La medición del
tiempo de reacción no sirve de nada si no puede fallar, así que se comprueba corriendo
el mismo arnés contra una copia del HTML a la que se le sacó el estado de carga:

```
sed 's/^  renderPreparando();$//' app/valija.html > /tmp/sin-preparando.html
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-arranque.js /tmp/sin-preparando.html
→ FALLA  hubo un cambio visible en pantalla dentro de los 300 ms del toque
```

## Dónde sale el resultado

En la **terminal**, en los nueve arneses. `valija-bloque-b.js` y
`hallazgos-qa-bloque-b.js` escribían sólo en `os.tmpdir()/valija-qa.log` y correrlos
como dice este archivo no mostraba nada; desde el 12/09 imprimen en pantalla y además
dejan el log. Los dos tardan entre dos y tres minutos: un timeout corto los mata a
mitad de camino y produce fallos que son del timeout, no del producto.

## Por qué las pruebas de motor se corren dos veces

`app/parts/*.test.js` prueba el archivo suelto. La app no corre ese archivo:
corre la copia pegada dentro de `app/valija.html`. Entre los dos hay un paso
manual, y ese paso ya se quedó corto una vez —la auditoría del bloque B
encontró que al HTML le faltaba parte del motor que sí estaba en `parts/`—.
`motores-desde-html.js` extrae el cuerpo de cada IIFE del HTML y corre las
mismas pruebas contra esa copia. Si el HTML quedó atrás, falla ahí aunque
`parts/` esté en verde.

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

Y hay dos piezas que acá son **simuladores, no la cosa real**: `claude`
(inyectado con `page.addInitScript`) y **pdf.js**, que en este entorno no baja
porque cdnjs está bloqueado. `importar-sin-imagenes.js` e `importar-arranque.js`
inyectan un pdf.js escrito contra la API documentada. Un simulador replica el contrato, no lo
verifica: que `page.getTextContent()` del pdf.js real devuelva esa forma en un
teléfono se comprueba con los pasos de `docs/design/import-engine.md` §5.

## Intermitencia conocida

`tier-del-modelo.js` falló **una aserción en una de siete corridas** el 12/09, y en las
otras seis dio 42 en verde. No se pudo identificar cuál fue: se perdió la salida de esa
corrida. Queda anotado porque **un arnés que falla una de cada siete no garantiza lo que
dice garantizar**, y porque descubrirlo de nuevo desde cero cuesta más que leer esto.

Sospecha, sin confirmar: alguna aserción que depende de un tiempo fijo. Este arnés
convive con esperas reales de la app —el techo de 4 s de `limits()`, el aviso de los
7 s— y una espera fija se queda corta cuando la máquina está cargada. Es el mismo patrón
que ya tumbó `valija-bloque-b.js` antes de cortarle la red externa.

**Qué hacer si vuelve a aparecer:** correrlo cinco veces guardando la salida completa de
cada una (`> /tmp/t$i.txt 2>&1`, no por tubería), y buscar la línea con `FALLA`. Con eso
se sabe si es una espera fija y se reemplaza por una condición.
