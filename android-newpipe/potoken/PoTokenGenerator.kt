package fm.treble.app.potoken

import android.content.Context
import io.reactivex.rxjava3.core.Single
import java.io.Closeable

/** Ported from NewPipe. */
interface PoTokenGenerator : Closeable {
    fun generatePoToken(identifier: String): Single<String>
    fun isExpired(): Boolean

    interface Factory {
        fun newPoTokenGenerator(context: Context): Single<PoTokenGenerator>
    }
}
