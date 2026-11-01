# Versiones de escritorio y celular

`index.html` conserva el diseño de escritorio. `index-mobile.html` es la página
de celular, con su propia estructura, `assets/css/mobile.css` y
`assets/js/mobile.js`. La única incorporación al HTML de escritorio es el
selector de versión al inicio del documento. El fondo ambiental de ambas
versiones no incluye cuadrícula; las demás adaptaciones se limitan al celular.

`assets/js/device-router.js` selecciona la página al entrar, antes de cargar los
estilos: hasta 900 px usa celular; una pantalla táctil de hasta 1100 px también
usa celular, para admitir teléfonos en horizontal y tabletas compactas.
Las pantallas mayores usan escritorio. Se conservan el subdirectorio de
GitHub Pages, los parámetros y la sección del enlace.

La selección no provoca recargas mientras se gira el teléfono, se abre el
teclado o se cambia el tamaño de la ventana. Ambas páginas siguen siendo
adaptables dentro de su contexto. Para forzar una versión en las pruebas:

- `index.html?view=desktop`
- `index-mobile.html?view=mobile`

La opción explícita permanece en esa URL. El pie móvil incluye un enlace a la
versión de escritorio. Sin JavaScript cada archivo conserva su propia versión
y el contenido sigue siendo legible.

## Contenido y animaciones

Los proyectos, certificados, logros, logos, colores, PDFs y conocimiento del
chat comparten los archivos existentes en `data/`. Los controladores de
proyectos, documentos, carruseles y animaciones de aparición también se
comparten; no hay dos copias de los registros ni de sus comportamientos.
Si se cambia texto editorial o se añade una tarjeta en el HTML, se debe
actualizar tanto `index.html` como `index-mobile.html`.

La portada móvil usa la misma escena fijada y secuencia reversible de scroll
que PC: nombre, apertura del retrato, datos y acciones. Sus proporciones se
adaptan al teléfono; si la pantalla no tiene altura suficiente o se solicita
movimiento reducido, el contenido sigue siendo legible con scroll normal.
El encabezado sólido incluye LinkedIn. Ambas barras se ocultan al bajar y
reaparecen al subir, con una transición; los controles enfocados con teclado
permanecen accesibles. Los nombres de navegación coinciden con PC.
La barra inferior usa una cápsula con enlaces de texto e indicador deslizante,
como la de escritorio. El botón del chat baja cuando la cápsula se oculta y
recupera su posición cuando reaparece, permaneciendo accesible. La presentación
inicial se centra en la pantalla antes de continuar con la secuencia de scroll.
El desplazamiento del botón se anima con `transform`, con la misma duración y
curva que la barra, para invertir el movimiento sin saltos ni cambiar el layout.
Las notas secundarias y los filtros se despliegan bajo demanda. Los proyectos
conservan la imagen con título superpuesto y subrayado de PC. Los certificados
usan tarjetas más compactas. Los documentos se muestran después de su información
en menús de pantalla completa. Los tamaños de los logos y su halo se leen de
los mismos campos de cada proyecto.
Las imágenes verticales conservan su proporción natural y tienen una altura
máxima adaptada a la pantalla (hasta 340 px). Direct contact permanece visible.

El chat respeta las áreas seguras y el teclado mediante `visualViewport`,
contiene el foco mientras está abierto y mantiene sus enlaces de sección en la
página móvil. Se respetan las preferencias de movimiento reducido.

## Revisión

Ejecuta `npm test`. Las pruebas cubren la selección automática, ausencia de
bucles de redirección, enlaces profundos, paridad de contenido, aislamiento de
estilos, orden de los menús, chat y reinicio del scroll de los documentos.
Para una revisión visual, sirve la raíz con un servidor estático y comprueba
320, 360, 390 y 430 px, una tableta de 768 px y un teléfono en horizontal.
Prueba también las dos variantes con los enlaces explícitos anteriores.
