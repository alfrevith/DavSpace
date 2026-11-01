# Certificates & Achievements

Edit **`data/credentials.json`**. Each object controls one card and its detail window. The two lists are independent. No JavaScript or HTML edits are needed to add or remove a record.

```json
{
  "id": "my-unique-record",
  "title": "Microsoft Excel Expert",
  "subtitle": "MOS · Microsoft 365 Apps",
  "year": "2026",
  "date": "2026-03-25",
  "description": "A factual description of the certificate or achievement.",
  "pdf": "certifications/Excel/MOS Excel Expert.pdf",
  "logo": "",
  "accent": "#79f2b0",
  "dialogAccent": "",
  "layout": "signal",
  "pending": false
}
```

- Add the object to `certificates` or `achievements`. Use a unique `id` with letters, numbers, hyphens or underscores.
- `title`, `subtitle`, `year` and `description` are the visible English content. `date` is an optional ISO date for sorting. Dated records appear newest first; pending records come last.
- `pdf` is a relative PDF path. Match spelling and capitalization exactly for GitHub Pages. An empty string displays a document-pending state.
- `logo` sets the image on both the card and its detail menu. Use a transparent PNG, WebP or SVG path, or `""` for no image. Excel entries already use `images/icons/Excel.png`. No filled logo background is added.
- `accent` controls each card's neon edges, soft light and hover treatment, and is also the default color of its menu. Use a full six-digit hex color, such as `"#79f2b0"`.
- `dialogAccent` optionally gives that record's menu a different neon color. Leave it empty (or omit it) to follow `accent`. Invalid colors safely fall back; another record's colors never carry over.
- `layout` can be `"signal"` (logo left, technical typography), `"orbit"` (logo right, curved details), or `"frame"` (editorial title and inset frame). All keep a consistent size and hierarchy. Omit it to automatically alternate styles.
- Long titles and subtitles use at most two lines on cards to preserve their proportions. The detail menu always shows the complete title and subtitle.
- `pending: true` explicitly labels an unfinished space. Replace its content and switch this to `false` when publishing a real achievement. Pending entries are excluded from the chat's factual knowledge.
- Remove an entire object to remove its card. Keep valid JSON: use double quotes and no trailing commas. An empty list displays a quiet empty state.

Both lanes loop automatically in opposite directions. Drag, swipe, arrow buttons and arrow keys work independently; each lane has its own persistent pause button. Automatic movement pauses on hover, keyboard focus, manual navigation, while a record is open, offscreen, and when the tab is hidden. Reduced-motion visitors get manual navigation.

`assets/css/credentials.css` contains only archive styles. `assets/js/credentials.js` handles data, carousels and the folio dialog. The PDF reader is shared with projects and loads only when a PDF record is opened. The chat reads the same JSON automatically.
