'use strict';

// A click on the toolbar icon opens the viewer (file picker / drag and drop).
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/viewer.html') });
});
