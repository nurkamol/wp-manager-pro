# Changelog

All notable changes to **WP Manager Pro** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.7.1] — 2026-03-16

### Added
- **Self-Update System** — `class-self-updater.php` integrates WP Manager Pro with WordPress's native plugin update mechanism; checks GitHub Releases API (12-hour cache); injects update data into `update_plugins` site transient; supplies plugin info modal via `plugins_api` filter; shows "View Release Notes" link in the Plugins list update row; clears cache after a successful self-update

### Fixed
- **Update Manager — false "Done" for premium/unlicensed plugins** — `$result === null` from `Plugin_Upgrader::upgrade()` (no update performed) was incorrectly treated as success; also added check of `$upgrader->skin->result` for errors captured by `WP_Ajax_Upgrader_Skin`; frontend now shows distinct badges: "License Required" (amber) and "Update Unavailable" (grey) in addition to "Failed" (red)
- **2FA QR code not rendering** — switched from the deprecated Google Charts QR API (`chart.googleapis.com`) to `api.qrserver.com`; QR codes now render correctly for Google Authenticator, Authy, and all standard TOTP apps
- **Custom Login — logout not working** — added `'logout'` to the `protect_login()` bypass array; the action=logout request to `wp-login.php` was being intercepted and redirected to the homepage before WordPress's logout handler could run; session now destroys correctly; added `logout_redirect` filter to redirect to the custom login URL after logout
- **Plain Permalinks** — added `permalinks.isPlain` flag to `wp_localize_script` data; amber warning banner shown across all plugin pages when WordPress is configured with Plain permalinks (REST API requires pretty permalinks)

### Changed
- `ApiError` class added to `api.ts`; all REST API errors now expose the WP error code to the frontend alongside the message

---

## [2.7.0] — 2026-03-16

