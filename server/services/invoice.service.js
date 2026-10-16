import mongoose from "mongoose"
import Business from "../models/business.model.js"
import Customer from "../models/customer.model.js"
import Invoice from "../models/invoice.model.js"
import Product from "../models/product.model.js"
import StockMovement from "../models/stockMovement.model.js"
import { nextNumber } from "../models/counter.model.js"
import { AppError } from "../utils/appError.js"
import { istDateString, parseIstDate } from "../utils/dates.js"
import { rupeesToPaise } from "../utils/money.js"
import { cleanText } from "../utils/validate.js"
import { addEntry, reverseEntry } from "./ledger.service.js"
import { GST_RATES, calcLine, formatMilli, parseQtyMilli, sumTotals } from "./invoiceMath.js"

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const MAX_PAISE = 1_000_000_000_000

const findCustomer = async (business, userId, customerId) => {
    if (!mongoose.isValidObjectId(customerId)) throw new AppError(400, "Choose a customer")
    const customer = await Customer.findOne({ _id: customerId, businessId: business._id, ownerId: userId, archivedAt: null })
    if (!customer) throw new AppError(404, "Customer not found")
    if (customer.type === "supplier") throw new AppError(400, "Invoices can only be made for customers")
    return customer
}

// Checks the form and calculates every amount on the server. Never trusts amounts sent by the browser.
const buildInvoiceData = (body, business) => {
    const type = body.type === "gst" ? "gst" : "non_gst"
    const gst = type === "gst"

    const today = istDateString()
    const issueText = body.issueDate ? String(body.issueDate) : today
    const issueDate = parseIstDate(issueText)
    if (!issueDate) throw new AppError(400, "Enter a valid invoice date")
    if (issueText > today) throw new AppError(400, "Invoice date cannot be in the future")

    let dueDate = null
    if (body.dueDate) {
        dueDate = parseIstDate(String(body.dueDate))
        if (!dueDate) throw new AppError(400, "Enter a valid due date")
        if (String(body.dueDate) < issueText) throw new AppError(400, "Due date cannot be before the invoice date")
    }

    const interstate = gst && body.interstate === true
    const sellerGstin = business.gstin || ""
    const buyerGstin = cleanText(body.buyerGstin).toUpperCase()
    if (gst) {
        if (!GSTIN_REGEX.test(sellerGstin)) throw new AppError(400, "Add your valid GSTIN in Settings before making a GST invoice")
        if (buyerGstin && !GSTIN_REGEX.test(buyerGstin)) throw new AppError(400, "The buyer's GSTIN is not valid")
    }

    const placeOfSupply = cleanText(body.placeOfSupply).slice(0, 60)
    const notes = cleanText(body.notes)
    if (notes.length > 500) throw new AppError(400, "Notes are too long")

    if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 50) {
        throw new AppError(400, "Add between 1 and 50 items")
    }

    const lines = body.lines.map((raw, index) => {
        const n = index + 1
        const name = cleanText(raw?.name)
        if (!name || name.length > 120) throw new AppError(400, `Item ${n}: enter the item name`)

        const qtyMilli = parseQtyMilli(raw?.qty)
        if (!qtyMilli) throw new AppError(400, `Item ${n}: enter a quantity above zero (up to 3 decimals)`)

        const ratePaise = rupeesToPaise(raw?.rate)
        if (ratePaise === null) throw new AppError(400, `Item ${n}: enter a valid rate`)

        const discountText = String(raw?.discount ?? "").trim()
        const discountPaise = discountText === "" ? 0 : rupeesToPaise(discountText)
        if (discountPaise === null) throw new AppError(400, `Item ${n}: enter a valid discount`)

        const taxRatePercent = gst ? Number(raw?.taxRate ?? 0) : 0
        if (!GST_RATES.includes(taxRatePercent)) throw new AppError(400, `Item ${n}: choose a valid GST rate`)

        if (!Number.isSafeInteger(qtyMilli * ratePaise)) throw new AppError(400, `Item ${n}: the amount is too large`)

        const hsn = cleanText(raw?.hsn)
        if (!/^\d{0,8}$/.test(hsn)) throw new AppError(400, `Item ${n}: HSN/SAC must be up to 8 digits`)

        let productId = null
        if (raw?.productId) {
            if (!mongoose.isValidObjectId(raw.productId)) throw new AppError(400, `Item ${n}: invalid product`)
            productId = raw.productId
        }

        const calc = calcLine({ qtyMilli, ratePaise, discountPaise, taxRatePercent }, { gst, interstate })
        if (discountPaise > calc.grossPaise) throw new AppError(400, `Item ${n}: the discount is more than the amount`)

        return {
            productId, name, hsn,
            unit: cleanText(raw?.unit).slice(0, 20) || "pcs",
            qtyMilli, ratePaise, discountPaise, taxRatePercent, ...calc
        }
    })

    const totals = sumTotals(lines)
    if (totals.totalPaise < 1) throw new AppError(400, "The invoice total must be above zero")
    if (totals.totalPaise > MAX_PAISE) throw new AppError(400, "The invoice total is too large")

    return { type, issueDate, dueDate, interstate, placeOfSupply, sellerGstin, buyerGstin, notes, lines, ...totals }
}

