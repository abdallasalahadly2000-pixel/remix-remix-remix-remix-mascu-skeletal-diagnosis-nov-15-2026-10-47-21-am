# Mascu-Skeletal Diagnosis — Running Locally in VS Code

## Option 1: Open `index.html` Directly in VS Code (Live Server / Browser)

1. Open `index.html` in VS Code and click **Go Live** (Live Server), or open `index.html` directly in your browser.
2. `index.html` automatically loads the pre-built standalone bundle (`./standalone/app.iife.js` and `./standalone/app.css`), so the full page renders on your screen immediately without needing terminal commands.

## Option 2: Run Full-Stack Dev Server (`npm` / **F5**)

1. Press **F5** in VS Code (or run `npm install && npm run dev` in the VS Code Terminal).
2. Open **http://localhost:3000**.

## Rebuilding After Edits

If you edit TypeScript/React files in `src/` and want Live Server (`index.html`) updated too, run:

```bash
npm run build:standalone
```
