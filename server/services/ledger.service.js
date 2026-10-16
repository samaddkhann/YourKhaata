import mongoose from "mongoose"
import Customer from "../models/customer.model.js"
import Invoice from "../models/invoice.model.js"
import Transaction, { PAYMENT_METHODS } from "../models/transaction.model.js"
import { nextNumber } from "../models/counter.model.js"
import { AppError } from "../utils/appError.js"
import { istDateString, parseIstDate } from "../utils/dates.js"
import { rupeesToPaise } from "../utils/money.js"
import { cleanText } from "../utils/validate.js"
import { KIND_EFFECT, PAYMENT_KINDS, allowedKinds, createsAdvance } from "./ledgerMath.js"

const MAX_PAISE = 1_000_000_000_000 // 1,000 crore rupees
const HOUR = 60 * 60 * 1000

const rupees = (paise) => (Math.abs(paise) / 100).toFixed(2)

// Checks the request and returns clean values. Throws a 400 if something is wrong.
const readEntryInput = (body) => {
    const kind = body.kind
    if (typeof kind !== "string" || !Object.hasOwn(KIND_EFFECT, kind)) {
        throw new AppError(400, "Choose a valid entry type")
    }
    if (!mongoose.isValidObjectId(body.customerId)) {
        throw new AppError(400, "Choose a customer")
    }

    const amountPaise = rupeesToPaise(body.amount)
    if (!amountPaise) throw new AppError(400, "Enter an amount greater than zero, like 500 or 500.50")
    if (amountPaise > MAX_PAISE) throw new AppError(400, "This amount is too large")

    const key = body.idempotencyKey
    if (typeof key !== "string" || key.length < 8 || key.length > 100) {
        throw new AppError(400, "Missing request id. Please refresh the page and try again")
    }

    const today = istDateString()
    const date = body.date ? String(body.date) : today
    const parsed = parseIstDate(date)
    if (!parsed) throw new AppError(400, "Enter a valid date")
    if (date > today) throw new AppError(400, "Date cannot be in the future")
    // Today = the exact time now. Older days = noon, so the order inside a day is decided by seq.
    const occurredAt = date === today ? new Date() : new Date(parsed.getTime() + 12 * HOUR)

    let paymentMethod = body.paymentMethod ? String(body.paymentMethod) : ""
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
        throw new AppError(400, "Invalid payment method")
    }
    if (!paymentMethod && PAYMENT_KINDS.includes(kind)) paymentMethod = "cash"

    let dueDate = null
    if (kind === "CREDIT_GIVEN" && body.dueDate) {
        dueDate = parseIstDate(String(body.dueDate))
        if (!dueDate) throw new AppError(400, "Enter a valid due date")
    }

    const referenceNo = cleanText(body.referenceNo)
    if (referenceNo.length > 50) throw new AppError(400, "Reference number is too long")
    const description = cleanText(body.description)
    if (description.length > 500) throw new AppError(400, "Description is too long")

    return {
        kind, amountPaise, occurredAt, paymentMethod, dueDate, referenceNo, description,
        customerId: body.customerId, idempotencyKey: key, confirmAdvance: body.confirmAdvance === true
    }
}

const advanceMessage = (kind, balance, amountPaise) => {
    const extra = rupees(balance + KIND_EFFECT[kind] * amountPaise)
    if (kind === "PAYMENT_RECEIVED") {
        return `This payment is more than the amount owed. Rs ${extra} will be recorded as an advance (you will owe this customer). Save anyway?`
    }
    return `This payment is more than the amount you owe. Rs ${extra} will be recorded as an advance (this supplier will owe you). Save anyway?`
}

// Adds one credit/payment entry and updates the customer's balance. All or nothing.
// invoiceId: set when the entry belongs to an invoice. session: pass one to join a bigger operation.
export const addEntry = async ({ business, userId, body, invoiceId = null, session = null }) => {
    if (business.archivedAt) throw new AppError(400, "Restore this khaata book before adding entries")

    const input = readEntryInput(body)

    // Same request id again? Return the first result instead of saving twice.
    const existing = await Transaction.findOne({ businessId: business._id, idempotencyKey: input.idempotencyKey })
    if (existing) return { entry: existing, duplicate: true }

    const run = async (s) => {
        const customer = await Customer.findOne({
            _id: input.customerId,
            businessId: business._id,
            ownerId: userId
        }).session(s)

        if (!customer) throw new AppError(404, "Customer not found")
        if (customer.archivedAt) throw new AppError(400, "Restore this customer before adding entries")
        if (!allowedKinds(customer.type).includes(input.kind)) {
            throw new AppError(400, "This entry type is not allowed for this customer type")
        }

        if (createsAdvance(input.kind, customer.balancePaise, input.amountPaise) && !input.confirmAdvance) {
            throw new AppError(409, advanceMessage(input.kind, customer.balancePaise, input.amountPaise), "ADVANCE_CONFIRM_NEEDED")
        }

        const isInvoicePayment = !!invoiceId && input.kind === "PAYMENT_RECEIVED"
        if (isInvoicePayment) {
            const invoice = await Invoice.findOne({ _id: invoiceId, ownerId: userId, businessId: business._id }).session(s)
            if (!invoice || invoice.status !== "issued") throw new AppError(409, "This invoice cannot take payments")
            if (String(invoice.customerId) !== String(customer._id)) throw new AppError(400, "This invoice belongs to another customer")
            if (invoice.paidPaise + input.amountPaise > invoice.totalPaise) {
                throw new AppError(409, `Only Rs ${rupees(invoice.totalPaise - invoice.paidPaise)} is left to pay on this invoice`)
            }
        }

        const seq = await nextNumber(business._id, "txn", s)
        let receiptNo = ""
        if (PAYMENT_KINDS.includes(input.kind)) {
            const number = await nextNumber(business._id, "receipt", s)
            receiptNo = "RCPT-" + String(number).padStart(6, "0")
        }

        const effect = KIND_EFFECT[input.kind]
        const [created] = await Transaction.create([{
            businessId: business._id,
            ownerId: userId,
            customerId: customer._id,
            seq,
            kind: input.kind,
            effect,
            amountPaise: input.amountPaise,
            occurredAt: input.occurredAt,
            dueDate: input.dueDate,
            description: input.description,
            paymentMethod: input.paymentMethod,
            referenceNo: input.referenceNo,
            receiptNo,
            invoiceId,
            idempotencyKey: input.idempotencyKey,
            createdBy: userId
        }], { session: s })

        await Customer.updateOne(
            { _id: customer._id },
            { $inc: { balancePaise: effect * input.amountPaise }, $max: { lastTransactionAt: input.occurredAt } },
            { session: s }
        )

        if (isInvoicePayment) {
            await Invoice.updateOne({ _id: invoiceId }, { $inc: { paidPaise: input.amountPaise } }, { session: s })
        }

        return created
    }

    try {
        const entry = session ? await run(session) : await mongoose.connection.transaction(run)
        return { entry, duplicate: false }
    } catch (error) {
        // Two identical requests at the same moment: the second one lands here
        if (!session && error?.code === 11000) {
            const saved = await Transaction.findOne({ businessId: business._id, idempotencyKey: input.idempotencyKey })
            if (saved) return { entry: saved, duplicate: true }
        }
        throw error
    }
}

