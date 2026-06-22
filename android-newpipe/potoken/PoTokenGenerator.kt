/*
 * Ported from NewPipe — https://github.com/TeamNewPipe/NewPipe — GPLv3,
 * © NewPipe contributors. Adapted for Treble (also GPLv3).
 */
package fm.treble.app.potoken

import android.content.Context
import io.reactivex.rxjava3.core.Single
import java.io.Closeable

interface PoTokenGenerator : Closeable {
    fun generatePoToken(identifier: String): Single<String>
    fun isExpired(): Boolean

    interface Factory {
        fun newPoTokenGenerator(context: Context): Single<PoTokenGenerator>
    }
}
