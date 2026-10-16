// Trims text. Anything that is not a string becomes "".
export const cleanText = (value) => (typeof value === "string" ? value.trim() : "")

// "" if empty, the cleaned number if valid, null if invalid
export const normalizePhone = (value) => {
    if (value === undefined || value === null || value === "") return ""
    const phone = String(value).replace(/[\s-]/g, "")
    return /^\+?\d{7,15}$/.test(phone) ? phone : null
}

export const normalizeEmail = (value) => {
    if (value === undefined || value === null || value === "") return ""
    const email = String(value).trim().toLowerCase()
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}