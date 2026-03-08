# Changelog

All notable changes to **WP Manager Pro** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] — 2026-03-08

### Added

#### Maintenance Mode
- **Professional Appearance Customization**: Tabs-based settings panel (Content, Appearance, Extras)
- **Gradient Presets**: 6 one-click presets (Midnight, Sunset, Forest, Royal, Slate, Candy)
- **Custom Color Pickers**: Native color + hex inputs for background start, background end, accent/divider, and text color
- **Page Icon Picker**: 8 emoji presets + custom emoji/text input for the floating page icon
- **Status Badge**: Toggle + custom badge text with pulse indicator
- **Countdown Timer**: Toggle + datetime-local input for an animated live countdown; preview shows placeholder countdown blocks
- **Save Settings without toggle**: Separate "Save Settings" button (POST `/maintenance/settings`) — settings are persisted without affecting maintenance active state
- **Live Preview pane**: Right-column real-time preview reflecting gradient, logo animation, badge, accent divider, title, message, and countdown

#### Database Manager
- **Pagination**: Full page controls (first/prev/next/last) with row range indicator (`X–Y of Z rows`)
- **Per-page selector**: Choose 50 / 100 / 250 / 500 rows per page; backend limit raised from 200 → 500
- **Edit Row**: Hover any row → pencil icon opens a Dialog with all columns as inputs; primary key shown read-only with type labels; saves via `PUT /database/row`
- **Delete Row**: Trash icon with inline confirm button (no modal) → `DELETE /database/row`
- **Add Row**: "+ Add Row" button in table header → Dialog with all editable columns; `auto_increment` fields automatically disabled; saves via `POST /database/row`
- **Column metadata**: Backend now returns `primary_key` + `col_meta` (type, nullable, key, default, extra) per column — used for PK badges, type hints, and auto-increment detection
- **Plugin page link**: "Open" shortcut link added to WP Admin Plugins list row

#### Security
- **Admin URL Protection** (new Security page): Moves WordPress login to a secret URL slug; blocks direct GET access to `wp-login.php` (redirects to homepage); POST/password-reset actions continue to work; custom login URL displayed with copy & open buttons
- **Security REST routes**: `GET /security`, `POST /security/admin-url`, `DELETE /security/admin-url`
- **Security nav item** in sidebar (Shield icon)

#### Image Tools
- **AVIF Support**: Toggle to allow AVIF image uploads (`image/avif`, `image/avifs` MIME types); requires PHP 8.1+ GD (`imageavif`) or ImageMagick with AVIF codec
- **AVIF support status card** added to support status row (now 4 columns)

---

## [1.2.0] — 2026-03-08

### Added

#### Plugin Manager
- **Update**: One-click update button (amber) appears on plugin rows and in WP.org search when an update is available; uses `Plugin_Upgrader::upgrade()` with WordPress update transients
- **Version History & Downgrade**: History icon button opens a version dialog fetching all available versions from `api.wordpress.org/plugins/info/1.2/?action=plugin_information&fields[versions]=1`; installs any version via `https://downloads.wordpress.org/plugin/{slug}.{version}.zip` with `overwrite_package: true`
- **Smart WP.org Search Buttons**: Search tab now detects installed plugins via `installedMap` (useMemo); shows amber "Update" if update available, green "Installed ✓" (disabled) if current, or blue "Install" for new plugins
- **Updates count in header**: Description shows `X updates available` when plugins have pending updates

#### Theme Manager
- **Update**: Same update mechanism as plugins — `Theme_Upgrader::upgrade($slug)` (POST `/themes/update`)
- **Version History & Downgrade**: Theme version dialog fetching from `api.wordpress.org/themes/info/1.2/?action=theme_information&fields[versions]=1`; installs via `https://downloads.wordpress.org/theme/{slug}.{version}.zip`
- **Smart WP.org Search Buttons**: Same smart button logic as plugins based on `installedMap`
- **Updates count in header**: Same update count display as Plugin Manager

#### UI / UX
- **Light/Dark Mode Toggle**: Sun/Moon button in the sidebar footer (and collapsed sidebar footer); persists selection via `localStorage`; applies `.dark` class to `#wp-manager-pro-root`; full dark palette for sidebar (always dark), main content, page headers, cards, dialogs, inputs
- **WordPress footer hidden**: Fixed CSS selector — `#wpfooter { display: none }` (was incorrectly scoped as a descendant of `.wp-manager-pro-page`)

### Fixed
- **ZIP download 401 (`rest_forbidden`)**: Export endpoints now append `&_wpnonce=wp_create_nonce('wp_rest')` to the download URL so browser navigation is authenticated without `X-WP-Nonce` header
- **ZIP filename includes version**: Exported ZIPs are named `{slug}-{version}.zip` (e.g. `woocommerce-8.6.1.zip`) instead of just `{slug}.zip`
- **WP.org search unreliable on local dev**: Removed PHP backend `plugins_api()` / `themes_api()` calls (which fail in air-gapped local environments); browser now fetches directly from the public CORS-enabled WP.org API

### Changed
- WP.org plugin/theme search now performs direct browser-to-`api.wordpress.org` fetch (bypasses PHP backend entirely) — more reliable, no server-to-server HTTP dependency
- Version bumped to `1.2.0` in plugin header and `WP_MANAGER_PRO_VERSION` constant

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
