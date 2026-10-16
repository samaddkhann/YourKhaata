import mongoose from "mongoose"
import Business from "../models/business.model.js"
import Customer from "../models/customer.model.js"
import Invoice from "../models/invoice.model.js"
import Transaction from "../models/transaction.model.js"
import * as invoiceService from "../services/invoice.service.js"
import { invoiceStatusLabel } from "../services/invoiceMath.js"
import { AppError, sendError } from "../utils/appError.js"
import { parseIstDate } from "../utils/dates.js"
import { escapeRegex } from "../utils/regex.js"

const DAY = 24 * 60 * 60 * 1000

const withLabel = (invoice) => ({ ...invoice, statusLabel: invoiceStatusLabel(invoice) })

const findOwnedInvoice = async (invoiceId, userId) => {
    if (!mongoose.isValidObjectId(invoiceId)) return null
    return Invoice.findOne({ _id: invoiceId, ownerId: userId })
}

export const listInvoices = async (req, res) => {
    try {
        const exportMode = req.query.export === "1"
        const page = Math.max(parseInt(req.query.page) || 1, 1)
        const limit = exportMode ? 5000 : Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)

        const filter = { businessId: req.business._id, ownerId: req.userId }

        switch (req.query.status) {
            case "draft":
                filter.status = "draft"
                break
            case "cancelled":
                filter.status = "cancelled"
                break
            case "paid":
                filter.status = "issued"
                filter.$expr = { $gte: ["$paidPaise", "$totalPaise"] }
                break
            case "partial":
                filter.status = "issued"
                filter.paidPaise = { $gt: 0 }
                filter.$expr = { $lt: ["$paidPaise", "$totalPaise"] }
                break
            case "unpaid":
                filter.status = "issued"
                filter.paidPaise = 0
                break
            case "overdue":
                filter.status = "issued"
                filter.dueDate = { $lt: new Date(Date.now() - DAY) }
                filter.$expr = { $lt: ["$paidPaise", "$totalPaise"] }
                break
        }

        const from = parseIstDate(req.query.from)
        const to = parseIstDate(req.query.to, true)
        if (from || to) {
            filter.issueDate = {}
            if (from) filter.issueDate.$gte = from
            if (to) filter.issueDate.$lte = to
        }

        const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 50) : ""
        if (q) {
            const customers = await Customer.find({
                businessId: req.business._id,
                nameLower: new RegExp(escapeRegex(q.toLowerCase()))
            }).select("_id").limit(200).lean()
            filter.$or = [{ number: new RegExp(escapeRegex(q), "i") }, { customerId: { $in: customers.map((c) => c._id) } }]
        }

        const [rows, total] = await Promise.all([
            Invoice.find(filter)
                .select("-lines")
                .sort({ createdAt: -1 })
                .skip(exportMode ? 0 : (page - 1) * limit)
                .limit(limit)
                .populate("customerId", "name phone")
                .lean(),
            Invoice.countDocuments(filter)
        ])

        return res.status(200).json({
            invoices: rows.map(withLabel),
            page,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1)
        })
    } catch (error) {
        return sendError(res, error, "Could not load invoices")
    }
}

export const createInvoice = async (req, res) => {
    try {
        const body = req.body ?? {}
        const { invoice, duplicate } = await invoiceService.createInvoice({
            business: req.business,
            userId: req.userId,
            body,
            finalize: body.finalize === true
        })
        return res.status(duplicate ? 200 : 201).json(invoice)
    } catch (error) {
        return sendError(res, error, "Could not save the invoice")
    }
}

export const getInvoice = async (req, res) => {
    try {
        const invoice = await findOwnedInvoice(req.params.invoiceId, req.userId)
        if (!invoice) throw new AppError(404, "Invoice not found")

        const [customer, business, payments] = await Promise.all([
            Customer.findById(invoice.customerId).select("name phone address type").lean(),
            Business.findOne({ _id: invoice.businessId, ownerId: req.userId })
                .select("name address phone ownerName gstin upiId invoiceTerms").lean(),
            Transaction.find({ invoiceId: invoice._id, ownerId: req.userId, kind: "PAYMENT_RECEIVED" })
                .sort({ occurredAt: 1, seq: 1 }).lean()
        ])

        return res.status(200).json({ invoice: withLabel(invoice.toObject()), customer, business, payments })
    } catch (error) {
        return sendError(res, error, "Could not load the invoice")
    }
}

export const updateInvoice = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.invoiceId)) throw new AppError(404, "Invoice not found")
        const invoice = await invoiceService.updateDraft({
            invoiceId: req.params.invoiceId,
            userId: req.userId,
            body: req.body ?? {}
        })
        return res.status(200).json(invoice)
    } catch (error) {
        return sendError(res, error, "Could not update the invoice")
    }
}

export const finalizeInvoice = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.invoiceId)) throw new AppError(404, "Invoice not found")
        const invoice = await invoiceService.finalizeInvoice({ invoiceId: req.params.invoiceId, userId: req.userId })
        return res.status(200).json(invoice)
    } catch (error) {
        return sendError(res, error, "Could not issue the invoice")
    }
}

export const payInvoice = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.invoiceId)) throw new AppError(404, "Invoice not found")
        const { entry, duplicate } = await invoiceService.payInvoice({
            invoiceId: req.params.invoiceId,
            userId: req.userId,
            body: req.body ?? {}
        })
        return res.status(duplicate ? 200 : 201).json(entry)
    } catch (error) {
        return sendError(res, error, "Could not record the payment")
    }
}

export const cancelInvoice = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.invoiceId)) throw new AppError(404, "Invoice not found")
        const invoice = await invoiceService.cancelInvoice({
            invoiceId: req.params.invoiceId,
            userId: req.userId,
            reason: req.body?.reason
        })
        return res.status(200).json(invoice)
    } catch (error) {
        return sendError(res, error, "Could not cancel the invoice")
    }
}