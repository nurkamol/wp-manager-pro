# WP Manager Pro — Roadmap

This document outlines the planned feature development for WP Manager Pro. Releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Minor versions (`1.x.0`) add new features; patch versions (`1.x.y`) deliver bug fixes and polish.

> **Current version:** 2.9.2 — last updated 2026-03-17

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

---

### v3.0.0 — Notification Centre + Major UI Refresh
*Focus: proactive monitoring and polished UX*

- **Notification Centre** — persistent in-app alert bell for failed crons, backup errors, login lockouts, update failures, SSL expiry, vulnerability alerts
- **Dashboard Widgets** — configurable widget grid on the Dashboard: uptime ping, recent audit events, cache hit ratio, pending updates count
- **Global Search** — `Cmd+F` overlay searching across plugins, files, users, notes, options, and audit log simultaneously
- **Mobile / Tablet Layout** — fully responsive layout for phones and tablets (sidebar collapses to bottom nav)
- **Dark Mode Auto-Sync** — follow OS `prefers-color-scheme` when no manual preference is set
- **Custom Post Type Manager** — register, edit, and delete CPTs and taxonomies from the UI with visual label builder

---

## 💡 Backlog (Unscheduled)

| Idea | Notes |
|------|-------|
| **Multisite / Network Support** | Network dashboard, network plugin/theme manager, per-site switching |
| **Webhook Manager** | Register outgoing webhooks triggered by WP events (publish post, user register, etc.) |
| **REST API Key Manager** | Generate and manage application passwords / API keys for external integrations |
| **WooCommerce Tools** | Order stats, stock alerts, coupon manager — shown when WooCommerce is active |
| **Keyboard Shortcuts** | `S` to save, `Esc` to close dialogs, `?` for help overlay |
| **WP-CLI Runner** | Execute WP-CLI commands from the browser UI with live output |
| **Template Hierarchy Viewer** | Show which template file is currently rendering the page |
| **Plugin Health Check** | Flag plugins known for conflicts, security issues, or poor performance |

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
