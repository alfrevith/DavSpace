# Beyond the Code

Tres estaciones reutilizan la composición, el progreso por scroll, las conexiones
iluminadas y la navegación de la antigua línea de tiempo. El ID de la sección es `#beyond-the-code`
y su enlace en ambas barras se llama `extra`. Ya no contiene los capítulos de proyectos ni el mapa de habilidades.
La consola de estaciones sigue el estado existente del encabezado: cuando se
oculta, sube cerca del borde superior; al regresar, deja espacio de nuevo. CSS
reutiliza `.is-hidden` en PC y `data-mobile-bars-hidden` en móvil, sin agregar
listeners de scroll. La transición se desactiva con movimiento reducido. El
contador conserva los mundos visitados y el indicador señala el mundo actual.
Las páginas `photography.html`, `drawings.html` y `writing.html` son independientes
y se adaptan a PC y celular sin pasar por el router de los dos índices.

Las fotografías de `images/photos/` y dibujos de `images/draws/` están registrados
en sus respectivos manifiestos. Los originales se conservan y las miniaturas
ligeras están en `images/previews/`. Writing reúne los dos poemas de `pdfs/poems/`
y la historia de `pdfs/stories/`, conservando sus PDF originales.
Los títulos numerados son etiquetas de navegación y pueden editarse en los JSON.

Las puertas de ambos índices se generan desde `scripts/creative-entrances-template.mjs`:
copias fotográficas sobre una mesa de luz, una hoja ilustrada con tinta y un manuscrito
con pluma y brasas. Sus imágenes son miniaturas reales, diferidas y sin filtros. Los
botones de acceso tienen su propio material y una superficie amplia para teclado y tacto.
Los trazos y pliegues se animan una sola vez al entrar en pantalla; las brasas se pausan
fuera de ella, al ocultar la pestaña o con movimiento reducido.

`creative-passage.js` valida los recorridos entre mundos y desde el portafolio.
`creative-transitions.js` usa un fundido de 100 ms de salida y 140 ms de llegada:
una sola capa con el color del destino, animando únicamente su opacidad, sin SVG,
textos ni máscaras. Un registro efímero en `sessionStorage` une ambos documentos, con
caducidad y comprobación de destino. La preparación del primer fotograma tiene un
límite de 800 ms; los efectos nunca interceptan el puntero ni duplican las
introducciones de los mundos. Sin animación o almacenamiento, los enlaces conservan
su funcionamiento normal. Los clics modificados y el historial siguen siendo nativos.

Al terminar la llegada se emite `creative:arrived`. Cada mundo espera ese evento
para ejecutar su apertura; las visitas mediante los botones superiores reproducen
también el diafragma de Photography y **The First Word** de Writing aunque la sesión
ya los haya mostrado. Con movimiento reducido las aperturas permanecen estáticas.

El selector del index se genera con `scripts/world-switcher-template.mjs` y se
viste con `creative-world-switcher.css`: encuadre de cámara, papel entintado y
encuadernación con detalles ámbar. `journey.js` mantiene el contador de mundos
encontrados y actualiza el material del indicador según la estación activa.

## Agregar contenido

Coloca tus archivos en `assets/photography/`, `assets/drawings/` o `assets/writing/`
(puedes crear esas carpetas al agregar los originales). Las rutas en los JSON parten
de la raíz del sitio, sin `/` inicial. Respeta mayúsculas y minúsculas.

También puedes seguir usando `images/photos/` e `images/draws/`. Para registrar
todos sus JPG/PNG y generar vistas previas proporcionales en Windows:

```powershell
./scripts/prepare-creative-images.ps1
```

El comando conserva títulos y metadatos existentes, respeta la orientación EXIF
y nunca sobrescribe los originales. No requiere instalar dependencias. Las
miniaturas tienen como máximo 1100 px en su lado mayor, sin recortes ni filtros.

### Fotografía

En `data/photography.json`, agrega entradas a `images`:

