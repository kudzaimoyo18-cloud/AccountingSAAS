// Ziina payment links (manual mode). Swap to Payment Intent API when key arrives.
// Flow: client pays via link → admin marks company active in /admin/[id].

export const PAYMENT_LINKS: Record<string, { amountAed: string; url: string }> = {
  starter: {
    amountAed: "349",
    url: "https://pay.ziina.com/kudzaimoyo18/ak2bSLcEY",
  },
  growth: {
    amountAed: "999",
    url: "https://pay.ziina.com/kudzaimoyo18/B5wT7OuS0",
  },
  pro: {
    amountAed: "2,900",
    url: "https://pay.ziina.com/kudzaimoyo18/a4elHLi0W",
  },
};
