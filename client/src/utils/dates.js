const IST_MS = 330 * 60 * 1000 // India time is UTC + 5:30

// "2026-10-15": today's date in India
export const todayIst = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10)

const addDays = (isoDate, days) => {
    const d = new Date(isoDate + "T00:00:00Z")
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

export const presetRange = (preset) => {
    const today = todayIst()
    if (preset === "today") return { from: today, to: today }
    if (preset === "week") {
        const day = new Date(today + "T00:00:00Z").getUTCDay() // 0 = Sunday
        return { from: addDays(today, day === 0 ? -6 : 1 - day), to: today } // week starts Monday
    }
    if (preset === "month") return { from: today.slice(0, 8) + "01", to: today }
    if (preset === "year") return { from: today.slice(0, 4) + "-01-01", to: today }
    return { from: "", to: "" }
}

export const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
        : ""

export const formatDateTime = (value) =>
    new Date(value).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
    })

// A saved date -> its India calendar date, like "2026-10-15"
export const toIstDate = (value) => new Date(new Date(value).getTime() + IST_MS).toISOString().slice(0, 10)