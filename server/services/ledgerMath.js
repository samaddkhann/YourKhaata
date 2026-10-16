// +1 means "I gave" (the other person owes me more). -1 means "I got" (they owe me less).
export const KIND_EFFECT = {
    CREDIT_GIVEN: 1,        // goods or money given on udhaar
    PAYMENT_MADE: 1,        // I paid a supplier
    PAYMENT_RECEIVED: -1,   // customer paid me
    PURCHASE_ON_CREDIT: -1, // I bought from a supplier on credit
}

export const CUSTOMER_KINDS = ["CREDIT_GIVEN", "PAYMENT_RECEIVED"]
export const SUPPLIER_KINDS = ["PURCHASE_ON_CREDIT", "PAYMENT_MADE"]
export const PAYMENT_KINDS = ["PAYMENT_RECEIVED", "PAYMENT_MADE"]

export const allowedKinds = (customerType) => {
    if (customerType === "customer") return CUSTOMER_KINDS
    if (customerType === "supplier") return SUPPLIER_KINDS
    return [...CUSTOMER_KINDS, ...SUPPLIER_KINDS]
}

// Would this payment flip the balance to the other side (an advance / overpayment)?
export const createsAdvance = (kind, balanceBeforePaise, amountPaise) => {
    const after = balanceBeforePaise + (KIND_EFFECT[kind] || 0) * amountPaise
    if (kind === "PAYMENT_RECEIVED") return after < 0
    if (kind === "PAYMENT_MADE") return after > 0
    return false
}

// Oldest first. Same time: lower seq first. This makes backdated entries safe.
export const sortEntries = (entries) =>
    [...entries].sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt) || a.seq - b.seq)

// Adds runningBalancePaise to each entry.
// balance = opening balance + the sum of (effect x amount) of ALL entries, reversals included.
export const addRunningBalance = (openingPaise, entries) => {
    let balance = openingPaise
    return sortEntries(entries).map((entry) => {
        balance += entry.effect * entry.amountPaise
        return { ...entry, runningBalancePaise: balance }
    })
}