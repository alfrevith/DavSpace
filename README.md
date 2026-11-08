# David Menjivar · Portfolio

Sitio estático compatible con GitHub Pages, sin backend ni compilación obligatoria.

## Dónde editar

| Contenido | Archivo o carpeta |
| --- | --- |
| Página principal, perfil y tarjetas de proyectos | `index.html` |
| Versión de celular, estructura y contenido | `index-mobile.html` |
| Diseño y comportamiento exclusivos de celular | `assets/css/mobile.css`, `assets/js/mobile.js` |
| Fichas de proyectos | [`data/projects.js`](data/projects.js) |
| Certificados, logros, logos y neón | [`data/credentials.json`](data/credentials.json) |
| Respuestas personales del chatbot | [`data/assistant-knowledge.json`](data/assistant-knowledge.json) |
| Estaciones de Beyond the Code y redes creativas | [`data/journey.json`](data/journey.json) |
| Fotografías, dibujos y obras PDF | `data/photography.json`, `data/drawings.json`, `data/writing.json` |
| Personaje jugable y controles | `assets/js/character-playground.js`, `assets/js/character-physics.js`, `assets/js/character-sprites.js` |
| Comportamiento del sitio | `assets/js/` |
| Estilos | `assets/css/` |
| Imágenes e iconos | `images/` |
| PDFs de proyectos | `pdfs/` |
| PDFs de certificaciones | `certifications/` |
| Documentos de futuros logros | `achievements/` |
| Pruebas | `tests/` |

Las rutas de imágenes y PDFs escritas en los datos se calculan desde la raíz del sitio: por ejemplo, `images/icons/Excel.png`, **sin** anteponer `../` por estar el JSON en `data/`. Respeta mayúsculas y minúsculas para GitHub Pages.

Las imágenes de reserva están en `images/backgrounds/`. Son fotografías distintas, conservadas con nombres descriptivos. El fondo actual sigue en `images/hero-contours.webp`.

## Guías

- [Versiones de escritorio y celular](docs/MOBILE.md)
- [Editar proyectos](docs/PROJECTS.md)
- [Editar certificados y logros](docs/CREDENTIALS.md)
- [Enseñar respuestas al chatbot](docs/ASSISTANT.md)
- [Editar Beyond the Code y las colecciones creativas](docs/CREATIVE-WORLDS.md)
- [Controles y edición del personaje jugable](docs/PLAYGROUND.md)

## Revisar localmente

Sirve esta carpeta con un servidor estático, por ejemplo Live Server. El chat y los carruseles consultan archivos con `fetch`, así que abrir el HTML mediante `file://` no basta para comprobar todas las funciones.

Con Node.js 22 o posterior:

```sh
npm ci
npm test
```

Las dependencias de npm se utilizan para desarrollo y pruebas. `node_modules/` está ignorado por Git y no se publica. El lector PDF usa la distribución local de PDF.js en `assets/pdfjs/`; sus fuentes, CMaps, worker, archivos WASM y licencia son necesarios para admitir distintos documentos.

## Publicación

La dirección pública es `https://alfrevith.github.io/DavSpace/`. Las etiquetas de
vista previa de ambos índices deben conservar esa base. Publica también
`images/thumbnail-social-v2.jpg`, la copia ligera del thumbnail para compartir;
el PNG original se conserva. El título utiliza signos Unicode similares a los
corchetes angulares para que las apps no lo eliminen como una etiqueta HTML.

Publica la raíz del repositorio en GitHub Pages, incluyendo `assets/`, `data/`, `images/` y los documentos. Las rutas también funcionan cuando el sitio se aloja bajo una subcarpeta como `/Portafolio/`.
