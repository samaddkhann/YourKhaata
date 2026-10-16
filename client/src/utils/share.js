import { formatDate } from "./dates"
import { formatPaise } from "./money"

// WhatsApp needs the number with country code and no symbols. 10 digits = Indian number.
export const whatsappLink = (phone, text) => {
    let digits = String(phone || "").replace(/\D/g, "")
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
    if (digits.length === 10) digits = "91" + digits
    if (digits.length < 11) return ""
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export const smsLink = (phone, text) => {
    const number = String(phone || "").replace(/[^\d+]/g, "")
    return number ? `sms:${number}?body=${encodeURIComponent(text)}` : ""
}

export const buildReminderText = ({ customerName, businessName, amountPaise, dueDate, upiId }) =>
    `Hello ${customerName},\n` +
    `This is a friendly reminder from ${businessName}: ${formatPaise(amountPaise)} is pending` +
    `${dueDate ? ` (due ${formatDate(dueDate)})` : ""}.\n` +
    `${upiId ? `You can pay by UPI: ${upiId}\n` : ""}` +
    `Please pay at your earliest convenience. Thank you.`