// Turns a draft into a real invoice. Everything below happens together or not at all:
// stock goes down, the customer's ledger gets a credit entry, and the invoice gets its number.
const issueInvoice = async ({ invoice, business, userId, session }) => {
    const need = new Map()
    for (const line of invoice.lines) {
        if (line.productId) need.set(String(line.productId), (need.get(String(line.productId)) || 0) + line.qtyMilli)
    }

    const moves = []
    for (const [productId, qty] of need) {
        const product = await Product.findOne({ _id: productId, businessId: business._id, ownerId: userId }).session(session)
        if (!product) throw new AppError(400, "One of the products no longer exists")
        if (!product.trackStock) continue

        const updated = await Product.findOneAndUpdate(
            { _id: productId, stockMilli: { $gte: qty } },
            { $inc: { stockMilli: -qty } },
            { new: true, session }
        )
        if (!updated) {
            throw new AppError(409, `Not enough stock for ${product.name}. Available: ${formatMilli(product.stockMilli)} ${product.unit}`)
        }
        moves.push({ productId, qty, after: updated.stockMilli })
    }

    const n = await nextNumber(business._id, "invoice", session)
    const number = `${business.invoicePrefix || "INV"}-${String(n).padStart(4, "0")}`

    const { entry } = await addEntry({
        business,
        userId,
        session,
        invoiceId: invoice._id,
        body: {
            customerId: invoice.customerId,
            kind: "CREDIT_GIVEN",
            amount: (invoice.totalPaise / 100).toFixed(2),
            date: istDateString(invoice.issueDate),
            dueDate: invoice.dueDate ? istDateString(invoice.dueDate) : "",
            description: `Invoice ${number}`,
            idempotencyKey: `inv-${invoice._id}`
        }
    })

    for (const m of moves) {
        await StockMovement.create([{
            businessId: business._id,
            ownerId: userId,
            productId: m.productId,
            type: "sale",
            quantityMilli: -m.qty,
            balanceAfterMilli: m.after,
            reason: `Invoice ${number}`,
            invoiceId: invoice._id,
            createdBy: userId
        }], { session })
    }

    invoice.number = number
    invoice.status = "issued"
    invoice.ledgerTransactionId = entry._id
    await invoice.save({ session })
    return invoice
}

export const createInvoice = async ({ business, userId, body, finalize }) => {
    if (business.archivedAt) throw new AppError(400, "Restore this khaata book first")

    const key = typeof body.idempotencyKey === "string" && body.idempotencyKey.length >= 8 ? body.idempotencyKey.slice(0, 100) : undefined
    if (key) {
        const existing = await Invoice.findOne({ businessId: business._id, idempotencyKey: key })
        if (existing) return { invoice: existing, duplicate: true }
    }

    const customer = await findCustomer(business, userId, body.customerId)
    const data = buildInvoiceData(body, business)
    const base = {
        businessId: business._id, ownerId: userId, customerId: customer._id,
        createdBy: userId, idempotencyKey: key, status: "draft", ...data
    }

    if (!finalize) {
        return { invoice: await Invoice.create(base), duplicate: false }
    }

    const invoice = await mongoose.connection.transaction(async (session) => {
        const [draft] = await Invoice.create([base], { session })
        return issueInvoice({ invoice: draft, business, userId, session })
    })
    return { invoice, duplicate: false }
}

