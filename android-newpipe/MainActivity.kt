package fm.treble.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  private var webRef: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // On-device NewPipeExtractor resolver (localhost:28923) the Rust core calls
    // to play YouTube without needing a desktop companion.
    NewPipeResolver.start(this)

    // Route hardware Back into the web UI (close overlays / pop in-app screens)
    // before letting the OS exit. TauriActivity disables Wry's own back handling,
    // so we own this. The web UI keeps PlaybackBridge.canGoBack current.
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val wv = webRef
        if (PlaybackBridge.canGoBack && wv != null) {
          wv.post { wv.evaluateJavascript("window.__trebleBack && window.__trebleBack();", null) }
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed() // nothing to pop — let the OS handle it
          isEnabled = true
        }
      }
    })
    // Needed so the foreground-playback notification is visible on Android 13+
    // (the service runs regardless, but the media notification would be hidden).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webRef = webView
    // window.TrebleNative.setPlaying(playing, title, artist) — drives PlaybackService.
    webView.addJavascriptInterface(PlaybackBridge(applicationContext), "TrebleNative")
  }

  override fun onPause() {
    super.onPause()
    // WryActivity.onPause() just paused the WebView, which also suspends the HTML5
    // <audio> element. If we're actively playing, resume the WebView so music keeps
    // going with the screen off — the foreground PlaybackService + wake lock keep
    // the process alive and out of the background-network firewall.
    if (PlaybackBridge.isPlaying) webRef?.onResume()
  }
}
