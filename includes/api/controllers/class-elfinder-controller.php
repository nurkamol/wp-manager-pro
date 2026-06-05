<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;

/**
 * elFinder connector — boots the bundled elFinder PHP library with a single
 * LocalFileSystem volume rooted at ABSPATH. The REST route's permission
 * callback ( manage_options ) plus the WP REST nonce gate every request; the
 * connector then speaks elFinder's own protocol and exits.
 */
class Elfinder_Controller {

    /**
     * Handle an elFinder connector request and stream the response.
     */
    public static function run( WP_REST_Request $request ) {
        // elFinder's library is global-symbol (no namespace) and its autoload.php
        // declares a global elFinderAutoloader() function. Other plugins ship
        // elFinder too (e.g. Filester), so requiring our copy unconditionally would
        // fatally redeclare those symbols. Only load our bundled copy when no
        // elFinder is present yet; otherwise reuse whatever is already loaded.
        if ( ! class_exists( '\elFinder' ) ) {
            require_once WP_MANAGER_PRO_PATH . 'includes/vendor/elfinder/php/autoload.php';
        }

        // elFinder caches volume state in its own PHP session.
        if ( PHP_SESSION_ACTIVE !== session_status() && ! headers_sent() ) {
            @session_start();
        }

        $uploads = wp_upload_dir();
        $tmb_dir = $uploads['basedir'] . '/wmp-elfinder-tmb';

        $opts = [
            'roots' => [
                [
                    'driver'          => 'LocalFileSystem',
                    'path'            => rtrim( ABSPATH, '/\\' ),
                    'URL'             => site_url( '/' ),
                    'alias'           => 'Site Root',
                    'tmbPath'         => $tmb_dir,
                    'tmbURL'          => $uploads['baseurl'] . '/wmp-elfinder-tmb',
                    'uploadOverwrite' => false,
                    'utf8fix'         => true,
                    'accessControl'   => [ self::class, 'access_control' ],
                ],
            ],
        ];

        // elFinderConnector reads the request, emits headers + body itself, then
        // we exit before WordPress tries to serialise a REST response.
        $connector = new \elFinderConnector( new \elFinder( $opts ) );
        $connector->run();
        exit;
    }

    /**
     * Restrict access to sensitive files. `wp-config.php` stays visible and
     * readable but cannot be written, renamed, moved, or deleted. elFinder's own
     * thumbnail cache and macOS cruft are hidden from the listing.
     *
     * @return bool|null true to allow/hide, false to deny, null for default.
     */
    public static function access_control( $attr, $path, $data, $volume, $is_dir, $relpath ) {
        $name = basename( $path );

        // Hide the thumbnail cache and macOS metadata without blocking elFinder's
        // own read/write of them (only the 'hidden' attribute is forced true).
        if ( '.tmb' === $name || '.DS_Store' === $name || '.quarantine' === $name ) {
            return 'hidden' === $attr ? true : null;
        }

        if ( 'wp-config.php' === $name ) {
            if ( 'write' === $attr )  return false; // no overwrite/edit.
            if ( 'locked' === $attr ) return true;  // no rename/move/delete.
            return null;                            // read allowed.
        }

        return null;
    }

