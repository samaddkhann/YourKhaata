import test from "node:test"
import assert from "node:assert/strict"
import { addRunningBalance, createsAdvance } from "../services/ledgerMath.js"
import { rupeesToPaise } from "../utils/money.js"

const entry = (seq, day, kind, effect, amountPaise) => ({
    seq, kind, effect, amountPaise,
    occurredAt: new Date(`2026-10-${day}T10:00:00Z`),
})

test("worked example: opening 1000, credit 500, payment 700 gives 800", () => {
    const rows = addRunningBalance(100000, [
        entry(1, 10, "CREDIT_GIVEN", 1, 50000),
        entry(2, 11, "PAYMENT_RECEIVED", -1, 70000),
    ])
    assert.deepEqual(rows.map((r) => r.runningBalancePaise), [150000, 80000])
})

test("partial payments reduce the balance step by step", () => {
    const rows = addRunningBalance(100000, [
        entry(1, 10, "CREDIT_GIVEN", 1, 50000),
        entry(2, 11, "PAYMENT_RECEIVED", -1, 20000),
        entry(3, 12, "PAYMENT_RECEIVED", -1, 30000),
    ])
    assert.deepEqual(rows.map((r) => r.runningBalancePaise), [150000, 130000, 100000])
})

test("a backdated entry keeps every running balance correct", () => {
    const rows = addRunningBalance(0, [
        entry(1, 10, "CREDIT_GIVEN", 1, 1000),
        entry(2, 12, "PAYMENT_RECEIVED", -1, 400),
        entry(3, 11, "CREDIT_GIVEN", 1, 200), // added last, but dated in between
    ])
    assert.deepEqual(rows.map((r) => r.seq), [1, 3, 2])
    assert.deepEqual(rows.map((r) => r.runningBalancePaise), [1000, 1200, 800])
})

test("a reversal cancels the original entry exactly", () => {
    const rows = addRunningBalance(0, [
        entry(1, 10, "CREDIT_GIVEN", 1, 50000),
        entry(2, 11, "REVERSAL", -1, 50000),
    ])
    assert.equal(rows.at(-1).runningBalancePaise, 0)
})

test("supplier: purchase on credit makes the balance negative, payment brings it back", () => {
    const rows = addRunningBalance(0, [
        entry(1, 10, "PURCHASE_ON_CREDIT", -1, 80000),
        entry(2, 11, "PAYMENT_MADE", 1, 30000),
    ])
    assert.deepEqual(rows.map((r) => r.runningBalancePaise), [-80000, -50000])
})

test("overpayment is detected, exact payment is not", () => {
    assert.equal(createsAdvance("PAYMENT_RECEIVED", 80000, 80000), false)
    assert.equal(createsAdvance("PAYMENT_RECEIVED", 80000, 80001), true)
    assert.equal(createsAdvance("PAYMENT_RECEIVED", 0, 100), true)
    assert.equal(createsAdvance("PAYMENT_MADE", -50000, 50000), false)
    assert.equal(createsAdvance("PAYMENT_MADE", -50000, 50001), true)
    assert.equal(createsAdvance("CREDIT_GIVEN", 0, 999), false)
})

test("rupeesToPaise accepts good amounts and rejects bad ones", () => {
    assert.equal(rupeesToPaise("1,250.5"), 125050)
    assert.equal(rupeesToPaise("500"), 50000)
    assert.equal(rupeesToPaise("0.05"), 5)
    assert.equal(rupeesToPaise("abc"), null)
    assert.equal(rupeesToPaise("-5"), null)
    assert.equal(rupeesToPaise("10.999"), null)
    assert.equal(rupeesToPaise(""), null)
})