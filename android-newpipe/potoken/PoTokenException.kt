/*
 * Ported from NewPipe (org.schabi.newpipe.util.potoken) —
 * https://github.com/TeamNewPipe/NewPipe — GPLv3, © NewPipe contributors.
 */
package fm.treble.app.potoken

class PoTokenException(message: String) : Exception(message)

// to be thrown if the WebView provided by the system is broken
class BadWebViewException(message: String) : Exception(message)

fun buildExceptionForJsError(error: String): Exception {
    return if (error.contains("SyntaxError")) {
        BadWebViewException(error)
    } else {
        PoTokenException(error)
    }
}