```json
{
  "images": [
    {
      "id": "identificador-unico",
      "image": "assets/photography/mi-foto.jpg",
      "thumbnail": "assets/photography/mi-foto-preview.webp",
      "title": "Título real de la fotografía",
      "description": "",
      "date": "",
      "camera": "",
      "location": "",
      "order": 1
    }
  ]
}
```

Es un ejemplo de formato, no una obra incluida. `id`, `image` y `title` son
obligatorios. Los demás campos son opcionales. No inventes EXIF, fechas o lugares.
Las imágenes pueden ser JPG, JPEG, PNG, WebP o AVIF.

Photography Room utiliza `scripts/photography-template.mjs`,
`assets/css/photography-room.css` y `assets/js/photography-room.js`.
La apertura editorial usa fotografías reales del manifiesto y permite abrirlas
en el mismo visor de la colección. La vista inicial «Exhibition» distribuye
retratos y paisajes conservando su proporción; «Single frame» mantiene la
navegación individual, flechas, gestos, zoom y originales.

`photography-motion.css` y `photography-motion.js` dirigen el movimiento.
El diafragma de seis palas dura aproximadamente 1.5 segundos, no intercepta
clics y aparece una sola vez por sesión. «Light. Time. Memory.» permite repetirlo.
El título se revela por líneas y la óptica SVG se traza durante la apertura.

Las fotografías aparecen completas mediante una transición suave de opacidad
y un asentamiento de escala del 1.2 %, de hasta 640 ms. No hay máscaras por
luminosidad, barridos ni destellos sobre las obras. `photography-emulsion.js`
se utiliza únicamente para obtener el tono ambiental de una miniatura ya cargada;
mantiene como máximo doce muestras. Las interrupciones devuelven la imagen a su estado final.

El visor es una mesa de luz con un encuadre amplio, controles agrupados y
originales sin filtros. Mientras carga el original conserva su vista previa;
al cambiar de fotografía utiliza un fundido de 300 ms. La apertura y el cierre
del panel son breves, sin hacer viajar la imagen por la pantalla.
Las transiciones se cancelan al navegar de nuevo, cambiar de tamaño, ocultar
la página o activar movimiento reducido. Los originales, foco, teclado y gestos
siguen siendo responsabilidad del controlador compartido.
La iluminación toma tonos de la fotografía enfocada, detrás de las obras.
La atmósfera limita Canvas a 34 partículas y DPR 1.5 en escritorio, 18 y DPR 1.25
en móvil, con límites menores para dispositivos modestos o ahorro de datos.
Se renderiza como máximo a 30/24 fps, se pausa al abrir el visor, al ocultar la
página o al salir de vista, y se detiene con `prefers-reduced-motion`.
Instagram y VSCO conservan sus URLs en el cierre editorial.

`assets/css/creative-navigation.css` comparte solamente la geometría de las
cabeceras de los tres mundos, usando las alturas y márgenes de Sketchbook.
Cada mundo conserva su tratamiento visual. Para regenerar las páginas sin
reescribir las estaciones de los índices: `node scripts/build-creative-pages.mjs`.

### Dibujo

`data/drawings.json` usa el mismo objeto `images`, sin necesitar `camera` ni
`location`. Usa `image: "assets/drawings/mi-dibujo.png"` y una miniatura aparte.
Las imágenes se presentan completas con `object-fit: contain`, sin recortarlas.

La identidad de Sketchbook se mantiene en `scripts/drawings-template.mjs` y
`assets/css/drawings-ink.css`. El generador inserta esta plantilla únicamente en
`drawings.html`; fotografía, escritura y los índices conservan su interfaz.
Los colores y las familias tipográficas se ajustan en las variables al inicio
del CSS. Las ilustraciones, costuras, marcos y el grano de papel son SVG locales
en `assets/illustrations/sketchbook-*.svg`, sin fuentes ni librerías externas.
`drawings-motion.css` y `drawings-motion.js` coordinan el título letra a letra,
la punta que escribe el subrayado, el trazado de los SVG y la aparición de los
folios al entrar en pantalla. El tintero es un botón accesible para repetir su
ilustración. Las secuencias son finitas y se cancelan al ocultar la página o
activar `prefers-reduced-motion`, incluso durante una animación.
Los SVG y las texturas se aplican a la interfaz, nunca a las obras.

