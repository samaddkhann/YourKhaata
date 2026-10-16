export const KIND_LABELS = {
    CREDIT_GIVEN: "Credit given (udhaar)",
    PAYMENT_RECEIVED: "Payment received",
    PURCHASE_ON_CREDIT: "Purchase on credit",
    PAYMENT_MADE: "Payment made",
    REVERSAL: "Reversal",
}

export const METHOD_LABELS = {
    cash: "Cash",
    upi: "UPI",
    bank_transfer: "Bank transfer",
    cheque: "Cheque",
    other: "Other",
}

export const PAYMENT_KINDS = ["PAYMENT_RECEIVED", "PAYMENT_MADE"]

// Which entry types a customer can have (same rule as the server)
export const kindsForType = (type) => {
    if (type === "customer") return ["CREDIT_GIVEN", "PAYMENT_RECEIVED"]
    if (type === "supplier") return ["PURCHASE_ON_CREDIT", "PAYMENT_MADE"]
    return ["CREDIT_GIVEN", "PAYMENT_RECEIVED", "PURCHASE_ON_CREDIT", "PAYMENT_MADE"]
}