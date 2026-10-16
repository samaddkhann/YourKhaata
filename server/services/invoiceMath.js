export const GST_RATES = [0, 5, 12, 18, 28]

// "2.5" -> 2500 (thousandths). Up to 5 digits and 3 decimals. Returns null if invalid or zero.
export const parseQtyMilli = (input) => {
    const match = /^(\d{1,5})(?:\.(\d{1,3}))?$/.exec(String(input ?? "").replace(/,/g, "").trim())
    if (!match) return null
    const milli = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"))
    return milli > 0 ? milli : null
}

export const formatMilli = (milli) => {
    const n = (milli || 0) / 1000
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "")
}

// One invoice line. All money is in paise.
export const calcLine = ({ qtyMilli, ratePaise, discountPaise, taxRatePercent }, { gst, interstate }) => {
    const grossPaise = Math.round((qtyMilli * ratePaise) / 1000)
    const taxablePaise = grossPaise - discountPaise
    const taxPaise = gst ? Math.round((taxablePaise * taxRatePercent) / 100) : 0

    let cgstPaise = 0
    let sgstPaise = 0
    let igstPaise = 0
    if (gst) {
        if (interstate) {
            igstPaise = taxPaise
        } else {
            cgstPaise = Math.floor(taxPaise / 2)
            sgstPaise = taxPaise - cgstPaise
        }
    }

    return { grossPaise, taxablePaise, cgstPaise, sgstPaise, igstPaise, totalPaise: taxablePaise + taxPaise }
}

export const sumTotals = (lines) => {
    const t = { subtotalPaise: 0, discountPaise: 0, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 }
    for (const line of lines) {
        t.subtotalPaise += line.grossPaise
        t.discountPaise += line.discountPaise
        t.taxablePaise += line.taxablePaise
        t.cgstPaise += line.cgstPaise
        t.sgstPaise += line.sgstPaise
        t.igstPaise += line.igstPaise
        t.totalPaise += line.totalPaise
    }
    t.taxPaise = t.cgstPaise + t.sgstPaise + t.igstPaise
    return t
}

const DAY = 24 * 60 * 60 * 1000

// The label shown to the user. Overdue starts after the due date has fully passed.
export const invoiceStatusLabel = (invoice, now = new Date()) => {
    if (invoice.status === "draft") return "draft"
    if (invoice.status === "cancelled") return "cancelled"
    if (invoice.paidPaise >= invoice.totalPaise) return "paid"
    if (invoice.dueDate && now.getTime() > new Date(invoice.dueDate).getTime() + DAY) return "overdue"
    return invoice.paidPaise > 0 ? "partially_paid" : "unpaid"
}