# WP Manager Pro — Roadmap

This document outlines the planned feature development for WP Manager Pro. Releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Minor versions (`1.x.0`) add new features; patch versions (`1.x.y`) deliver bug fixes and polish.

> **Current version:** 2.3.0 — last updated 2026-03-11

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

---

## 🔜 Upcoming

### v2.4.0 — Advanced Dev Tools
*Focus: developer-centric tools for staging and production workflows*

- **wp-config.php Visual Editor** — edit all defined constants visually (beyond just debug flags); groups: Database, Debug, Salts, URLs, Paths, Multisite, Custom
- **`.htaccess` Editor** — dedicated Monaco editor with Apache syntax highlighting; automatic backup before each save
- **Environment Badge** — label the current site as `production`, `staging`, or `development` in the sidebar header; configurable via UI or `WP_ENVIRONMENT_TYPE` constant
- **Command Palette** — `Cmd+K` / `Ctrl+K` overlay for instant keyboard navigation to any page or action within the plugin
- **PHP Info Viewer** — full `phpinfo()` output rendered as a searchable, filterable table (no raw HTML dump)
- **Query Monitor (lite)** — show slow queries collected via `SAVEQUERIES`, total query count, and memory delta per WP hook when Debug mode is active

---

### v2.5.0 — Import / Export / Sync
*Focus: portability of settings and content between environments*

- **Settings Export / Import** — export all WP Manager Pro settings (SMTP, branding, redirects, snippets, image options) as a signed JSON bundle; import on any site
- **WordPress Native Exporter** — trigger the built-in WordPress XML export (posts, pages, media) without navigating away from WP Manager Pro
- **Remote Pull (FTP / SFTP)** — connect to a remote server via FTP/SFTP credentials; pull files or database to the local environment with progress indicator
- **Environment Sync** — push/pull `wp_options` configuration keys between two connected sites (e.g. staging → production)

---

### v2.6.0 — Multisite Support
*Focus: first-class WordPress Multisite / Network compatibility*

- **Network Dashboard** — aggregate stats across all subsites (plugin count, update alerts, storage usage)
- **Network Plugin / Theme Manager** — network-activate, deactivate, and update plugins and themes across the whole network
- **Per-Site Controls** — switch between subsites from within the plugin UI without a full page reload
- **Super Admin Actions** — manage network users, add/remove subsites, and configure network options

---

## 💡 Backlog (Unscheduled)

These items are under consideration but have not been assigned to a release milestone.

| Idea | Notes |
|------|-------|
| **Webhook Manager** | Register outgoing webhooks triggered by WP events (publish post, user register, etc.) |
| **REST API Key Manager** | Generate and manage application passwords / API keys for external integrations |
| **Global Search** | Search across plugins, files, users, notes, and options from a single input |
| **Keyboard Shortcuts** | Site-wide shortcuts: `S` to save, `Esc` to close dialogs, `?` for help overlay |
| **Mobile / Tablet Layout** | Responsive layout improvements for tablets and phones |
| **Notification Centre** | Persistent in-app alert log for important events (failed crons, backup errors, login lockouts) |
| **Dark Mode Sync** | Follow OS `prefers-color-scheme` automatically if no manual preference is set |
| **Plugin Health Check** | Detect plugins known to cause conflicts, security issues, or performance problems |
| **Custom Post Type Manager** | Register, edit, and delete custom post types and taxonomies from the UI |
| **WooCommerce Tools** | Basic order stats, stock alerts, and coupon manager when WooCommerce is active |

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
