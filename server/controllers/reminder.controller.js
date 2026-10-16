import mongoose from "mongoose"
import Reminder from "../models/reminder.model.js"
import { AppError, sendError } from "../utils/appError.js"
import { istDateString, parseIstDate } from "../utils/dates.js"
import { findOwnedCustomer } from "../utils/findOwned.js"
import { rupeesToPaise } from "../utils/money.js"
import { cleanText } from "../utils/validate.js"

const STATUSES = ["pending", "sent", "completed", "cancelled"]

const findOwnedReminder = async (reminderId, userId) => {
    if (!mongoose.isValidObjectId(reminderId)) return null
    return Reminder.findOne({ _id: reminderId, ownerId: userId })
}

export const listReminders = async (req, res) => {
    try {
        const filter = { businessId: req.business._id, ownerId: req.userId }
        if (STATUSES.includes(req.query.status)) filter.status = req.query.status

        const reminders = await Reminder.find(filter)
            .sort({ remindAt: req.query.status === "pending" ? 1 : -1 })
            .limit(200)
            .populate("customerId", "name phone balancePaise")
            .lean()

        return res.status(200).json(reminders)
    } catch (error) {
        return sendError(res, error, "Could not load reminders")
    }
}

export const createReminder = async (req, res) => {
    try {
        const body = req.body ?? {}
        if (req.business.archivedAt) throw new AppError(400, "Restore this khaata book first")

        const customer = await findOwnedCustomer(body.customerId, req.userId)
        if (!customer || String(customer.businessId) !== String(req.business._id)) {
            throw new AppError(404, "Customer not found")
        }

        // No amount typed = the full outstanding balance
        let amountPaise = customer.balancePaise
        if (body.amount !== undefined && String(body.amount).trim() !== "") {
            amountPaise = rupeesToPaise(body.amount)
            if (!amountPaise) throw new AppError(400, "Enter a valid amount")
        }
        if (amountPaise <= 0) throw new AppError(400, "This customer owes nothing right now. Enter an amount to remind.")

        const remindAt = parseIstDate(String(body.remindAt || istDateString()))
        if (!remindAt) throw new AppError(400, "Enter a valid reminder date")

        let dueDate = null
        if (body.dueDate) {
            dueDate = parseIstDate(String(body.dueDate))
            if (!dueDate) throw new AppError(400, "Enter a valid due date")
        }

        const messageText = cleanText(body.messageText)
        if (!messageText || messageText.length > 1000) {
            throw new AppError(400, "The message is required (up to 1000 characters)")
        }

        const reminder = await Reminder.create({
            businessId: req.business._id,
            ownerId: req.userId,
            customerId: customer._id,
            amountPaise,
            dueDate,
            remindAt,
            messageText,
            history: [{ action: "created", channel: "manual" }]
        })

        return res.status(201).json(reminder)
    } catch (error) {
        return sendError(res, error, "Could not create the reminder")
    }
}

// Reschedule a pending reminder
export const updateReminder = async (req, res) => {
    try {
        const reminder = await findOwnedReminder(req.params.reminderId, req.userId)
        if (!reminder) throw new AppError(404, "Reminder not found")
        if (reminder.status !== "pending") throw new AppError(409, "Only pending reminders can be changed")

        const body = req.body ?? {}

        if (body.remindAt) {
            const remindAt = parseIstDate(String(body.remindAt))
            if (!remindAt) throw new AppError(400, "Enter a valid reminder date")
            reminder.remindAt = remindAt
        }
        if (body.dueDate !== undefined) {
            if (body.dueDate === "" || body.dueDate === null) {
                reminder.dueDate = null
            } else {
                const dueDate = parseIstDate(String(body.dueDate))
                if (!dueDate) throw new AppError(400, "Enter a valid due date")
                reminder.dueDate = dueDate
            }
        }
        if (body.messageText !== undefined) {
            const messageText = cleanText(body.messageText)
            if (!messageText || messageText.length > 1000) throw new AppError(400, "The message is required (up to 1000 characters)")
            reminder.messageText = messageText
        }

        reminder.history.push({ action: "rescheduled", channel: "manual" })
        await reminder.save()

        return res.status(200).json(reminder)
    } catch (error) {
        return sendError(res, error, "Could not update the reminder")
    }
}

// One helper for the three status buttons
const changeStatus = (allowedFrom, newStatus) => async (req, res) => {
    try {
        const reminder = await findOwnedReminder(req.params.reminderId, req.userId)
        if (!reminder) throw new AppError(404, "Reminder not found")
        if (!allowedFrom.includes(reminder.status)) {
            throw new AppError(409, `This reminder is already ${reminder.status}`)
        }

        const channel = ["whatsapp", "sms", "manual"].includes(req.body?.channel) ? req.body.channel : "manual"
        reminder.status = newStatus
        if (newStatus === "sent") reminder.channel = channel
        reminder.history.push({ action: newStatus, channel })
        await reminder.save()

        return res.status(200).json(reminder)
    } catch (error) {
        return sendError(res, error, "Could not update the reminder")
    }
}

// "sent" only means: the user opened WhatsApp/SMS to share it. We cannot know if they pressed send.
export const markSent = changeStatus(["pending", "sent"], "sent")
export const markCompleted = changeStatus(["pending", "sent"], "completed")
export const cancelReminder = changeStatus(["pending", "sent"], "cancelled")