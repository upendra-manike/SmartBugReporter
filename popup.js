'use strict';

var formSection = document.getElementById('formSection');
var resultSection = document.getElementById('resultSection');
var errorSection = document.getElementById('errorSection');
var idleActions = document.getElementById('idleActions');
var recordingSection = document.getElementById('recordingSection');
var recordingStatus = document.getElementById('recordingStatus');
var autoTestSection = document.getElementById('autoTestSection');
var autoTestStatus = document.getElementById('autoTestStatus');
var autoTestPages = document.getElementById('autoTestPages');
var btnRunAutoTest = document.getElementById('btnRunAutoTest');
var btnStartSession = document.getElementById('btnStartSession');
var btnStopAutoTest = document.getElementById('btnStopAutoTest');
var btnStopSession = document.getElementById('btnStopSession');
var autoTestPollTimer = null;
var titleInput = document.getElementById('title');
var stepsInput = document.getElementById('steps');
var btnCapture = document.getElementById('btnCapture');
var resultStatus = document.getElementById('resultStatus');
var preview = document.getElementById('preview');
var btnJira = document.getElementById('btnJira');
var btnGitHub = document.getElementById('btnGitHub');
var btnAgain = document.getElementById('btnAgain');

var lastCapture = null;

function showError(msg) {
  errorSection.textContent = msg;
  errorSection.classList.remove('hidden');
}
function hideError() {
  errorSection.classList.add('hidden');
}

function setRecordingUI(recording, showAutoTest) {
  if (recording) {
    idleActions.classList.add('hidden');
    recordingSection.classList.remove('hidden');
    if (showAutoTest) {
      autoTestSection.classList.remove('hidden');
      startAutoTestPoll();
    } else {
      autoTestSection.classList.add('hidden');
      stopAutoTestPoll();
    }
  } else {
    idleActions.classList.remove('hidden');
    recordingSection.classList.add('hidden');
    autoTestSection.classList.add('hidden');
    stopAutoTestPoll();
  }
}

function startAutoTestPoll() {
  stopAutoTestPoll();
  function poll() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.runtime.sendMessage({ type: 'SBR_AUTOTEST_STATUS', payload: { tabId: tab.id } }, function (st) {
        if (st && autoTestPages) {
          autoTestPages.textContent = st.pagesVisited || 0;
          if (!st.running) {
            autoTestSection.classList.add('hidden');
            stopAutoTestPoll();
            if (recordingStatus) recordingStatus.textContent = 'Auto-test finished. Click Stop & generate report.';
          }
        }
      });
    });
  }
  poll();
  autoTestPollTimer = setInterval(poll, 1500);
}

function stopAutoTestPoll() {
  if (autoTestPollTimer) {
    clearInterval(autoTestPollTimer);
    autoTestPollTimer = null;
  }
}

function loadRecordingState() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) return;
    chrome.runtime.sendMessage({ type: 'SBR_IS_RECORDING', payload: { tabId: tab.id } }, function (res) {
      var recording = res && res.recording;
      chrome.runtime.sendMessage({ type: 'SBR_AUTOTEST_STATUS', payload: { tabId: tab.id } }, function (st) {
        setRecordingUI(recording, recording && st && st.running);
        if (recording && st && st.running && autoTestPages) autoTestPages.textContent = st.pagesVisited || 0;
      });
    });
  });
}

btnRunAutoTest.addEventListener('click', function () {
  hideError();
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) {
      showError('No active tab.');
      return;
    }
    chrome.runtime.sendMessage({ type: 'SBR_START_SESSION', payload: { tabId: tab.id } }, function (res) {
      if (chrome.runtime.lastError || (res && res.error)) {
        showError((res && res.error) || chrome.runtime.lastError.message || 'Failed to start.');
        return;
      }
      chrome.runtime.sendMessage({ type: 'SBR_START_AUTOTEST', payload: { tabId: tab.id } }, function (r2) {
        if (chrome.runtime.lastError || (r2 && r2.error)) {
          showError((r2 && r2.error) || chrome.runtime.lastError.message || 'Failed to start auto-test.');
          setRecordingUI(true, false);
          return;
        }
        setRecordingUI(true, true);
        recordingStatus.textContent = 'Auto-testing… Extension is navigating the app and recording.';
      });
    });
  });
});

