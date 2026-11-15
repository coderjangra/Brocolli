package expo.modules.paymentcapture

import org.json.JSONObject

/** A payment-looking message that already passed [CaptureFilter]. Never leaves the device. */
data class Capture(
  val source: String,
  val sender: String,
  val text: String,
  val receivedAt: Long,
  val packageName: String?
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "source" to source,
    "sender" to sender,
    "text" to text,
    "receivedAt" to receivedAt.toDouble(),
    "packageName" to packageName
  )

  fun toJson(): JSONObject = JSONObject().apply {
    put("source", source)
    put("sender", sender)
    put("text", text)
    put("receivedAt", receivedAt)
    if (packageName != null) put("packageName", packageName)
  }

  companion object {
    fun fromJson(o: JSONObject) = Capture(
      source = o.optString("source"),
      sender = o.optString("sender"),
      text = o.optString("text"),
      receivedAt = o.optLong("receivedAt"),
      packageName = if (o.has("packageName")) o.optString("packageName") else null
    )
  }
}
