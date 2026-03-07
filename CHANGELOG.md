# Changelog

All notable changes to **WP Manager Pro** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-03-07

### Initial Release 🎉

First public release of WP Manager Pro — a comprehensive, agency-ready WordPress management suite built with React 19, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui, TanStack Query v5, and the WordPress REST API.

### Added

#### Core Architecture
- Single-page React application embedded in WordPress admin via `toplevel_page` menu
- HashRouter-based client-side routing for full WordPress admin compatibility
- REST API namespace `wp-manager-pro/v1` with 39 endpoints across 11 controllers
- All routes secured with `manage_options` capability and WordPress nonce authentication
- Script localization: `apiUrl`, `nonce`, `siteUrl`, `adminUrl`, `version`, current `user` object
- Custom `wp_wmp_notes` database table created on plugin activation
- Maintenance file cleanup on plugin deactivation

#### Dashboard
- Site health overview with real-time stats
- WordPress, PHP, MySQL version display
- Active plugin, theme, and user counts
- Update alert counts (core, plugin, theme)
- PHP configuration summary (memory limit, max execution, upload limit)
- Database size, uploads directory size, disk usage metrics
- Recent posts list

#### Plugin Manager
- Full plugin listing with active/inactive status and update availability badges
- Activate and deactivate plugins with guard against deactivating WP Manager Pro itself
- Delete plugins with automatic deactivation before removal
- Search WordPress.org plugin repository with ratings, download counts, and pagination
- Install plugins directly from search results

#### Theme Manager
- List all installed themes with screenshots, version, author, parent/child info
- Update availability indicators
- One-click theme activation
- Delete inactive themes
- Search WordPress.org theme repository with pagination
- Install themes from search results

#### File Manager
- Full filesystem browser rooted at `ABSPATH`
- Directory listing with file type, size, modification time, and writability
- Breadcrumb path navigation
- In-browser code editor for text-based files (PHP, JS, TS, TSX, JSX, CSS, SCSS, LESS, HTML, JSON, XML, YAML, TXT, MD, ENV, INI, LOG, SVG, Twig, Blade)
- 2 MB file size limit for editor safety
- Create new directories
- Delete files and directories recursively
- Path traversal prevention via `realpath()` — all paths validated inside `ABSPATH`
- Write-protection for `wp-config.php`, `.htaccess`, and `index.php`

#### Database Manager
- Table browser with engine, collation, row count, and size (MB)
- Total database size summary
- Paginated table data viewer
- Search & Replace across all tables with correct PHP serialized data handling
- Single-table or select-all `OPTIMIZE TABLE`
- SQL query runner restricted to read-safe statements: `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN`
- Compatible with all MySQL/MariaDB environments (uses `SHOW TABLE STATUS` for broad compatibility)

#### User Manager
- Paginated user list with Gravatar avatars, display name, login, email, role badges
- Registration date and post count columns
- Current user highlighted with "You" badge
- Change role for any user (self-role change prevention)
- Role filter dropdown with all registered WordPress roles
- Search users by name or email
- **Login As (Admin Impersonation)**: generates a secure single-use token stored as a WordPress transient (5-minute expiry), redirects to admin on success
- Delete user with post reassignment to admin (self-deletion prevention)

#### System Info
- WordPress tab: version, site URL, home URL, locale, charset, admin email, multisite, debug flags, memory limits, upload size, revision settings, timezone
- PHP tab: version, OS, SAPI, memory limit, max execution time, upload/post limits, extensions status (cURL, GD, Imagick, mbstring, OpenSSL, ZIP, Intl, OPcache)
- Database tab: host, version, database size, charset, collation, table prefix
- Server tab: software, server IP, port, protocol, HTTPS status, PHP path, disk free/total space
- Plugins tab: all active plugins with slug, version, and author
- Constants tab: status of all key WordPress constants
- Cron tab: next 20 scheduled cron jobs with recurrence and next run time

#### Maintenance Mode
- Toggle maintenance mode on/off instantly
- Configurable custom title and message
- Generates a fully styled `wp-content/maintenance.php` with animated UI
- Automatically removed on plugin deactivation

#### Debug Tools
- Toggle `WP_DEBUG`, `WP_DEBUG_LOG`, `WP_DEBUG_DISPLAY`, `SAVEQUERIES` by patching `wp-config.php`
- Error log viewer: reads last N lines (default 200) from `wp-content/debug.log` or the PHP `error_log` path
- Clear error log with one click

#### Image Tools
- Enable/disable WebP output conversion
- Set global maximum image dimensions (width and height)
- Configure JPEG quality (1–100)
- Bulk regenerate all registered thumbnail sizes
- Detection of GD, ImageMagick, and WebP support

#### Notes
- Create, read, update, delete persistent notes
- Color-coded notes (default, blue, green, yellow, red, purple)
- Notes ordered by last updated
- Stored in the custom `wp_wmp_notes` table (created on activation)

### Technical Notes
- Vite build outputs `assets/build/index.js` and `assets/build/style.css`
- Admin PHP handles both `style.css` and `index.css` via `file_exists` check
- Database table browser uses `SHOW TABLE STATUS` instead of `information_schema.TABLES` for compatibility with all MySQL environments
- Login-As token stored via `set_transient` / `get_transient` with 5-minute TTL
- Role filter Select uses `"all"` sentinel value (Radix UI prohibits empty-string `SelectItem` values)

---

[1.0.0]: https://github.com/your-org/wp-manager-pro/releases/tag/v1.0.0
