# Markdown teleprompter

Open source browser teleprompter by [soltrinox](https://github.com/soltrinox),
licensed under [Apache 2.0](LICENSE). Requires Node.js 22.12 or newer for development.

Vite + vanilla JavaScript + Tailwind: load `.md` / `.txt`, render Markdown with KaTeX math, outline on the right, and a teleprompter that advances up to **three words per step** during auto-play (clipped at sentence and block boundaries). **Prev/Next** buttons and **Page Up/Down** jump by **sentence** (one segment at a time). The **active sentence** (or whole list item) gets a subtle full-line highlight (including spaces and punctuation between words in each text run); the last word in each phrase is emphasized in green. Sentence detection uses `Intl.Segmenter` when available, with a regex fallback - abbreviations like `e.g.` can split imperfectly.

Clicking an outline heading scrolls to that section and moves the teleprompter cursor to the section start (playback pauses so you can press Play from there). On desktop (`lg+`), the outline stays pinned beside the document while the main pane scrolls; the outline panel scrolls independently. Parent sections with subsections show a chevron (▶ collapsed, ▼ expanded) that toggles visibility without navigating.

## Development

```bash
npm install
npm run dev
```

Open the URL Vite prints (avoid `file://` so file input and modules work reliably).

## Math delimiters

- Inline: `$x^2 + y^2$`
- Display: `$$\int_0^1 x\,dx$$`

## Production build

```bash
npm run build
npm run preview
```

## Docker (Alpine nginx)

```bash
docker build -t markdown-teleprompter .
docker run --rm -p 8080:80 markdown-teleprompter
```

Then open `http://localhost:8080`.

## Keyboard shortcuts

Shortcuts are ignored while focus is in an input, textarea, select, or contenteditable field.

| Key | Action |
|-----|--------|
| Space | Play / pause |
| Page Down | Next sentence |
| Page Up | Previous sentence |
| Delete | Restart chapter (jump to current section start) |
| + (or =) | Speed up  -  fewer ms per phrase |
| − | Slow down  -  more ms per phrase |

## Tests

```bash
npm test
```

## Vercel deployment

The app runs entirely in the browser. Vercel builds it with Node.js and serves
its static output. Markdown file selection, drag and drop, speed controls,
chapter navigation, and math rendering work without a backend. Selected file
contents are read locally in the browser; the app does not upload them. Images
or links in a document can still request external resources. Local relative
image files are not uploaded alongside a selected Markdown document.

`vercel.json` sets the Vite framework, `npm ci` installation, `npm run build`
build command, and `dist` output directory. No environment variables are needed.

From this project folder, deploy a preview:

```bash
npx vercel
```

On first deployment, log in if prompted, select your Vercel account or team,
and create or select the teleprompter project. Use this folder as the project
root. After checking the preview, publish to production:

```bash
npx vercel --prod
```

For Git-based deployments, push this folder to a repository and import it in
Vercel. If it is inside a larger repository, set the Root Directory to
`markdown-teleprompter`. Vercel will use the included configuration.

Speed and outline preferences are stored per browser and site address. Settings
from localhost do not automatically transfer to the Vercel site.

## Core and professional development

The public core includes the playback engine, Markdown renderer, outline
navigation, and reference web app. See [ROADMAP.md](ROADMAP.md) for potential
professional features and [CONTRIBUTING.md](CONTRIBUTING.md) for contributions.
No account or paid service is required for current playback features.

## Browser verification

The browser suite tests the production build on desktop and mobile Chromium:
file loading, math, playback advancement and pause, speed persistence and
bounds, chapter/sentence navigation, and unsafe HTML removal.

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs unit tests, the production build, and browser tests on each
push and pull request. Chromium mobile emulation does not establish physical
mobile device or Safari support.
