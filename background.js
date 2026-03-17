'use strict';

var SESSION_MAX_LOGS = 500;
var SESSION_MAX_REQUESTS = 200;
var SESSION_MAX_ERRORS = 100;

var sessionActive = {};
var sessionData = {};

var AUTO_MAX_PAGES = 15;
var AUTO_WAIT_MS = 2500;
var AUTO_INTERACT_WAIT_MS = 3000;
var autoTestRunning = {};
var autoTestState = {}; // tabId -> { visited: Set (as array), queue: [], pagesVisited: 0, origin: '' }
var autoTestTabListeners = {};

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  var payload = message.payload || {};
  var tabId = payload.tabId != null ? payload.tabId : (sender.tab && sender.tab.id);

  if (message.type === 'SBR_START_SESSION') {
    if (tabId == null) {
      sendResponse({ error: 'No tab' });
      return true;
    }
    sessionActive[tabId] = true;
    sessionData[tabId] = { logs: [], requests: [], errors: [] };
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: 'MAIN',
      func: clearPageBuffers
    }, function () {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'SBR_SESSION_DATA') {
    var id = sender.tab && sender.tab.id;
    if (id != null && sessionActive[id] && sessionData[id]) {
      var kind = message.kind;
      var payload_ = message.payload;
      if (kind === 'log') {
        sessionData[id].logs.push(payload_);
        if (sessionData[id].logs.length > SESSION_MAX_LOGS) sessionData[id].logs.shift();
      } else if (kind === 'request') {
        sessionData[id].requests.push(payload_);
        if (sessionData[id].requests.length > SESSION_MAX_REQUESTS) sessionData[id].requests.shift();
      } else if (kind === 'error') {
        sessionData[id].errors.push(payload_);
        if (sessionData[id].errors.length > SESSION_MAX_ERRORS) sessionData[id].errors.shift();
      }
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SBR_IS_RECORDING') {
    sendResponse({ recording: !!(tabId != null && sessionActive[tabId]) });
    return true;
  }

  if (message.type === 'SBR_CAPTURE') {
    captureBug(tabId, payload, sendResponse);
    return true;
  }

  if (message.type === 'SBR_START_AUTOTEST') {
    if (tabId == null) {
      sendResponse({ error: 'No tab' });
      return true;
    }
    startAutoTest(tabId, sendResponse);
    return true;
  }

  if (message.type === 'SBR_STOP_AUTOTEST') {
    if (tabId == null) {
      sendResponse({ ok: true });
      return true;
    }
    stopAutoTest(tabId);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SBR_AUTOTEST_STATUS') {
    var tid = payload.tabId != null ? payload.tabId : tabId;
    var st = tid != null && autoTestState[tid] ? {
      running: !!autoTestRunning[tid],
      pagesVisited: autoTestState[tid].pagesVisited,
      maxPages: AUTO_MAX_PAGES
    } : { running: false, pagesVisited: 0, maxPages: AUTO_MAX_PAGES };
    sendResponse(st);
    return true;
  }

  return false;
});

function startAutoTest(tabId, sendResponse) {
  if (autoTestRunning[tabId]) {
    sendResponse({ ok: true });
    return;
  }
  sessionActive[tabId] = true;
  if (!sessionData[tabId]) sessionData[tabId] = { logs: [], requests: [], errors: [] };
  chrome.tabs.get(tabId, function (tab) {
    if (chrome.runtime.lastError || !tab || !tab.url) {
      sendResponse({ error: 'Tab or URL not available' });
      return;
    }
    var origin;
    try {
      origin = new URL(tab.url).origin;
    } catch (_) {
      sendResponse({ error: 'Invalid URL' });
      return;
    }
    autoTestRunning[tabId] = true;
    autoTestState[tabId] = {
      visited: [tab.url],
      queue: [],
      pagesVisited: 0,
      origin: origin
    };
    sendResponse({ ok: true });
    chrome.scripting.executeScript({ target: { tabId: tabId }, world: 'MAIN', func: clearPageBuffers }, function () {
      setTimeout(function () {
        interactThenCollect(tabId);
      }, AUTO_WAIT_MS);
    });
  });
}

