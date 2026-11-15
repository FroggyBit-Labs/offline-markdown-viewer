'use strict';

// Automatic rendering of .md files opened over file:// (requires "Allow access to file URLs").
(function () {
  if (!/^text\/(plain|markdown|x-markdown)$/i.test(document.contentType || '')) return;
  const body = document.body;
  if (!body || body.children.length !== 1 || body.firstElementChild.tagName !== 'PRE') return;
  if (typeof MDReader === 'undefined') return;

  const text = body.firstElementChild.textContent;
  // Computed before the page is emptied: a stray "%" in the path must not leave a blank page.
  const rawName = location.pathname.split('/').pop() || '';
  let fileName;
  try { fileName = decodeURIComponent(rawName); } catch (e) { fileName = rawName; }

  // Network lockdown of the page: no remote resource, no page script.
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = "default-src 'none'; img-src file: data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";
  document.head.appendChild(meta);

  const vp = document.createElement('meta');
  vp.name = 'viewport';
  vp.content = 'width=device-width, initial-scale=1';
  document.head.appendChild(vp);

  body.replaceChildren();
  body.classList.add('mdr-page');
  const root = document.createElement('div');
  body.appendChild(root);
  MDReader.mount(root, text, { fileName, docKey: location.href.split('#')[0] }).catch(() => {
    // Last resort: show the raw text rather than an empty page.
    const pre = document.createElement('pre');
    pre.textContent = text;
    body.replaceChildren(pre);
  });
})();
