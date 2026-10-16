import test from "node:test"
import assert from "node:assert/strict"
import { calcLine, invoiceStatusLabel, parseQtyMilli, sumTotals } from "../services/invoiceMath.js"

test("quantity parsing", () => {
    assert.equal(parseQtyMilli("2.5"), 2500)
    assert.equal(parseQtyMilli("10"), 10000)
    assert.equal(parseQtyMilli("0.001"), 1)
    assert.equal(parseQtyMilli("0"), null)
    assert.equal(parseQtyMilli("1.2345"), null)
    assert.equal(parseQtyMilli("abc"), null)
})

test("non-GST invoice: no tax is added", () => {
    const a = calcLine({ qtyMilli: 2000, ratePaise: 50000, discountPaise: 10000, taxRatePercent: 18 }, { gst: false, interstate: false })
    assert.equal(a.grossPaise, 100000)
    assert.equal(a.totalPaise, 90000)
    assert.equal(a.cgstPaise + a.sgstPaise + a.igstPaise, 0)
})

test("GST within the state splits tax into CGST and SGST", () => {
    // 2 x Rs 500 = 1000, discount 100 -> taxable 900, 18% = 162, CGST 81 + SGST 81
    const a = calcLine({ qtyMilli: 2000, ratePaise: 50000, discountPaise: 10000, taxRatePercent: 18 }, { gst: true, interstate: false })
    assert.equal(a.taxablePaise, 90000)
    assert.equal(a.cgstPaise, 8100)
    assert.equal(a.sgstPaise, 8100)
    assert.equal(a.igstPaise, 0)
    assert.equal(a.totalPaise, 106200)
})

test("GST between states uses IGST", () => {
    const a = calcLine({ qtyMilli: 1000, ratePaise: 101000, discountPaise: 0, taxRatePercent: 5 }, { gst: true, interstate: true })
    assert.equal(a.igstPaise, 5050)
    assert.equal(a.cgstPaise + a.sgstPaise, 0)
    assert.equal(a.totalPaise, 106050)
})

test("an odd tax amount never loses a paisa", () => {
    // taxable Rs 10.10 at 5% = 50.5 paise -> rounds to 51, split 25 + 26
    const a = calcLine({ qtyMilli: 1000, ratePaise: 1010, discountPaise: 0, taxRatePercent: 5 }, { gst: true, interstate: false })
    assert.equal(a.cgstPaise + a.sgstPaise, 51)
    assert.equal(a.totalPaise, 1010 + 51)
})

test("totals add up line by line", () => {
    const l1 = calcLine({ qtyMilli: 1000, ratePaise: 10000, discountPaise: 0, taxRatePercent: 12 }, { gst: true, interstate: false })
    const l2 = calcLine({ qtyMilli: 3000, ratePaise: 2500, discountPaise: 500, taxRatePercent: 5 }, { gst: true, interstate: false })
    const t = sumTotals([l1, l2])
    assert.equal(t.totalPaise, l1.totalPaise + l2.totalPaise)
    assert.equal(t.taxPaise, t.cgstPaise + t.sgstPaise + t.igstPaise)
    assert.equal(t.totalPaise, t.taxablePaise + t.taxPaise)
})

test("invoice status labels", () => {
    const now = new Date("2026-10-20T10:00:00Z")
    const base = { status: "issued", totalPaise: 1000, paidPaise: 0, dueDate: null }
    assert.equal(invoiceStatusLabel({ ...base, status: "draft" }, now), "draft")
    assert.equal(invoiceStatusLabel({ ...base, status: "cancelled" }, now), "cancelled")
    assert.equal(invoiceStatusLabel(base, now), "unpaid")
    assert.equal(invoiceStatusLabel({ ...base, paidPaise: 400 }, now), "partially_paid")
    assert.equal(invoiceStatusLabel({ ...base, paidPaise: 1000 }, now), "paid")
    assert.equal(invoiceStatusLabel({ ...base, dueDate: new Date("2026-10-10T00:00:00Z") }, now), "overdue")
    assert.equal(invoiceStatusLabel({ ...base, paidPaise: 1000, dueDate: new Date("2026-10-10T00:00:00Z") }, now), "paid")
})