Al cambiar de página, `drawings-ink-renderer.js` analiza únicamente la miniatura
ya cargada en un canvas temporal de hasta 200 px. De ella deriva hasta 72 trazos
SVG que dibujan los contornos reales, mientras la imagen se revela por pasadas.
Al terminar, se retira el boceto y queda la imagen completa sin filtros. No se
modifican archivos, no se solicitan originales para este efecto y se conservan
solo ocho bocetos en memoria. Los cambios rápidos cancelan el dibujo anterior;
si el navegador no admite el efecto, la galería funciona con su imagen normal.

El selector «Page by page / All pages» reutiliza `creative-gallery.js` y mantiene
la selección entre vistas. El visor conserva zoom, originales, flechas, gestos,
Escape y restauración del foco. Para regenerar el HTML después de editar la
plantilla basta ejecutar `node scripts/build-creative-pages.mjs`.

### Poema o historia — The Burning Manuscript

Coloca los originales en `pdfs/poems/` o `pdfs/stories/`, también en subcarpetas, y ejecuta:

```sh
npm run build:writing
```

El catálogo recorre ambas carpetas, extrae metadatos y número de páginas con la
instalación local de PDF.js y regenera Writing. Conserva los títulos, identificadores
y el orden ya revisados. No escribe sobre los PDF. Revisa el título extraído al agregar
una obra: si el documento no ofrece un título fiable, utiliza el nombre del archivo.
El catálogo es estático y funciona en GitHub Pages sin listar directorios en el navegador.

En `data/writing.json` puedes ajustar las entradas de `works`:

```json
{
  "works": [
    {
      "id": "identificador-unico-del-texto",
      "type": "poetry",
      "pdf": "pdfs/poems/mi-poema.pdf",
      "title": "Título real del texto",
      "cover": null,
      "description": "",
      "date": null,
      "order": 1
    }
  ]
}
```

Usa `type: "poetry"` para un poema y `type: "story"` para una historia. El PDF
es la única fuente del contenido literario. No copies versos ni capítulos al JSON.
`id`, `type`, `pdf` y `title` son obligatorios. No se incluyen archivos de ejemplo.

La portada es opcional: `cover` puede ser la ruta de una imagen optimizada o `null`.
Sin portada se dibuja un manuscrito con el título real. Para cambiarla solo edita
esa ruta; no es necesario cargar ni renderizar un PDF para obtener su portada.

`scripts/writing-template.mjs` y `assets/css/writing-manuscript.css` contienen la
escena y sus materiales: hojas sueltas para Poetry y encuadernaciones para Stories.
`writing-manuscript.js` coordina trazos, pliegues y la introducción **The First Word**,
que se muestra una vez por sesión. La pluma oculta la secuencia **LET HIM COOK.**,
activable también con teclado y sin bloquear la navegación.

El fuego usa seis llamas ilustradas con curvas Bézier, siluetas cálidas y núcleos
luminosos (`writing-fire.js`). Se dibuja directamente en Canvas, sin ruido ni raster
intermedio, y reserva espacio para que las puntas no se recorten. Comparte
un solo planificador con las brasas: máximo 30 fps en escritorio y 24 en móvil, DPR
limitado a 1.5 y 1, y presupuestos de partículas según el dispositivo. El fuego se
pausa fuera del hero; todos los efectos se detienen con la pestaña oculta, movimiento
reducido o el lector abierto. El lector conserva los colores originales del documento.
Los enlaces de **Original documents** también funcionan sin JavaScript.

