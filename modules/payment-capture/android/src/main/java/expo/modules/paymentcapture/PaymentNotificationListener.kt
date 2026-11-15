package expo.modules.paymentcapture

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class PaymentNotificationListener : NotificationListenerService() {
  /** Apps re-post the same notification on updates; remember recent ones briefly. */
  private val recent = LinkedHashMap<Int, Long>()

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    try {
      val n = sbn ?: return
      val pkg = n.packageName ?: return
      if (pkg !in CaptureFilter.PAYMENT_APPS && pkg !in CaptureFilter.MESSAGING_APPS) return
      val notification = n.notification ?: return
      if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

      val extras = notification.extras ?: return
      val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().trim()
      val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty().trim()
      val messaging = pkg in CaptureFilter.MESSAGING_APPS

      // SMS apps group several messages into one MessagingStyle notification
      // ("2 new messages"); read each message on its own.
      val bodies = mutableListOf<String>()
      if (messaging) {
        @Suppress("DEPRECATION")
        extras.getParcelableArray(Notification.EXTRA_MESSAGES)?.forEach { item ->
          (item as? android.os.Bundle)?.getCharSequence("text")?.toString()?.trim()
            ?.takeIf { it.isNotEmpty() }?.let(bodies::add)
        }
        if (bodies.isEmpty()) bodies.add(text)
      } else {
        bodies.add(listOf(title, text).filter { it.isNotBlank() }.joinToString(". "))
      }

      var queued = false
      for (body in bodies) {
        val accepted = if (messaging) CaptureFilter.acceptSms(title, body)
        else CaptureFilter.acceptNotification(pkg, title, text)
        if (!accepted) continue
        val now = System.currentTimeMillis()
        val hash = (pkg + body).hashCode()
        val seen = synchronized(recent) {
          recent.entries.removeAll { now - it.value > 10 * 60_000 }
          recent.put(hash, now) != null
        }
        if (seen) continue
        CaptureQueue.push(applicationContext, Capture("notification", title, body, n.postTime, pkg))
        queued = true
      }
      if (queued) PaymentCaptureModule.notifyNew()
    } catch (_: Throwable) {
      // Never crash the listener on an odd notification.
    }
  }
}
