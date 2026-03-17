'use strict';

(function () {
  if (window.__sbrInjected) return;
  window.__sbrInjected = true;

  var MAX_LOGS = 100;
  var MAX_REQUESTS = 50;

  window.__sbrLogs = [];
  window.__sbrRequests = [];
  window.__sbrErrors = [];

  function safeStringify(x) {
    try {
      if (typeof x === 'string') return x;
      return JSON.stringify(x);
    } catch (_) {
      return String(x);
    }
  }

  function emitSession(kind, payload) {
    try {
      document.dispatchEvent(new CustomEvent('sbrSessionEntry', { detail: { kind: kind, payload: payload } }));
    } catch (_) {}
  }

  function addLog(type, args) {
    var arr = Array.prototype.slice.call(args);
    var entry = {
      type: type,
      time: Date.now(),
      args: arr.map(function (a) {
        try {
          if (typeof a === 'object') return safeStringify(a);
          return String(a);
        } catch (_) {
          return '[unknown]';
        }
      })
    };
    window.__sbrLogs.push(entry);
    if (window.__sbrLogs.length > MAX_LOGS) window.__sbrLogs.shift();
    emitSession('log', entry);
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (method) {
    var orig = console[method];
    if (!orig) return;
    console[method] = function () {
      addLog(method, arguments);
      return orig.apply(console, arguments);
    };
  });

  function addError(entry) {
    window.__sbrErrors.push(entry);
    if (window.__sbrErrors.length > 50) window.__sbrErrors.shift();
    emitSession('error', entry);
  }

  window.addEventListener('error', function (e) {
    addError({
      type: 'error',
      message: e.message || '',
      source: e.filename || '',
      line: e.lineno,
      col: e.colno,
      stack: e.error && e.error.stack || ''
    });
  });

  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    var msg = reason && (reason.message || String(reason)) || 'Unhandled rejection';
    var stack = reason && reason.stack || '';
    addError({ type: 'unhandledrejection', message: msg, stack: stack });
  });

  function serviceLabel(url) {
    try {
      var u = new URL(url);
      return u.hostname + (u.pathname.split('/')[1] || '');
    } catch (_) {
      return url || '';
    }
  }

  function addRequest(entry) {
    window.__sbrRequests.push(entry);
    if (window.__sbrRequests.length > MAX_REQUESTS) window.__sbrRequests.shift();
    emitSession('request', entry);
  }

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = (init && init.method) || 'GET';
      var start = Date.now();
      return origFetch.apply(this, arguments).then(function (res) {
        addRequest({
          url: url,
          method: method.toUpperCase(),
          service: serviceLabel(url),
          duration: Date.now() - start,
          status: res && res.status
        });
        return res;
      }).catch(function (err) {
        addRequest({
          url: url,
          method: method.toUpperCase(),
          service: serviceLabel(url),
          duration: Date.now() - start,
          status: null,
          error: err && err.message
        });
        throw err;
      });
    };
  }

  var OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    window.XMLHttpRequest = function () {
      var xhr = new OrigXHR();
      var method = 'GET';
      var url = '';
      var start;
      xhr.open = function (m, u) {
        method = (m && m.toUpperCase()) || 'GET';
        url = u || '';
        return OrigXHR.prototype.open.apply(this, arguments);
      };
      xhr.addEventListener('load', function () {
        addRequest({
          url: url,
          method: method,
          service: serviceLabel(url),
          duration: start ? Date.now() - start : 0,
          status: xhr.status
        });
      });
      xhr.send = function () {
        start = Date.now();
        return OrigXHR.prototype.send.apply(this, arguments);
      };
      return xhr;
    };
  }
})();

