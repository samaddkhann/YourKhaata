import mongoose from "mongoose"
import Customer from "../models/customer.model.js"
import Reminder from "../models/reminder.model.js"
import Transaction, { KINDS, PAYMENT_METHODS } from "../models/transaction.model.js"
import { getPeriodTotals } from "../services/ledger.service.js"
import { AppError, sendError } from "../utils/appError.js"
import { parseIstDate } from "../utils/dates.js"

const DAY = 24 * 60 * 60 * 1000

const readRange = (query) => {
    const to = parseIstDate(query.to, true) || new Date()
    const from = parseIstDate(query.from) || new Date(to.getTime() - 30 * DAY)
    if (from > to) throw new AppError(400, "The start date must be before the end date")
    if (to - from > 800 * DAY) throw new AppError(400, "Please choose a range of up to 2 years")
    return { from, to }
}

export const getDashboard = async (req, res) => {
    try {
        const { from, to } = readRange(req.query)
        const businessId = req.business._id
        const chartFormat = to - from > 92 * DAY ? "%Y-%m" : "%Y-%m-%d"

        const [stats, totals, recent, overdueIds, upcoming, chartRows] = await Promise.all([
            // Snapshot of what is owed right now (not limited to the date range)
            Customer.aggregate([
                { $match: { businessId, archivedAt: null } },
                {
                    $group: {
                        _id: null,
                        customers: { $sum: 1 },
                        toReceive: { $sum: { $cond: [{ $gt: ["$balancePaise", 0] }, "$balancePaise", 0] } },
                        toPay: { $sum: { $cond: [{ $lt: ["$balancePaise", 0] }, { $multiply: ["$balancePaise", -1] }, 0] } }
                    }
                }
            ]),
            getPeriodTotals(businessId, from, to),
            Transaction.find({ businessId, ownerId: req.userId })
                .sort({ occurredAt: -1, seq: -1 }).limit(8).populate("customerId", "name").lean(),
            Transaction.distinct("customerId", {
                businessId, status: "active", kind: "CREDIT_GIVEN", dueDate: { $lt: new Date() }
            }),
            Reminder.find({ businessId, ownerId: req.userId, status: "pending" })
                .sort({ remindAt: 1 }).limit(5).populate("customerId", "name").lean(),
            Transaction.aggregate([
                {
                    $match: {
                        businessId,
                        status: "active",
                        kind: { $in: ["CREDIT_GIVEN", "PAYMENT_RECEIVED"] },
                        occurredAt: { $gte: from, $lte: to }
                    }
                },
                {
                    $group: {
                        _id: {
                            label: { $dateToString: { format: chartFormat, date: "$occurredAt", timezone: "Asia/Kolkata" } },
                            kind: "$kind"
                        },
                        total: { $sum: "$amountPaise" }
                    }
                },
                { $sort: { "_id.label": 1 } }
            ])
        ])

        const overdue = overdueIds.length
            ? await Customer.find({ _id: { $in: overdueIds }, businessId, archivedAt: null, balancePaise: { $gt: 0 } })
                .sort({ balancePaise: -1 }).limit(5).select("name phone balancePaise").lean()
            : []

        const chartMap = {}
        chartRows.forEach((row) => {
            const label = row._id.label
            chartMap[label] = chartMap[label] || { label, creditGiven: 0, paymentsReceived: 0 }
            if (row._id.kind === "CREDIT_GIVEN") chartMap[label].creditGiven = row.total
            else chartMap[label].paymentsReceived = row.total
        })

        const s = stats[0] || { customers: 0, toReceive: 0, toPay: 0 }

        return res.status(200).json({
            snapshot: { customers: s.customers, toReceive: s.toReceive, toPay: s.toPay },
            period: totals,
            recent: recent.map((t) => ({
                _id: t._id,
                customerId: t.customerId?._id,
                customerName: t.customerId?.name || "Unknown",
                kind: t.kind,
                effect: t.effect,
                amountPaise: t.amountPaise,
                occurredAt: t.occurredAt,
                status: t.status
            })),
            overdue,
            upcoming: upcoming.map((r) => ({
                _id: r._id,
                customerName: r.customerId?.name || "Unknown",
                amountPaise: r.amountPaise,
                remindAt: r.remindAt
            })),
            chart: Object.values(chartMap)
        })
    } catch (error) {
        return sendError(res, error, "Could not load the dashboard")
    }
}

// side = receivable ("You'll get", balance above zero) or payable ("You'll give", balance below zero)
export const getOutstandingReport = async (req, res) => {
    try {
        const side = req.query.side === "payable" ? "payable" : "receivable"
        const customers = await Customer.find({
            businessId: req.business._id,
            archivedAt: null,
            balancePaise: side === "payable" ? { $lt: 0 } : { $gt: 0 }
        })
            .sort({ balancePaise: side === "payable" ? 1 : -1 })
            .limit(5000)
            .select("name phone type balancePaise")
            .lean()

        const totalPaise = customers.reduce((sum, c) => sum + Math.abs(c.balancePaise), 0)

        return res.status(200).json({ report: side, rows: customers, totalPaise })
    } catch (error) {
        return sendError(res, error, "Could not load the report")
    }
}

export const getTransactionsReport = async (req, res) => {
    try {
        const { from, to } = readRange(req.query)
        const { customerId, kind, method } = req.query

        const extra = {}
        if (mongoose.isValidObjectId(customerId)) extra.customerId = new mongoose.Types.ObjectId(customerId)
        if (typeof kind === "string" && KINDS.includes(kind)) extra.kind = kind
        if (typeof method === "string" && PAYMENT_METHODS.includes(method)) extra.paymentMethod = method

        const rows = await Transaction.find({
            businessId: req.business._id,
            occurredAt: { $gte: from, $lte: to },
            ...extra
        })
            .sort({ occurredAt: 1, seq: 1 })
            .limit(5000)
            .populate("customerId", "name phone")
            .lean()

        const totals = await getPeriodTotals(req.business._id, from, to, extra)

        return res.status(200).json({
            report: "transactions",
            from,
            to,
            totals,
            rows: rows.map((t) => ({
                _id: t._id,
                customerId: t.customerId?._id,
                customerName: t.customerId?.name || "Unknown",
                kind: t.kind,
                effect: t.effect,
                amountPaise: t.amountPaise,
                occurredAt: t.occurredAt,
                description: t.description,
                referenceNo: t.referenceNo,
                receiptNo: t.receiptNo,
                paymentMethod: t.paymentMethod,
                status: t.status
            }))
        })
    } catch (error) {
        return sendError(res, error, "Could not load the report")
    }
}