export const updateDraft = async ({ invoiceId, userId, body }) => {
    const invoice = await Invoice.findOne({ _id: invoiceId, ownerId: userId })
    if (!invoice) throw new AppError(404, "Invoice not found")
    if (invoice.status !== "draft") throw new AppError(409, "Only drafts can be edited")

    const business = await Business.findOne({ _id: invoice.businessId, ownerId: userId })
    if (!business || business.archivedAt) throw new AppError(400, "Restore this khaata book first")

    const customer = await findCustomer(business, userId, body.customerId || invoice.customerId)
    const data = buildInvoiceData(body, business)

    Object.assign(invoice, { customerId: customer._id, ...data })
    await invoice.save()
    return invoice
}

export const finalizeInvoice = async ({ invoiceId, userId }) => {
    const found = await Invoice.findOne({ _id: invoiceId, ownerId: userId })
    if (!found) throw new AppError(404, "Invoice not found")

    const business = await Business.findOne({ _id: found.businessId, ownerId: userId })
    if (!business || business.archivedAt) throw new AppError(400, "Restore this khaata book first")

    return mongoose.connection.transaction(async (session) => {
        const invoice = await Invoice.findOne({ _id: invoiceId, ownerId: userId }).session(session)
        if (!invoice || invoice.status !== "draft") throw new AppError(409, "This invoice is already issued")
        return issueInvoice({ invoice, business, userId, session })
    })
}

// Records a payment against ONE invoice. It is also a normal ledger entry, so nothing is counted twice.
export const payInvoice = async ({ invoiceId, userId, body }) => {
    const invoice = await Invoice.findOne({ _id: invoiceId, ownerId: userId })
    if (!invoice) throw new AppError(404, "Invoice not found")
    if (invoice.status !== "issued") throw new AppError(409, "This invoice cannot take payments")

    const business = await Business.findOne({ _id: invoice.businessId, ownerId: userId })
    if (!business) throw new AppError(404, "Invoice not found")

    return addEntry({
        business,
        userId,
        invoiceId: invoice._id,
        body: {
            customerId: invoice.customerId,
            kind: "PAYMENT_RECEIVED",
            amount: body.amount,
            date: body.date,
            paymentMethod: body.paymentMethod,
            referenceNo: body.referenceNo,
            description: `Payment for invoice ${invoice.number}`,
            idempotencyKey: body.idempotencyKey,
            confirmAdvance: true // the amount is already limited to what is left on the invoice
        }
    })
}

export const cancelInvoice = async ({ invoiceId, userId, reason }) => {
    const cleanReason = cleanText(reason)
    if (cleanReason.length < 3 || cleanReason.length > 150) throw new AppError(400, "Please give a reason (3 to 150 characters)")

    const found = await Invoice.findOne({ _id: invoiceId, ownerId: userId })
    if (!found) throw new AppError(404, "Invoice not found")

    return mongoose.connection.transaction(async (session) => {
        const patch = { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: cleanReason } }

        if (found.status === "draft") {
            const cancelledDraft = await Invoice.findOneAndUpdate({ _id: found._id, ownerId: userId, status: "draft" }, patch, { new: true, session })
            if (!cancelledDraft) throw new AppError(409, "This invoice has already changed. Refresh and try again.")
            return cancelledDraft
        }

        // Only an issued invoice with NO payments can be cancelled
        const invoice = await Invoice.findOneAndUpdate({ _id: found._id, ownerId: userId, status: "issued", paidPaise: 0 }, patch, { new: true, session })
        if (!invoice) {
            throw new AppError(409, "This invoice has payments or is already cancelled. Reverse its payments in the customer's ledger first.")
        }

        await reverseEntry({
            transactionId: invoice.ledgerTransactionId,
            userId,
            reason: `Invoice ${invoice.number} cancelled: ${cleanReason}`,
            session,
            allowInvoiceCredit: true
        })

        // Put the stock back
        const back = new Map()
        for (const line of invoice.lines) {
            if (line.productId) back.set(String(line.productId), (back.get(String(line.productId)) || 0) + line.qtyMilli)
        }
        for (const [productId, qty] of back) {
            const product = await Product.findOne({ _id: productId, ownerId: userId }).session(session)
            if (!product || !product.trackStock) continue
            const updated = await Product.findOneAndUpdate({ _id: productId }, { $inc: { stockMilli: qty } }, { new: true, session })
            await StockMovement.create([{
                businessId: invoice.businessId,
                ownerId: userId,
                productId,
                type: "cancel_restore",
                quantityMilli: qty,
                balanceAfterMilli: updated.stockMilli,
                reason: `Invoice ${invoice.number} cancelled`,
                invoiceId: invoice._id,
                createdBy: userId
            }], { session })
        }

        return invoice
    })
}