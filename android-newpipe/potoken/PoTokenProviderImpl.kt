/*
 * Ported from NewPipe (org.schabi.newpipe.util.potoken.PoTokenProviderImpl) —
 * https://github.com/TeamNewPipe/NewPipe — licensed GPLv3.
 * © NewPipe contributors. Adapted for Treble (also GPLv3).
 */
package fm.treble.app.potoken

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.services.youtube.InnertubeClientRequestInfo
import org.schabi.newpipe.extractor.services.youtube.PoTokenProvider
import org.schabi.newpipe.extractor.services.youtube.PoTokenResult
import org.schabi.newpipe.extractor.services.youtube.YoutubeParsingHelper

/**
 * Ported from NewPipe (org.schabi.newpipe.util.potoken.PoTokenProviderImpl).
 * Generates a WEB-client poToken via the BotGuard WebView so YouTube serves
 * non-gated streams. Call [init] with the application context before use.
 */
object PoTokenProviderImpl : PoTokenProvider {
    private val TAG = "PoTokenProvider"
    private lateinit var appContext: Context
    private var webViewBadImpl = false

    fun init(context: Context) { appContext = context.applicationContext }

    private object WebPoTokenGenLock
    private var webPoTokenVisitorData: String? = null
    private var webPoTokenStreamingPot: String? = null
    private var webPoTokenGenerator: PoTokenGenerator? = null

    override fun getWebClientPoToken(videoId: String): PoTokenResult? {
        if (!::appContext.isInitialized || webViewBadImpl) return null
        return try {
            getWebClientPoToken(videoId, forceRecreate = false)
        } catch (e: RuntimeException) {
            when (val cause = e.cause) {
                is BadWebViewException -> {
                    Log.e(TAG, "WebView broken, disabling poToken", e)
                    webViewBadImpl = true
                    null
                }
                null -> throw e
                else -> throw cause
            }
        }
    }

    private fun getWebClientPoToken(videoId: String, forceRecreate: Boolean): PoTokenResult {
        data class Quad<A, B, C, D>(val a: A, val b: B, val c: C, val d: D)

        val (poTokenGenerator, visitorData, streamingPot, hasBeenRecreated) =
            synchronized(WebPoTokenGenLock) {
                val shouldRecreate = webPoTokenGenerator == null || forceRecreate ||
                    webPoTokenGenerator!!.isExpired()

                if (shouldRecreate) {
                    val info = InnertubeClientRequestInfo.ofWebClient()
                    info.clientInfo.clientVersion = YoutubeParsingHelper.getClientVersion()

                    webPoTokenVisitorData = YoutubeParsingHelper.getVisitorDataFromInnertube(
                        info,
                        NewPipe.getPreferredLocalization(),
                        NewPipe.getPreferredContentCountry(),
                        YoutubeParsingHelper.getYouTubeHeaders(),
                        YoutubeParsingHelper.YOUTUBEI_V1_URL,
                        null,
                        false
                    )
                    webPoTokenGenerator?.let { Handler(Looper.getMainLooper()).post { it.close() } }

                    webPoTokenGenerator = PoTokenWebView.newPoTokenGenerator(appContext).blockingGet()
                    // streaming poToken must be generated exactly once, before any player tokens
                    webPoTokenStreamingPot = webPoTokenGenerator!!
                        .generatePoToken(webPoTokenVisitorData!!).blockingGet()
                }

                Quad(webPoTokenGenerator!!, webPoTokenVisitorData!!, webPoTokenStreamingPot!!, shouldRecreate)
            }

        val playerPot = try {
            poTokenGenerator.generatePoToken(videoId).blockingGet()
        } catch (t: Throwable) {
            if (hasBeenRecreated) throw t
            Log.e(TAG, "Failed to obtain poToken, retrying", t)
            return getWebClientPoToken(videoId, forceRecreate = true)
        }

        return PoTokenResult(visitorData, playerPot, streamingPot)
    }

    override fun getWebEmbedClientPoToken(videoId: String): PoTokenResult? = null
    override fun getAndroidClientPoToken(videoId: String): PoTokenResult? = null
    override fun getIosClientPoToken(videoId: String): PoTokenResult? = null
}
