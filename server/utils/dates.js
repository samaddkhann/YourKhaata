const IST_OFFSET_MS = 330 * 60 * 1000 // India time is UTC + 5:30

// "2026-10-15": today's date in India
export const istDateString = (date = new Date()) =>
    new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)

// "2026-10-15" -> the start (or end) of that day in India. Returns null if invalid.
export const parseIstDate = (text, endOfDay = false) => {
    if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
    const time = endOfDay ? "23:59:59.999" : "00:00:00.000"
    const date = new Date(`${text}T${time}+05:30`)
    if (Number.isNaN(date.getTime())) return null
    if (istDateString(date) !== text) return null // catches 2026-02-31
    return date
}