// Corrects a mistake WITHOUT erasing history: adds an opposite entry and marks the old one "reversed".
export const reverseEntry = async ({ transactionId, userId, reason, session = null, allowInvoiceCredit = false }) => {
    if (!mongoose.isValidObjectId(transactionId)) throw new AppError(404, "Entry not found")

    const cleanReason = cleanText(reason)
    if (cleanReason.length < 3 || cleanReason.length > 200) {
        throw new AppError(400, "Please give a reason (3 to 200 characters)")
    }

    const found = await Transaction.findOne({ _id: transactionId, ownerId: userId })
    if (!found) throw new AppError(404, "Entry not found")
    if (found.kind === "REVERSAL" || found.status === "reversed") {
        throw new AppError(409, "This entry is already reversed")
    }
    if (found.invoiceId && found.kind === "CREDIT_GIVEN" && !allowInvoiceCredit) {
        throw new AppError(409, "This entry belongs to an invoice. Cancel the invoice instead.")
    }

    const run = async (s) => {
        // Only one request can flip "active" to "reversed"
        const original = await Transaction.findOneAndUpdate(
            { _id: found._id, ownerId: userId, status: "active", kind: { $ne: "REVERSAL" } },
            { $set: { status: "reversed" } },
            { session: s, new: true }
        )
        if (!original) throw new AppError(409, "This entry is already reversed")

        const seq = await nextNumber(original.businessId, "txn", s)
        const [reversal] = await Transaction.create([{
            businessId: original.businessId,
            ownerId: userId,
            customerId: original.customerId,
            seq,
            kind: "REVERSAL",
            effect: -original.effect,
            amountPaise: original.amountPaise,
            occurredAt: new Date(),
            description: `Reversal: ${cleanReason}`,
            reason: cleanReason,
            reversesTransactionId: original._id,
            invoiceId: original.invoiceId,
            createdBy: userId
        }], { session: s })

        await Transaction.updateOne({ _id: original._id }, { $set: { reversedByTransactionId: reversal._id } }, { session: s })
        await Customer.updateOne(
            { _id: original.customerId },
            { $inc: { balancePaise: reversal.effect * reversal.amountPaise }, $max: { lastTransactionAt: reversal.occurredAt } },
            { session: s }
        )

        // A reversed invoice payment means the invoice has that much unpaid again
        if (original.invoiceId && original.kind === "PAYMENT_RECEIVED") {
            await Invoice.updateOne({ _id: original.invoiceId }, { $inc: { paidPaise: -original.amountPaise } }, { session: s })
        }

        return reversal
    }

    return session ? run(session) : mongoose.connection.transaction(run)
}

// Totals for a date range. The dashboard AND the reports both use this, so they always match.
// Counts only active entries and never counts reversal entries.
export const getPeriodTotals = async (businessId, from, to, extraMatch = {}) => {
    const rows = await Transaction.aggregate([
        {
            $match: {
                businessId,
                status: "active",
                kind: { $ne: "REVERSAL" },
                occurredAt: { $gte: from, $lte: to },
                ...extraMatch
            }
        },
        { $group: { _id: "$kind", total: { $sum: "$amountPaise" } } }
    ])

    const t = { CREDIT_GIVEN: 0, PAYMENT_RECEIVED: 0, PURCHASE_ON_CREDIT: 0, PAYMENT_MADE: 0 }
    rows.forEach((row) => {
        if (Object.hasOwn(t, row._id)) t[row._id] = row.total
    })

    return {
        creditGiven: t.CREDIT_GIVEN,
        paymentsReceived: t.PAYMENT_RECEIVED,
        purchases: t.PURCHASE_ON_CREDIT,
        paymentsMade: t.PAYMENT_MADE,
        youGave: t.CREDIT_GIVEN + t.PAYMENT_MADE,
        youGot: t.PAYMENT_RECEIVED + t.PURCHASE_ON_CREDIT,
        netCashFlow: t.PAYMENT_RECEIVED - t.PAYMENT_MADE // credit is NOT cash, so it is not counted
    }
}