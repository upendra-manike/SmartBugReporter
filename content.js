'use strict';

(function () {
  var script = document.createElement('script');
  try {
    script.src = chrome.runtime.getURL('page-capture.js');
  } catch (_) {
    // If chrome.runtime is unavailable, skip injection.
    return;
  }
  script.async = false;
  script.onload = function () {
    script.remove();
  };
  (document.documentElement || document.head || document.body).appendChild(script);

  document.addEventListener('sbrSessionEntry', function (e) {
    if (e.detail && e.detail.kind && e.detail.payload && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: 'SBR_SESSION_DATA',
          kind: e.detail.kind,
          payload: e.detail.payload
        });
      } catch (_) {}
    }
  });
})();
