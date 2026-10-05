# Contributing

Use Node.js 22.12 or newer and install dependencies with `npm ci`.

Before opening a pull request, run:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Describe the user-facing change and include relevant test coverage. Keep pull
requests focused. Use synthetic documents in tests and examples. Do not commit
private scripts, secrets, generated builds, or browser test artifacts.

Use ASCII hyphens instead of em dashes in source and documentation.
Contributions submitted for inclusion are licensed under Apache 2.0.
