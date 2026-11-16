# Offline Markdown Viewer

Offline Markdown and Mermaid viewer for Chromium browsers (Chrome, Microsoft Edge, Vivaldi…). Manifest V3 extension, local by default: remote images are blocked unless you explicitly allow some sites. No account, no telemetry, no external dependencies.

Author: FroggyBit Labs

The interface follows the language of the browser: English, French, Spanish and German (English when the browser language is not translated).

## No remote dependencies

The extension is self-contained. Everything it needs is bundled in it: no CDN, no remote code, no online service, no account, no telemetry. Nothing is downloaded when you install it or when you use it (updates come from the store you installed it from, like any extension; the extension itself never checks for them).

The only connections that can ever happen are the ones your own documents ask for, such as a remote image in a Markdown file, and only if you choose to allow them, site by site (see "Remote images" below). The dependencies of the content you read are yours to decide, not the tool's.

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
- Content sanitized by DOMPurify (scripts, iframes, forms, styles and event handlers removed); Mermaid in `securityLevel: strict`, with labels drawn as plain SVG text (no HTML labels, locked against `%%{init}%%` directives). A rendered diagram is cleaned in an inert template before it enters the page: no image, frame or external reference can load from a diagram.
- `file://` pages: an injected CSP forbids any remote resource (`default-src 'none'`; images only from `file:`, `data:` and, if you turned it on, the sites you list in "Remote images").
- Remote resources neutralized in the content (images, video, audio, posters, backgrounds); the only exception is an image from your own allow-list (see "Remote images" below). Mermaid `%%{init}%%` directives cannot inject CSS or fonts.
- Local images: on `file://` pages, relative paths and local absolute paths (`file:///C:/x.png`, `C:\x.png`, `C:/x.png`) are displayed, since they never touch the network. Network shares (`\\nas01\photos\image001.jpg`, `file://nas01/photos/image001.jpg`) are blocked unless you list that server yourself in "Remote images" (see below): requesting one makes Windows send the user's sign-in details (NTLM) to the server. On the viewer page (toolbar icon), only embedded `data:` images can be shown; other local images get a placeholder suggesting to open the file directly in the browser.
- Viewer page: extension CSP `default-src 'none'`, `script-src 'self'`, `connect-src 'none'`, local media and images only.
- External links use `noopener noreferrer`.

## Remote images (off by default)

Remote images are blocked and shown as a placeholder. If you want some of them, you can unlock them yourself, on purpose:

- The **Remote images** toolbar button opens a panel with a switch, a list of allowed sites (one per line) and a consent checkbox. Nothing is allowed until you list at least one site: there is no "allow everything".
- Accepted entries: `https://example.org`, `https://*.example.org` (sub-domains), `https://example.org/images/` (path prefix), `http://192.168.1.10:8080`, and network folders such as `\\nas01\photos\` (see below). Only `http://` and `https://`; a `*` only at the start of a host name; anything else is refused with a message, never ignored silently.
- **For web addresses, the browser enforces the list, not only the extension**: the same list is written into the page's Content-Security-Policy, so any other address is refused by the browser itself, even if the code were bypassed.
- Available for Markdown files opened directly in the browser (`file://` addresses). The viewer page (toolbar icon) cannot enforce a per-site list, so remote images stay blocked there.
- Allowed images are requested without a referrer. The listed sites see your IP address and when you open the document, like any website you visit, and your browser may send them the cookies it already holds for them.
- **Network folders** (for example images on a company file server): list the server or folder as `\\nas01\photos\` and write the image as `\\nas01\photos\image001.jpg` (in Markdown, in HTML, or as a `file://` address). A second consent box appears for them, because Windows may send your sign-in details to a listed server: list only servers you trust. Unlike web addresses, a network folder cannot be enforced by the Content-Security-Policy (a CSP cannot tell a network share from a local file), so for these the extension's own code is the only check: a server or folder that is not on your list is never requested, but a bypass of the code would not be stopped by the browser. A path that contains spaces must be written between angle brackets, as Markdown requires: `![x](<\\nas01\my photos\a.jpg>)`. Image syntax shown inside code (code spans, code blocks, quotes, lists) is never rewritten. A mapped drive letter (`Z:\...`) is simply a local path and needs no entry.
- The consent boxes are asked when you turn the option on and whenever you add a site or a network folder; a list you have not changed is not asked about again.
- The setting is stored under its own key (`omv-net`) and can be turned off at any time from the same panel.

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

The code is released under the MIT license (see `LICENSE`), holder: FroggyBit Labs.

The libraries bundled in `vendor/` (marked, DOMPurify, Mermaid) keep their own licenses, provided next to each library (`vendor/LICENSE-*.txt`).