function stopAutoTest(tabId) {
  autoTestRunning[tabId] = false;
  if (autoTestTabListeners[tabId]) {
    chrome.tabs.onUpdated.removeListener(autoTestTabListeners[tabId]);
    autoTestTabListeners[tabId] = null;
  }
}

function scheduleNext(tabId) {
  if (!autoTestRunning[tabId] || !autoTestState[tabId]) return;
  var st = autoTestState[tabId];
  if (st.pagesVisited >= AUTO_MAX_PAGES || st.queue.length === 0) {
    autoTestRunning[tabId] = false;
    if (autoTestTabListeners[tabId]) {
      chrome.tabs.onUpdated.removeListener(autoTestTabListeners[tabId]);
      autoTestTabListeners[tabId] = null;
    }
    return;
  }
  var nextUrl = st.queue.shift();
  st.visited.push(nextUrl);
  st.pagesVisited += 1;
  if (autoTestTabListeners[tabId]) {
    chrome.tabs.onUpdated.removeListener(autoTestTabListeners[tabId]);
    autoTestTabListeners[tabId] = null;
  }
  var listener = function (id, info) {
    if (id !== tabId || info.status !== 'complete') return;
    chrome.tabs.onUpdated.removeListener(listener);
    autoTestTabListeners[tabId] = null;
    setTimeout(function () {
      interactThenCollect(tabId);
    }, AUTO_WAIT_MS);
  };
  autoTestTabListeners[tabId] = listener;
  chrome.tabs.onUpdated.addListener(listener);
  chrome.tabs.update(tabId, { url: nextUrl }, function () {
    if (chrome.runtime.lastError) {
      scheduleNext(tabId);
    }
  });
}

function interactThenCollect(tabId) {
  if (!autoTestRunning[tabId]) return;
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',
    func: interactWithPageLikeTester
  }, function () {
    setTimeout(function () {
      collectLinksAndContinue(tabId);
    }, AUTO_INTERACT_WAIT_MS);
  });
}

function collectLinksAndContinue(tabId) {
  if (!autoTestRunning[tabId] || !autoTestState[tabId]) return;
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',
    func: getPageLinksForCrawl
  }, function (res) {
    if (res && res[0] && res[0].result && autoTestState[tabId]) {
      var links = res[0].result;
      var st = autoTestState[tabId];
      var visitedSet = {};
      st.visited.forEach(function (u) { visitedSet[u] = true; });
      for (var i = 0; i < links.length && st.queue.length < 50; i++) {
        if (!visitedSet[links[i]]) {
          st.queue.push(links[i]);
          visitedSet[links[i]] = true;
        }
      }
    }
    scheduleNext(tabId);
  });
}

function interactWithPageLikeTester() {
  var actions = [];
  try {
    var skipBtn = /delete|remove|destroy|logout|signout|cancel/i;
    var testValues = ['Test User', 'test@example.com', 'test123', 'Test content', 'test'];
    var inputs = document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=image]), textarea');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.offsetParent === null || el.disabled || el.readOnly) continue;
      var type = (el.type || '').toLowerCase();
      var val = type === 'email' ? 'test@example.com' : type === 'password' ? 'test123' : testValues[i % testValues.length];
      try {
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
        actions.push('filled:' + (el.name || el.id || type));
      } catch (_) {}
    }
    var buttons = document.querySelectorAll('button, input[type=submit], input[type=button], [role=button], a.btn');
    for (var j = 0; j < Math.min(buttons.length, 3); j++) {
      var btn = buttons[j];
      var text = (btn.textContent || btn.value || '').trim();
      if (btn.offsetParent === null || skipBtn.test(text)) continue;
      try {
        btn.click();
        actions.push('clicked:' + text.slice(0, 30));
        break;
      } catch (_) {}
    }
    var inPageLinks = document.querySelectorAll('a[href="#"], a[href^="javascript:"]');
    for (var k = 0; k < Math.min(inPageLinks.length, 2); k++) {
      if (inPageLinks[k].offsetParent === null) continue;
      try {
        inPageLinks[k].click();
        actions.push('clicked-link');
        break;
      } catch (_) {}
    }
  } catch (_) {}
  return actions;
}

