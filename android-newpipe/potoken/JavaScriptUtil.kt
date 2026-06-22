/*
 * Ported from NewPipe (org.schabi.newpipe.util.potoken.JavaScriptUtil) —
 * https://github.com/TeamNewPipe/NewPipe — licensed GPLv3, © NewPipe contributors.
 */
package fm.treble.app.potoken

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

// Adapted for Treble: uses Android's built-in org.json (NewPipeExtractor bundles its
// own nanojson fork, which can't be re-added) and android.util.Base64 instead of okio.

fun parseChallengeData(rawChallengeData: String): String {
    val scrambled = JSONArray(rawChallengeData)

    val challengeData: JSONArray = if (scrambled.length() > 1 && scrambled.opt(1) is String) {
        JSONArray(descramble(scrambled.getString(1)))
    } else {
        scrambled.getJSONArray(0)
    }

    val messageId = challengeData.getString(0)
    val interpreterHash = challengeData.getString(3)
    val program = challengeData.getString(4)
    val globalName = challengeData.getString(5)
    val clientExperimentsStateBlob = challengeData.getString(7)

    val safeScript = challengeData.optJSONArray(1)?.let { firstString(it) }
    val trustedResourceUrl = challengeData.optJSONArray(2)?.let { firstString(it) }

    val interpreterJs = JSONObject()
        .put("privateDoNotAccessOrElseSafeScriptWrappedValue", safeScript)
        .put("privateDoNotAccessOrElseTrustedResourceUrlWrappedValue", trustedResourceUrl)

    return JSONObject()
        .put("messageId", messageId)
        .put("interpreterJavascript", interpreterJs)
        .put("interpreterHash", interpreterHash)
        .put("program", program)
        .put("globalName", globalName)
        .put("clientExperimentsStateBlob", clientExperimentsStateBlob)
        .toString()
}

fun parseIntegrityTokenData(rawIntegrityTokenData: String): Pair<String, Long> {
    val arr = JSONArray(rawIntegrityTokenData)
    return base64ToU8(arr.getString(0)) to arr.getLong(1)
}

fun stringToU8(identifier: String): String = newUint8Array(identifier.toByteArray())

fun u8ToBase64(poToken: String): String {
    val bytes = poToken.split(",").map { it.toUByte().toByte() }.toByteArray()
    return Base64.encodeToString(bytes, Base64.NO_WRAP).replace("+", "-").replace("/", "_")
}

private fun firstString(arr: JSONArray): String? {
    for (i in 0 until arr.length()) {
        val v = arr.opt(i)
        if (v is String) return v
    }
    return null
}

private fun descramble(scrambledChallenge: String): String {
    return base64ToByteString(scrambledChallenge).map { (it + 97).toByte() }.toByteArray().decodeToString()
}

private fun base64ToU8(base64: String): String = newUint8Array(base64ToByteString(base64))

private fun newUint8Array(contents: ByteArray): String =
    "new Uint8Array([" + contents.joinToString(separator = ",") { it.toUByte().toString() } + "])"

private fun base64ToByteString(base64: String): ByteArray {
    val base64Mod = base64.replace('-', '+').replace('_', '/').replace('.', '=')
    return Base64.decode(base64Mod, Base64.DEFAULT)
}
