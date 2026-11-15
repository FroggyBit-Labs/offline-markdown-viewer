'use strict';

// Translation helper on top of chrome.i18n.
// The browser picks the language from its own UI language and falls back to the default
// locale (English) when a language is not translated. If a key is missing, the key is shown.
(function (global) {
  function msg(key) {
    const subs = Array.prototype.slice.call(arguments, 1).map(String);
    try {
      const m = chrome.i18n.getMessage(key, subs);
      if (m) return m;
    } catch (e) { /* i18n unavailable */ }
    return key;
  }
  function uiLang() {
    try { return chrome.i18n.getUILanguage() || 'en'; } catch (e) { return 'en'; }
  }
  global.msg = msg;
  global.uiLang = uiLang;
})(globalThis);
