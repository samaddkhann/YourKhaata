export const GST_RATES = [0, 5, 12, 18, 28]

export const parseQtyMilli = (input) => {
    const match = /^(\d{1,5})(?:\.(\d{1,3}))?$/.exec(String(input ?? "").replace(/,/g, "").trim())
    if (!match) return null
    const milli = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"))
    return milli > 0 ? milli : null
}

export const formatQty = (milli) => {
    const n = (milli || 0) / 1000
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "")
}

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
    return { grossPaise, taxablePaise, cgstPaise, sgstPaise, igstPaise, totalPaise: taxablePaise + taxPaise, discountPaise }
}

export const sumTotals = (lines) => {
    const t = { subtotalPaise: 0, discountPaise: 0, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 }
    for (const l of lines) {
        t.subtotalPaise += l.grossPaise
        t.discountPaise += l.discountPaise
        t.taxablePaise += l.taxablePaise
        t.cgstPaise += l.cgstPaise
        t.sgstPaise += l.sgstPaise
        t.igstPaise += l.igstPaise
        t.totalPaise += l.totalPaise
    }
    t.taxPaise = t.cgstPaise + t.sgstPaise + t.igstPaise
    return t
}