### Added
- **Security Scanner page** (`/security-scanner`) — new dedicated page in the System group (ScanLine icon) with 4-tab layout
- **Overview tab** — animated security score ring (0–100 with letter grade A+ to F) combining results from all scans; four summary cards for quick status of each check area; "Run All Scans" button triggers all checks in parallel
- **Malware Scanner** — scans up to 8,000 PHP/JS/HTML files in plugins and themes directories against 13 detection patterns: `eval(base64_decode(…))`, `eval(gzinflate/gzuncompress/gzdecode(…))`, `eval(str_rot13(…))`, `preg_replace` with `/e` modifier, `assert()` / `system()` / `exec()` / `passthru()` / `shell_exec()` with user input, long base64-encoded strings, dynamic variable function calls, known webshell markers (FilesMan, r57, c99), and `document.write(unescape(…))`; findings show file path, pattern name, severity (critical / warning), line number, and code snippet; scope selector (all / plugins / themes); skips files >512 KB
- **Vulnerability Database** — checks all installed plugins and themes against the [WPScan API](https://wpscan.com); shows CVE title, CVSS severity and score, fix version, and reference links; configurable API key (stored securely, only last 4 chars shown in UI); WPScan free tier allows 25 requests/day
- **SSL Monitor** — connects to site domain on port 443 via PHP `stream_socket_client`; parses certificate with `openssl_x509_parse`; displays subject, issuer, SAN entries, valid-from/to dates, days remaining with colour-coded alerts (green / 14-day warning / expired red)
- **Core & PHP tab** — fetches latest WordPress version from `api.wordpress.org/core/version-check/1.7/`; flags outdated WP installations; checks PHP version against built-in EOL date table (PHP 5.6 through 8.4); flags EOL and near-EOL PHP versions; shows MySQL/MariaDB version

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scanner/malware` | Scan PHP/JS/HTML files; `?scope=plugins\|themes\|all` |
| GET | `/scanner/vulns` | Check plugins/themes against WPScan CVE API |
| GET | `/scanner/ssl` | Verify SSL certificate for site domain |
| GET | `/scanner/core` | Compare WP version + PHP EOL status |
| GET | `/scanner/api-key` | Return whether WPScan API key is configured (masked) |
| POST | `/scanner/api-key` | Save or clear WPScan API key |

---

## [2.6.0] — 2026-03-16

### Added
- **Update Manager page** (`/updates`) — 3-tab developer-friendly update control centre
- **Available Updates tab** — lists all pending plugin, theme, and WordPress core updates; per-item "View Changelog" button fetches live changelog from WordPress.org; "Update Now" per item with animated status badge (updating / done / failed); checkbox multi-select with "Update Selected" batch action that runs sequentially to avoid file-system conflicts; "Check for Updates" force-refresh button
- **Pre-update backup** — each update automatically zips the plugin/theme directory to `wp-content/wmp-backups/updates/` before upgrading (core skipped — too large)
- **History tab** — log of every update run through WP Manager Pro (up to 100 entries); columns: name, type, version arrow, date, status, rollback button; "Rollback" button visible only when backup ZIP exists and not already rolled back; "Clear History" deletes log and all backup files
- **Scheduled tab** — form to queue any plugin or theme update at a specific future datetime; uses `wp_schedule_single_event` + WP Cron; lists pending jobs with "Cancel" button; backup + update runs automatically at scheduled time

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/updates/available` | All pending plugin/theme/core updates (reads transients; `?force=1` triggers fresh WP check) |
| GET | `/updates/changelog` | Fetch plugin/theme changelog from WordPress.org API (`?type=plugin&slug=xyz`) |
| POST | `/updates/run` | Back up + upgrade a single plugin, theme, or core; logs to history |
| POST | `/updates/rollback` | Restore plugin/theme from pre-update ZIP backup |
| GET | `/updates/history` | Update history log (max 100 entries, `has_backup` flag per entry) |
| DELETE | `/updates/history/clear` | Clear history and delete all backup ZIPs |
| GET | `/updates/scheduled` | List scheduled update jobs with WP Cron next-run info |
| POST | `/updates/schedule` | Queue a plugin/theme update via `wp_schedule_single_event` |
| DELETE | `/updates/schedule/cancel` | Cancel and unschedule a queued update |

---

## [2.5.0] — 2026-03-16

### Added
- **Command Palette** — `Cmd+K` / `Ctrl+K` global overlay with fuzzy search across all 25 pages and 5 quick actions (Flush Cache, Toggle Maintenance, Clear Error Log, Purge Transients, Create Backup); keyboard navigation (↑↓ Enter Esc); recent pages from localStorage; keyboard icon button in sidebar footer
- **Settings Export** — export WP Manager Pro config (Branding, Maintenance, SMTP, Image Settings, Snippets, Redirects, Notes) as a signed JSON bundle with HMAC integrity signature
- **Settings Import** — drag-and-drop JSON import with client-side preview, cross-site warning, per-section overwrite control, and import result summary
- **WordPress XML Export** — trigger WordPress's native content export (All / Posts / Pages / Media / custom CPT) as a downloadable XML file without leaving the plugin

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings/export` | Download all WP Manager Pro settings as signed JSON |
| POST | `/settings/import` | Import settings from a JSON bundle with section control |
| POST | `/settings/export-wp-xml` | Stream WordPress XML export for selected content type |

---

## [2.4.0] — 2026-03-16

### Added
- **Dev Tools page** (`/dev-tools`) — new Tools section entry with Terminal icon; 5-tab developer toolkit
- **wp-config.php Visual Editor** — accordion groups (Database, Debug, Salts, URLs, Memory/Settings, Custom); bool constants as Switches; DB_PASSWORD masked with eye toggle; Salts masked with "Regenerate All Salts" (fetches fresh keys from `api.wordpress.org`); each field has an inline Save button
- **`.htaccess` Editor** — textarea editor with file info bar (path, size, writability); auto-backup to `.htaccess.wmp-backup` before every save; "Restore from backup" button
- **PHP Info Viewer** — lazy-loaded on demand; search/filter input across all sections; collapsible accordion sections; table with Directive / Local Value / Master Value; amber highlight when local ≠ master value
- **Query Monitor** — reads `$wpdb->queries` when `SAVEQUERIES` is on; stat cards (total queries, total time, slow query count, memory peak); query table with slow-query highlight (>50 ms); "Show slow only" toggle; clear instructions when `SAVEQUERIES` is off
- **Environment Badge** — select Production / Staging / Development / Local from 4 colored cards; reads `WP_ENVIRONMENT_TYPE` constant (read-only) or plugin option; badge rendered in sidebar header under plugin name

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dev-tools/wp-config` | All defined constants grouped with type/value/line metadata |
| POST | `/dev-tools/wp-config` | Update a single constant value |
| GET | `/dev-tools/htaccess` | Read .htaccess content + writability (`?backup=1` for backup copy) |
| POST | `/dev-tools/htaccess` | Save new .htaccess content (auto-backups before write) |
| GET | `/dev-tools/phpinfo` | Parsed phpinfo() sections with directive rows |
| GET | `/dev-tools/query-monitor` | SAVEQUERIES data — slow queries, totals, memory peak |
| GET | `/dev-tools/environment` | Current environment type (constant or option) |
| POST | `/dev-tools/environment` | Save environment type to plugin option |

---

## [2.3.1] — 2026-03-16

### Added
- **Bundled Redis object-cache drop-in** (`includes/object-cache.php`) — installs its own `wp-content/object-cache.php`; no third-party redis-cache plugin required
- **Object Cache tab** in Performance — Overview/Diagnostics tabs; status rows, connection details, live Redis stats (hit ratio, keys, memory, uptime, clients, ops/sec), per-request WP cache stats; Install / Enable / Disable / Flush actions
- **Redis Cache admin bar node** — green pulsing dot + Redis version badge; appears automatically when object cache drop-in is active and Redis is reachable; sub-items: Flush Cache (AJAX with toast) and Object Cache Settings link
- **Maintenance admin bar toggle visibility** setting in Access & Extras tab — hidden by default on fresh installs
- **Custom bypass URL slug** — type your own `?wmp_preview=` key; auto-generate button still available

### Fixed
- **Asset cache-busting** — JS/CSS now versioned by `filemtime()` instead of the plugin version constant; browser always fetches the latest build after a deploy
- **Maintenance boolean options not persisting** — `show_badge`, `show_countdown`, `show_adminbar_toggle` stored as `0`/`1` integers to avoid WordPress `update_option(false)` edge case
- **Page not reloading after maintenance save** — "Save Settings" now reloads ~800 ms after success so the server-rendered admin bar reflects saved settings immediately
- **Admin bar toggle unresponsive** — binding JS now runs immediately at footer time (admin bar is already in DOM) with `DOMContentLoaded` as fallback

---

## [2.3.0] — 2026-03-11

### Added
- **Content Tools page** — 4-tab page for bulk content management without leaving WP Manager Pro
- **Bulk Post Editor tab** — filter posts by type, status, and keyword; select multiple posts with checkboxes; bulk-update status, author, or publish date in one action
- **Post Duplicator tab** — clone any post, page, or CPT as a draft; options to copy post meta, taxonomies/categories, and featured image
- **Scheduled Post Manager tab** — list all future-scheduled content across post types; shows scheduled time, author, and live countdown ("in 3d 5h"); overdue posts highlighted in red
- **Options Table Editor tab** — paginated, searchable browser for all `wp_options` rows; type detection (string, integer, float, JSON, serialized, empty); inline edit with full raw-value Textarea and autoload toggle; delete with protection for critical keys
- `FileEdit` icon added to sidebar Tools group for Content Tools
- Helper endpoints: `/content/post-types` (registered public post types), `/content/authors` (users with `edit_posts`)

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/content/post-types` | List all registered public post types |
| GET | `/content/authors` | List users with edit_posts capability |
| GET | `/content/posts` | Paginated post list with post_type, status, search, page filters |
| POST | `/content/posts/bulk-edit` | Bulk update status, date, author, category for multiple post IDs |
| POST | `/content/posts/duplicate` | Clone a post as a draft with optional meta/taxonomy/thumbnail copy |
| GET | `/content/scheduled` | List all future-scheduled posts across post types |
| GET | `/content/options` | Paginated, searchable wp_options list with type detection |
| GET | `/content/options/(?P<name>...)` | Full value of a single option (for edit dialog) |
| POST | `/content/options` | Create or update a wp_options row |
| DELETE | `/content/options` | Delete a wp_options row (protected critical keys blocked) |

---

## [2.2.0] — 2026-03-11

### Added
- **Media Manager page** — 5-tab dedicated page for media library cleanup and maintenance
- **Overview tab** — stats cards: total attachments, uploads folder size, orphaned count, unused count, duplicate groups; "What Each Section Does" guide
- **Orphaned tab** — lists attachments whose physical file is missing from disk; bulk-select and delete via `wp_delete_attachment`
- **Unused tab** — lists attachments with `post_parent = 0` not used as a featured image and not referenced in any published post content; shows thumbnail, file size, bulk delete
- **Duplicates tab** — groups attachments by MD5 file hash; shows wasted space per group; one-click delete of individual duplicates (keeps oldest)
- **Compress tab** — re-compress JPEG and PNG attachments via `wp_get_image_editor`; adjustable quality slider (40–100); shows before/after size and savings
- `Images` icon added to sidebar Tools group for Media Manager

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/media/overview` | Summary stats: totals, size, orphaned/unused/duplicate counts |
| GET | `/media/orphaned` | List attachments with missing physical files |
| DELETE | `/media/orphaned` | Bulk delete orphaned attachments by ID array |
| GET | `/media/unused` | List unattached, unreferenced attachments with thumbnails |
| DELETE | `/media/unused` | Bulk delete unused attachments by ID array |
| GET | `/media/duplicates` | Group attachments by MD5 hash; returns wasted-space totals |
| DELETE | `/media/duplicate` | Delete a single duplicate attachment |
| GET | `/media/compress-candidates` | List JPEG/PNG attachments with file sizes |
| POST | `/media/compress` | Re-compress one attachment; returns before/after sizes |

---

## [2.1.0] — 2026-03-10

### Added
- **Cron Manager page** — full WP-Cron visibility and control in a 3-tab dedicated page (Events, Schedules, Health)
- **Event Browser** — lists all scheduled cron events sorted by next-run time; shows hook name, relative next-run label, schedule label and interval, argument count; colour-coded urgency (green/amber/red)
- **Manual Trigger** — run any cron event on demand via `do_action_ref_array`; captures output buffer and wall-clock duration; displays inline result banner with output preview
- **Delete Events** — one-click removal of custom (non-core) events via `wp_unschedule_event`; core WordPress events are protected (run-only)
- **Custom Schedules** — register new recurrence intervals from the UI (key, display name, interval in seconds ≥ 60); persisted in `wp_options` and injected into WordPress via `cron_schedules` filter
- **Delete Custom Schedules** — remove any UI-created schedule; built-in WordPress schedules are not deletable
- **Cron Health tab** — status cards for DISABLE_WP_CRON, overdue event count, WP_CRON_LOCK_TIMEOUT, ALTERNATE_WP_CRON; lists up to 10 overdue events with hook name and seconds overdue
- **Real Cron Setup guide** — inline instructions for disabling pseudo-cron, server crontab snippet (with site URL pre-filled), and WP-CLI command
- `date-fns` v4 dependency for human-readable relative timestamps in the Events tab
- `Clock` icon added to sidebar Tools group for Cron Manager

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cron/events` | List all scheduled events sorted by timestamp |
| POST | `/cron/run` | Trigger an event immediately; returns output + duration |
| DELETE | `/cron/event` | Unschedule a specific event (or all occurrences of a hook) |
| GET | `/cron/schedules` | List all registered schedules (built-in + custom) |
| POST | `/cron/schedules` | Create a custom schedule |
| DELETE | `/cron/schedules` | Delete a custom schedule |
| GET | `/cron/health` | Cron health status, overdue events, and real-cron hints |

---

## [2.0.0] — 2026-03-10

### Added

#### Security Suite (5-tab Security page)
- Security page fully redesigned with tabbed layout: **Overview**, **Login**, **Hardening**, **Integrity**, **Two-Factor**

#### Overview Tab
- Status cards for six security features: Admin URL, Login Limiter, IP Blocklist, XML-RPC, Hide WP Version, Two-Factor Auth
- Each card shows on/off badge with color indicator
- WordPress version + locale displayed; quick reference to run a file integrity check

#### Login Protection Tab
- **Custom Login URL** — existing feature (custom slug, block direct wp-login.php access) now integrated into tabbed layout
- **Login Attempt Limiter** — configurable max attempts, counting window (seconds), and lockout duration (seconds); state stored in WordPress transients
- **Lockout Log** — table of all IP lockout events with username, timestamp, and attempt count; per-IP unlock and bulk clear

#### Hardening Tab
- **Disable XML-RPC** toggle — applies `xmlrpc_enabled` filter returning `false`
- **Hide WordPress Version** toggle — removes WP version from `<meta name="generator">` and strips `?ver=X.Y.Z` from script/style queue URLs
- **IP Blocklist** — add exact IPs or CIDR ranges with optional notes; enforced on `init` hook; per-entry remove button

#### File Integrity Tab
- Fetches official MD5 checksums from `https://api.wordpress.org/core/checksums/1.0/?version=X&locale=Y`
- Compares every file in `wp-admin/` and `wp-includes/` against expected hashes
- Reports **modified** files (path, last-modified date) and **missing** files
- `wp-content/` is excluded (user content)

#### Two-Factor Authentication Tab
- TOTP-based 2FA per admin account (RFC 6238 — SHA1, 6 digits, 30-second window)
- QR code via Google Charts API for Google Authenticator, Authy, or any TOTP app
- Fallback manual secret entry (base32-encoded, no padding)
- 8 one-time backup codes generated on verification; stored as MD5 hashes in user meta
- Per-user meta keys: `wmp_2fa_secret`, `wmp_2fa_enabled`, `wmp_2fa_backup_codes`

#### REST Endpoints (14 new)
- `GET /security/overview` — all feature states in one call
- `POST /security/limiter` — save login limiter settings
- `GET /security/lockouts` — list lockout log
- `DELETE /security/lockouts` — clear lockout log
- `POST /security/lockouts/unlock` — unlock specific IP
- `GET /security/ip-blocklist` — list blocked IPs
- `POST /security/ip-blocklist` — add IP/CIDR to blocklist
- `DELETE /security/ip-blocklist` — remove IP from blocklist
- `POST /security/hardening` — save XML-RPC + hide-version settings
- `POST /security/integrity` — run core file integrity check
- `GET /security/2fa` — get 2FA status for current user
- `POST /security/2fa/setup` — generate TOTP secret + QR URL
- `POST /security/2fa/verify` — verify code and activate 2FA
- `DELETE /security/2fa` — disable 2FA for current user

#### WordPress Runtime Hooks
- `wp_login_failed` → record failed login attempt per IP
- `authenticate` (priority 30) → block locked-out IPs before authentication
- `init` → check IP blocklist and `wp_die(403)` if matched
- `xmlrpc_enabled` → disable XML-RPC (conditional on option)
- `the_generator` → suppress WP version meta tag (conditional on option)
- `script_loader_src` / `style_loader_src` → strip `?ver=X.Y.Z` from asset URLs (conditional)

### Changed
- Security page route `/security` now loads a 5-tab component instead of the single-card layout
- `class-plugin.php` loads `class-performance-controller` (missing from previous release's controller list)
- `class-routes.php` now properly imports `Security_Controller` via `use` statement

---

## [1.9.0] — 2026-03-10

### Added

#### Performance Page (new Tools section entry)
- New **Performance** page (`/performance` route, Gauge icon) with three tabs: Overview, Transients, DB Cleanup
- Sidebar icon: `Gauge` from lucide-react, placed between Image Tools and Notes in the Tools group

#### Overview Tab
- Eight stat cards: Post Revisions (with estimated KB saved), Auto-Drafts, Trashed Content, Spam Comments, Pending Comments, Orphaned Post Meta, Orphaned Comment Meta, Expired Transients
- Cards highlight amber when the count is non-zero
- Amber alert banner appears when any cleanable item exists, pointing to the DB Cleanup tab
- **Object Cache Status banner**: auto-detects Redis (`WP_REDIS_VERSION`, `class Redis`), Memcached (`class Memcache` / `class Memcached`), or any external cache via `wp_using_ext_object_cache()`; shows green banner with cache type when active, grey banner with install recommendation when not active

#### Transients Tab
- Paginated table (50/page) of all transients (`_transient_%` in `wp_options`, excluding `_transient_timeout_%` rows)
- Left-join on timeout rows to compute `expires_at` and `expired` flag per entry
- Columns: name (with `expired` destructive badge), size in bytes, expiry timestamp
- Search filters by transient name prefix
- Delete individual transient button (calls `delete_transient()` + `delete_site_transient()`)
- **Purge Expired** button: clears all expired regular and site transients in one shot; button disabled when count is 0

#### DB Cleanup Tab
- Checkbox-based selection of 8 cleanup types with live item counts (amber when non-zero)
- Select All / None toggle buttons in card header
- Total items summary line updates reactively as selections change
- Confirmation dialog lists each selected type with its count before executing
- After successful cleanup: count summary toast, selected items cleared, Overview stats refreshed

#### REST API — 5 new endpoints
- `GET /performance/overview` — all counts + object cache status; queries via direct `$wpdb->get_var()` using `SHOW TABLE STATUS`-style aggregation
- `GET /performance/transients` — paginated list with optional search; LEFT JOIN to compute expiry; supports `page`, `limit`, `search` params
- `DELETE /performance/transients` — deletes single transient by `?name=` param (regular + site variants)
- `POST /performance/transients/purge-expired` — iterates expired timeout rows for both `_transient_timeout_%` and `_site_transient_timeout_%`; returns deleted count
- `POST /performance/cleanup` — runs selected types from validated allowlist; uses `wp_delete_post_revision()`, `wp_delete_post()`, `wp_delete_comment()`, direct `$wpdb->query()` DELETE with LEFT JOIN for orphaned meta rows

### Changed
- Bump version `1.8.0` → `1.9.0` in plugin header, `WP_MANAGER_PRO_VERSION` constant, and `package.json`
- Build: `index.js` ~728 kB / `style.css` ~49.6 kB
- Screenshots: all 15 retaken; `14-plugin-zip-upload` replaced by `14-settings`; `15-performance` added

---

## [1.8.0] — 2026-03-10

### Added

#### Sidebar Redesign (shadcn sidebar-07 style)
- Collapsed sidebar width changed from `w-16` (64 px) to `w-14` (56 px)
- Each collapsed nav item now renders a visible button box: `border`, `bg-slate-800/70 border-slate-700/50`, `h-8`, icon size `w-[18px] h-[18px]`
- Active collapsed item: `bg-blue-600 border-blue-500 text-white`
- Group spacing in collapsed mode: `mt-4` top margin per group (replaces old `h-px` separator dividers)
- Group labels shown only in expanded mode, only for `gi > 0`
- Expanded sidebar: `ChevronLeft` collapse button in header alongside `PanelLeftClose/PanelLeftOpen`
- Collapsed sidebar: blue `ChevronRight` button centered in header for expand; footer shows user avatar (with tooltip), WP-menu toggle, and theme toggle

#### WP Admin Menu Toggle
- New `useWpAdminSidebar` hook (`src/hooks/useWpAdminSidebar.ts`)
- Injects/removes a `<style id="wmp-wp-sidebar-style">` tag in `document.head`
- Hidden state CSS: `#adminmenumain, #adminmenuback { display: none !important }` + `#wpcontent, #wpfooter { margin-left: 0 !important; transition: margin-left 0.3s }`
- State read from / written to `localStorage` key `wmp-wp-sidebar-hidden` on every toggle
- Button appears in expanded sidebar header (`PanelLeftClose/PanelLeftOpen`) and in collapsed sidebar footer
- Tooltip: "Hide WP menu" / "Show WP menu"

### Changed
- Bump version `1.7.0` → `1.8.0` in plugin header, `WP_MANAGER_PRO_VERSION` constant, and `package.json`
- All 14 screenshots retaken at 3228×1524 px (2× Retina) with the new sidebar UI

---

## [1.7.0] — 2026-03-09

### Added

#### Code Snippets — Monaco Editor
- Replaced plain `<Textarea>` in the create/edit dialog with the full Monaco editor (`@monaco-editor/react`)
- Syntax highlighting per snippet type: PHP, CSS, JavaScript
- Line numbers, word-wrap, and `automaticLayout` — editor resizes correctly inside the dialog

#### Scheduled Backups
- New "Scheduled Backups" card in the Database Backup page
- Enable toggle + Frequency selector (Daily / Weekly / Monthly) + Retain last N select (3 / 5 / 10 / 30)
- Backend: `GET /backup/schedule` and `POST /backup/schedule` REST routes
- WP Cron action `wmp_run_scheduled_backup` calls the existing `generate_dump()` pipeline and prunes old backups automatically
- Custom `monthly` cron recurrence registered via `cron_schedules` filter
- Next-run timestamp shown in the UI when schedule is active

#### Server Config Generator (Image Tools)
- New "Server Config Generator" card in Image Tools with **Nginx** and **Apache** tabs
- Three snippets per server: WebP Serving, Security Headers, Browser Cache Rules
- One-click **Copy** button per snippet (Clipboard API)

#### White-label / Branding (Settings)
- New **Settings** page (`/settings` route, Cog icon in System nav group)
- Branding tab: Plugin Name, Admin Menu Label, Custom Logo URL with live preview
- Logo URL replaces the blue icon in the sidebar header; plugin name is split into main + badge (e.g. "My Manager" + "Pro")
- `GET /settings` and `POST /settings` REST routes backed by new `class-settings-controller.php`
- `wp_localize_script` now exposes `branding.{ pluginName, menuLabel, logoUrl }` to the React app
- `add_menu_page()` uses `get_option('wmp_menu_label')` so the WP admin menu label is dynamic

### Changed
- Sidebar imports `getBranding()` from `api.ts`; logo area and plugin name are now driven by saved branding options

---

## [1.6.0] — 2026-03-09

### Added

#### Image Tools — WebP Delivery
- **Serve WebP Automatically**: `wp_get_attachment_url` filter transparently returns `.webp` URL when browser sends `Accept: image/webp` and a sidecar exists
- **Apache .htaccess rules**: `write_htaccess_webp()` writes `insert_with_markers()` rewrite block to `uploads/.htaccess` on save; removed cleanly when option disabled
- **Nginx info tip** shown in the UI for non-Apache users

#### Image Tools — Replace Original with WebP
- New "Replace Original with WebP" toggle: on upload, deletes original JPEG/PNG and redirects the upload array to the `.webp` file
- On batch convert: updates `_wp_attached_file`, `post_mime_type`, and regenerates attachment metadata from the new `.webp`
- Works only for WebP (not AVIF); irreversible — warning shown in UI

#### Image Tools — Auto-Delete Sidecar Files
- `delete_attachment` hook → `delete_sidecar_files()`: removes `.webp` and `.avif` sidecar for full-size image and all registered thumbnail sizes when an attachment is deleted
- New REST route: `DELETE /images/convert` → `delete_all_converted()` — bulk-delete all `.webp` or `.avif` sidecar files with per-format trash buttons in the UI

### Changed
- `save_as_format()` return type changed from `void` to `?string` (returns path on success, `null` on failure)
- `batch_convert()` accepts new `delete_original` boolean param; conditionally updates attachment record after converting
- Version bumped to `1.6.0` in plugin header, `WP_MANAGER_PRO_VERSION` constant, and `package.json`
- Build: `index.js` 687 kB / `style.css` 47 kB

---

## [1.5.0] — 2026-03-09

### Added

#### Image Tools
- **WebP Conversion on Upload**: `wp_handle_upload` filter converts every uploaded raster image to `.webp` alongside the original when "Convert to WebP on Upload" is enabled
- **AVIF Conversion on Upload**: same pipeline for AVIF when enabled and server supports it
- **Batch Convert**: `POST /images/convert` processes existing media in paginated batches of 10; `GET /images/convert-stats` returns total/converted/remaining counts per format
- **Progress bar** with live counter and Stop button in the Batch Convert card

#### Maintenance Mode
- **Real-time preview countdown**: replaced static hardcoded `['00d','00h','00m','00s']` with `useEffect` + `setInterval` ticking from the saved end datetime
- **Scope control**: apply maintenance to whole site / home page only / specific URL paths (fnmatch wildcard support)
- **Secret bypass URL**: 16-char key (`wp_generate_password`); `?wmp_preview=KEY` sets 7-day httpOnly cookie; `hash_equals()` comparison
- New API fields: `bypass_key`, `scope`, `scope_paths`, `home_url` in `GET /maintenance`

#### Dashboard
- Added 4 Quick Actions: Code Snippets (`/snippets`), Image Tools (`/images`), Email/SMTP (`/email`), Backup (`/backup`) — grid is now 3×4 (12 actions)

### Fixed
- **Maintenance countdown live preview** showed static zeros — fixed with real-time `setInterval` state
- **Snippets toggle** broken by `!!"0" === true` in JS — `enabled` cast to `(int)` before JSON encoding in `get_snippets()`, `create_snippet()`, `update_snippet()`

---

## [1.4.0] — 2026-03-09

### Added

#### Code Snippets Manager
- PHP, CSS, JS snippet CRUD with per-snippet enable/disable toggle
- PHP runs on `init`; CSS on `wp_head`; JS on `wp_footer`
- Custom DB table `wp_wmp_snippets`; toggled `enabled` stored as `TINYINT(1)`

#### Redirect Manager
- CRUD for 301/302/307/308 redirects with wildcard `*` source paths
- Hit counter, active/inactive toggle, CSV import/export
- Runs on `template_redirect` hook (frontend only)

#### Email / SMTP
- Configure SMTP host, port, auth, encryption via `phpmailer_init` hook
- Send test email endpoint, email log (last 100 entries), clear log
- REST routes: `GET /email/settings`, `POST /email/settings`, `POST /email/test`, `GET /email/log`, `DELETE /email/log/clear`

#### Database Backup
- Full or table-specific SQL dumps via PHP `$wpdb` row iteration
- Backup list with filename, size, creation date; download and delete
- Stored in `wp-content/wmp-backups/` with `.htaccess` blocking direct access
- REST routes: `GET /backup`, `POST /backup/create`, `POST /backup/download`, `GET /backup/serve`, `DELETE /backup/delete`

#### Audit Log
- Tracks: plugin activated/deactivated/deleted, theme switched, user login/logout/failed-login, user registered, post published
- Filter by action type, CSV export, clear log
- Custom DB table `wp_wmp_audit_log`

### Fixed
- **Snippets `enabled` toggle**: `$wpdb->get_results()` returns string `"0"` — cast to `(int)` before returning JSON

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

[2.0.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.9.0...v2.0.0
[1.9.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/nurkamol/wp-manager-pro/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/nurkamol/wp-manager-pro/releases/tag/v1.0.0

[2.7.0]: https://github.com/nurkamol/wp-manager-pro/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/nurkamol/wp-manager-pro/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/nurkamol/wp-manager-pro/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/nurkamol/wp-manager-pro/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/nurkamol/wp-manager-pro/compare/v2.3.0...v2.3.1
[2.2.0]: https://github.com/nurkamol/wp-manager-pro/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/nurkamol/wp-manager-pro/compare/v2.0.0...v2.1.0
