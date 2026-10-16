const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 })
const plain = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 12500000 (paise) -> "₹1,25,000.00"
export const formatPaise = (paise) => inr.format((paise || 0) / 100)

// PDF fonts cannot draw the ₹ sign, so PDFs use "Rs."
export const formatPaisePdf = (paise) => "Rs. " + plain.format((paise || 0) / 100)

// A real number for CSV files: 125050 -> 1250.5
export const rupeesNumber = (paise) => Number(((paise || 0) / 100).toFixed(2))

export const balanceText = (paise) => {
    if (paise > 0) return `${formatPaise(paise)} (you'll get)`
    if (paise < 0) return `${formatPaise(-paise)} (you'll give)`
    return "₹0.00 (settled)"
}

export const balancePdf = (paise) => {
    if (paise > 0) return `${formatPaisePdf(paise)} (get)`
    if (paise < 0) return `${formatPaisePdf(-paise)} (give)`
    return formatPaisePdf(0)
}

// "1,250.5" -> 125050. Returns null if invalid.
export const rupeesToPaise = (input) => {
    const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(String(input).replace(/,/g, "").trim())
    if (!match) return null
    return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
}