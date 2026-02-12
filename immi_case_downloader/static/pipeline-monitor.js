/* ═══════════════════════════════════════════════════════════════════════
   IMMI-Case Pipeline Monitor
   Extracted from pipeline.html for maintainability
   ═══════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  var monitorEl = document.getElementById('monitor-section');
  if (!monitorEl) return;

  var statusUrl = monitorEl.dataset.statusUrl;
  var logUrl = monitorEl.dataset.logUrl;
  var actionUrl = monitorEl.dataset.actionUrl;
  var pipelineRunning = monitorEl.dataset.running === 'true';
  var autoScroll = true;
  var startTime = Date.now();
  var activeFilter = '';
  var lastLogCount = parseInt(monitorEl.dataset.logCount, 10) || 0;

  var PHASE_BG = {crawl: 'bg-primary', clean: 'bg-info', download: 'bg-warning text-dark', pipeline: 'bg-secondary'};
  var LEVEL_ICON = {
    error: 'bi-x-circle-fill text-danger',
    warn: 'bi-exclamation-triangle-fill text-warning',
    success: 'bi-check-circle-fill text-success',
    info: 'bi-info-circle text-muted',
    debug: 'bi-bug text-muted'
  };
  var STRATEGY_BG = {direct: 'badge bg-success', viewdb: 'badge bg-warning text-dark', keyword_search: 'badge bg-info'};
  var PHASE_ICONS = {crawl: 'bi-search', clean: 'bi-funnel', download: 'bi-cloud-download'};

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updatePhaseIndicator(phase, data) {
    var el = document.getElementById('phase-' + phase);
    if (!el) return;
    var circle = el.querySelector('.phase-indicator');
    if (!circle) return;

    while (circle.firstChild) circle.removeChild(circle.firstChild);
    circle.className = 'phase-indicator';

    var completed = data.phases_completed.indexOf(phase) >= 0;
    var active = data.phase === phase;

    if (completed) {
      circle.classList.add('completed');
      var icon = document.createElement('i');
      icon.className = 'bi bi-check-lg';
      circle.appendChild(icon);
    } else if (active) {
      circle.classList.add('active');
      var spinner = document.createElement('span');
      spinner.className = 'spinner-border spinner-border-sm';
      circle.appendChild(spinner);
    } else {
      circle.classList.add('pending');
      var icon = document.createElement('i');
      icon.className = 'bi ' + (PHASE_ICONS[phase] || 'bi-circle');
      circle.appendChild(icon);
    }
  }

  function appendLogEntries(newEntries) {
    var container = document.getElementById('log-container');
    if (!container) return;

    newEntries.forEach(function(event) {
      var div = document.createElement('div');
      div.className = 'log-entry d-flex gap-2 py-1 border-bottom';
      div.dataset.level = event.level;
      div.dataset.category = event.category;

      var ts = document.createElement('span');
      ts.className = 'text-muted';
      ts.style.minWidth = '70px';
      ts.textContent = event.timestamp.slice(-8);
      div.appendChild(ts);

      var badge = document.createElement('span');
      badge.className = 'badge ' + (PHASE_BG[event.phase] || 'bg-secondary');
      badge.style.minWidth = '55px';
      badge.textContent = event.phase;
      div.appendChild(badge);

      var iconSpan = document.createElement('span');
      var icon = document.createElement('i');
      icon.className = 'bi ' + (LEVEL_ICON[event.level] || 'bi-info-circle text-muted');
      iconSpan.appendChild(icon);
      div.appendChild(iconSpan);

      var msg = document.createElement('span');
      msg.className = 'flex-grow-1';
      msg.textContent = event.message;
      div.appendChild(msg);

      if (activeFilter) {
        var show = activeFilter === event.level || activeFilter === event.category;
        div.style.display = show ? '' : 'none';
      }

      container.appendChild(div);
    });

    if (autoScroll) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /* Elapsed timer */
  if (pipelineRunning) {
    function updateElapsed() {
      var secs = Math.floor((Date.now() - startTime) / 1000);
      var m = Math.floor(secs / 60), s = secs % 60;
      var el = document.getElementById('elapsed-badge');
      if (el) el.textContent = (m > 0 ? m + 'm ' : '') + s + 's elapsed';
    }
    setInterval(updateElapsed, 1000);

    function refreshPipeline() {
      fetch(statusUrl)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var pt = document.getElementById('progress-text');
          if (pt) pt.textContent = data.phase_progress;

          var bar = document.getElementById('progress-bar');
          if (bar) {
            bar.style.width = data.overall_progress + '%';
            bar.textContent = data.overall_progress + '%';
            if (data.overall_progress > 80) bar.classList.add('bg-success');
          }

          setText('stat-found', data.stats.crawl.total_found.toLocaleString());
          setText('stat-new', data.stats.crawl.new_added.toLocaleString());
          setText('stat-downloaded', data.stats.download.downloaded.toLocaleString());
          setText('stat-errors', data.errors.length.toLocaleString());

          var sb = document.getElementById('strategy-badge');
          if (sb && data.current_strategy) {
            sb.textContent = data.current_strategy;
            sb.className = STRATEGY_BG[data.current_strategy] || 'badge bg-secondary';
          }

          updatePhaseIndicator('crawl', data);
          updatePhaseIndicator('clean', data);
          updatePhaseIndicator('download', data);

          if (data.log.length > lastLogCount) {
            appendLogEntries(data.log.slice(lastLogCount));
            lastLogCount = data.log.length;
          }
          setText('log-count', data.log.length.toString());

          if (!data.running) {
            window.location.reload();
          } else {
            setTimeout(refreshPipeline, 2000);
          }
        })
        .catch(function() { setTimeout(refreshPipeline, 5000); });
    }
    setTimeout(refreshPipeline, 2000);
  }

  /* Log filter tabs */
  document.querySelectorAll('#log-filters button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#log-filters button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;

      document.querySelectorAll('#log-container .log-entry').forEach(function(entry) {
        if (!activeFilter) {
          entry.style.display = '';
        } else {
          var match = entry.dataset.level === activeFilter || entry.dataset.category === activeFilter;
          entry.style.display = match ? '' : 'none';
        }
      });
    });
  });

  /* Global functions */
  window.toggleAutoScroll = function() {
    autoScroll = !autoScroll;
    var btn = document.getElementById('scroll-btn');
    if (btn) btn.classList.toggle('btn-primary', autoScroll);
  };

  window.exportLog = function() {
    fetch(logUrl)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pipeline_log_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
      });
  };

  window.stopPipeline = function() {
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('stopPipelineModal'));
    modal.show();
  };

  window.confirmStopPipeline = function() {
    fetch(actionUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'stop'})
    }).then(function() { window.location.reload(); });
  };
})();
