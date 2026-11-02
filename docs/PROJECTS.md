# Editing project details

All project-window content lives in `data/projects.js`. Each key matches a card's
`data-project` in `index.html`: `beyond`, `plant-bud`, `pot-c`, `cecam`, and
`pets-health`. Edit one entry without touching the window's HTML, styles, or logic.

```js
beyond: {
  title: "Beyond",
  logo: "images/Projects/beyond-logo.svg",
  logoWhiteBackground: false,
  logoDoubleSize: false,
  accent: "#93e7ff",
  status: "in-development",
  role: "Frontend developer",
  type: ["Web"],
  date: "2026",
  mode: "individual",
  technologies: ["HTML", "CSS", "JavaScript"],
  description: "Write the project description here.\nA new paragraph goes here.",
  pdf: "pdfs/beyond.pdf"
}
```

The values above illustrate the format; fill in the actual project information.

- `accent`: a six-digit hex color, such as `"#93e7ff"`. It controls this project's
  neon corners, ambient lighting, and title accents.
  Each project has its own color; missing or invalid colors use cyan.
- `logo`: an image next to the name inside the project window. Place a transparent
  PNG, WebP or SVG in `images/Projects/` and enter its path from the site root.
  Each project starts with `logo: ""`; empty, missing or broken images hide the
  logo space. Logos retain their proportions and use a transparent background by default.
  Paths and filenames must match case exactly for GitHub Pages.
- `status`: `"in-development"`, `"prototype"`, or `"completed"`.
- `logoDoubleSize`: set to `true` to double the menu logo from 72 to 144 px
  (56 to 112 px on mobile). Defaults to `false` and works with the white glow.
- `logoWhiteBackground`: set to `true` to add a soft white glow behind this
  project's menu logo. The compact rectangular light fades smoothly into the panel without
  a solid plate or border and preserves the logo's full size. Use it for black or dark logos.
  Defaults to `false` (transparent) when omitted; each project is independent.
- `mode`: `"individual"` or `"team"`.
- `type` and `technologies`: lists of independent labels.
- `date`: English text such as `"2026"` or `"January – March 2026"`.
- `description`: plain text. Use `\n\n` between paragraphs. HTML is displayed as text.
- `pdf`: put the PDF inside `pdfs/` and use its relative path. An HTTPS URL also
  works if the host permits embedding. Leave `""` to show the empty archive state.

Empty or removed fields have neutral English placeholders. Removing an entry
does not break other projects; its card still opens a minimal file using the
card's name, label, and year. To remove a project from the portfolio entirely,
remove its card from `index.html` as well. Keep cards ordered newest to oldest,
with Beyond first among the 2026 projects. The board's year and labels remain in
each card, so update them too if the project's year or category changes.

PDFs load only when their project opens, after the entrance animation, and are
connected to the five documents in `pdfs/`. A loading indicator shows actual
PDF.js download progress when the server supplies a total size, and an
indeterminate bar otherwise. It stays visible while the first page is prepared
and disappears after that page is painted; errors retain the external reader link.
The former decorative pending-document panel has been removed from both layouts.
PDFs are
unmounted when the window closes. The custom PDF.js reader has page navigation,
a page-number input, zoom, fit-to-width, and an expanded document layout. Arrow
keys navigate pages when the page viewport has focus. The single compact toolbar
includes **Open PDF**, which opens the full browser reader for text, links, searching,
printing, and other PDF features. Remote PDFs must permit cross-origin requests;
otherwise use the full reader link or a local PDF. Paths are case-sensitive on
GitHub Pages: `pdfs/Beyond.pdf` must match the actual filename exactly.

PDF.js 6.4.299 is hosted locally in `assets/pdfjs/`, including its worker, fonts,
CMaps, WebAssembly support files, and Apache 2.0 license. No CDN is required.
It is imported only when a PDF opens; only the current page is rendered, with
a bounded canvas resolution. `assets/js/project-pdf-viewer.js` manages the reader and
releases its rendering task and worker when the project closes.

The window closes with its close button, Escape, or a click outside its frame.
Left/right arrow keys and the two header buttons move between projects in board
order, looping at either end without closing the modal. Each change uses a short
directional slide and fade (disabled for reduced motion), resets the reading
position and releases the previous PDF and 3D viewer. PDFs load only after the
transition settles. Arrow keys inside the PDF page viewport still navigate PDF
pages; editable controls and the 3D viewer keep their own keyboard interactions.
POT-C alone also has an **Interactive 3D model** section. **Show 3D model** loads
`assets/3D/viewer.html` and `assets/3D/Basurero.glb` (filename case matters).
Drag to rotate, pinch or scroll to zoom, and use **Reset view** to reframe it.
**Hide 3D model** or closing the project destroys the isolated viewer document,
releasing its model and WebGL resources. Nothing from the 3D viewer loads before
the button is pressed, and each reopening starts hidden. Model Viewer 4.4.0 and
its Apache license are served locally from `assets/model-viewer/`; no CDN or build
step is required. The supplied GLB includes its textures and needs no decoder.

Keyboard focus is contained by the native dialog and returns to the project
card on close. Reduced-motion preferences disable the entrance and exit motion.

The opening unfolds from a central seam into the workspace, followed by the
illuminated contour, document, logo and staggered project details. The title's
brief color separation settles once; its decorative copies are hidden from
screen readers. All entrance effects finish automatically. Closing during the
entrance fades from its current pose. The corner lighting then stays static;
no cursor-following reflection covers the PDF.
PDF pages are rendered on an opaque white canvas without tinted overlays.