btnStartSession.addEventListener('click', function () {
  hideError();
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) {
      showError('No active tab.');
      return;
    }
    chrome.runtime.sendMessage({ type: 'SBR_START_SESSION', payload: { tabId: tab.id } }, function (res) {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || 'Failed to start.');
        return;
      }
      if (res && res.error) {
        showError(res.error);
        return;
      }
      setRecordingUI(true, false);
    });
  });
});

btnStopAutoTest.addEventListener('click', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (tab && tab.id) {
      chrome.runtime.sendMessage({ type: 'SBR_STOP_AUTOTEST', payload: { tabId: tab.id } }, function () {
        autoTestSection.classList.add('hidden');
        stopAutoTestPoll();
        recordingStatus.textContent = 'Recording paused. Click Stop & generate report when done.';
      });
    }
  });
});

btnStopSession.addEventListener('click', function () {
  hideError();
  btnStopSession.disabled = true;
  btnStopSession.textContent = 'Generating…';
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) {
      btnStopSession.disabled = false;
      btnStopSession.textContent = 'Stop & generate report';
      return;
    }
    chrome.runtime.sendMessage({
      type: 'SBR_CAPTURE',
      payload: {
        tabId: tab.id,
        pageUrl: tab.url,
        title: titleInput.value.trim(),
        steps: stepsInput.value.trim(),
        sessionMode: true
      }
    }, function (result) {
      btnStopSession.disabled = false;
      btnStopSession.textContent = 'Stop & generate report';
      setRecordingUI(false, false);
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || 'Capture failed.');
        return;
      }
      if (result && result.error) {
        showError(result.error);
        return;
      }
      showResult(result);
    });
  });
});

function showResult(result) {
  lastCapture = result;
  formSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
  var logCount = result.logs ? result.logs.length : 0;
  var reqCount = result.requests ? result.requests.length : 0;
  var errCount = result.uncaughtErrors ? result.uncaughtErrors.length : 0;
  resultStatus.textContent = (result.sessionMode ? 'Session report: ' : 'Captured: ') + logCount + ' log(s), ' + reqCount + ' request(s)' + (errCount ? ', ' + errCount + ' uncaught error(s)' : '') + '.';
  resultStatus.innerHTML += ' <span style="color:#64748b;font-size:11px;">Title/steps blank → report uses auto-generated title and steps from detected issues.</span>';
  if (result.screenshot) {
    preview.innerHTML = '<img src="' + result.screenshot + '" alt="Screenshot">';
  } else {
    preview.textContent = 'Screenshot not available.';
  }
}

btnCapture.addEventListener('click', function () {
  hideError();
  btnCapture.disabled = true;
  btnCapture.textContent = 'Capturing…';

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) {
      showError('No active tab.');
      btnCapture.disabled = false;
      btnCapture.textContent = 'Capture current page';
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SBR_CAPTURE',
      payload: {
        tabId: tab.id,
        pageUrl: tab.url,
        title: titleInput.value.trim(),
        steps: stepsInput.value.trim()
      }
    }, function (result) {
      btnCapture.disabled = false;
      btnCapture.textContent = 'Capture current page';

      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || 'Capture failed.');
        return;
      }
      if (result && result.error) {
        showError(result.error);
        return;
      }
      showResult(result);
    });
  });
});

loadRecordingState();

function copyReport(format) {
  if (!lastCapture || !window.SmartBugReporterFormatters) return;
  var text = window.SmartBugReporterFormatters[format](lastCapture);
  navigator.clipboard.writeText(text).then(function () {
    resultStatus.textContent = 'Copied as ' + (format === 'jira' ? 'Jira' : format === 'github' ? 'GitHub' : 'Markdown') + '!';
  }).catch(function () {
    resultStatus.textContent = 'Copy failed.';
  });
}

btnJira.addEventListener('click', function () {
  copyReport('jira');
});
btnGitHub.addEventListener('click', function () {
  copyReport('github');
});

btnAgain.addEventListener('click', function () {
  resultSection.classList.add('hidden');
  formSection.classList.remove('hidden');
  resultStatus.textContent = '';
  preview.innerHTML = '';
  loadRecordingState();
});