    /**
     * Render the self-contained iframe host document. Loading elFinder in its own
     * document isolates it from the React app's global Tailwind/admin CSS resets,
     * which otherwise strip the jQuery-UI widget styling. Capability + nonce gated.
     */
    public static function host() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You are not allowed to access the File Manager.', 'wp-manager-pro' ), 403 );
        }

        $nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';
        if ( ! wp_verify_nonce( $nonce, 'wmp_elfinder_host' ) ) {
            wp_die( esc_html__( 'Invalid or expired File Manager session. Reload the page.', 'wp-manager-pro' ), 403 );
        }

        $base       = WP_MANAGER_PRO_URL . 'assets/elfinder/';
        $connector  = rest_url( 'wp-manager-pro/v1/files/elfinder' );
        $rest_nonce = wp_create_nonce( 'wp_rest' );
        $jquery     = includes_url( 'js/jquery/jquery.min.js' );
        $jqui_css   = $base . 'jquery-ui/jquery-ui.min.css';
        $jqui_js    = $base . 'jquery-ui/jquery-ui.min.js';

        nocache_headers();
        header( 'Content-Type: text/html; charset=utf-8' );
        // The iframe is same-origin; deny external framing for safety.
        header( 'X-Frame-Options: SAMEORIGIN' );

        // Pass typed config to the inline boot script.
        $cfg = wp_json_encode( [
            'url'       => $connector,
            'baseUrl'   => $base,
            'restNonce' => $rest_nonce,
            'lang'      => 'en',
            // ACE editor base (contains ace.js + modes/themes/workers). The bundled
            // editors.default.js loads it via options.cdns.ace — fully offline.
            'aceUrl'    => untrailingslashit( $base . 'ace' ),
            // Dark theme = community Dark Slim + our contrast-fix overlay (array).
            'darkCss'   => [
                $base . 'themes/dark-slim/css/elfinder.theme.min.css',
                $base . 'themes/dark-slim/dark-fix.css',
            ],
        ] );

        ?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>File Manager</title>
<link rel="stylesheet" href="<?php echo esc_url( $jqui_css ); ?>">
<link rel="stylesheet" href="<?php echo esc_url( $base . 'css/elfinder.min.css' ); ?>">
<link rel="stylesheet" href="<?php echo esc_url( $base . 'css/theme.css' ); ?>">
<style>
  html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; background: #fff; }
  #wmp-elfinder { border: 0; }
  #wmp-elf-error { display: none; box-sizing: border-box; max-width: 640px; margin: 48px auto; padding: 24px 28px;
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #7a2e0e;
    background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; }
  #wmp-elf-error h2 { margin: 0 0 8px; font-size: 16px; color: #9a3412; }
  #wmp-elf-error code { background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #fed7aa; word-break: break-all; }
  #wmp-elf-error a { color: #2563eb; }
</style>
</head>
<body>
<div id="wmp-elfinder"></div>
<div id="wmp-elf-error" role="alert"></div>
<script>
  // Surface any load/init failure visibly instead of leaving the iframe blank,
  // so the cause is diagnosable on any hosting stack (see issue #5).
  window.__wmpElfFail = function (msg) {
    var box = document.getElementById('wmp-elf-error');
    var fm  = document.getElementById('wmp-elfinder');
    if (fm) { fm.style.display = 'none'; }
    if (!box) { return; }
    box.style.display = 'block';
    box.innerHTML = '<h2>File Manager could not load</h2>' +
      '<p>' + String(msg).replace(/[<>&]/g, function (c) { return { '<':'&lt;','>':'&gt;','&':'&amp;' }[c]; }) + '</p>' +
      '<p>Try a hard refresh (Ctrl/Cmd+Shift+R). If it persists, open this frame directly to see the browser console: ' +
      '<a href="' + location.href + '" target="_blank" rel="noopener">open in a new tab</a>, and share the console error on ' +
      '<a href="https://github.com/nurkamol/wp-manager-pro/issues" target="_blank" rel="noopener">GitHub</a>.</p>';
  };
  window.addEventListener('error', function (e) {
    var where = e && e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + (e.lineno || '?') : '';
    window.__wmpElfFail('<code>' + (e && e.message ? e.message : 'Script error') + where + '</code>');
  });
</script>
<script src="<?php echo esc_url( $jquery ); ?>"></script>
<!-- WordPress ships jQuery in noConflict mode (no global $). elFinder's bundled
     editors.default uses a bare `$` (e.g. $.Deferred() in the ACE loader), so
     restore it here. This iframe only contains jQuery/jQuery-UI/elFinder, so
     reclaiming $ for jQuery is safe. -->
