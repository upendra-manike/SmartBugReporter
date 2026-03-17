'use strict';

window.SmartBugReporterFormatters = (function () {

  var SLOW_MS = 1000;
  var FAILED_STATUS_MIN = 400;

  function analyze(data) {
    var logs = data.logs || [];
    var requests = data.requests || [];
    var uncaught = data.uncaughtErrors || [];
    var url = data.browserInfo && (data.browserInfo.pageUrl || data.browserInfo.url) || '';
    var pathname = '';
    try {
      pathname = new URL(url).pathname || url;
    } catch (_) {
      pathname = url;
    }

    var consoleErrors = logs.filter(function (e) { return (e.type || '') === 'error'; });
    var consoleWarnings = logs.filter(function (e) { return (e.type || '') === 'warn'; });
    var failedRequests = requests.filter(function (r) {
      var s = r.status;
      return s >= FAILED_STATUS_MIN || s === 0 || r.error;
    });
    var slowRequests = requests.filter(function (r) {
      return r.duration != null && r.duration >= SLOW_MS;
    });

    var issues = [];
    if (uncaught.length) {
      issues.push({ type: 'Uncaught errors', count: uncaught.length, items: uncaught, first: uncaught[0].message });
    }
    if (consoleErrors.length) {
      issues.push({
        type: 'Console errors',
        count: consoleErrors.length,
        items: consoleErrors,
        first: (consoleErrors[0].args || []).join(' ').slice(0, 120)
      });
    }
    if (consoleWarnings.length) {
      issues.push({
        type: 'Console warnings',
        count: consoleWarnings.length,
        items: consoleWarnings,
        first: (consoleWarnings[0].args || []).join(' ').slice(0, 120)
      });
    }
    if (failedRequests && failedRequests.length > 0) {
      var r0 = failedRequests[0];
      var statusOrError = r0 && (r0.status != null ? String(r0.status) : (r0.error || '-')) || '-';
      var failedFirst = (r0 ? (r0.method || '') + ' ' + (r0.url || '') : '') + ' -> ' + statusOrError;
      var failedItems = failedRequests.map(function (r) {
        return { method: r.method, url: r.url, status: r.status, error: r.error, duration: r.duration };
      });
      issues.push({ type: 'Failed API requests', count: failedItems.length, items: failedItems, first: failedFirst });
    }
    if (slowRequests.length) {
      issues.push({
        type: 'Slow API requests',
        count: slowRequests.length,
        items: slowRequests,
        first: (slowRequests[0].method || '') + ' ' + (slowRequests[0].url || '') + ' → ' + (slowRequests[0].duration || 0) + ' ms'
      });
    }

    var suggestedTitle = data.title && data.title.trim();
    if (!suggestedTitle && uncaught.length && uncaught[0].message) {
      suggestedTitle = (uncaught[0].message || '').slice(0, 80);
    }
    if (!suggestedTitle && consoleErrors.length) {
      suggestedTitle = ((consoleErrors[0].args || []).join(' ') || '').slice(0, 80);
    }
    if (!suggestedTitle && failedRequests && failedRequests.length) {
      suggestedTitle = 'API error: ' + (failedRequests[0].method || '') + ' ' + (failedRequests[0].url || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 50);
    }
    if (!suggestedTitle) {
      suggestedTitle = 'Bug on ' + (pathname || url || 'page');
    }

    var defaultSteps = '1. Navigate to ' + (url || '(page URL)') + '\n' +
      '2. (Describe the actions you took: clicks, form inputs, navigation)\n' +
      '3. Expected: (what should happen)\n' +
      '4. Actual: (what happened / errors or incorrect behavior seen)';

    return {
      issues: issues,
      suggestedTitle: suggestedTitle,
      defaultSteps: defaultSteps,
      consoleErrors: consoleErrors,
      consoleWarnings: consoleWarnings,
      failedRequests: failedRequests,
      slowRequests: slowRequests,
      uncaught: uncaught
    };
  }

  function escapeJira(s) {
    if (!s) return '';
    return String(s).replace(/\|/g, '\\|');
  }

  function escapeMd(s) {
    if (!s) return '';
    return String(s).replace(/\|/g, '\\|');
  }

  return {
    jira: function (data) {
      var a = analyze(data);
      var lines = [];
      var title = (data.title && data.title.trim()) || a.suggestedTitle;
      var steps = (data.steps && data.steps.trim()) || a.defaultSteps;

      lines.push('h2. Bug: ' + escapeJira(title));
      lines.push('');

      lines.push('h3. Issues detected (app flow / bugs)');
      if (a.issues.length > 0) {
        lines.push('The following potential bugs were detected from console and network activity:');
        lines.push('');
        a.issues.forEach(function (issue) {
          lines.push('* ' + issue.type + ': ' + issue.count + (issue.first ? ' — ' + escapeJira(issue.first) : ''));
        });
        lines.push('');
      } else {
        lines.push('No errors, warnings, failed requests, or slow requests were detected in this capture. If you still see a bug, describe it in the steps below.');
        lines.push('');
      }

      lines.push('h3. Steps to reproduce');
      lines.push(steps);
      lines.push('');

      lines.push('h3. Environment');
      lines.push('* URL:* ' + (data.browserInfo && (data.browserInfo.pageUrl || data.browserInfo.url) || ''));
      lines.push('* User-Agent:* ' + (data.browserInfo && data.browserInfo.userAgent || ''));
      lines.push('* Platform:* ' + (data.browserInfo && data.browserInfo.platform || ''));
      lines.push('* Screen:* ' + (data.browserInfo && data.browserInfo.screenWidth || '') + '×' + (data.browserInfo && data.browserInfo.screenHeight || ''));
      lines.push('* Viewport:* ' + (data.browserInfo && data.browserInfo.viewportWidth || '') + '×' + (data.browserInfo && data.browserInfo.viewportHeight || ''));
      lines.push('');

      if (a.uncaught.length > 0) {
        lines.push('h3. Uncaught errors / unhandled rejections');
        lines.push('{code}');
        a.uncaught.forEach(function (e) {
          lines.push('[' + (e.type || 'error') + '] ' + (e.message || ''));
          if (e.source) lines.push('  at ' + e.source + (e.line != null ? ':' + e.line + (e.col != null ? ':' + e.col : '') : ''));
          if (e.stack) lines.push(e.stack);
        });
        lines.push('{code}');
        lines.push('');
      }

      if (a.consoleErrors.length > 0 || a.consoleWarnings.length > 0) {
        lines.push('h3. Console errors and warnings');
        lines.push('{code}');
        (a.consoleErrors.concat(a.consoleWarnings)).forEach(function (e) {
          lines.push('[' + (e.type || 'log').toUpperCase() + '] ' + (e.args || []).join(' '));
        });
        lines.push('{code}');
        lines.push('');
      }

      if (a.failedRequests.length > 0 || a.slowRequests.length > 0) {
        lines.push('h3. Failed and slow network requests');
        lines.push('||Method||URL||Status||Duration||Note||');
        a.failedRequests.forEach(function (r) {
          lines.push('|' + (r.method || '') + '|' + escapeJira(r.url || '') + '|' + (r.status != null ? r.status : (r.error || '–')) + '|' + (r.duration != null ? r.duration + ' ms' : '–') + '|Failed|');
        });
        a.slowRequests.forEach(function (r) {
          if (a.failedRequests.indexOf(r) === -1) {
            lines.push('|' + (r.method || '') + '|' + escapeJira(r.url || '') + '|' + (r.status || '–') + '|' + (r.duration != null ? r.duration + ' ms' : '–') + '|Slow|');
          }
        });
        lines.push('');
      }

      if (data.logs && data.logs.length > 0) {
        lines.push('h3. Full console log (all levels)');
        lines.push('{code}');
        data.logs.forEach(function (e) {
          lines.push('[' + (e.type || 'log').toUpperCase() + '] ' + (e.args || []).join(' '));
        });
        lines.push('{code}');
        lines.push('');
      }

      if (data.requests && data.requests.length > 0) {
        lines.push('h3. All network requests');
        lines.push('||Method||URL||Status||Duration||');
        data.requests.forEach(function (r) {
          lines.push('|' + (r.method || '') + '|' + escapeJira(r.url || '') + '|' + (r.status != null ? r.status : (r.error || '–')) + '|' + (r.duration != null ? r.duration + ' ms' : '–') + '|');
        });
        lines.push('');
      }

      lines.push('h3. Screenshot');
      lines.push('(Attach the screenshot from your clipboard or drag-and-drop the captured image.)');
      return lines.join('\n');
    },

    github: function (data) {
      var a = analyze(data);
      var lines = [];
      var title = (data.title && data.title.trim()) || a.suggestedTitle;
      var steps = (data.steps && data.steps.trim()) || a.defaultSteps;

      lines.push('## Bug: ' + escapeMd(title));
      lines.push('');

      lines.push('### Issues detected (app flow / bugs)');
      if (a.issues.length > 0) {
        lines.push('The following potential bugs were detected from console and network activity:');
        lines.push('');
        a.issues.forEach(function (issue) {
          lines.push('- **' + issue.type + ':** ' + issue.count + (issue.first ? ' — `' + escapeMd(issue.first) + '`' : ''));
        });
        lines.push('');
      } else {
        lines.push('No console errors, warnings, failed API calls, or slow requests were detected in this session. If you still observed a problem, explain it in the steps and expected/actual sections.');
        lines.push('');
      }

      lines.push('### Steps to reproduce');
      lines.push('```');
      lines.push(steps);
      lines.push('```');
      lines.push('');

      lines.push('### Environment');
      lines.push('- **URL:** ' + (data.browserInfo && (data.browserInfo.pageUrl || data.browserInfo.url) || ''));
      lines.push('- **User-Agent:** ' + (data.browserInfo && data.browserInfo.userAgent || ''));
      lines.push('- **Platform:** ' + (data.browserInfo && data.browserInfo.platform || ''));
      lines.push('- **Screen:** ' + (data.browserInfo && data.browserInfo.screenWidth || '') + '×' + (data.browserInfo && data.browserInfo.screenHeight || ''));
      lines.push('- **Viewport:** ' + (data.browserInfo && data.browserInfo.viewportWidth || '') + '×' + (data.browserInfo && data.browserInfo.viewportHeight || ''));
      lines.push('');

      if (a.uncaught.length > 0) {
        lines.push('### Uncaught errors / unhandled rejections');
        lines.push('```');
        a.uncaught.forEach(function (e) {
          lines.push('[' + (e.type || 'error') + '] ' + (e.message || ''));
          if (e.source) lines.push('  at ' + e.source + (e.line != null ? ':' + e.line + (e.col != null ? ':' + e.col : '') : ''));
          if (e.stack) lines.push(e.stack);
        });
        lines.push('```');
        lines.push('');
      }

      if (a.consoleErrors.length > 0 || a.consoleWarnings.length > 0) {
        lines.push('### Console errors and warnings');
        lines.push('```');
        (a.consoleErrors.concat(a.consoleWarnings)).forEach(function (e) {
          lines.push('[' + (e.type || 'log').toUpperCase() + '] ' + (e.args || []).join(' '));
        });
        lines.push('```');
        lines.push('');
      }

      if (a.failedRequests.length > 0 || a.slowRequests.length > 0) {
        lines.push('### Failed and slow network requests');
        lines.push('| Method | URL | Status | Duration | Note |');
        lines.push('|--------|-----|--------|----------|------|');
        a.failedRequests.forEach(function (r) {
          var u = escapeMd(r.url || '');
          lines.push('| ' + (r.method || '') + ' | ' + u + ' | ' + (r.status != null ? r.status : (r.error || '–')) + ' | ' + (r.duration != null ? r.duration + ' ms' : '–') + ' | Failed |');
        });
        a.slowRequests.forEach(function (r) {
          if (a.failedRequests.indexOf(r) === -1) {
            var u = escapeMd(r.url || '');
            lines.push('| ' + (r.method || '') + ' | ' + u + ' | ' + (r.status || '–') + ' | ' + (r.duration != null ? r.duration + ' ms' : '–') + ' | Slow |');
          }
        });
        lines.push('');
      }

      if (data.logs && data.logs.length > 0) {
        lines.push('### Full console log (all levels)');
        lines.push('```');
        data.logs.forEach(function (e) {
          lines.push('[' + (e.type || 'log').toUpperCase() + '] ' + (e.args || []).join(' '));
        });
        lines.push('```');
        lines.push('');
      }

      if (data.requests && data.requests.length > 0) {
        lines.push('### All network requests');
        lines.push('| Method | URL | Status | Duration |');
        lines.push('|--------|-----|--------|----------|');
        data.requests.forEach(function (r) {
          var u = escapeMd(r.url || '');
          lines.push('| ' + (r.method || '') + ' | ' + u + ' | ' + (r.status != null ? r.status : (r.error || '–')) + ' | ' + (r.duration != null ? r.duration + ' ms' : '–') + ' |');
        });
        lines.push('');
      }

      lines.push('### Screenshot');
      if (data.screenshot) {
        lines.push('![Screenshot](data:image/png;base64,' + data.screenshot.replace(/^data:image\/\w+;base64,/, '') + ')');
      } else {
        lines.push('_(Attach screenshot manually)_');
      }
      return lines.join('\n');
    },

    markdown: function (data) {
      return window.SmartBugReporterFormatters.github(data);
    }
  };
})();
