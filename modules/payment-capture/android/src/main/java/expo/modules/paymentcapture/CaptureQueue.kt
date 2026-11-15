package expo.modules.paymentcapture

import android.content.Context
import org.json.JSONArray

/** Small on-device queue so captures made while the app is closed survive until JS drains them. */
object CaptureQueue {
  private const val PREFS = "brocolli_capture_queue"
  private const val KEY = "items"
  private const val MAX_ITEMS = 300
  private val lock = Any()

  fun push(context: Context, capture: Capture) = synchronized(lock) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val items = runCatching { JSONArray(prefs.getString(KEY, "[]")) }.getOrDefault(JSONArray())
    items.put(capture.toJson())
    val trimmed = JSONArray()
    for (i in maxOf(0, items.length() - MAX_ITEMS) until items.length()) trimmed.put(items.get(i))
    prefs.edit().putString(KEY, trimmed.toString()).apply()
  }

  fun drain(context: Context): List<Capture> = synchronized(lock) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val items = runCatching { JSONArray(prefs.getString(KEY, "[]")) }.getOrDefault(JSONArray())
    prefs.edit().remove(KEY).commit()
    (0 until items.length()).mapNotNull { i ->
      runCatching { Capture.fromJson(items.getJSONObject(i)) }.getOrNull()
    }
  }
}
