package expo.modules.paymentcapture

/**
 * Privacy gate (SPEC §5, CONTRIBUTING.md): only bank/UPI payment messages get past
 * this point. Everything else is dropped here and never reaches JS.
 */
object CaptureFilter {
  val PAYMENT_APPS = setOf(
    "com.google.android.apps.nbu.paisa.user", // Google Pay
    "com.phonepe.app",
    "net.one97.paytm",
    "in.org.npci.upiapp", // BHIM
    "com.dreamplug.androidapp", // CRED
    "com.snapwork.hdfc",
    "com.csam.icici.bank.imobile",
    "com.sbi.lotusintouch", // YONO
    "com.axis.mobile",
    "com.msf.kbank.mobile", // Kotak
    "money.super.payments",
    "com.naviapp",
    "com.fampay.in",
    "com.iexceed.ib.digitalbankingprod", // Indian Bank IndOASIS
    "com.indusind.mobile.indie", // IndusInd INDIE
    "com.indusind.indusmobile",
    "com.infrasofttech.indianBank",
    "com.bankofbaroda.mconnect",
    "com.pnb.pnbone",
    "com.canarabank.mobility",
    "com.unionbank.ecommerce.mobile.android",
    "com.idfcfirstbank.optimus",
    "com.freecharge.android",
    "com.mobikwik_new",
    "in.amazon.mShop.android.shopping" // Amazon Pay UPI
  )

  /** Bank SMS also arrive as notifications from the SMS app, so no SMS permission is needed. */
  val MESSAGING_APPS = setOf(
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.android.mms"
  )

  private val SENDER = Regex("^(?:[A-Z]{2}-)?([A-Z0-9]{5,9})(-[A-Z])?$")
  private val BANK_IDS = listOf(
    "HDFC", "ICICI", "SBI", "AXIS", "KOTAK", "PAYTM", "YESB", "YESBNK", "IDFC", "PNB", "BOB",
    "BARODA", "CANBNK", "INDUS", "AUBANK", "AUSFB", "FEDBNK", "UNION", "UBOI", "IDBI", "AIRBNK",
    "JUPITR", "FIMONY", "SCBANK", "CITI", "HSBC", "RBL", "IOB", "BOI", "CBOI", "UCO", "KVB",
    "DBS", "UPI", "INDBNK", "INDIANB", "CENTBK", "BOIIND", "MAHABK", "IOBCHN", "UCOBNK", "PSBANK",
    "BANDHN", "RBLBNK", "KARBNK", "KVBANK", "SIBSMS", "TMBANK", "CSBBNK", "DCBBNK", "EQUTAS",
    "UJJIVN", "JKBANK", "SLICE", "ONECRD", "AMEX", "BAJAJF", "NAVI", "MOBIKW", "FRECHG"
  )

  /** Any service/transactional (-S / -T) sender whose text names a masked bank account. */
  private val ACCOUNT_REF = Regex(
    """\b(a/c|acct|account|card)\b[^\n]{0,14}?[xX*]+\d{3,4}|\b(a/c|acct|account)\s*(no\.?)?\s*\*?\d{3,4}\b""",
    RegexOption.IGNORE_CASE
  )
  private val KEYWORDS = Regex(
    "\\b(debited|credited|spent|paid|sent|received|withdrawn|purchase|refund)",
    RegexOption.IGNORE_CASE
  )
  private val MONEY = Regex("(Rs\\.?|INR|₹)\\s?\\d|(debited|credited) by \\d", RegexOption.IGNORE_CASE)
  private val OTP = Regex("\\b(OTP|one[- ]time password|verification code)\\b", RegexOption.IGNORE_CASE)

  fun isBankSender(sender: String): Boolean {
    val match = SENDER.matchEntire(sender.trim().uppercase()) ?: return false
    val id = match.groupValues[1]
    return BANK_IDS.any { id.contains(it) }
  }

  fun looksLikePayment(text: String): Boolean =
    text.length in 8..2000 &&
      KEYWORDS.containsMatchIn(text) &&
      MONEY.containsMatchIn(text) &&
      !OTP.containsMatchIn(text)

  private fun isTransactionalSender(sender: String): Boolean {
    val match = SENDER.matchEntire(sender.trim().uppercase()) ?: return false
    return match.groupValues[2] == "-S" || match.groupValues[2] == "-T"
  }

  fun acceptSms(sender: String, body: String) =
    looksLikePayment(body) &&
      (isBankSender(sender) || (isTransactionalSender(sender) && ACCOUNT_REF.containsMatchIn(body)))

  fun acceptNotification(pkg: String, title: String, text: String): Boolean = when (pkg) {
    in PAYMENT_APPS -> looksLikePayment("$title $text")
    in MESSAGING_APPS -> acceptSms(title, text)
    else -> false
  }
}
