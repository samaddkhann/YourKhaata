// Turns what a user types ("1,250.50") into whole paise (125050).
// Returns null if the text is not a valid amount. No decimal-math mistakes.
export const rupeesToPaise = (input) => {
    const text = String(input ?? "").replace(/,/g, "").trim()
    const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text)
    if (!match) return null

    const rupees = Number(match[1])
    const fraction = Number((match[2] ?? "").padEnd(2, "0"))
    return rupees * 100 + fraction
}