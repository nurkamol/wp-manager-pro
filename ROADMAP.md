# WP Manager Pro — Roadmap

This document outlines the planned feature development for WP Manager Pro. Releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Minor versions (`1.x.0`) add new features; patch versions (`1.x.y`) deliver bug fixes and polish.

> **Current version:** 3.4.5 — last updated 2026-06-05

---

## ✅ Released

| Version | Highlights |
|---------|-----------|
| [1.0.0] | Dashboard, Plugin Manager, Theme Manager, File Manager, Database Manager, User Manager, System Info, Maintenance Mode, Debug Tools, Image Tools, Notes |
| [1.1.0] | Monaco Editor, ZIP import/export for plugins & themes, file upload & rename, DB row CRUD, username rename, SVG support, Reset Tools |
| [1.2.0] | One-click plugin/theme updates, version history & downgrade, light/dark mode toggle |
| [1.3.0] | Maintenance appearance editor (gradients, countdown, live preview), Security page (admin URL protection), AVIF support, DB row edit/delete/add |
| [1.4.0] | Code Snippets, Redirect Manager, Email/SMTP, Database Backup, Audit Log |
| [1.5.0] | WebP/AVIF conversion on upload, batch convert existing media, maintenance scope & bypass URL |
| [1.6.0] | Serve WebP automatically, replace original with WebP, auto-delete sidecar files |
| [1.7.0] | Monaco editor in Code Snippets, Scheduled Backups, Server Config Generator, White-label/Branding |
| [1.8.0] | Sidebar redesign (shadcn sidebar-07 icon-rail), WP Admin menu hide/show toggle |
| [1.9.0] | Performance page: DB Cleanup, Transient Manager, Object Cache Status |
| [2.0.0] | Security Suite: Login Limiter, Lockout Log, IP Blocklist, XML-RPC disable, Hide WP Version, File Integrity Check, TOTP 2FA |
| [2.1.0] | Cron Manager: Event Browser, Manual Trigger, Delete Events, Custom Schedules, Cron Health tab with real-cron setup guide |
| [2.2.0] | Media Manager: Orphaned finder, Unused bulk delete, Duplicate detector (MD5), JPEG/PNG compression — 9 new REST endpoints |
| [2.3.0] | Content Tools: Bulk Post Editor, Post Duplicator, Scheduled Post Manager, Options Table Editor — 10 new REST endpoints |
| [2.3.1] | Bundled Redis drop-in (no external plugin needed), Redis admin bar node with flush cache, maintenance toggle visibility setting, custom bypass URL slug, asset cache-busting fix |
| [2.4.0] | Dev Tools: wp-config.php visual editor, .htaccess editor with auto-backup, PHP Info viewer, Query Monitor (lite), Environment badge in sidebar |
| [2.5.0] | Command Palette (Cmd+Shift+P), Settings Export/Import (signed JSON bundle), WordPress XML Content Export |
| [2.6.0] | Update Manager: changelog preview, pre-update backup, rollback, scheduled updates via WP Cron — 9 new REST endpoints |
| [2.7.0] | Security Scanner: Malware Scanner (13 patterns, 8k files), Vulnerability Database (WPScan CVE API), SSL Monitor, Outdated Core/PHP Alert, Security Score ring — 6 new REST endpoints |
| [2.7.1] | Bug fixes: self-update system (GitHub Releases), premium plugin false "Done", 2FA QR code, custom login logout, plain permalink warning |
| [2.8.0] | Agency Tools: Mail Interceptor (log + dev mode + preview + resend), White-label Login Page, Admin UI Customiser, Client Report Generator, Coming Soon Mode — 9 new REST endpoints |
| [2.8.1] | Bug fixes: self-update badge stuck after update (missing version bump), Changelog dialog showing "No changelog available", read-path transient hook, Check WMP Update button |
| [2.9.0] | Developer Utilities: Hook Explorer, REST API Tester, Dummy Data Generator, Rewrite Rules Tester, Object Cache Browser, Database Prefix Changer — 12 new REST endpoints; Login Page UI redesign with Media Library picker and side-by-side live preview |
| [2.9.1] | Bug fixes: Login Page CSS not applying, Media Library button falling back to prompt(); Added Privacy & Terms links on login page, Coming Soon complete UI redesign with side-by-side preview |
| [2.9.2] | Bug fix: `window.wmpOpenMedia` bridge injected via `wp_add_inline_script('after')` resolves Media Library modal not opening; Settings → Branding logo Select button added |
| [2.9.3] | Bug fixes: Image Tools status cards (GD/ImageMagick/WebP/AVIF) all showing "Not available" due to `Imagick::queryFormats()` exception; Malware Scanner self-flagging own files (false positive); Malware Scanner file Inspect modal + Quarantine/Delete/Ignore actions; Sidebar environment badge redesign; Cron Manager spacing normalised |
| [2.9.4] | Deep root-cause fix for Media Library modal never opening: Rollup minifier named Lucide icon `const wp`, shadowing `window.wp` globally; fixed by switching to IIFE build format; `wmpOpenMedia` bridge hardened to use `window.wp` explicitly |
| [3.0.0] | Dark Mode Auto-Sync, Dashboard Widgets (configurable grid), Notification Centre (bell + slide-out panel), Mobile/Tablet Layout (bottom nav, auto-collapse), Global Search (live search in Command Palette), System-wide Command Palette overlay (WPMGR admin bar button), Custom Post Type Manager (CPTs + taxonomies UI) |
| [3.1.0] | Plugin Health Check (abandoned, compatibility, CVE, quality flags via WP.org + WPScan APIs, 24 h cached), WPMGR admin bar button polished, CPT/taxonomy pages added to Command Palette |
| [3.2.0] | Code editor replaced: Monaco → **CodeMirror 6** in File Manager and Snippets (inline + fullscreen). Fixes [#2](https://github.com/nurkamol/wp-manager-pro/issues/2): Monaco's CDN-loaded language workers left the editor as plain text on sites with strict CSP / firewalls / offline networks. CodeMirror 6 is bundled, no external requests, One-Dark theme, PHP / JS / TS / CSS / HTML / JSON / XML / SVG / Markdown / YAML support, new shared `CodeEditor` component |
| [3.2.1] | **Switch back from "Login as"** ([#3](https://github.com/nurkamol/wp-manager-pro/issues/3)): impersonating a user now adds a "Switch back to {admin}" admin-bar link that restores the original session. Secured by a nonce plus an HttpOnly, SameSite=Lax cookie-bound token kept only in the originating admin's browser; return is gated on the original account still being an administrator |
| [3.3.0] | **File Manager right-click actions** ([#4](https://github.com/nurkamol/wp-manager-pro/issues/4)): context menu on every file/folder (Open/Edit, Download, Rename, Duplicate, Copy, Cut, Paste into folder, Copy path, Delete), Copy/Cut/Paste between directories, recursive Duplicate with auto `-copy` suffix, inline New File, and one-click Download. New REST endpoints `/files/new`, `/files/copy`, `/files/move`, `/files/duplicate`, `/files/download` confined to `ABSPATH` with protected-file guards |
| [3.4.0] | **File Manager rebuilt on [elFinder 2.1.69](https://github.com/studio-42/elfinder)** ([#4](https://github.com/nurkamol/wp-manager-pro/issues/4)): drag-and-drop, multi-select, full toolbar, quick-look preview, thumbnails, tree-wide search, archive (zip) compress/extract, and chmod. Bundled PHP connector boots a `LocalFileSystem` volume rooted at `ABSPATH`, gated by `manage_options` + the REST nonce, with `wp-config.php` read-only/locked; conflict-safe with other elFinder-based plugins |
| [3.4.1] | **File Manager rendering & themes**: elFinder now renders in an isolated iframe (no more app CSS bleed), bundles jQuery UI theme CSS for correct widget styling, adds theme selection incl. a **Dark Slim** dark theme, advanced toolbar/context-menu config, and hides `.tmb`/`.DS_Store` from the listing |
| [3.4.2] | **File Manager editors & dark theme**: Filester-style "Edit file" submenu with bundled **ACE** (offline, syntax-highlighted) + built-in TextArea; contrast-fixed **Dark** theme so secondary columns/read-only rows are legible |
| [3.4.3] | **Fix**: "Edit file → ACE Editor" opened blank — WordPress' noConflict jQuery left the iframe without a global `$`, which elFinder's `editors.default` ACE loader relies on. Restored `$ = jQuery`; ACE now loads and renders the file. Bundled ACE autocomplete snippets |
| [3.4.4] | **Fixes** [#6](https://github.com/nurkamol/wp-manager-pro/issues/6): custom login page scattered elements → `flex-direction: column` centers the form, language switcher, and footer. **Improves** [#5](https://github.com/nurkamol/wp-manager-pro/issues/5): the File Manager iframe surfaces real load/init errors (proxy/CSP/404) with an "open in new tab" fallback instead of a silent blank panel |
| [3.4.5] | **Fixes** [#5](https://github.com/nurkamol/wp-manager-pro/issues/5) (root cause): the v3.4.0–v3.4.4 release **assets** were uploaded truncated, missing `assets/elfinder/` + `assets/global-palette.js`, so installs/self-updates 404'd all File Manager assets. All affected assets re-uploaded complete + verified; v3.4.5 ships the verified package so the self-updater auto-recovers stuck sites |

---

### v3.5.0 — Monitoring & Integrations
*Focus: outgoing integrations and automated reporting*

- **Scheduled Reports** — weekly/monthly HTML email digest of site health, security score, backup status, top audit events
- **Webhook Manager** — register outgoing webhooks triggered by WP events (publish post, user register, backup complete, etc.)
- **REST API Key Manager** — generate and manage application passwords / API keys for external integrations
- **WooCommerce Tools** — order stats, stock alerts, coupon manager (shown only when WooCommerce is active)

---

## 💡 Backlog (Unscheduled)

| Idea | Notes |
|------|-------|
| **Multisite / Network Support** | Network dashboard, network plugin/theme manager, per-site switching |
| **Keyboard Shortcuts** | `S` to save, `Esc` to close dialogs, `?` for help overlay |
| **WP-CLI Runner** | Execute WP-CLI commands from the browser UI with live output |
| **Template Hierarchy Viewer** | Show which template file is currently rendering the page |

---

## 📌 Versioning Policy

| Change type | Version bump |
|-------------|-------------|
| New pages / features | `minor` — `x.Y.0` |
| Bug fixes, UI polish | `patch` — `x.y.Z` |
| Breaking API changes | `major` — `X.0.0` |

---

## 🤝 Contributing

Have a feature request or want to vote on a backlog item? [Open an issue](https://github.com/nurkamol/wp-manager-pro/issues) on GitHub. Bug reports and pull requests are welcome.

---

[1.0.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.0.0
[1.1.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.1.0
[1.2.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.2.0
[1.3.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.3.0
[1.4.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.4.0
[1.5.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.5.0
[1.6.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.6.0
[1.7.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.7.0
[1.8.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.8.0
[1.9.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.9.0
[2.0.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.0.0

[2.1.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.1.0
[2.2.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.2.0
[2.3.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.3.0
[2.3.1]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.3.1
[2.4.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.4.0
[2.5.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.5.0
[2.6.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.6.0
[2.7.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.7.0
[2.7.1]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.7.1
[2.8.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.8.0
[2.8.1]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.8.1
[2.9.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.9.0
[2.9.1]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.9.1
[2.9.2]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.9.2
[2.9.3]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.9.3
[2.9.4]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v2.9.4
[3.0.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.0.0
[3.1.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.1.0
[3.2.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.2.0
[3.2.1]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.2.1
[3.3.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.3.0
[3.4.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.4.0
[3.4.1]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.4.1
[3.4.2]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.4.2
[3.4.3]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.4.3
[3.4.4]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.4.4
[3.4.5]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v3.4.5