function getPageLinksForCrawl() {
  var out = [];
  var origin;
  try {
    origin = window.location.origin;
  } catch (_) {
    return out;
  }
  var skip = /logout|signout|sign.out|log.out|delete|remove|destroy/i;
  var links = document.querySelectorAll('a[href]');
  for (var i = 0; i < links.length && out.length < 30; i++) {
    var a = links[i];
    var href = (a.getAttribute('href') || '').trim();
    if (!href || href === '#' || /^javascript:/i.test(href)) continue;
    if (skip.test(href) || skip.test((a.textContent || '').trim())) continue;
    try {
      var full = new URL(href, window.location.href).href;
      if (new URL(full).origin !== origin) continue;
      if (full !== window.location.href) out.push(full);
    } catch (_) {}
  }
  return out;
}

function clearPageBuffers() {
  try {
    if (window.__sbrLogs) window.__sbrLogs.length = 0;
    if (window.__sbrRequests) window.__sbrRequests.length = 0;
    if (window.__sbrErrors) window.__sbrErrors.length = 0;
  } catch (_) {}
}

function captureBug(tabId, payload, sendResponse) {
  if (tabId == null) {
    sendResponse({ error: 'No tab' });
    return;
  }

  var result = { screenshot: null, logs: [], requests: [], browserInfo: {}, error: null };
  var title = payload.title || '';
  var steps = payload.steps || '';

  chrome.tabs.get(tabId, function (tab) {
    if (chrome.runtime.lastError || !tab) {
      result.error = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Tab not found';
      sendResponse(result);
      return;
    }
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, onScreenshot);
  });

  function onScreenshot(dataUrl) {
    if (chrome.runtime.lastError) {
      result.error = chrome.runtime.lastError.message || 'Screenshot failed';
      sendResponse(result);
      return;
    }
    result.screenshot = dataUrl;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: 'MAIN',
      func: getPageBugData
    }, function (res) {
      if (res && res[0] && res[0].result) {
        var data = res[0].result;
        result.logs = data.logs || [];
        result.requests = data.requests || [];
        result.browserInfo = data.browserInfo || {};
        result.uncaughtErrors = data.uncaughtErrors || [];
      }
      result.browserInfo.pageUrl = result.browserInfo.url || payload.pageUrl || '';

      if (payload.sessionMode && sessionActive[tabId] && sessionData[tabId]) {
        var sess = sessionData[tabId];
        result.logs = (sess.logs || []).concat(result.logs);
        result.requests = (sess.requests || []).concat(result.requests);
        result.uncaughtErrors = (sess.errors || []).concat(result.uncaughtErrors || []);
        sessionActive[tabId] = false;
        sessionData[tabId] = null;
      }

      result.title = title;
      result.steps = steps;
      result.sessionMode = payload.sessionMode || false;
      sendResponse(result);
    });
  }
}

function getPageBugData() {
  var logs = [];
  var requests = [];
  var browserInfo = {};

  try {
    if (window.__sbrLogs && Array.isArray(window.__sbrLogs)) {
      logs = window.__sbrLogs.slice(-100);
    }
  } catch (_) {}

  try {
    if (window.__sbrRequests && Array.isArray(window.__sbrRequests)) {
      requests = window.__sbrRequests.slice(-50);
    }
  } catch (_) {}

  var uncaughtErrors = [];
  try {
    if (window.__sbrErrors && Array.isArray(window.__sbrErrors)) {
      uncaughtErrors = window.__sbrErrors.slice(-20);
    }
  } catch (_) {}

  try {
    browserInfo = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen && window.screen.width,
      screenHeight: window.screen && window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  } catch (_) {}

  return { logs: logs, requests: requests, browserInfo: browserInfo, uncaughtErrors: uncaughtErrors };
}
