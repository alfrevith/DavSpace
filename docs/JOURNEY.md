# My Journey

La sección `#journey` vive después de Certificates y antes de Contact en ambos índices y
tiene un enlace en las dos barras de navegación. Presenta seis capítulos reales
(Pet's Health, CECAM, POT-C, Plant Bud, Beyond y My Portfolio) y un cierre abierto
hacia el futuro. Sus textos proceden de la historia aportada por David.

`data/journey.json` contiene la historia, contribución, reto, lección, habilidades
y transición de cada capítulo. Para actualizarlo ejecuta:

```sh
npm run build:journey
```

Este comando regenera únicamente el bloque delimitado por `journey:start/end`
en cada índice. Los HTML generados se publican como siempre en GitHub Pages:
no se requiere compilación en el servidor. El contenido está presente sin JS y
también puede ser indexado por el chat. Los detalles nativos se pueden abrir
con teclado, incluso si falla la mejora de scroll.

Las imágenes se toman de las tarjetas existentes; My Portfolio utiliza la
miniatura real para compartir. Se cargan con `loading="lazy"`. No se descargan
PDFs, modelos, frameworks ni bibliotecas gráficas para mostrar la sección.
Explore the project utiliza `PortfolioProjects.open()` y el mismo diálogo,
PDF y visor 3D ya existentes. Al cerrar se devuelve el foco al enlace de Journey.

Cada habilidad tiene un `id` estable y una etiqueta visible. `applied` enlaza
habilidades ya conocidas que también se usan en capítulos posteriores. El mapa
combina ambos datos y muestra la primera aparición **en esta historia**, sin
asignar porcentajes de dominio ni inferir fechas de aprendizaje. IDs compartidos
como `application-logic`, `teamwork` o `responsive` agrupan nombres relacionados.
No añadas conexiones especulativas ni logros futuros al capítulo final.

`assets/js/journey.js` mide los capítulos en un único frame por evento de scroll,
y solo mientras la sección está visible. Conserva las etapas ya recorridas,
actualiza la ruta, el capítulo activo y el número de habilidades conectadas.
No usa bucles permanentes; cancela frames con la pestaña oculta. El paralaje se
desactiva en móvil y con movimiento reducido. Los cambios de altura por imágenes
o detalles se recogen mediante ResizeObserver. Solo el horizonte del capítulo
futuro tiene una respiración CSS, mientras ese capítulo está activo y visible.

El mapa opcional usa un diálogo nativo: selector de habilidad, primera aparición,
aplicaciones posteriores y enlaces de regreso a cada capítulo. Se cierra con
Escape, su botón o un clic exterior, libera el scroll y restaura el foco.

La composición móvil tiene escenas apiladas, fotos de altura limitada, controles
táctiles y una consola adaptada al encabezado que aparece al subir. El CSS está
aislado bajo `.journey-section`; las únicas reglas externas ajustan el bloqueo
del diálogo y el espacio de los seis enlaces móviles.
