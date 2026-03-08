# WP Manager Pro

> A comprehensive, agency-ready WordPress management suite — built with React 19, TypeScript, and the WordPress REST API.

![Version](https://img.shields.io/badge/version-1.3.0-blue)
![WordPress](https://img.shields.io/badge/WordPress-5.9%2B-21759b)
![PHP](https://img.shields.io/badge/PHP-7.4%2B-8892be)
![License](https://img.shields.io/badge/license-GPL--2.0%2B-green)

---

## Screenshots

| Dashboard | Plugin Manager |
|-----------|---------------|
| ![Dashboard](screenshots/01-dashboard.png) | ![Plugin Manager](screenshots/02-plugin-manager.png) |

| Theme Manager | File Manager |
|--------------|-------------|
| ![Theme Manager](screenshots/03-theme-manager.png) | ![File Manager](screenshots/04-file-manager.png) |

| Database Manager | User Manager |
|-----------------|-------------|
| ![Database Manager](screenshots/05-database-manager.png) | ![User Manager](screenshots/06-user-manager.png) |

| Maintenance Mode | Debug Tools |
|-----------------|------------|
| ![Maintenance Mode](screenshots/07-maintenance-mode.png) | ![Debug Tools](screenshots/08-debug-tools.png) |

| Image Tools | Security |
|------------|---------|
| ![Image Tools](screenshots/09-image-tools.png) | ![Security](screenshots/13-security.png) |

| System Info | Reset Tools |
|------------|------------|
| ![System Info](screenshots/11-system-info.png) | ![Reset Tools](screenshots/12-reset-tools.png) |

| Notes | Plugin ZIP Upload |
|-------|-----------------|
| ![Notes](screenshots/10-notes.png) | ![Plugin ZIP Upload](screenshots/14-plugin-zip-upload.png) |

---

## Overview

**WP Manager Pro** replaces the need for multiple separate admin plugins by providing a single, fast, modern interface for managing every critical aspect of a WordPress site. It ships as a standard WordPress plugin — install it, activate it, and a full React-powered control panel appears under your WP Admin menu.

All operations happen through a secured REST API (`wp-manager-pro/v1`) that requires the `manage_options` capability on every route.

---

## What's New in v1.3.0

| Feature | Description |
|---------|-------------|
| 🎨 Maintenance Appearance Editor | Full gradient designer with 6 presets, custom color pickers, emoji icon picker, live preview pane |
| 🛡️ Security — Admin URL Hide | Move `wp-login.php` to a secret slug; block bots scanning the default login URL |
| 🖼️ AVIF Image Support | Enable AVIF uploads (requires PHP 8.1+ GD or ImageMagick with AVIF codec) |
| 🔗 Plugin Page Link | "Open" shortcut link directly in the WP Plugins list row |
| 🌙 Maintenance Countdown Timer | Toggle a live countdown clock on the maintenance page |
| 💾 Save Without Toggle | Save maintenance appearance settings without changing maintenance state |

## What's New in v1.2.0

| Feature | Description |
|---------|-------------|
| 🔄 Plugin & Theme Updates | One-click update button (amber) when an update is available |
| 📦 Version History & Downgrade | Browse all versions from WordPress.org API and install any version in one click |
| 🎯 Smart WP.org Search Buttons | Search results show Install / Update / Installed based on current status |
| 🌙 Light / Dark Mode Toggle | Sun/Moon toggle in sidebar; persists via `localStorage` |

## What's New in v1.1.0

| Feature | Description |
|---------|-------------|
| 🗜️ Plugin/Theme ZIP Import & Export | Upload `.zip` files to install/overwrite, or export any plugin or theme as a ZIP |
| 🖥️ Monaco Editor | VS Code-powered syntax highlighting in File Manager |
| 📤 File Upload & Rename | Upload files to any directory; rename files and folders in-place |
| 🗃️ Database Row CRUD | Insert, edit, and delete individual table rows + export tables as `.sql` dumps |
| 👤 Username Rename | Rename any user's login handle directly from the Users panel |
| 🐛 SCRIPT_DEBUG Toggle | Toggle `SCRIPT_DEBUG` constant alongside other debug flags |
| 🔍 Log Level Filter | Filter error log by: Error, Warning, Notice, Deprecated |
| 🖼️ SVG Support | Enable SVG uploads with per-role permissions and server-side sanitization |
| 🗑️ Reset Tools | Safely reset site content with count preview and double confirmation |

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
- Upload a `.zip` to install or overwrite an existing plugin
- Export any installed plugin as a `.zip` download
- Search and install directly from the WordPress.org repository
- **v1.2.0** One-click update button on plugins with available updates
- **v1.2.0** Version History dialog — browse and install any version from WordPress.org
- **v1.2.0** Smart WP.org search buttons: Install / Update / Installed ✓

### Theme Manager
- Browse all installed themes with screenshots, parent/child relationships
- Activate themes with one click
- Delete inactive themes
- Upload a `.zip` to install or overwrite an existing theme
- Export any installed theme as a `.zip` download
- Search and install from WordPress.org
- **v1.2.0** One-click update button on outdated themes
- **v1.2.0** Version History dialog — install any version
- **v1.2.0** Smart WP.org search buttons

### File Manager
- Full filesystem browser starting from `ABSPATH`
- Breadcrumb navigation with file metadata (size, modified date, writable status)
- Monaco Editor (VS Code engine) with full syntax highlighting for PHP, JS, TS, CSS, JSON, SQL, YAML, HTML, SVG, Markdown, and more
- Upload files directly to any directory
- Rename files and folders in-place
- Create directories, delete files and folders
- Security: path traversal protection via `realpath()`, critical file guard, 2 MB read limit

### Database Manager
- Table browser: engine, collation, row count, size
- Paginated table data viewer
- Insert, edit, and delete individual table rows
- Export any table as a `.sql` dump download
- Search & Replace across all tables with correct serialized-data handling
- Single-table or bulk `OPTIMIZE TABLE`
- SQL query runner — `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN` only

### User Manager
- Paginated user list with avatars, roles, registration date, post count
- Change any user's role (prevents modifying your own role)
- Rename any user's login username
- **Login As** — admin impersonation via secure one-time token (5-minute expiry)
- Delete users with post reassignment to admin
- Search and filter by role

### System Info
- WordPress: version, site/home URL, locale, charset, multisite, debug flags, memory limits
- PHP: version, OS, memory, loaded extensions
- Database: host, version, size, charset, collation
- Server: software, IP, port, protocol, HTTPS status, disk space
- Active plugins with versions, defined constants, next 20 cron jobs

### Maintenance Mode
- Toggle maintenance mode on/off instantly
- Custom title and message
- **v1.3.0** Tabbed appearance editor (Content, Appearance, Extras)
- **v1.3.0** 6 gradient presets (Midnight, Sunset, Forest, Royal, Slate, Candy)
- **v1.3.0** Custom color pickers for background gradient, accent divider, and text
- **v1.3.0** Emoji icon picker (8 presets + custom input) with floating animation
- **v1.3.0** Status badge toggle with custom text
- **v1.3.0** Countdown timer to a specified date/time
- **v1.3.0** Live preview pane — updates in real-time as you adjust settings
- **v1.3.0** Save settings independently of toggling maintenance state
- Generates a styled standalone HTML maintenance page (fully inline CSS)
- Automatically removed on plugin deactivation

### Debug Tools
- Toggle `WP_DEBUG`, `WP_DEBUG_LOG`, `WP_DEBUG_DISPLAY`, `SAVEQUERIES`, `SCRIPT_DEBUG` directly in `wp-config.php`
- Error log viewer (last N lines)
- Filter error log by level: Error, Warning, Notice, Deprecated
- Copy entire log to clipboard with one click
- Clear error log with one click
- Auto-detects `wp-content/debug.log` or PHP `error_log` path

### Image Tools
- Enable/disable WebP conversion on upload (requires GD or ImageMagick)
- **v1.3.0** Enable AVIF uploads (requires PHP 8.1+ GD `imageavif` or ImageMagick with AVIF codec)
- Set maximum image dimensions (width × height)
- Configure JPEG quality
- Regenerate all registered thumbnail sizes in bulk
- Enable SVG uploads with per-role permission control (administrator, editor, author)
- Server-side SVG sanitization (strips `<script>`, `on*` events, `javascript:` hrefs, `<foreignObject>`, `<base>`)
- Support status cards: GD, ImageMagick, WebP, AVIF

### Security *(New in v1.3.0)*
- **Admin URL Protection**: Move `wp-login.php` to a secret URL slug of your choice
- Direct GET requests to `wp-login.php` are blocked and redirected to the homepage
- Login form POST, password reset, and other auth actions continue to work normally
- Custom login URL displayed with copy-to-clipboard and open buttons
- One-click disable to restore default WordPress login behavior
- Protects against bots scanning the standard login URL

### Notes
- Color-coded, persistent note-taking (stored in a custom `wp_wmp_notes` table)
- Create, edit, delete notes with 6 color options
- Ordered by last updated

### Reset Tools
- Live count preview before any action (posts, pages, comments, media, non-admin users)
- Checkbox selection of which content types to reset
- Double confirmation dialog to prevent accidental data loss
- Safe deletion using WordPress core functions only
- Non-destructive to plugin settings, admin accounts, or site configuration

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
1. Download `wp-manager-pro-1.3.0.zip` from the [Releases](https://github.com/nurkamol/wp-manager-pro/releases) page.
2. In WP Admin → **Plugins → Add New → Upload Plugin**.
3. Upload the ZIP and click **Install Now**, then **Activate**.
4. Navigate to **WP Manager** in the admin sidebar (or click **Open** in the Plugins list).

### Manual
```bash
unzip wp-manager-pro-1.3.0.zip -d /path/to/wp-content/plugins/
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
#   assets/build/index.js   (~623 kB, ~182 kB gzipped)
#   assets/build/style.css  (~42 kB, ~8 kB gzipped)
```

### Package Plugin ZIP
```bash
cd ..
zip -r wp-manager-pro-1.3.0.zip \
  wp-manager-pro/wp-manager-pro.php \
  wp-manager-pro/includes/ \
  wp-manager-pro/assets/ \
  --exclude "wp-manager-pro/screenshots/*"
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
| POST | `/plugins/upload` | Upload plugin ZIP |
| GET | `/plugins/export` | Create plugin ZIP export |
| GET | `/plugins/download` | Stream plugin ZIP download |
| POST | `/plugins/update` | **v1.2.0** Update plugin to latest version |
| POST | `/plugins/install-version` | **v1.2.0** Install specific plugin version |
| GET | `/themes` | List all themes |
| POST | `/themes/activate` | Activate theme |
| DELETE | `/themes/delete` | Delete theme |
| POST | `/themes/install` | Install from WP.org |
| GET | `/themes/search` | Search WP.org |
| POST | `/themes/upload` | Upload theme ZIP |
| GET | `/themes/export` | Create theme ZIP export |
| GET | `/themes/download` | Stream theme ZIP download |
| POST | `/themes/update` | **v1.2.0** Update theme to latest version |
| POST | `/themes/install-version` | **v1.2.0** Install specific theme version |
| GET | `/files` | List directory contents |
| GET | `/files/read` | Read file content |
| POST | `/files/write` | Write file content |
| DELETE | `/files/delete` | Delete file or directory |
| POST | `/files/mkdir` | Create directory |
| POST | `/files/upload` | Upload file to directory |
| POST | `/files/rename` | Rename file or folder |
| GET | `/database/tables` | List database tables |
| GET | `/database/table-data` | Browse table rows |
| POST | `/database/search-replace` | Search & replace |
| POST | `/database/optimize` | Optimize tables |
| POST | `/database/query` | Run SQL query |
| POST | `/database/row` | Insert table row |
| PUT | `/database/row` | Update table row |
| DELETE | `/database/row` | Delete table row |
| GET | `/database/export` | Export table as SQL dump |
| GET | `/system` | System information |
| GET | `/maintenance` | Maintenance status & appearance settings |
| POST | `/maintenance/toggle` | Toggle maintenance + save settings |
| POST | `/maintenance/settings` | **v1.3.0** Save appearance settings without toggling |
| GET | `/users` | List users |
| POST | `/users/change-role` | Change user role |
| POST | `/users/login-as` | Generate login-as token |
| DELETE | `/users/delete` | Delete user |
| POST | `/users/rename` | Rename user login |
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
| GET | `/reset/status` | Get content counts |
| POST | `/reset/execute` | Execute site reset |
| GET | `/security` | **v1.3.0** Admin URL protection status |
| POST | `/security/admin-url` | **v1.3.0** Enable/update custom login slug |
| DELETE | `/security/admin-url` | **v1.3.0** Disable admin URL protection |

---

## Project Structure

```
wp-manager-pro/
├── wp-manager-pro.php              # Plugin entry point, constants, activation hooks
├── includes/
│   ├── class-plugin.php            # Singleton bootstrap, hook registration
│   ├── class-admin.php             # Admin menu, asset enqueuing, plugin links
│   └── api/
│       ├── class-routes.php        # REST route registration (55 endpoints)
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
│           ├── class-reset-controller.php
│           └── class-security-controller.php  # v1.3.0
├── assets/
│   └── build/
│       ├── index.js                # Compiled React app (~623 kB, ~182 kB gzip)
│       └── style.css               # Compiled styles (~42 kB, ~8 kB gzip)
├── src/                            # React source (TypeScript)
│   ├── main.tsx
│   ├── index.css
│   ├── App.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   ├── hooks/
│   │   └── useTheme.ts             # v1.2.0 Dark mode hook
│   ├── components/
│   │   ├── Sidebar.tsx             # Nav + dark mode toggle
│   │   ├── Layout.tsx
│   │   ├── PageHeader.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ui/                     # shadcn components
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Plugins.tsx
│       ├── Themes.tsx
│       ├── FileManager.tsx
│       ├── Database.tsx
│       ├── Users.tsx
│       ├── SystemInfo.tsx
│       ├── Maintenance.tsx         # v1.3.0 appearance editor
│       ├── Debug.tsx
│       ├── ImageTools.tsx          # v1.3.0 AVIF support
│       ├── Notes.tsx
│       ├── Reset.tsx
│       └── Security.tsx            # v1.3.0 admin URL hide
├── releases/
│   ├── v1.0.0.md
│   ├── v1.1.0.md
│   ├── v1.2.0.md
│   └── v1.3.0.md
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
- Critical files (`wp-config.php`, `.htaccess`, `index.php`) are write-protected in delete and rename endpoints
- File read is limited to text-based extensions (no binary execution)
- Login-As tokens are single-use, stored in WordPress transients, expire in 5 minutes
- Database query runner is read-only (`SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN` only)
- SVG uploads are sanitized server-side: strips `<script>`, `on*` event attrs, `javascript:` hrefs, `<foreignObject>`, `<base>` tags
- Username rename validates with `sanitize_user()` + `validate_username()`, checks for conflicts
- Reset Tools requires explicit `confirm: true` flag; uses WordPress core deletion functions only
- **v1.3.0** Admin URL protection blocks GET requests to `wp-login.php` without the secret key; POST/password-reset flows are unaffected
- All user inputs are sanitized with `sanitize_text_field()`, `absint()`, `sanitize_hex_color()`, `wp_kses_post()`

---

## License

GPL v2 or later — see [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html).

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.
