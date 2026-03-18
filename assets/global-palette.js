(function () {
  'use strict';

  var PLUGIN_URL = window._wmpGlobal && window._wmpGlobal.pluginUrl ? window._wmpGlobal.pluginUrl : '';
  var SHORTCUT   = window._wmpGlobal && window._wmpGlobal.shortcut  ? window._wmpGlobal.shortcut  : 'shift+p';

  var NAV_ITEMS = [
    { label: 'Dashboard',          icon: '⊞', route: '/',                hint: 'home' },
    { label: 'Plugins',            icon: '🧩', route: '/plugins',         hint: 'plugins' },
    { label: 'Themes',             icon: '🎨', route: '/themes',          hint: 'themes' },
    { label: 'Update Manager',     icon: '🔄', route: '/updates',         hint: 'updates' },
    { label: 'File Manager',       icon: '📁', route: '/file-manager',    hint: 'files' },
    { label: 'Users',              icon: '👥', route: '/users',           hint: 'users' },
    { label: 'Database',           icon: '🗄', route: '/database',        hint: 'database' },
    { label: 'DB Backup',          icon: '💾', route: '/backup',          hint: 'backup' },
    { label: 'Maintenance',        icon: '🚧', route: '/maintenance',     hint: 'maintenance' },
    { label: 'Debug Tools',        icon: '🐛', route: '/debug',           hint: 'debug' },
    { label: 'Dev Tools',          icon: '>_', route: '/dev-tools',       hint: 'dev-tools' },
    { label: 'Image Tools',        icon: '🖼', route: '/images',          hint: 'images' },
    { label: 'Media Manager',      icon: '📷', route: '/media-manager',   hint: 'media' },
    { label: 'Performance',        icon: '⚡', route: '/performance',     hint: 'performance' },
    { label: 'Cron Manager',       icon: '🕐', route: '/cron',            hint: 'cron' },
    { label: 'Content Tools',      icon: '✏️', route: '/content-tools',   hint: 'content' },
    { label: 'Post Types',         icon: '⊞',  route: '/post-types',       hint: 'cpt' },
    { label: 'Notes',              icon: '📝', route: '/notes',           hint: 'notes' },
    { label: 'Code Snippets',      icon: '</>', route: '/snippets',        hint: 'snippets' },
    { label: 'Redirects',          icon: '↩', route: '/redirects',       hint: 'redirects' },
    { label: 'Email / SMTP',       icon: '✉️', route: '/email',           hint: 'email' },
    { label: 'Audit Log',          icon: '📋', route: '/audit-log',       hint: 'audit' },
    { label: 'Agency Tools',       icon: '💼', route: '/agency',          hint: 'agency' },
    { label: 'System Info',        icon: '🖥', route: '/system',          hint: 'system' },
    { label: 'Security',           icon: '🛡', route: '/security',        hint: 'security' },
    { label: 'Security Scanner',   icon: '🔍', route: '/security-scanner',hint: 'scanner' },
    { label: 'Dev Utilities',      icon: '🔧', route: '/developer',       hint: 'dev' },
    { label: 'Reset Tools',        icon: '↺',  route: '/reset',           hint: 'reset' },
    { label: 'Settings',           icon: '⚙️', route: '/settings',        hint: 'settings' },
  ];

  var activeIndex = 0;
  var filtered    = NAV_ITEMS.slice();
  var overlay, input, list, backdrop;

  // ── Build DOM ──────────────────────────────────────────────────────────────

  function build() {
    // Styles
    var style = document.createElement('style');
    style.textContent = [
      '#wmp-palette-backdrop{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}',
      '#wmp-palette{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:999999;',
        'width:min(580px,92vw);background:#1e2535;border:1px solid #334155;border-radius:12px;',
        'box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '#wmp-palette-search{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #334155}',
      '#wmp-palette-search svg{flex-shrink:0;color:#64748b}',
      '#wmp-palette-input{flex:1;background:transparent;border:none;outline:none;font-size:15px;color:#f1f5f9;',
        'caret-color:#3b82f6}',
      '#wmp-palette-input::placeholder{color:#475569}',
      '#wmp-palette-esc{font-size:11px;color:#475569;background:#0f172a;border:1px solid #334155;',
        'border-radius:4px;padding:2px 6px;font-family:monospace}',
      '#wmp-palette-list{max-height:360px;overflow-y:auto;padding:6px 0}',
      '#wmp-palette-list::-webkit-scrollbar{width:4px}',
      '#wmp-palette-list::-webkit-scrollbar-track{background:transparent}',
      '#wmp-palette-list::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}',
      '.wmp-pi{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background .1s}',
      '.wmp-pi:hover,.wmp-pi.active{background:#1e3a5f}',
      '.wmp-pi.active{background:#1d4ed8}',
      '.wmp-pi-icon{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;',
        'font-size:14px;background:#0f172a;flex-shrink:0}',
      '.wmp-pi.active .wmp-pi-icon{background:rgba(255,255,255,.15)}',
      '.wmp-pi-label{flex:1;font-size:13px;color:#e2e8f0}',
      '.wmp-pi.active .wmp-pi-label{color:#fff}',
      '.wmp-pi-hint{font-size:11px;color:#475569;font-family:monospace}',
      '.wmp-pi.active .wmp-pi-hint{color:rgba(255,255,255,.5)}',
      '#wmp-palette-empty{padding:32px;text-align:center;font-size:13px;color:#475569}',
      '#wmp-palette-footer{display:flex;align-items:center;gap:16px;padding:8px 16px;border-top:1px solid #1e293b;',
        'font-size:11px;color:#475569}',
      '#wmp-palette-footer kbd{background:#0f172a;border:1px solid #334155;border-radius:3px;',
        'padding:1px 5px;font-family:monospace;font-size:10px;color:#94a3b8}',
      '#wmp-palette-footer .wmp-badge{margin-left:auto;font-size:10px;color:#334155}',
    ].join('');
    document.head.appendChild(style);

    // Backdrop
    backdrop = document.createElement('div');
    backdrop.id = 'wmp-palette-backdrop';
    backdrop.addEventListener('click', close);

    // Palette wrapper
    overlay = document.createElement('div');
    overlay.id = 'wmp-palette';

    // Search row
    var searchRow = document.createElement('div');
    searchRow.id = 'wmp-palette-search';
    searchRow.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';

    input = document.createElement('input');
    input.id = 'wmp-palette-input';
    input.type = 'text';
    input.placeholder = 'Search pages…';
    input.autocomplete = 'off';
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);

    var esc = document.createElement('span');
    esc.id = 'wmp-palette-esc';
    esc.textContent = 'Esc';

    searchRow.appendChild(input);
    searchRow.appendChild(esc);

    // List
    list = document.createElement('div');
    list.id = 'wmp-palette-list';

    // Footer
    var footer = document.createElement('div');
    footer.id = 'wmp-palette-footer';
    footer.innerHTML = '<kbd>↑↓</kbd> navigate &nbsp;<kbd>↵</kbd> open &nbsp;<kbd>Esc</kbd> close' +
      '<span class="wmp-badge">WP Manager Pro</span>';

    overlay.appendChild(searchRow);
    overlay.appendChild(list);
    overlay.appendChild(footer);
  }

  // ── Render list ────────────────────────────────────────────────────────────

  function render() {
    list.innerHTML = '';
    if (!filtered.length) {
      var empty = document.createElement('div');
      empty.id = 'wmp-palette-empty';
      empty.textContent = 'No results';
      list.appendChild(empty);
      return;
    }
    filtered.forEach(function (item, i) {
      var row = document.createElement('div');
      row.className = 'wmp-pi' + (i === activeIndex ? ' active' : '');
      row.dataset.index = i;
      row.innerHTML =
        '<div class="wmp-pi-icon">' + item.icon + '</div>' +
        '<span class="wmp-pi-label">' + item.label + '</span>' +
        '<span class="wmp-pi-hint">' + item.hint + '</span>';
      row.addEventListener('mouseenter', function () { setActive(i); });
      row.addEventListener('click', function () { activate(i); });
      list.appendChild(row);
    });
  }

  function setActive(i) {
    activeIndex = i;
    var rows = list.querySelectorAll('.wmp-pi');
    rows.forEach(function (r, ri) {
      r.classList.toggle('active', ri === i);
    });
    var active = list.querySelector('.wmp-pi.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  function onInput() {
    var q = input.value.toLowerCase().trim();
    filtered = q
      ? NAV_ITEMS.filter(function (n) {
          return n.label.toLowerCase().indexOf(q) !== -1 || n.hint.indexOf(q) !== -1;
        })
      : NAV_ITEMS.slice();
    activeIndex = 0;
    render();
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(activeIndex);
    } else if (e.key === 'Escape') {
      close();
    }
  }

  function activate(i) {
    var item = filtered[i];
    if (!item || !PLUGIN_URL) return;
    close();
    var url = PLUGIN_URL + (item.route === '/' ? '' : '#' + item.route);
    window.location.href = url;
  }

  // ── Open / Close ───────────────────────────────────────────────────────────

  function open() {
    // If we're inside the plugin page, delegate to the in-app palette
    if (window.location.href.indexOf('page=wp-manager-pro') !== -1) return;

    if (!overlay) build();

    filtered    = NAV_ITEMS.slice();
    activeIndex = 0;

    document.body.appendChild(backdrop);
    document.body.appendChild(overlay);
    render();
    setTimeout(function () { input.value = ''; input.focus(); }, 30);
  }

  function close() {
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    if (overlay  && overlay.parentNode)  overlay.parentNode.removeChild(overlay);
  }

  // ── Global keyboard listener ───────────────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (!e.metaKey && !e.ctrlKey) return;
    var key = e.key.toLowerCase();
    var matches =
      (SHORTCUT === 'shift+p' && e.shiftKey && key === 'p') ||
      (SHORTCUT === 'shift+k' && e.shiftKey && key === 'k') ||
      (SHORTCUT === 'k'       && !e.shiftKey && key === 'k');
    if (!matches) return;
    if (window.location.href.indexOf('page=wp-manager-pro') !== -1) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  }, true);

  // ── Admin bar button click ─────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('wp-admin-bar-wmp-launch');
    if (btn) {
      btn.addEventListener('click', function (e) {
        if (window.location.href.indexOf('page=wp-manager-pro') !== -1) return;
        e.preventDefault();
        open();
      });
    }
  });

})();