<script>window.$ = window.jQuery;</script>
<script src="<?php echo esc_url( $jqui_js ); ?>"></script>
<script src="<?php echo esc_url( $base . 'js/elfinder.min.js' ); ?>"></script>
<!-- Bundled editor integrations (ACE etc.) for the "Edit file" submenu. -->
<script src="<?php echo esc_url( $base . 'js/extras/editors.default.min.js' ); ?>"></script>
<script>
(function () {
  var CFG = <?php echo $cfg; // phpcs:ignore — JSON-encoded, safe. ?>;
  var fail = window.__wmpElfFail || function () {};

  // Guard against partial asset loads (some hosts/proxies/CSP block scripts).
  if (typeof window.jQuery === 'undefined') { fail('jQuery did not load.'); return; }
  if (!window.jQuery.fn || typeof window.jQuery.fn.elfinder !== 'function') {
    fail('elFinder did not load (jQuery.fn.elfinder missing). A proxy, CSP, or 404 may be blocking <code>js/elfinder.min.js</code>.');
    return;
  }

  try {
  jQuery(function ($) {
    // Restrict the "Edit file" editors to ACE (bundled) — elFinder still offers
    // its built-in TextArea alongside it, matching the Filester-style submenu.
    // The rest of editors.default (CodeMirror, TinyMCE, online services…) is dropped.
    var allEditors = (elFinder.prototype._options.commandsOptions.edit.editors || []);
    var editors = allEditors.filter(function (ed) {
      return ed.info && ed.info.id === 'aceeditor';
    });

    // Point ACE at the bundled copy (offline) while keeping other cdn defaults.
    var cdns = $.extend({}, elFinder.prototype._options.cdns, { ace: CFG.aceUrl });

    var instance = $('#wmp-elfinder').elfinder({
      url: CFG.url,
      baseUrl: CFG.baseUrl,
      cssAutoLoad: false,
      lang: CFG.lang,
      // Authenticate every connector request with the WP REST nonce — header for
      // XHR, query param for plain file/quick-look URLs elFinder builds itself.
      customHeaders: { 'X-WP-Nonce': CFG.restNonce },
      customData: { _wpnonce: CFG.restNonce },
      height: '100%',
      resizable: false,
      sound: false,
      rememberLastDir: true,
      cdns: cdns,
      commandsOptions: { edit: { editors: editors } },
      // Theme switcher (Default + Dark) is exposed in the Preferences dialog.
      themes: {
        'dark': { name: 'Dark', cssurls: CFG.darkCss }
      },
      theme: 'default',
      uiOptions: {
        toolbar: [
          ['back', 'forward'],
          ['reload'],
          ['home', 'up'],
          ['mkdir', 'mkfile', 'upload'],
          ['open', 'download', 'getfile'],
          ['undo', 'redo'],
          ['copy', 'cut', 'paste'],
          ['rm', 'empty'],
          ['rename', 'duplicate', 'edit', 'resize'],
          ['extract', 'archive'],
          ['search'],
          ['view', 'sort'],
          ['preference'],
          ['fullscreen']
        ],
        toolbarExtra: { displayTextLabel: false, autoHideUA: ['search'] }
      },
      contextmenu: {
        navbar: ['open', 'download', '|', 'copy', 'cut', 'paste', 'duplicate', '|', 'rm', '|', 'rename', '|', 'info', 'chmod'],
        cwd: ['reload', 'back', '|', 'upload', 'mkdir', 'mkfile', 'paste', '|', 'sort', '|', 'info', 'preference', 'fullscreen'],
        files: ['getfile', '|', 'open', 'opennew', 'download', 'opendir', 'quicklook', '|', 'copy', 'cut', 'paste', 'duplicate', '|', 'rm', '|', 'edit', 'rename', 'resize', '|', 'archive', 'extract', '|', 'selectall', 'selectinvert', '|', 'info', 'chmod']
      }
    }).elfinder('instance');

    var fit = function () { if (instance) instance.resize('100%', $(window).height()); };
    $(window).on('resize', fit);
    fit();
  });
  } catch (err) {
    fail('<code>' + String(err && err.message ? err.message : err) + '</code>');
  }
})();
</script>
</body>
</html>
<?php
        exit;
    }
}
