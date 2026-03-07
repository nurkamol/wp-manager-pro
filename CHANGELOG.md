# Changelog

All notable changes to **WP Manager Pro** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-03-08

### Added

#### Plugin Manager
- **ZIP Upload**: Upload a `.zip` file to install a new plugin or overwrite an existing one (uses WordPress `Plugin_Upgrader` with `overwrite_package: true`)
- **ZIP Export**: Export any installed plugin directory as a `.zip` download; uses PHP `ZipArchive` + `RecursiveIteratorIterator` and streams through the REST endpoint
- Export temp files stored under `wp-content/uploads/wmp-exports/` with a 5-minute transient key for the download URL

#### Theme Manager
- **ZIP Upload**: Upload a `.zip` file to install a new theme or overwrite an existing one (uses WordPress `Theme_Upgrader` with `overwrite_package: true`)
- **ZIP Export**: Export any installed theme directory as a `.zip` download with the same streaming mechanism as plugin export

#### File Manager
- **Monaco Editor**: Replaced the plain `<textarea>` with the full VS Code editor engine (`@monaco-editor/react`); automatic language detection from file extension covers PHP, JS, TS, TSX, JSX, CSS, SCSS, JSON, SQL, YAML, TOML, HTML, XML, SVG, Markdown, Bash, ENV, INI, and more
- **File Upload**: Upload any file to the currently browsed directory (`multipart/form-data` via `move_uploaded_file`); validates destination is within `ABSPATH`
- **Rename**: Rename files and folders in-place via a dialog; guards against path separator injection and renaming critical files

#### Database Manager
- **Row Insert**: Insert a new row into any table via a dynamically-generated form (POST `/database/row`)
- **Row Edit**: Edit an existing row's values inline (PUT `/database/row`)
- **Row Delete**: Delete individual rows by primary key (DELETE `/database/row`)
- **Table Export**: Export a full table as a `.sql` dump downloaded to the browser; streams via `@ob_end_clean()` + `header()` + `echo` + `exit`

#### User Manager
- **Username Rename**: Rename any user's login handle; uses `sanitize_user()` + `validate_username()` for validation, checks for conflicts with `username_exists()`, executes via direct `$wpdb->update` on `$wpdb->users`, then clears user cache with `clean_user_cache()`
- Self-rename prevented server-side

#### Debug Tools
- **SCRIPT_DEBUG Toggle**: `SCRIPT_DEBUG` constant can now be toggled alongside `WP_DEBUG`, `WP_DEBUG_LOG`, `WP_DEBUG_DISPLAY`, and `SAVEQUERIES`
- **Log Level Filter**: Error log viewer now supports filtering by level — Error, Warning, Notice, Deprecated — using regex matching against PHP log line prefixes
- **Copy Log**: One-click copy of the visible error log to the clipboard

#### Image Tools
- **SVG Support**: New "SVG Support" card — enable/disable SVG uploads globally with per-role checkboxes (administrator, editor, author)
- **SVG Sanitization**: Server-side sanitization on upload via `wp_handle_upload_prefilter` hook; strips `<script>` tags, `on*` event attributes, `javascript:` hrefs, `<foreignObject>`, and `<base>` elements
- Settings stored in `wp_options` under `wmp_svg_enabled` and `wmp_svg_allowed_roles`

#### Reset Tools *(New Page)*
- New `/reset` route and sidebar navigation item (RotateCcw icon)
- Live count display: posts, pages, comments, media attachments, non-admin users
- Checkbox selection per content type
- Double confirmation dialog before any destructive action
- Server-side execution requires `confirm: true` flag; uses `WP_Query`, `WP_Comment_Query`, `WP_User_Query` for counts and `wp_delete_post`, `wp_delete_attachment`, `wp_delete_user` for deletion
- Administrator accounts are never touched

#### API Client (`src/lib/api.ts`)
- Added `api.upload(endpoint, formData)` method for multipart file uploads — does **not** set `Content-Type` header so the browser automatically appends the correct `boundary`

### Changed
- Version bumped to `1.1.0` in plugin header comment and `WP_MANAGER_PRO_VERSION` constant
- REST route count: 39 → 55 endpoints (16 new routes)
- Build output: `index.js` ~589 kB / `style.css` ~37.5 kB (Monaco Editor added)
- File Manager editor replaced with Monaco (VS Code engine) — syntax highlighting for all supported file types
- `class-plugin.php` now loads `class-reset-controller` and registers SVG hooks (`upload_mimes`, `wp_handle_upload_prefilter`)
- `class-routes.php` expanded with all new route registrations

### Technical Notes
- Monaco Editor: language mapping via `getMonacoLang(ext)` helper in `FileManager.tsx`
- Export streaming: `@ob_end_clean()` flushes OB before streaming ZIP/SQL from a REST callback
- Transient-based export: export key stored for 300 s; separate `/download` endpoint validates and streams the file, then deletes it
- Username rename uses direct `$wpdb->update` — WordPress has no native `wp_rename_user()` function

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

[1.1.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.0.0