El easter egg revela **LET**, **HIM** y **COOK.** con pasadas de tinta escalonadas,
una ligera presión de imprenta y un subrayado caligráfico que se dibuja al final.
La secuencia dura 3.4 segundos y se cancela al abrir el lector, cambiar de tamaño,
ocultar la pestaña o repetir el clic. La opacidad de reposo es cero y el texto se
oculta al acabar la salida para impedir que reaparezca entre animaciones.

## Orden, vistas previas y rendimiento

- `order` ordena de menor a mayor. Los empates respetan el orden del JSON.
- Conserva el original y crea una copia pequeña para `thumbnail` o `cover`.
  Recomendación: WebP/AVIF de 900–1200 px en su lado mayor, con calidad visual
  suficiente, habitualmente 100–250 KB. Revisa el resultado antes de publicar.
- No se modifica ni se convierte automáticamente tu original.
- Las miniaturas cargan con `loading="lazy"`. Si omites la miniatura se muestra
  el título y el acceso al original; el archivo grande no se descarga como preview.
- La entrada en la línea de tiempo usa la primera miniatura/portada disponible,
  consultando el manifiesto al acercarse al viewport. Nunca abre PDFs para esto.
- Los originales de imágenes cargan al abrir el visor. Se libera la fuente al cerrar.
- El lector reutiliza la misma instalación local de PDF.js del portafolio. Descarga
  el documento solo al seleccionarlo, renderiza una página por vez y destruye la
  tarea/worker y los canvases al cerrar. No hay una segunda versión de PDF.js.

## Navegación y lectura

Photography Room presenta una selección de fotografías en vista individual o cuadrícula. Conserva la selección al cambiar.
Photography Room y Sketchbook admiten botones, flechas en la galería/visor y swipes
horizontales. Con zoom activo los gestos quedan disponibles para inspeccionar la
imagen. Los diálogos nativos admiten Escape y devuelven el foco al botón de origen.

Writer's Room tiene pestañas Poetry/Stories con flechas, Home y End. El lector
incluye páginas, zoom, ajuste al ancho, modo expandido, pantalla completa si el
navegador lo admite, descarga y acceso al PDF original. La última página se guarda
localmente por `id` y se restaura al reabrir, con un aviso discreto. Si el almacenamiento
no está disponible se abre la página 1. Cambia el `id` si reemplazas un documento
por una obra completamente distinta para que no herede su posición anterior.

El canvas no se anuncia como documento accesible completo: se ofrece el original
para selección de texto, lectura asistida y herramientas del visor del navegador.

## Textos y enlaces sociales

`data/journey.json` centraliza los textos de las estaciones y los perfiles reales
de Instagram/VSCO. Tras modificar ese archivo, ejecuta:

```sh
npm run build:creative
```

Regenera los bloques delimitados de ambos índices y las tres páginas independientes.
Las galerías leen sus JSON en ejecución: agregar obras no requiere regenerar su HTML.
Las puertas de los índices usan una selección estática de miniaturas: ejecuta
`build:creative` si quieres actualizar también esas composiciones.
`build:journey` sigue disponible para regenerar solo las estaciones.

Publica todos los archivos en GitHub Pages. El retorno a `index.html#beyond-the-code`
conserva el ancla al elegir automáticamente el índice móvil. El sitio admite
subcarpetas como `/DavSpace/`, acceso directo y refresh, sin backend ni framework.

## Comprobación

```sh
npm test
```

Las pruebas usan registros ficticios únicamente en memoria para ejercitar los
controles sin añadir obras al sitio. Comprueban rutas, colecciones vacías,
errores de carga, galerías, foco, teclado/swipes, categorías, memoria de lectura,
zoom/navegación PDF y liberación de recursos. Prueba también visualmente tus
imágenes y PDFs reales después de agregarlos. No se garantiza un objetivo de
Core Web Vitals sin medir con el contenido y condiciones de publicación reales.
