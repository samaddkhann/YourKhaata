import Customer from "../models/customer.model.js"
import Invoice from "../models/invoice.model.js"
import Product from "../models/product.model.js"
import Reminder from "../models/reminder.model.js"
import Transaction from "../models/transaction.model.js"
import { sendError } from "../utils/appError.js"
import { istDateString, parseIstDate } from "../utils/dates.js"

const DAY = 24 * 60 * 60 * 1000

export const getNotifications = async (req, res) => {
    try {
        const businessId = req.business._id
        const ownerId = req.userId

        const overdueIds = await Transaction.distinct("customerId", {
            businessId, status: "active", kind: "CREDIT_GIVEN", dueDate: { $lt: new Date() }
        })

        const [overdueCustomers, overdueInvoices, remindersDue, lowStockCount, lowStockItems] = await Promise.all([
            overdueIds.length
                ? Customer.countDocuments({ _id: { $in: overdueIds }, businessId, archivedAt: null, balancePaise: { $gt: 0 } })
                : 0,
            Invoice.countDocuments({
                businessId, ownerId, status: "issued",
                dueDate: { $lt: new Date(Date.now() - DAY) },
                $expr: { $lt: ["$paidPaise", "$totalPaise"] }
            }),
            Reminder.countDocuments({
                businessId, ownerId, status: "pending",
                remindAt: { $lte: parseIstDate(istDateString(), true) }
            }),
            Product.countDocuments({
                businessId, ownerId, active: true, trackStock: true,
                lowStockMilli: { $gt: 0 },
                $expr: { $lte: ["$stockMilli", "$lowStockMilli"] }
            }),
            Product.find({
                businessId, ownerId, active: true, trackStock: true,
                lowStockMilli: { $gt: 0 },
                $expr: { $lte: ["$stockMilli", "$lowStockMilli"] }
            }).limit(3).select("name").lean()
        ])

        const items = []
        if (remindersDue > 0) {
            items.push({ id: "reminders", title: `${remindersDue} reminder${remindersDue > 1 ? "s" : ""} to send today`, text: "Open Reminders to share them.", link: "/reminders" })
        }
        if (overdueCustomers > 0) {
            items.push({ id: "customers", title: `${overdueCustomers} customer${overdueCustomers > 1 ? "s have" : " has"} overdue payments`, text: "Their due date has passed.", link: "/customers" })
        }
        if (overdueInvoices > 0) {
            items.push({ id: "invoices", title: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? "s" : ""}`, text: "Unpaid after the due date.", link: "/invoices" })
        }
        if (lowStockCount > 0) {
            items.push({ id: "stock", title: `${lowStockCount} item${lowStockCount > 1 ? "s are" : " is"} low on stock`, text: lowStockItems.map((p) => p.name).join(", "), link: "/inventory" })
        }

        return res.status(200).json({ items })
    } catch (error) {
        return sendError(res, error, "Could not load notifications")
    }
}