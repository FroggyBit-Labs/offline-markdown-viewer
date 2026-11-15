'use strict';

// Rendering engine shared by the file:// page and the viewer page.
// Pipeline: marked (GFM) -> DOMPurify (sanitizing) -> Mermaid (securityLevel strict).
// User-visible texts come from msg() (see i18n.js and _locales/).
(function (global) {
  // Remote resources: any scheme other than file:, data: or blob:, protocol-relative URLs (//host)
  // and UNC paths (\\host, including mixes of / and \). Only relative paths and those three schemes
  // stay allowed. The value is normalized first, the way the browser's URL parser does it
  // (tabs and line breaks removed everywhere, control characters and spaces stripped at the start),
  // otherwise "ht&#9;tps://host" would slip past the test and still be fetched.
  const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
  const LOCAL_SCHEMES = /^(?:file|data|blob)$/i;
  function normalizeUrl(val) {
    return String(val).replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+/, '');
  }
  function isRemote(val) {
    const v = normalizeUrl(val);
    if (/^[\\/]{2}/.test(v)) return true;
    const m = SCHEME.exec(v);
    return !!m && !LOCAL_SCHEMES.test(m[1]);
  }
  // Ids set by the interface: a heading of the document must never reuse them.
  const RESERVED_IDS = ['mdr-content', 'mdr-panel', 'mdr-pins'];
  const FRONT = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
  const MEDIA_ATTRS = ['src', 'poster', 'background'];
  let mermaidCounter = 0;

  function own(obj, key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key); }

  // ---------- Customization ----------
  const KEY = 'omv-settings';
  const PINS_KEY = 'omv-pins';
  const MAX_PINS_PER_DOC = 200;
  const MAX_DOCS = 100;
  const COLORS = ['bg', 'fg', 'muted', 'border', 'soft', 'link', 'accent', 'codebg', 'codefg'];
  // Labels of colors, presets, groups and fonts are looked up as color_<k>, preset_<k>, font_<k>.
  const PRESETS = {
    light: { bg: '#ffffff', fg: '#1f2328', muted: '#57606a', border: '#8c959f', soft: '#f6f8fa', link: '#0b5cad', accent: '#1f4e79', codebg: '#f6f8fa', codefg: '#1f2328' },
    dark: { bg: '#0d1117', fg: '#e6edf3', muted: '#9198a1', border: '#6e7681', soft: '#161b22', link: '#58a6ff', accent: '#79b8ff', codebg: '#010409', codefg: '#e6edf3' },
    sepia: { bg: '#f4ecd8', fg: '#433422', muted: '#6b5b45', border: '#9c8a68', soft: '#ebe0c6', link: '#7a3f06', accent: '#6b3e0a', codebg: '#ebe0c6', codefg: '#433422' },
    contrast: { bg: '#000000', fg: '#ffffff', muted: '#d0d0d0', border: '#ffffff', soft: '#1a1a1a', link: '#6cb6ff', accent: '#ffd33d', codebg: '#000000', codefg: '#ffffff' },
    yellow: { bg: '#000000', fg: '#ffff00', muted: '#ffff99', border: '#ffff00', soft: '#1a1a00', link: '#00ffff', accent: '#ffffff', codebg: '#000000', codefg: '#ffff00' },
    soft: { bg: '#fdf6e3', fg: '#1a1a1a', muted: '#4a4a4a', border: '#8a7d5e', soft: '#f3e9cc', link: '#00508c', accent: '#003a66', codebg: '#f3e9cc', codefg: '#1a1a1a' },
    // Soft themes: all checked against at least WCAG AA (text 4.5:1, borders 3:1)
    brume: { bg: '#f1f4f8', fg: '#1e293b', muted: '#475569', border: '#7b8ba0', soft: '#e2e8f0', link: '#1d4ed8', accent: '#1e40af', codebg: '#e8edf3', codefg: '#1e293b' },
    ocean: { bg: '#f0f7f7', fg: '#153238', muted: '#3f5f66', border: '#6f969c', soft: '#dfeeee', link: '#006d77', accent: '#00535b', codebg: '#e0eeee', codefg: '#153238' },
    rose: { bg: '#fff7f6', fg: '#3b2528', muted: '#6b4a4f', border: '#a8838a', soft: '#fbe7e8', link: '#a3243b', accent: '#861c2f', codebg: '#f8e4e5', codefg: '#3b2528' },
    nord: { bg: '#2e3440', fg: '#eceff4', muted: '#aab4c8', border: '#7384a0', soft: '#3b4252', link: '#88c0d0', accent: '#81a1c1', codebg: '#242933', codefg: '#e5e9f0' },
    foret: { bg: '#1b2420', fg: '#e3ece6', muted: '#a9bdb0', border: '#6a8574', soft: '#25322b', link: '#7fd1a0', accent: '#9be3b8', codebg: '#131b17', codefg: '#e3ece6' },
    crepuscule: { bg: '#1e1b2e', fg: '#e8e6f5', muted: '#b3aed0', border: '#7a75a3', soft: '#2a2640', link: '#b4a7ff', accent: '#c9bfff', codebg: '#15131f', codefg: '#e8e6f5' },
    cafe: { bg: '#231d19', fg: '#f0e6dc', muted: '#b8a899', border: '#85746a', soft: '#2e2621', link: '#e6a86c', accent: '#f0c28f', codebg: '#19140f', codefg: '#f0e6dc' }
  };
  const GROUPS = [
    ['group_classic', ['light', 'dark', 'sepia']],
    ['group_soft_light', ['brume', 'ocean', 'rose']],
    ['group_soft_dark', ['nord', 'foret', 'crepuscule', 'cafe']],
    ['group_a11y', ['contrast', 'yellow', 'soft']]
  ];
  const FONTS = {
    sans: 'system-ui, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
    legible: 'Verdana, Tahoma, "Trebuchet MS", sans-serif'
  };
  const HEX = /^#[0-9a-f]{6}$/i;

  function clamp(v, min, max, def) {
    v = Number(v);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;
  }

  function defaultPreset() {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // System preset: high contrast if requested, otherwise light/dark.
  function systemPreset() {
    return matchMedia('(prefers-contrast: more)').matches ? 'contrast' : defaultPreset();
  }

  function defaults() {
    return normalize({ preset: systemPreset() });
  }

  // Every value read from storage is validated again before it reaches the CSS or Mermaid
  // (own keys only: no constructor, toString, etc.).
  function normalize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const preset = (own(PRESETS, raw.preset) || raw.preset === 'custom') ? raw.preset : 'light';
    const base = PRESETS[own(PRESETS, preset) ? preset : 'light'];
    const colors = {};
    for (const k of COLORS) {
      const v = raw.colors && raw.colors[k];
      colors[k] = (preset === 'custom' && typeof v === 'string' && HEX.test(v)) ? v.toLowerCase() : base[k];
    }
    return {
      preset,
      colors,
      fontSize: clamp(raw.fontSize, 12, 32, 16),
      lineHeight: clamp(raw.lineHeight, 13, 25, 16),   // x10
      width: clamp(raw.width, 500, 1600, 900),
      font: own(FONTS, raw.font) ? raw.font : 'sans',
      spacing: raw.spacing === true,
      lineNumbers: raw.lineNumbers === true
    };
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try { chrome.storage.local.get(key, (r) => resolve(r ? (key === null ? r : r[key]) : undefined)); } catch (e) { resolve(undefined); }
    });
  }
  function storageSet(key, value) {
    return new Promise((resolve) => {
      try { chrome.storage.local.set({ [key]: value }, () => resolve()); } catch (e) { resolve(); /* storage unavailable */ }
    });
  }
  function storageRemove(keys) {
    return new Promise((resolve) => {
      try { chrome.storage.local.remove(keys, () => resolve()); } catch (e) { resolve(); }
    });
  }
  // Writes from one tab run one after the other, in call order.
  let writeChain = Promise.resolve();
  function queueWrite(task) {
    writeChain = writeChain.then(task, task);
    return writeChain;
  }

  async function loadSettings() {
    const raw = await storageGet(KEY);
    return raw ? normalize(raw) : defaults();
  }
  function saveSettings(s) { return queueWrite(() => storageSet(KEY, normalize(s))); }

  // Pins: one storage key per document ("omv-pins:<document>" -> [ { line, text, t } ]).
  // Two tabs on two different documents therefore never write the same key.
  function pinsKey(docKey) { return PINS_KEY + ':' + docKey; }
  function cleanPins(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => p && Number.isInteger(p.line) && p.line > 0)
      .map((p) => ({ line: p.line, text: String(p.text || '').slice(0, 120), t: Number(p.t) || 0 }))
      .slice(0, MAX_PINS_PER_DOC);
  }
  async function loadPins(docKey) {
    return cleanPins(await storageGet(pinsKey(docKey)));
  }
  function savePins(docKey, pins) {
    const key = pinsKey(docKey);
    const value = cleanPins(pins);
    return queueWrite(async () => {
      if (!value.length) return storageRemove(key);
      await storageSet(key, value);
      // Beyond MAX_DOCS documents, the least recently used ones are forgotten.
      const all = (await storageGet(null)) || {};
      const keys = Object.keys(all).filter((k) => k.startsWith(PINS_KEY + ':'));
      if (keys.length > MAX_DOCS) {
        const lastUse = (k) => Math.max(0, ...cleanPins(all[k]).map((p) => p.t));
        const old = keys.filter((k) => k !== key).sort((a, b) => lastUse(a) - lastUse(b)).slice(0, keys.length - MAX_DOCS);
        if (old.length) await storageRemove(old);
      }
    });
  }

  function channel(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  }
  function isDarkColor(hex) { return luminance(hex) < 0.18; }
  function ratio(a, b) {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  // ---------- Sanitizing ----------
  const PURIFY_CFG = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'option', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'script'],
    // data-line / data-first / data-ln are reserved for line numbering: forbidden in the content.
    FORBID_ATTR: ['style', 'srcset', 'data-line', 'data-first', 'data-ln']
  };

  let hooked = false;
  function installHooks() {
    if (hooked) return;
    hooked = true;
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        const href = normalizeUrl(node.getAttribute('href') || '');
        if (/^https?:/i.test(href) || /^[\\/]{2}/.test(href)) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
          if (!node.hasAttribute('title')) node.setAttribute('title', msg('link_external'));
        }
      }
      // Every remote resource is neutralized (images, video, audio, sources, posters, backgrounds).
      for (const attr of MEDIA_ATTRS) {
        const val = node.getAttribute(attr);
        if (val !== null && isRemote(val)) {
          node.removeAttribute(attr);
          node.classList.add('mdr-blocked');
          node.setAttribute('title', msg('blocked_remote', val));
        }
      }
      if (node.id && RESERVED_IDS.includes(node.id)) node.removeAttribute('id');
      if (node.tagName === 'IMG' && !node.hasAttribute('alt')) node.setAttribute('alt', '');
      if (node.tagName === 'INPUT') {
        if (node.getAttribute('type') === 'checkbox') {
          node.setAttribute('disabled', '');
          node.setAttribute('aria-label', msg(node.hasAttribute('checked') ? 'task_done' : 'task_todo'));
        } else node.remove();
      }
    });
  }

  // GitHub-style anchors: lowercase, accents kept, punctuation removed (except - and _),
  // each space becomes a hyphen; duplicates numbered -1, -2...
  function slugify(text, used) {
    const base = text.toLowerCase().trim()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, '').replace(/\s/g, '-') || 'section';
    let id = base, n = 0;
    while (used.has(id)) id = base + '-' + (++n);
    used.add(id);
    return id;
  }

  // ---------- Block rendering with source line numbers ----------
  function countNl(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
    return n;
  }

  // "Pinnable" elements carry data-line (line of the source file).
  // A list is not annotated itself: only its items are (line granularity).
  function annotateList(list, tok, line) {
    const lis = Array.from(list.children).filter((c) => c.tagName === 'LI');
    let ln = line;
    tok.items.forEach((item, i) => {
      const li = lis[i];
      if (li) {
        li.dataset.line = ln;
        const nested = li.querySelectorAll(':scope > ul, :scope > ol');
        let k = 0, off = 0;
        for (const t of item.tokens || []) {
          if (t.type === 'list' && nested[k]) annotateList(nested[k++], t, ln + off);
          off += countNl(t.raw || '');
        }
      }
      ln += countNl(item.raw || '');
    });
  }

  function annotateTable(table, line) {
    const head = table.querySelector('thead tr');
    if (head) head.dataset.line = line;
    table.querySelectorAll('tbody tr').forEach((tr, j) => { tr.dataset.line = line + 2 + j; });
  }

  function annotate(el, tok, line) {
    if (tok.type === 'list' && /^(UL|OL)$/.test(el.tagName)) annotateList(el, tok, line);
    else if (tok.type === 'table' && el.tagName === 'TABLE') annotateTable(el, line);
    else {
      el.dataset.line = line;
      if (tok.type === 'code' && el.tagName === 'PRE') {
        el.dataset.first = line + (/^ {0,3}(```|~~~)/.test(tok.raw || '') ? 1 : 0);
      }
    }
  }

  // HTML element expected for each Markdown block type (null: raw HTML block, any element will do).
  function expectedTag(tok) {
    switch (tok.type) {
      case 'heading': return 'H' + tok.depth;
      case 'paragraph': return 'P';
      case 'list': return tok.ordered ? 'OL' : 'UL';
      case 'table': return 'TABLE';
      case 'code': return 'PRE';
      case 'blockquote': return 'BLOCKQUOTE';
      case 'hr': return 'HR';
      default: return null;
    }
  }

  // The document is sanitized in one go: an HTML block wrapping Markdown (<details>,
  // <div align="center">...) keeps its structure. An empty marker with a random attribute name
  // precedes each block to recover its source line, then it is removed.
  // The HTML parser can move a marker (for example out of a hand-written <table>):
  // the next element is only annotated if it matches the block type and has not been annotated yet.
  // Better a line without a number than a pin set on the wrong element.
  function renderBlocks(text, article) {
    const m = FRONT.exec(text);
    if (m) text = '```yaml\n' + m[1] + '\n```\n' + text.slice(m[0].length);   // same number of lines
    const opts = { gfm: true, breaks: false };
    const tokens = marked.lexer(text, opts);
    const attr = 'data-omv-' + Math.random().toString(36).slice(2, 10);
    const parts = [];
    const blocks = [];
    let line = 1;
    for (const tok of tokens) {
      if (tok.type !== 'space' && tok.type !== 'def') {
        parts.push('<span ' + attr + '="' + blocks.length + '"></span>');
        blocks.push({ tok, line });
      }
      parts.push(marked.parser([tok], opts));
      line += countNl(tok.raw || '');
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = DOMPurify.sanitize(parts.join(''), PURIFY_CFG);   // HTML sanitized by DOMPurify
    const marks = Array.from(tpl.content.querySelectorAll('[' + attr + ']'));
    const done = new WeakSet();
    marks.forEach((mark) => {
      const info = blocks[Number(mark.getAttribute(attr))];
      // A marker followed by another marker: the block produced no element (HTML comment,
      // block moved by the parser). Annotate nothing rather than aim at the next block.
      const target = mark.nextElementSibling;
      if (info && target && !target.hasAttribute(attr) && !done.has(target)) {
        const want = expectedTag(info.tok);
        const ok = want === null || target.tagName === want;
        if (ok) { annotate(target, info.tok, info.line); done.add(target); }
      }
    });
    marks.forEach((mark) => mark.remove());
    article.replaceChildren(tpl.content);
  }

  // Line numbering in code blocks (plain text: copy and paste stays intact).
  function numberCode(article) {
    article.querySelectorAll('pre[data-first] > code').forEach((code) => {
      const first = Number(code.parentElement.dataset.first);
      const lines = code.textContent.replace(/\n$/, '').split('\n');
      const frag = document.createDocumentFragment();
      lines.forEach((l, i) => {
        const s = document.createElement('span');
        s.className = 'mdr-cl';
        s.dataset.ln = String(first + i);
        s.textContent = l + '\n';
        frag.append(s);
      });
      code.replaceChildren(frag);
    });
  }

  // ---------- Mermaid ----------
  function mermaidConfig(c, fontFamily) {
    return {
      startOnLoad: false,
      securityLevel: 'strict',
      // Keys that a %%{init}%% directive of the document cannot change (no CSS or font injected).
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges',
        'themeCSS', 'themeVariables', 'fontFamily', 'altFontFamily'],
      theme: 'base',
      fontFamily: fontFamily,
      themeVariables: {
        darkMode: isDarkColor(c.bg),
        background: c.bg,
        primaryColor: c.soft,
        primaryTextColor: c.fg,
        primaryBorderColor: c.accent,
        secondaryColor: c.soft,
        tertiaryColor: c.bg,
        lineColor: c.fg,
        textColor: c.fg,
        titleColor: c.fg,
        edgeLabelBackground: c.bg,
        clusterBkg: c.soft,
        clusterBorder: c.border,
        noteBkgColor: c.soft,
        noteTextColor: c.fg,
        noteBorderColor: c.border
      }
    };
  }

  // isStale(): true if a newer render has started; we then stop without touching the DOM.
  async function renderMermaid(article, settings, isStale) {
    const blocks = article.querySelectorAll('pre > code.language-mermaid');
    if (!blocks.length) return;
    mermaid.initialize(mermaidConfig(settings.colors, FONTS[settings.font]));
    let n = 0;
    for (const code of blocks) {
      if (isStale()) return;
      n++;
      const pre = code.parentElement;
      const holder = document.createElement('figure');
      holder.className = 'mdr-mermaid';
      if (pre.dataset.line) holder.dataset.line = pre.dataset.line;
      const id = 'mdr-m-' + (++mermaidCounter);
      try {
        const { svg } = await mermaid.render(id, code.textContent);
        const box = document.createElement('div');
        box.innerHTML = svg;
        const s = box.querySelector('svg');
        if (s) {
          s.setAttribute('role', 'img');
          s.setAttribute('aria-label', msg('mermaid_aria', n));
        }
        holder.append(box);
        const det = document.createElement('details');
        det.className = 'mdr-alt';
        const sum = document.createElement('summary');
        sum.textContent = msg('mermaid_alt_summary', n);
        const alt = document.createElement('pre');
        alt.textContent = code.textContent;
        det.append(sum, alt);
        holder.append(det);
      } catch (e) {
        const stale = document.getElementById('d' + id);
        if (stale) stale.remove();
        holder.classList.add('mdr-mermaid-error');
        const err = document.createElement('p');
        err.setAttribute('role', 'alert');
        err.textContent = msg('mermaid_invalid', String((e && e.message) || e).split('\n')[0]);
        holder.append(err, pre.cloneNode(true));
      }
      if (isStale()) return;
      pre.replaceWith(holder);
    }
  }

  // ---------- Page elements ----------
  // Ids already present in the document (hand-written HTML) are kept and reserved;
  // the other headings (h1 to h6) get an anchor. The table of contents stops at h4.
  function buildToc(article, nav) {
    const used = new Set(RESERVED_IDS);
    article.querySelectorAll('[id]').forEach((n) => used.add(n.id));
    nav.replaceChildren();
    article.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      if (!h.id) h.id = slugify(h.textContent, used);
      if (!/^H[1-4]$/.test(h.tagName)) return;
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.className = 'lvl' + h.tagName.slice(1);
      nav.appendChild(a);
    });
    nav.hidden = nav.children.length < 2;
  }

  function addCopyButtons(article) {
    article.querySelectorAll('pre').forEach((pre) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mdr-copy';
      btn.textContent = msg('copy');
      btn.setAttribute('aria-label', msg('copy_aria'));
      btn.addEventListener('click', () => {
        const done = (label) => { btn.textContent = label; setTimeout(() => { btn.textContent = msg('copy'); }, 1500); };
        const code = pre.querySelector('code');
        const txt = code ? code.textContent : Array.from(pre.childNodes).filter((n) => n !== btn).map((n) => n.textContent).join('');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(() => done(msg('copied')), () => done(msg('copy_failed')));
        } else done(msg('copy_failed'));
      });
      pre.appendChild(btn);
    });
  }

  function el(tag, props, children) {
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    (children || []).forEach((c) => n.append(c));
    return n;
  }

  function field(label, control) {
    return el('label', { className: 'mdr-field' }, [el('span', { textContent: label }), control]);
  }

  // Short text of a node for the pin list, without the "Copy" buttons of code blocks.
  function snippet(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.mdr-copy').forEach((b) => b.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function decodeSafe(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  // ---------- Mounting ----------
  // A new mount on the same root releases the previous one (listeners, observer, memory).
  const mounted = new WeakMap();

  async function mount(root, text, opts) {
    opts = opts || {};
    installHooks();
    const previous = mounted.get(root);
    if (previous) previous();
    const ac = new AbortController();
    const listen = { signal: ac.signal };
    let observer = null;
    let onStorage = null;
    let generation = 0;
    const dispose = () => {
      ac.abort();
      if (observer) observer.disconnect();
      if (onStorage) { try { chrome.storage.onChanged.removeListener(onStorage); } catch (e) { /* unavailable */ } }
      generation++;                    // invalidates a Mermaid render still in progress
      if (mounted.get(root) === dispose) mounted.delete(root);
    };
    mounted.set(root, dispose);

    const settings = await loadSettings();
    const docKey = opts.docKey || opts.fileName || 'document';
    let pins = await loadPins(docKey);
    if (ac.signal.aborted) return;     // replaced while the settings were loading

    root.className = 'mdr';
    root.lang = uiLang();
    root.replaceChildren();

    const skip = el('a', { className: 'mdr-skip', href: '#mdr-content', textContent: msg('skip_link') });

    // Toolbar
    const title = el('span', { className: 'mdr-title', textContent: opts.fileName || 'Markdown' });
    const btnResume = el('button', { type: 'button', textContent: msg('btn_resume') });
    btnResume.title = msg('btn_resume_title');
    const btnPins = el('button', { type: 'button' });
    btnPins.setAttribute('aria-expanded', 'false');
    btnPins.setAttribute('aria-controls', 'mdr-pins');
    const btnNum = el('button', { type: 'button', textContent: msg('btn_lines') });
    btnNum.title = msg('btn_lines_title');
    const btnSrc = el('button', { type: 'button', textContent: msg('btn_source') });
    const btnTheme = el('button', { type: 'button' });
    const btnLook = el('button', { type: 'button', textContent: msg('btn_appearance') });
    btnLook.setAttribute('aria-expanded', 'false');
    btnLook.setAttribute('aria-controls', 'mdr-panel');
    const btnPrint = el('button', { type: 'button', textContent: msg('btn_print') });
    btnPrint.addEventListener('click', () => window.print());
    const bar = el('header', { className: 'mdr-bar' }, [title, btnResume, btnPins, btnNum, btnSrc, btnTheme, btnLook, btnPrint]);

    // Appearance panel
    const selPreset = el('select');
    GROUPS.forEach(([groupKey, keys]) => {
      const og = el('optgroup', { label: msg(groupKey) });
      keys.forEach((k) => og.append(el('option', { value: k, textContent: msg('preset_' + k) })));
      selPreset.append(og);
    });
    selPreset.append(el('option', { value: 'custom', textContent: msg('preset_custom') }));
    const colorInputs = {};
    const colorGrid = el('div', { className: 'mdr-colors' });
    COLORS.forEach((k) => {
      colorInputs[k] = el('input', { type: 'color' });
      colorGrid.append(field(msg('color_' + k), colorInputs[k]));
    });
    const rngSize = el('input', { type: 'range', min: 12, max: 32, step: 1 });
    const rngLine = el('input', { type: 'range', min: 13, max: 25, step: 1 });
    const rngWidth = el('input', { type: 'range', min: 500, max: 1600, step: 50 });
    const selFont = el('select');
    Object.keys(FONTS).forEach((k) => selFont.append(el('option', { value: k, textContent: msg('font_' + k) })));
    const chkSpacing = el('input', { type: 'checkbox' });
    const spacingField = el('label', { className: 'mdr-check' }, [chkSpacing, el('span', { textContent: msg('spacing_label') })]);
    const contrastBox = el('div', { className: 'mdr-contrast' });
    contrastBox.setAttribute('role', 'status');
    contrastBox.setAttribute('aria-live', 'polite');
    const btnReset = el('button', { type: 'button', textContent: msg('btn_reset') });
    const panel = el('div', { className: 'mdr-panel', id: 'mdr-panel', hidden: true }, [
      field(msg('field_preset'), selPreset), colorGrid, contrastBox,
      field(msg('field_size'), rngSize), field(msg('field_leading'), rngLine), field(msg('field_width'), rngWidth),
      field(msg('field_font'), selFont), spacingField, btnReset
    ]);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', msg('btn_appearance'));

    // Pins panel
    const pinsList = el('ol', { className: 'mdr-pinlist' });
    const btnClear = el('button', { type: 'button', textContent: msg('btn_clear_all') });
    const pinsPanel = el('div', { className: 'mdr-panel', id: 'mdr-pins', hidden: true }, [
      el('strong', { textContent: msg('pins_title') }),
      el('p', { className: 'mdr-hint', textContent: msg('pins_hint') }),
      pinsList, btnClear
    ]);
    pinsPanel.setAttribute('role', 'dialog');
    pinsPanel.setAttribute('aria-label', msg('pins_title'));

    // Content
    const nav = el('nav', { className: 'mdr-toc' });
    nav.setAttribute('aria-label', msg('toc_label'));
    const article = el('article', { className: 'mdr-body' });
    const source = el('pre', { className: 'mdr-source', hidden: true });
    source.tabIndex = 0;
    const gutter = el('div', { className: 'mdr-gutter' });
    gutter.setAttribute('role', 'group');
    gutter.setAttribute('aria-label', msg('gutter_label'));
    const main = el('main', { id: 'mdr-content' }, [gutter, article, source]);
    main.tabIndex = -1;
    const layout = el('div', { className: 'mdr-layout' }, [nav, main]);
    root.append(skip, bar, panel, pinsPanel, layout);

    let showSource = false;
    let sourceBuilt = false;
    let targets = [];            // [{ line, node }] for the current mode
    const buttons = new Map();   // line -> button

    // ----- Contrast -----
    function updateContrast() {
      const c = settings.colors;
      const checks = [
        ['contrast_text', c.fg, c.bg, 4.5],
        ['contrast_muted', c.muted, c.bg, 4.5],
        ['contrast_link', c.link, c.bg, 4.5],
        ['contrast_code', c.codefg, c.codebg, 4.5],
        ['contrast_border', c.border, c.bg, 3]
      ];
      contrastBox.replaceChildren(el('strong', { textContent: msg('contrast_title') }));
      const ul = el('ul');
      checks.forEach(([labelKey, a, b, min]) => {
        const r = ratio(a, b);
        const ok = r >= min;
        const verdict = ok ? msg('contrast_pass') : msg('contrast_fail', min);
        ul.append(el('li', { className: ok ? 'ok' : 'ko', textContent: (ok ? '✔ ' : '✖ ') + msg('contrast_line', msg(labelKey), r.toFixed(1), verdict) }));
      });
      contrastBox.append(ul);
    }

    function applyStyle() {
      const c = settings.colors;
      for (const k of COLORS) root.style.setProperty('--' + k, c[k]);
      root.style.setProperty('--fs', settings.fontSize + 'px');
      root.style.setProperty('--lh', String(settings.lineHeight / 10));
      root.style.setProperty('--w', settings.width + 'px');
      root.style.setProperty('--ff', FONTS[settings.font]);
      root.classList.toggle('mdr-spaced', settings.spacing);
      root.classList.toggle('mdr-numbers', settings.lineNumbers);
      root.dataset.theme = isDarkColor(c.bg) ? 'dark' : 'light';
      btnTheme.textContent = msg(isDarkColor(c.bg) ? 'btn_theme_light' : 'btn_theme_dark');
      btnNum.setAttribute('aria-pressed', String(settings.lineNumbers));
      selPreset.value = settings.preset;
      for (const k of COLORS) colorInputs[k].value = c[k];
      rngSize.value = settings.fontSize;
      rngLine.value = settings.lineHeight;
      rngWidth.value = settings.width;
      selFont.value = settings.font;
      chkSpacing.checked = settings.spacing;
      updateContrast();
    }

    // ----- Gutter: line numbers and pins -----
    function pinOf(line) { return pins.find((p) => p.line === line); }

    function collectTargets() {
      if (showSource) {
        targets = Array.from(source.children).map((n) => ({ line: Number(n.dataset.ln), node: n }));
      } else {
        const seen = new Set();
        targets = [];
        article.querySelectorAll('[data-line]').forEach((n) => {
          const line = Number(n.dataset.line);
          if (!seen.has(line)) { seen.add(line); targets.push({ line, node: n }); }
        });
      }
    }

    function updateButton(btn, line) {
      const pinned = !!pinOf(line);
      btn.classList.toggle('pinned', pinned);
      btn.textContent = (pinned ? '📌 ' : '') + line;
      btn.setAttribute('aria-pressed', String(pinned));
      btn.setAttribute('aria-label', msg(pinned ? 'pin_remove_aria' : 'pin_add_aria', line));
    }

    function layoutGutter() {
      const visible = !showSource ? !article.hidden : !source.hidden;
      if (!visible) return;
      const base = main.getBoundingClientRect().top;
      const tops = targets.map((t) => t.node.getBoundingClientRect().top - base);
      targets.forEach((t, i) => {
        const b = buttons.get(t.line);
        if (b) b.style.top = tops[i] + 'px';
      });
    }
    let layoutQueued = false;
    function queueLayout() {
      if (layoutQueued) return;
      layoutQueued = true;
      requestAnimationFrame(() => { layoutQueued = false; layoutGutter(); });
    }

    function refreshMarks() {
      const gutterOn = settings.lineNumbers || pins.length > 0;
      main.classList.toggle('mdr-has-gutter', gutterOn);
      targets.forEach((t) => {
        const pinned = !!pinOf(t.line);
        t.node.classList.toggle('mdr-pinned', pinned);
        const b = buttons.get(t.line);
        if (b) {
          updateButton(b, t.line);
          b.hidden = !(settings.lineNumbers || pinned);
        }
      });
      // Roving tabindex: the tab stop is always on a visible button.
      const visible = Array.from(buttons.values()).filter((b) => !b.hidden);
      const current = visible.find((b) => b.tabIndex === 0) || visible[0];
      buttons.forEach((b) => { b.tabIndex = -1; });
      if (current) current.tabIndex = 0;
      btnPins.textContent = msg('btn_pins', pins.length);
      btnResume.hidden = pins.length === 0;
      btnClear.hidden = pins.length === 0;
      pinsList.replaceChildren();
      if (!pins.length) pinsList.append(el('li', { className: 'mdr-empty', textContent: msg('pins_empty') }));
      pins.slice().sort((a, b) => a.line - b.line).forEach((p) => {
        const go = el('a', { href: '#', textContent: msg('pin_item', p.line, p.text || msg('pin_item_empty')) });
        go.addEventListener('click', (e) => { e.preventDefault(); goTo(p.line); });
        const rm = el('button', { type: 'button', textContent: msg('btn_remove') });
        rm.setAttribute('aria-label', msg('pin_remove_aria', p.line));
        rm.addEventListener('click', () => togglePin(p.line, null));
        pinsList.append(el('li', {}, [go, rm]));
      });
      queueLayout();
    }

    function buildGutter() {
      collectTargets();
      gutter.replaceChildren();
      buttons.clear();
      targets.forEach((t) => {
        const b = el('button', { type: 'button', className: 'mdr-pin' });
        b.tabIndex = -1;                   // a single tab stop (set by refreshMarks), arrows to navigate
        b.addEventListener('click', () => togglePin(t.line, t.node));
        buttons.set(t.line, b);
        gutter.append(b);
      });
      refreshMarks();
    }

    gutter.addEventListener('keydown', (e) => {
      const list = Array.from(gutter.querySelectorAll('.mdr-pin')).filter((b) => !b.hidden);
      const i = list.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowDown') j = Math.min(list.length - 1, i + 1);
      else if (e.key === 'ArrowUp') j = Math.max(0, i - 1);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = list.length - 1;
      if (j < 0) return;
      e.preventDefault();
      list.forEach((b) => { b.tabIndex = -1; });
      list[j].tabIndex = 0;
      list[j].focus();
    });

    function togglePin(line, node) {
      const existing = pinOf(line);
      if (existing) {
        pins = pins.filter((p) => p !== existing);
      } else {
        if (pins.length >= MAX_PINS_PER_DOC) return;
        const t = node ? { node } : targets.find((x) => x.line === line);
        pins.push({ line, text: t ? snippet(t.node) : '', t: Date.now() });
      }
      savePins(docKey, pins);
      refreshMarks();
    }

    function goTo(line) {
      // The exact line if it is displayed, otherwise the closest displayed line before it.
      let best = null;
      targets.forEach((t) => { if (t.line <= line && (!best || t.line > best.line)) best = t; });
      if (!best && targets.length) best = targets[0];
      if (!best) return;
      best.node.scrollIntoView({ block: 'center' });
      const b = buttons.get(best.line);
      if (b && !b.hidden) b.focus(); else { main.focus({ preventScroll: true }); }
    }

    // ----- Rendering -----
    // Each render has a number: an outdated render (quick theme changes) stops
    // after Mermaid without touching the DOM again.
    let firstRender = true;
    async function render() {
      const my = ++generation;
      const isStale = () => my !== generation;
      applyStyle();
      renderBlocks(text, article);
      buildToc(article, nav);
      await renderMermaid(article, settings, isStale);
      if (isStale()) return;
      numberCode(article);
      addCopyButtons(article);
      const h1 = article.querySelector('h1');
      document.title = (h1 ? h1.textContent : opts.fileName) || 'Markdown';
      if (!showSource) buildGutter();
      // The URL anchor is only followed on the first display: the reading position is kept afterwards.
      if (firstRender) {
        firstRender = false;
        if (location.hash) {
          const t = document.getElementById(decodeSafe(location.hash.slice(1)));
          if (t) t.scrollIntoView();
        }
      }
    }

    function buildSource() {
      if (sourceBuilt) return;
      sourceBuilt = true;
      const frag = document.createDocumentFragment();
      text.replace(/\r\n?/g, '\n').split('\n').forEach((l, i) => {
        const s = el('span', { className: 'mdr-sl', textContent: l });
        s.dataset.ln = String(i + 1);
        frag.append(s);
      });
      source.replaceChildren(frag);
    }

    function persist() { saveSettings(settings); }

    function setPreset(name) {
      settings.preset = name;
      Object.assign(settings.colors, Object.fromEntries(COLORS.map((k) => [k, PRESETS[name][k]])));
      persist();
      return render();
    }

    selPreset.addEventListener('change', () => { if (own(PRESETS, selPreset.value)) setPreset(selPreset.value); });
    btnTheme.addEventListener('click', () => setPreset(isDarkColor(settings.colors.bg) ? 'light' : 'dark'));
    btnReset.addEventListener('click', () => {
      Object.assign(settings, { fontSize: 16, lineHeight: 16, width: 900, font: 'sans', spacing: false });
      return setPreset(systemPreset());
    });

    COLORS.forEach((k) => {
      colorInputs[k].addEventListener('input', () => {
        settings.colors[k] = colorInputs[k].value;
        settings.preset = 'custom';
        selPreset.value = 'custom';
        root.style.setProperty('--' + k, settings.colors[k]);
        updateContrast();
      });
      colorInputs[k].addEventListener('change', () => { persist(); render(); });
    });
    function range(input, key, min, max, def, cssVar, fmt) {
      input.addEventListener('input', () => { settings[key] = clamp(input.value, min, max, def); root.style.setProperty(cssVar, fmt(settings[key])); queueLayout(); });
      input.addEventListener('change', persist);
    }
    range(rngSize, 'fontSize', 12, 32, 16, '--fs', (v) => v + 'px');
    range(rngLine, 'lineHeight', 13, 25, 16, '--lh', (v) => String(v / 10));
    range(rngWidth, 'width', 500, 1600, 900, '--w', (v) => v + 'px');
    selFont.addEventListener('change', () => { settings.font = own(FONTS, selFont.value) ? selFont.value : 'sans'; persist(); render(); });
    chkSpacing.addEventListener('change', () => { settings.spacing = chkSpacing.checked; root.classList.toggle('mdr-spaced', settings.spacing); persist(); queueLayout(); });

    btnNum.addEventListener('click', () => {
      settings.lineNumbers = !settings.lineNumbers;
      root.classList.toggle('mdr-numbers', settings.lineNumbers);
      btnNum.setAttribute('aria-pressed', String(settings.lineNumbers));
      persist();
      refreshMarks();
    });

    // Only one panel open at a time
    const panels = [[panel, btnLook], [pinsPanel, btnPins]];
    function togglePanel(p, open, focus) {
      panels.forEach(([pp, bb]) => {
        const o = pp === p ? open : false;
        pp.hidden = !o;
        bb.setAttribute('aria-expanded', String(o));
      });
      if (focus !== false) {
        if (open) (p.querySelector('select, a, button') || p).focus();
        else panels.find(([pp]) => pp === p)[1].focus();
      }
    }
    btnLook.addEventListener('click', () => togglePanel(panel, panel.hidden));
    btnPins.addEventListener('click', () => togglePanel(pinsPanel, pinsPanel.hidden));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      panels.forEach(([pp]) => { if (!pp.hidden) togglePanel(pp, false); });
    }, listen);
    btnClear.addEventListener('click', () => { pins = []; savePins(docKey, pins); refreshMarks(); });
    btnResume.addEventListener('click', () => {
      const last = pins.slice().sort((a, b) => b.t - a.t)[0];
      if (last) goTo(last.line);
    });

    btnSrc.addEventListener('click', () => {
      showSource = !showSource;
      if (showSource) buildSource();
      source.hidden = !showSource;
      article.hidden = showSource;
      btnSrc.textContent = msg(showSource ? 'btn_rendered' : 'btn_source');
      buildGutter();
    });

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(queueLayout);
      observer.observe(main);
    }
    window.addEventListener('resize', queueLayout, listen);
    // <details> elements (Mermaid text alternative) change the height: recompute.
    article.addEventListener('toggle', queueLayout, true);

    // Synchronization between tabs: a setting or pin changed elsewhere is picked up here,
    // instead of being overwritten by the next write from this tab.
    const myPinsKey = pinsKey(docKey);
    onStorage = (changes, area) => {
      if (area !== 'local' || ac.signal.aborted) return;
      if (changes[KEY] && changes[KEY].newValue) {
        const next = normalize(changes[KEY].newValue);
        if (JSON.stringify(next) !== JSON.stringify(normalize(settings))) {
          const colorsChanged = JSON.stringify(next.colors) !== JSON.stringify(settings.colors) || next.font !== settings.font;
          Object.assign(settings, next);
          if (colorsChanged) render();                 // Mermaid depends on colors and font
          else { applyStyle(); refreshMarks(); }
        }
      }
      if (changes[myPinsKey]) {
        const next = cleanPins(changes[myPinsKey].newValue);
        if (JSON.stringify(next) !== JSON.stringify(pins)) { pins = next; refreshMarks(); }
      }
    };
    try { chrome.storage.onChanged.addListener(onStorage); } catch (e) { onStorage = null; }

    return render();
  }

  global.MDReader = { mount };
})(globalThis);
