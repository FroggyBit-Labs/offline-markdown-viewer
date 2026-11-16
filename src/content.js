'use strict';

// Automatic rendering of .md files opened over file:// (requires "Allow access to file URLs").
(async function () {
  if (!/^text\/(plain|markdown|x-markdown)$/i.test(document.contentType || '')) return;
  const body = document.body;
  if (!body || body.children.length !== 1 || body.firstElementChild.tagName !== 'PRE') return;
  if (typeof MDReader === 'undefined') return;

  const text = body.firstElementChild.textContent;
  // Computed before the page is emptied: a stray "%" in the path must not leave a blank page.
  const rawName = location.pathname.split('/').pop() || '';
  let fileName;
  try { fileName = decodeURIComponent(rawName); } catch (e) { fileName = rawName; }

  // Network lockdown of the page: no page script, and only local or embedded images, plus the sites the user
  // explicitly listed in "Remote images" (empty and switched off by default). The browser enforces this policy.
  // The same settings object feeds the CSP and the rendering, so both always agree on the list. If reading
  // ever failed, the strictest policy (no remote site) is used for both.
  const STRICT = { enabled: false, allow: [] };
  const settings = await MDReader.loadSettings().catch(() => null);
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = MDReader.contentCsp(settings);
  document.head.appendChild(meta);

  const vp = document.createElement('meta');
  vp.name = 'viewport';
  vp.content = 'width=device-width, initial-scale=1';
  document.head.appendChild(vp);

  body.replaceChildren();
  body.classList.add('mdr-page');
  const root = document.createElement('div');
  body.appendChild(root);
  MDReader.mount(root, text, { fileName, docKey: location.href.split('#')[0], localImages: true, settings: settings || undefined, net: settings ? undefined : STRICT }).catch(() => {
    // Last resort: show the raw text rather than an empty page.
    const pre = document.createElement('pre');
    pre.textContent = text;
    body.replaceChildren(pre);
  });
})();
