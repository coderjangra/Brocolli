package expo.modules.paymentcapture

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    try {
      val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
      var queued = false
      messages.groupBy { it.originatingAddress.orEmpty() }.forEach { (sender, parts) ->
        val body = parts.joinToString("") { it.messageBody.orEmpty() }
        if (CaptureFilter.acceptSms(sender, body)) {
          CaptureQueue.push(context, Capture("sms", sender, body, parts.first().timestampMillis, null))
          queued = true
        }
      }
      if (queued) PaymentCaptureModule.notifyNew()
    } catch (_: Throwable) {
    }
  }
}
