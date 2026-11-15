package expo.modules.paymentcapture

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import android.provider.Telephony
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaymentCaptureModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("PaymentCapture")

    Events("onCapture")

    OnCreate { active = this@PaymentCaptureModule }
    OnDestroy { if (active === this@PaymentCaptureModule) active = null }

    Function("isNotificationAccessEnabled") {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      enabled?.contains(context.packageName) == true
    }

    Function("openNotificationAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("hasSmsPermission") { hasSms(context) }

    Function("drainQueue") { CaptureQueue.drain(context).map { it.toMap() } }

    AsyncFunction("scanRecentSms") { sinceMs: Double ->
      if (!hasSms(context)) return@AsyncFunction emptyList<Map<String, Any?>>()
      val out = mutableListOf<Map<String, Any?>>()
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
        "${Telephony.Sms.DATE} > ?",
        arrayOf(sinceMs.toLong().toString()),
        "${Telephony.Sms.DATE} DESC"
      )?.use { cursor ->
        while (cursor.moveToNext() && out.size < 500) {
          val sender = cursor.getString(0).orEmpty()
          val body = cursor.getString(1).orEmpty()
          if (CaptureFilter.acceptSms(sender, body)) {
            out.add(Capture("sms", sender, body, cursor.getLong(2), null).toMap())
          }
        }
      }
      out
    }
  }

  private fun hasSms(context: Context) =
    context.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED &&
      context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED

  companion object {
    @Volatile
    private var active: PaymentCaptureModule? = null

    /** Ping JS that the queue has something; JS drains it. Safe when the app is not running. */
    fun notifyNew() {
      try {
        active?.sendEvent("onCapture", emptyMap<String, Any>())
      } catch (_: Throwable) {
      }
    }
  }
}
