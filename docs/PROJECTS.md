# Editing project details

All project-window content lives in `data/projects.js`. Each key matches a card's
`data-project` in `index.html`: `beyond`, `plant-bud`, `pot-c`, `cecam`, and
`pets-health`. Edit one entry without touching the window's HTML, styles, or logic.

```js
beyond: {
  title: "Beyond",
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
- `status`: `"in-development"`, `"prototype"`, or `"completed"`.
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
Keyboard focus is contained by the native dialog and returns to the project
card on close. Reduced-motion preferences disable the entrance and exit motion.

The title's brief glitch plays once when the file opens. Its decorative text
copies are hidden from screen readers. The corner lighting stays static; no cursor-following reflection covers the PDF.
PDF pages are rendered on an opaque white canvas without tinted overlays.
