'use strict';

(function () {
  const welcome = document.getElementById('welcome');
  const root = document.getElementById('root');
  const drop = document.getElementById('drop');
  const input = document.getElementById('file');
  const error = document.getElementById('error');

  const TEXT_EXT = /\.(md|markdown|mdown|txt)$/i;
  const MAX_SIZE = 20 * 1024 * 1024;   // beyond this, rendering would freeze the tab

  // Static texts of the page, in the browser's language.
  document.documentElement.lang = uiLang();
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = msg(n.dataset.i18n); });

  function showError(text) {
    welcome.hidden = false;
    MDReader.unmount(root);      // release the previous document's listeners before clearing the page
    root.replaceChildren();
    root.className = '';
    error.textContent = text;
    error.hidden = false;
  }

  // Key of a document's pins: file name + first non-empty line (usually the title).
  // It survives edits to the file while keeping two README.md files of different projects apart.
  function docKeyOf(name, text) {
    const first = (text.split(/\r\n?|\n/).find((l) => l.trim() !== '') || '').trim().slice(0, 200);
    return 'viewer:' + name + ':' + first;
  }

  function open(file) {
    if (!file) return;
    error.hidden = true;
    if (!TEXT_EXT.test(file.name) && !/^text\//i.test(file.type || '')) {
      showError(msg('error_not_text', file.name));
      return;
    }
    if (file.size > MAX_SIZE) {
      showError(msg('error_too_big', file.name));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => showError(msg('error_read', file.name));
    reader.onload = () => {
      const text = String(reader.result);
      // A null character gives away a binary file with a renamed extension: do not show it as garbage.
      if (text.includes('\u0000')) {
        showError(msg('error_binary', file.name));
        return;
      }
      welcome.hidden = true;
      root.replaceChildren();
      MDReader.mount(root, text, { fileName: file.name, docKey: docKeyOf(file.name, text) }).catch(() => {
        // Last resort: show the raw text rather than an empty page.
        const pre = document.createElement('pre');
        pre.className = 'mdr-raw';
        pre.textContent = text;
        root.className = '';
        root.replaceChildren(pre);
      });
    };
    reader.readAsText(file, 'utf-8');
  }

  input.addEventListener('change', () => {
    const file = input.files[0];
    // Reset: choosing the same file again (after editing it) still fires "change".
    input.value = '';
    open(file);
  });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  drop.addEventListener('click', (e) => { if (e.target !== input) { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  document.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) open(files[0]);
  });
})();
