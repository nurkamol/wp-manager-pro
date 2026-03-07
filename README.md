# WP Manager Pro

> A comprehensive, agency-ready WordPress management suite — built with React 19, TypeScript, and the WordPress REST API.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![WordPress](https://img.shields.io/badge/WordPress-5.9%2B-21759b)
![PHP](https://img.shields.io/badge/PHP-7.4%2B-8892be)
![License](https://img.shields.io/badge/license-GPL--2.0%2B-green)

---

## Overview

**WP Manager Pro** replaces the need for multiple separate admin plugins by providing a single, fast, modern interface for managing every critical aspect of a WordPress site. It ships as a standard WordPress plugin — install it, activate it, and a full React-powered control panel appears under your WP Admin menu.

All operations happen through a secured REST API (`wp-manager-pro/v1`) that requires the `manage_options` capability on every route.

---

## What's New in v1.1.0

| Feature | Description |
|---------|-------------|
| 🗜️ Plugin/Theme ZIP Import & Export | Upload `.zip` files to install/overwrite, or export any plugin or theme as a ZIP |
| 🖥️ Monaco Editor | VS Code-powered syntax highlighting in File Manager — replaces plain textarea |
| 📤 File Upload & Rename | Upload files to any directory; rename files and folders in-place |
| 🗃️ Database Row CRUD | Insert, edit, and delete individual table rows + export tables as `.sql` dumps |
| 👤 Username Rename | Rename any user's login handle directly from the Users panel |
| 🐛 SCRIPT_DEBUG Toggle | Toggle `SCRIPT_DEBUG` constant alongside other debug flags |
| 🔍 Log Level Filter | Filter error log by: Error, Warning, Notice, Deprecated |
| 🖼️ SVG Support | Enable SVG uploads with per-role permissions and server-side sanitization |
| 🗑️ Reset Tools | Safely reset site content (posts, pages, comments, media, non-admin users) with count preview and double confirmation |

---

## Features

### Dashboard
- Real-time site health at a glance
- Active plugin/theme/user counts
- Available update alerts (core, plugins, themes)
- PHP memory limit, max execution time, upload limit
- Database size, uploads folder size, disk usage
- Recent posts summary

### Plugin Manager
- List all installed plugins with activation status and pending updates
- Activate / deactivate with instant feedback
- Delete plugins (with auto-deactivation guard)
- **NEW v1.1.0** Upload a `.zip` to install or overwrite an existing plugin
- **NEW v1.1.0** Export any installed plugin as a `.zip` download
- Search and install directly from the WordPress.org repository (with ratings, download counts, pagination)

### Theme Manager
- Browse all installed themes with screenshots, parent/child relationships
- Activate themes with one click
- Delete inactive themes
- **NEW v1.1.0** Upload a `.zip` to install or overwrite an existing theme
- **NEW v1.1.0** Export any installed theme as a `.zip` download
- Search and install from WordPress.org

### File Manager
- Full filesystem browser starting from `ABSPATH`
- Breadcrumb navigation with file metadata (size, modified date, writable status)
- **NEW v1.1.0** Monaco Editor (VS Code engine) with full syntax highlighting for PHP, JS, TS, CSS, JSON, SQL, YAML, HTML, SVG, Markdown, and more
- **NEW v1.1.0** Upload files directly to any directory
- **NEW v1.1.0** Rename files and folders in-place
- Create directories, delete files and folders
- Security: path traversal protection via `realpath()`, critical file guard (`wp-config.php`, `.htaccess`, `index.php`), 2 MB read limit

### Database Manager
- Table browser: engine, collation, row count, size in MB
- Paginated table data viewer
- **NEW v1.1.0** Insert, edit, and delete individual table rows
- **NEW v1.1.0** Export any table as a `.sql` dump download
- Search & Replace across all tables with correct serialized-data handling
- Single-table or bulk `OPTIMIZE TABLE`
- SQL query runner — `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN` only (read-safe)

### User Manager
- Paginated user list with avatars, roles, registration date, post count
- Change any user's role (prevents modifying your own role)
- **NEW v1.1.0** Rename any user's login username
- **Login As** — admin impersonation via secure one-time token (5-minute expiry)
- Delete users with post reassignment to admin (prevents self-deletion)
- Search and filter by role

### System Info
- WordPress: version, site/home URL, locale, charset, multisite, debug flags, memory limits
- PHP: version, OS, memory, loaded extensions (cURL, GD, Imagick, mbstring, OpenSSL, ZIP, Intl, OPcache)
- Database: host, version, size, charset, collation
- Server: software, IP, port, protocol, HTTPS status, disk space
- Active plugins with versions
- Defined WordPress constants
- Next 20 scheduled cron jobs

### Maintenance Mode
- Toggle maintenance mode on/off instantly
- Custom title and message
- Generates a styled `wp-content/maintenance.php` page served to all visitors
- Automatically removed on plugin deactivation

### Debug Tools
- Toggle `WP_DEBUG`, `WP_DEBUG_LOG`, `WP_DEBUG_DISPLAY`, `SAVEQUERIES` directly in `wp-config.php`
- **NEW v1.1.0** Toggle `SCRIPT_DEBUG` constant
- Error log viewer (last N lines, configurable)
- **NEW v1.1.0** Filter error log by level: Error, Warning, Notice, Deprecated
- **NEW v1.1.0** Copy entire log to clipboard with one click
- Clear error log with one click
- Auto-detects `wp-content/debug.log` or PHP `error_log` path

### Image Tools
- Enable/disable WebP conversion (requires GD or ImageMagick)
- Set maximum image dimensions (width × height)
- Configure JPEG quality
- Regenerate all registered thumbnail sizes in bulk
- **NEW v1.1.0** Enable SVG uploads with per-role permission control (administrator, editor, author)
- **NEW v1.1.0** Server-side SVG sanitization (strips `<script>`, `on*` event attributes, `javascript:` hrefs, `<foreignObject>`, `<base>`)

### Notes
- Color-coded, persistent note-taking (stored in a custom `wp_wmp_notes` table)
- Create, edit, delete notes
- Ordered by last updated

### Reset Tools *(New in v1.1.0)*
- Live count preview before any action (posts, pages, comments, media, non-admin users)
- Checkbox selection of which content types to reset
- Double confirmation dialog to prevent accidental data loss
- Safe deletion using WordPress core functions (`wp_delete_post`, `wp_delete_user`, etc.)
- Non-destructive to plugin settings, user accounts of administrators, or site configuration

---

## Requirements

| Requirement | Minimum |
|-------------|---------|
| WordPress   | 5.9     |
| PHP         | 7.4     |
| MySQL/MariaDB | 5.6+  |
| Browser     | Modern (ES2020+) |

---

## Installation

### From ZIP
1. Download `wp-manager-pro-1.1.0.zip` from the [Releases](https://github.com/nurkamol/wp-manager-pro/releases) page.
2. In WP Admin → **Plugins → Add New → Upload Plugin**.
3. Upload the ZIP and click **Install Now**, then **Activate**.
4. Navigate to **WP Manager** in the admin sidebar.

### Manual
```bash
# Unzip into your plugins directory
unzip wp-manager-pro-1.1.0.zip -d /path/to/wp-content/plugins/
```

Then activate via WP Admin → **Plugins**.

---

## Building from Source

### Prerequisites
```bash
node >= 18
npm >= 9
```

### Setup
```bash
git clone https://github.com/nurkamol/wp-manager-pro.git
cd wp-manager-pro
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
# Outputs:
#   assets/build/index.js   (~589 kB, ~170 kB gzipped)
#   assets/build/style.css  (~37.5 kB, ~7.5 kB gzipped)
```

### Package Plugin ZIP
```bash
cd ..
zip -r wp-manager-pro-1.1.0.zip \
  wp-manager-pro/wp-manager-pro.php \
  wp-manager-pro/includes/ \
  wp-manager-pro/assets/
```

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.7 | Type safety |
| Vite | 6 | Build tool |
| Tailwind CSS | 3.4 | Utility-first styling |
| shadcn/ui | manual | Component library (Radix UI) |
| TanStack Query | v5 | Server state & caching |
| React Router | v7 | Client-side routing (HashRouter) |
| Monaco Editor | latest | VS Code editor engine (File Manager) |
| Lucide React | 0.469 | Icon set |
| Sonner | 1.7 | Toast notifications |

### Backend
| Technology | Details |
|-----------|---------|
| PHP | 7.4+ |
| WordPress REST API | Namespace: `wp-manager-pro/v1` |
| Authentication | WordPress nonce (`wp_rest`) |
| Authorization | `manage_options` capability on all routes |

---

## REST API Reference

**Base URL:** `{site_url}/wp-json/wp-manager-pro/v1`

All endpoints require a valid WordPress nonce in the `X-WP-Nonce` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Site stats & health |
| GET | `/plugins` | List all plugins |
| POST | `/plugins/activate` | Activate plugin |
| POST | `/plugins/deactivate` | Deactivate plugin |
| DELETE | `/plugins/delete` | Delete plugin |
| POST | `/plugins/install` | Install from WP.org |
| GET | `/plugins/search` | Search WP.org |
| POST | `/plugins/upload` | **v1.1.0** Upload plugin ZIP |
| GET | `/plugins/export` | **v1.1.0** Create plugin ZIP export |
| GET | `/plugins/download` | **v1.1.0** Stream plugin ZIP download |
| GET | `/themes` | List all themes |
| POST | `/themes/activate` | Activate theme |
| DELETE | `/themes/delete` | Delete theme |
| POST | `/themes/install` | Install from WP.org |
| GET | `/themes/search` | Search WP.org |
| POST | `/themes/upload` | **v1.1.0** Upload theme ZIP |
| GET | `/themes/export` | **v1.1.0** Create theme ZIP export |
| GET | `/themes/download` | **v1.1.0** Stream theme ZIP download |
| GET | `/files` | List directory contents |
| GET | `/files/read` | Read file content |
| POST | `/files/write` | Write file content |
| DELETE | `/files/delete` | Delete file or directory |
| POST | `/files/mkdir` | Create directory |
| POST | `/files/upload` | **v1.1.0** Upload file to directory |
| POST | `/files/rename` | **v1.1.0** Rename file or folder |
| GET | `/database/tables` | List database tables |
| GET | `/database/table-data` | Browse table rows |
| POST | `/database/search-replace` | Search & replace |
| POST | `/database/optimize` | Optimize tables |
| POST | `/database/query` | Run SQL query |
| POST | `/database/row` | **v1.1.0** Insert table row |
| PUT | `/database/row` | **v1.1.0** Update table row |
| DELETE | `/database/row` | **v1.1.0** Delete table row |
| GET | `/database/export` | **v1.1.0** Export table as SQL dump |
| GET | `/system` | System information |
| GET | `/maintenance` | Maintenance status |
| POST | `/maintenance/toggle` | Toggle maintenance mode |
| GET | `/users` | List users |
| POST | `/users/change-role` | Change user role |
| POST | `/users/login-as` | Generate login token |
| DELETE | `/users/delete` | Delete user |
| POST | `/users/rename` | **v1.1.0** Rename user login |
| GET | `/notes` | List notes |
| POST | `/notes` | Create note |
| PUT | `/notes/{id}` | Update note |
| DELETE | `/notes/{id}` | Delete note |
| GET | `/debug` | Debug status |
| POST | `/debug/toggle` | Toggle debug constants |
| GET | `/debug/log` | Read error log |
| DELETE | `/debug/log/clear` | Clear error log |
| GET | `/images/settings` | Image settings |
| POST | `/images/settings` | Save image settings |
| POST | `/images/regenerate` | Regenerate thumbnails |
| GET | `/reset/status` | **v1.1.0** Get content counts |
| POST | `/reset/execute` | **v1.1.0** Execute site reset |

---

## Project Structure

```
wp-manager-pro/
├── wp-manager-pro.php              # Plugin entry point, constants, activation hooks
├── includes/
│   ├── class-plugin.php            # Singleton bootstrap, hook registration
│   ├── class-admin.php             # Admin menu, asset enqueuing, script localization
│   └── api/
│       ├── class-routes.php        # REST route registration
│       └── controllers/
│           ├── class-dashboard-controller.php
│           ├── class-plugins-controller.php
│           ├── class-themes-controller.php
│           ├── class-files-controller.php
│           ├── class-database-controller.php
│           ├── class-users-controller.php
│           ├── class-system-controller.php
│           ├── class-maintenance-controller.php
│           ├── class-debug-controller.php
│           ├── class-images-controller.php
│           ├── class-notes-controller.php
│           └── class-reset-controller.php   # v1.1.0
├── assets/
│   └── build/
│       ├── index.js                # Compiled React app
│       └── style.css               # Compiled styles
├── src/                            # React source (TypeScript)
│   ├── main.tsx
│   ├── index.css
│   ├── App.tsx
│   ├── lib/
│   │   ├── api.ts                  # REST API client (+ upload() method)
│   │   └── utils.ts
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── PageHeader.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ui/                     # shadcn components
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Plugins.tsx
│       ├── Themes.tsx
│       ├── FileManager.tsx         # Monaco Editor + Upload + Rename
│       ├── Database.tsx            # Row CRUD + Export
│       ├── Users.tsx               # Username Rename
│       ├── SystemInfo.tsx
│       ├── Maintenance.tsx
│       ├── Debug.tsx               # SCRIPT_DEBUG + Level filter + Copy
│       ├── ImageTools.tsx          # SVG Support
│       ├── Notes.tsx
│       └── Reset.tsx               # v1.1.0 Reset Tools
├── releases/
│   ├── v1.0.0.md
│   └── v1.1.0.md
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── CHANGELOG.md
└── README.md
```

---

## Security

- All REST endpoints are protected by `manage_options` capability check
- WordPress nonce validation on every request (`wp_rest`)
- File Manager uses `realpath()` path traversal prevention — all paths must resolve inside `ABSPATH`
- Critical files (`wp-config.php`, `.htaccess`, `index.php`) are write-protected in the delete and rename endpoints
- File read is limited to text-based extensions (no binary execution)
- Login-As tokens are single-use, stored in WordPress transients, expire in 5 minutes
- Database query runner is read-only (`SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN` only)
- SVG uploads are sanitized server-side: strips `<script>`, `on*` event attrs, `javascript:` hrefs, `<foreignObject>`, `<base>` tags
- Username rename validates with `sanitize_user()` + `validate_username()`, checks for conflicts
- Reset Tools requires explicit `confirm: true` flag; uses WordPress core deletion functions only
- All user inputs are sanitized with `sanitize_text_field()`, `absint()`, `wp_kses_post()`

---

## License

GPL v2 or later — see [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html).

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.
