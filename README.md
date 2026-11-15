# Offline Markdown Viewer (OMV)

Offline Markdown and Mermaid viewer for Chromium browsers (Chrome, Microsoft Edge, Vivaldi…). Manifest V3 extension, 100% local and self-contained: no network, no account, no telemetry, no external dependencies.

Author: FroggyBit Labs

The interface follows the language of the browser: English, French, Spanish and German (English when the browser language is not translated).

## Installation

1. Open `chrome://extensions` (Edge: `edge://extensions`, Vivaldi: `vivaldi://extensions`).
2. Turn on **Developer mode**.
3. **Load unpacked** and choose this folder.
4. In the extension's details, turn on **Allow access to file URLs**.

## Usage

- Open a `.md`, `.markdown` or `.mdown` file over `file:///`: it is rendered automatically.
- If the browser downloads the file instead of showing it, click the extension icon: reading page with a file picker and drag and drop (relative images are not resolved there).
- Toolbar: Source/Rendered, light/dark theme, **Appearance**, print. Automatic side table of contents, Copy button on code blocks, YAML front matter shown as a block.

## Security and sovereignty

- One permission only: `storage` (appearance settings and pins saved locally in the browser). No host access, no `fetch`, no telemetry.
- Libraries bundled in `vendor/` (no CDN), pinned versions, integrity checked at import (see `vendor/VENDOR.md`).
- Content sanitized by DOMPurify (scripts, iframes, forms, styles and event handlers removed); Mermaid in `securityLevel: strict`.
- `file://` pages: an injected CSP forbids any remote resource (`default-src 'none'`, `file:`/`data:` images only).
- Remote resources neutralized in the content (images, video, audio, posters, backgrounds); Mermaid `%%{init}%%` directives cannot inject CSS or fonts.
- Viewer page: extension CSP `default-src 'none'`, `script-src 'self'`, `connect-src 'none'`, local media and images only.
- External links use `noopener noreferrer`.

## Customization and accessibility

**Appearance** panel (settings saved locally):

- Grouped presets: Classic (Light, Dark, Sepia), Soft light (Mist, Ocean, Rosé), Soft dark (Nord, Forest, Twilight, Coffee), Accessibility (High contrast, Yellow on black, Comfort), or Custom (9 colors of your choice, also applied to Mermaid diagrams).
- Text size (12 to 32 px), line spacing, content width, font including "Readability" (Verdana/Tahoma), increased spacing (WCAG 1.4.12).
- Live contrast indicator (WCAG AA ratios 4.5:1 and 3:1) with explicit text, not relying on color alone.
- Full keyboard navigation, visible focus, "Skip to content" link, Escape closes the panel, ARIA landmarks (table of contents, main content).
- Mermaid: diagram exposed as an image with a text alternative (collapsible diagram code); errors are announced.
- Honors `prefers-contrast`, `prefers-reduced-motion`, `prefers-color-scheme` and the Windows forced-colors mode.

## Line numbers and pins

- **Lines**: shows the line numbers of the source file (rendered text, list items, table rows, code block lines, and the Source view). Numbers are not copied with the code.
- **Pin**: clicking a number sets a pin (📌, accent bar and background, not color alone). Granularity: list item, table row, paragraph, heading or code block; in the **Source** view, every exact line.
- **Pins (n)**: list of the document's pins, with direct access and removal. **Resume** goes back to the last pin set.
- Keyboard: a single tab stop in the number column, up/down arrows, Home/End to navigate, Enter/Space to pin.
- Pins are saved locally per document: the file path over `file://`; in the viewer page, the file name plus its first non-empty line (usually the title), which survives edits to the file while keeping two `README.md` files of different projects apart. If the file is edited, lines may shift.
- Settings and pins are synchronized between open tabs: a change made in one tab is not overwritten by another.

## Languages

Texts live in `_locales/<language>/messages.json` and follow the browser's UI language (`chrome.i18n`): `en` (default), `fr`, `es`, `de`. To add a language, copy `_locales/en/messages.json` to a new folder named with the language code and translate the `message` values; keep the `$P1$`-style placeholders.

## Limitations

- Tests: an end-to-end check (rendering, anchors, blocked remote resources, pins, synchronization between tabs, printing, invalid files) was run in Edge. Chrome and Vivaldi remain to be validated manually with `example.md`. There is no automated test suite in the repository.
- No syntax highlighting for code.
- Mermaid (5.5 MB) is loaded for every `.md` file: slight delay on opening.

## License

OMV's code is released under the MIT license (see `LICENSE`), holder: FroggyBit Labs.

The libraries bundled in `vendor/` (marked, DOMPurify, Mermaid) keep their own licenses, provided next to each library (`vendor/LICENSE-*.txt`).
