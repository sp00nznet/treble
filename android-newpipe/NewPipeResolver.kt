package fm.treble.app

import android.util.Log
import fi.iki.elonen.NanoHTTPD
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response as NpResponse
import org.schabi.newpipe.extractor.stream.StreamInfo
import java.net.HttpURLConnection
import java.net.URL

/**
 * On-device YouTube stream resolution using NewPipeExtractor (the same library
 * NewPipe uses) — it runs YouTube's player JS deobfuscation locally via Rhino.
 *
 * Exposed to the Rust core as a tiny localhost HTTP server so the existing
 * resolve path can call it like any other resolver (no JNI bridge needed):
 *   GET http://127.0.0.1:28923/resolve?id=<videoId>  ->  a playable stream URL
 */
object NewPipeResolver {
    const val PORT = 28923
    private const val UA =
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    private var server: ResolverServer? = null

    fun start() {
        try {
            NewPipe.init(NpDownloader())
            val s = ResolverServer(PORT)
            s.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            server = s
            Log.i("Treble", "NewPipe resolver on 127.0.0.1:$PORT")
        } catch (e: Throwable) {
            Log.e("Treble", "NewPipe resolver failed to start", e)
        }
    }

    /** Resolve the best progressive audio URL for a YouTube video id. */
    fun resolveAudio(id: String): String? {
        return try {
            val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$id")
            info.audioStreams
                .filter { it.isUrl && !it.content.isNullOrEmpty() }
                .maxByOrNull { it.averageBitrate }
                ?.content
        } catch (e: Throwable) {
            Log.e("Treble", "NewPipe resolve failed for $id: ${e.message}")
            null
        }
    }

    /** Minimal localhost HTTP front-end so the Rust side can call us. */
    private class ResolverServer(port: Int) : NanoHTTPD("127.0.0.1", port) {
        override fun serve(session: IHTTPSession): Response = when (session.uri) {
            "/ping" -> newFixedLengthResponse("newpipe")
            "/resolve" -> {
                val id = session.parameters["id"]?.firstOrNull()
                val url = if (!id.isNullOrEmpty()) resolveAudio(id) else null
                if (url != null) newFixedLengthResponse(url)
                else newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "resolve failed")
            }
            else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found")
        }
    }

    /** NewPipeExtractor downloader backed by HttpURLConnection (no extra deps). */
    private class NpDownloader : Downloader() {
        override fun execute(request: Request): NpResponse {
            val conn = URL(request.url()).openConnection() as HttpURLConnection
            conn.connectTimeout = 30_000
            conn.readTimeout = 30_000
            conn.instanceFollowRedirects = true
            conn.requestMethod = request.httpMethod()

            var hasUa = false
            for ((name, values) in request.headers()) {
                for (v in values) conn.addRequestProperty(name, v)
                if (name.equals("User-Agent", ignoreCase = true)) hasUa = true
            }
            if (!hasUa) conn.setRequestProperty("User-Agent", UA)

            request.dataToSend()?.let { data ->
                conn.doOutput = true
                conn.outputStream.use { it.write(data) }
            }

            val code = conn.responseCode
            val message = conn.responseMessage ?: ""
            val stream = if (code >= 400) conn.errorStream else conn.inputStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            val headers = HashMap<String, List<String>>()
            for ((k, v) in conn.headerFields) if (k != null) headers[k] = v
            val latest = conn.url.toString()
            conn.disconnect()
            return NpResponse(code, message, headers, body, latest)
        }
    }
}
