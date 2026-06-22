package fm.treble.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * JS -> native bridge exposed on the WebView as `window.TrebleNative`. The web UI
 * calls [setPlaying] whenever playback starts/stops so we can run (or tear down)
 * the foreground [PlaybackService] that keeps audio + network alive in the
 * background. A direct JavascriptInterface (not a localhost HTTP call) so it works
 * even with `usesCleartextTraffic=false` in release.
 */
class PlaybackBridge(private val ctx: Context) {
    private val main = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun setPlaying(playing: Boolean, title: String, artist: String) {
        isPlaying = playing
        main.post {
            if (playing) PlaybackService.start(ctx, title, artist)
            else PlaybackService.stop(ctx)
        }
    }

    /** The web UI reports whether hardware Back has somewhere to go in-app (an open
     *  overlay or a non-root screen). MainActivity uses this to decide whether to
     *  consume the Back press or let the OS exit the app. */
    @JavascriptInterface
    fun setCanBack(canBack: Boolean) {
        canGoBack = canBack
    }

    companion object {
        /** Read by MainActivity.onPause() to decide whether to keep the WebView (and
         *  its <audio>) running while the activity is backgrounded. */
        @Volatile
        var isPlaying = false

        /** Read by MainActivity's Back handler (see setCanBack). */
        @Volatile
        var canGoBack = false
    }
}
