// Pick a friendly emoji for a payee so captured cards are scannable at a glance.

const RULES: [RegExp, string][] = [
  [/zomato|swiggy|domino|pizza|kfc|mcdonald|burger|eats|biryani|dhaba|restaurant|food|cafe|canteen|mess/, '🍕'],
  [/chai|tea|coffee|starbucks|ccd|barista|third wave/, '☕'],
  [/uber|ola|taxi|cab|auto/, '🚕'],
  [/rapido|bike/, '🛵'],
  [/metro|irctc|rail|train|redbus|bus|abhibus/, '🚆'],
  [/indigo|air ?india|vistara|akasa|spicejet|flight|makemytrip|goibibo|ixigo/, '✈️'],
  [/blinkit|zepto|instamart|bigbasket|dmart|grocer|kirana|mart|milk|dairy/, '🛒'],
  [/pvr|inox|cinema|movie|bookmyshow|district/, '🎬'],
  [/netflix|spotify|prime|hotstar|youtube|jiocinema|sony ?liv/, '📺'],
  [/jio|airtel|vi |vodafone|bsnl|recharge|mobile/, '📱'],
  [/amazon|flipkart|myntra|meesho|ajio|nykaa|shop/, '🛍️'],
  [/petrol|fuel|hp |indian oil|bharat petroleum|shell/, '⛽'],
  [/hostel|pg |rent|room|flat|stay|oyo|hotel/, '🏠'],
  [/electric|bescom|power|water|gas|bill/, '💡'],
  [/xerox|print|stationery|book|college|university|fees|exam/, '📚'],
  [/medical|pharma|apollo|medplus|hospital|clinic|chemist/, '💊'],
  [/gym|fitness|cult/, '🏋️'],
  [/atm|withdrawal|cash/, '💵'],
];

export function merchantEmoji(payee: string): string {
  const name = ` ${payee.toLowerCase()} `;
  return RULES.find(([re]) => re.test(name))?.[1] ?? '💸';
}
