# David Menjivar · Portfolio

Sitio estático compatible con GitHub Pages, sin backend ni compilación obligatoria.

## Dónde editar

| Contenido | Archivo o carpeta |
| --- | --- |
| Página principal, perfil y tarjetas de proyectos | `index.html` |
| Fichas de proyectos | [`data/projects.js`](data/projects.js) |
| Certificados, logros, logos y neón | [`data/credentials.json`](data/credentials.json) |
| Respuestas personales del chatbot | [`data/assistant-knowledge.json`](data/assistant-knowledge.json) |
| Comportamiento del sitio | `assets/js/` |
| Estilos | `assets/css/` |
| Imágenes e iconos | `images/` |
| PDFs de proyectos | `pdfs/` |
| PDFs de certificaciones | `certifications/` |
| Documentos de futuros logros | `achievements/` |
| Pruebas | `tests/` |

Las páginas de fotografía, dibujos, informática e historias permanecen en la raíz para conservar sus enlaces. `assets/photography/`, `assets/drawings/` y `assets/informatics/` quedan disponibles para el contenido de esas galerías.

Las rutas de imágenes y PDFs escritas en los datos se calculan desde la raíz del sitio: por ejemplo, `images/icons/Excel.png`, **sin** anteponer `../` por estar el JSON en `data/`. Respeta mayúsculas y minúsculas para GitHub Pages.

Las imágenes de reserva están en `images/backgrounds/`. Son fotografías distintas, conservadas con nombres descriptivos. El fondo actual sigue en `images/hero-contours.webp`.

## Guías

- [Editar proyectos](docs/PROJECTS.md)
- [Editar certificados y logros](docs/CREDENTIALS.md)
- [Enseñar respuestas al chatbot](docs/ASSISTANT.md)

## Revisar localmente

Sirve esta carpeta con un servidor estático, por ejemplo Live Server. El chat y los carruseles consultan archivos con `fetch`, así que abrir el HTML mediante `file://` no basta para comprobar todas las funciones.

Con Node.js 22 o posterior:

```sh
npm ci
npm test
```

Las dependencias de npm se utilizan para desarrollo y pruebas. `node_modules/` está ignorado por Git y no se publica. El lector PDF usa la distribución local de PDF.js en `assets/pdfjs/`; sus fuentes, CMaps, worker, archivos WASM y licencia son necesarios para admitir distintos documentos.

## Publicación

Publica la raíz del repositorio en GitHub Pages, incluyendo `assets/`, `data/`, `images/` y los documentos. Las rutas también funcionan cuando el sitio se aloja bajo una subcarpeta como `/Portafolio/`.

Pendiente ya existente: `data/projects.js` apunta a `pdfs/Beyond.pdf`, pero ese archivo no está en la carpeta actual. Añadir el PDF con ese nombre exacto resuelve esa ruta y su prueba; la reorganización conserva la configuración.
