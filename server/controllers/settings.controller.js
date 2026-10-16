import mongoose from "mongoose"
import Business from "../models/business.model.js"
import Counter from "../models/counter.model.js"
import Customer from "../models/customer.model.js"
import Invoice from "../models/invoice.model.js"
import Product from "../models/product.model.js"
import Reminder from "../models/reminder.model.js"
import StockMovement from "../models/stockMovement.model.js"
import Transaction from "../models/transaction.model.js"
import User from "../models/user.model.js"
import { cookieOptions } from "../config/token.js"
import { AppError, sendError } from "../utils/appError.js"
import { cleanText } from "../utils/validate.js"

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/

export const updateProfile = async (req, res) => {
    try {
        const name = cleanText(req.body?.name)
        if (name.length < 2 || name.length > 100) throw new AppError(400, "Enter your name (2 to 100 characters)")

        const language = req.body?.language
        if (!["en", "hi"].includes(language)) throw new AppError(400, "Choose a valid language")

        const user = await User.findByIdAndUpdate(req.userId, { name, language }, { new: true })
        if (!user) throw new AppError(404, "User not found")

        return res.status(200).json(user)
    } catch (error) {
        return sendError(res, error, "Could not save your profile")
    }
}

export const updateInvoiceSettings = async (req, res) => {
    try {
        const body = req.body ?? {}

        const gstin = cleanText(body.gstin).toUpperCase()
        if (gstin && !GSTIN_REGEX.test(gstin)) throw new AppError(400, "This GSTIN is not valid. It has 15 letters and digits.")

        const upiId = cleanText(body.upiId)
        if (upiId && !UPI_REGEX.test(upiId)) throw new AppError(400, "This UPI ID is not valid. Example: shop@upi")

        const invoicePrefix = cleanText(body.invoicePrefix).toUpperCase() || "INV"
        if (!/^[A-Z0-9]{1,10}$/.test(invoicePrefix)) throw new AppError(400, "The invoice prefix can have up to 10 letters or digits")

        const invoiceTerms = cleanText(body.invoiceTerms)
        if (invoiceTerms.length > 500) throw new AppError(400, "The terms are too long (max 500 characters)")

        Object.assign(req.business, { gstin, upiId, invoicePrefix, invoiceTerms })
        await req.business.save()

        return res.status(200).json(req.business)
    } catch (error) {
        return sendError(res, error, "Could not save the settings")
    }
}

// Everything the user owns, as one file
export const exportMyData = async (req, res) => {
    try {
        const ownerId = req.userId
        const [user, businesses, customers, transactions, reminders, invoices, products, stockMovements] = await Promise.all([
            User.findById(ownerId).lean(),
            Business.find({ ownerId }).lean(),
            Customer.find({ ownerId }).lean(),
            Transaction.find({ ownerId }).lean(),
            Reminder.find({ ownerId }).lean(),
            Invoice.find({ ownerId }).lean(),
            Product.find({ ownerId }).lean(),
            StockMovement.find({ ownerId }).lean()
        ])

        return res.status(200).json({
            exportedAt: new Date().toISOString(),
            note: "All money amounts are in paise (100 paise = 1 rupee).",
            user, businesses, customers, transactions, reminders, invoices, products, stockMovements
        })
    } catch (error) {
        return sendError(res, error, "Could not export your data")
    }
}

// Permanently deletes one ARCHIVED khaata book, after the owner types its name
export const deleteBusiness = async (req, res) => {
    try {
        const business = req.business
        if (!business.archivedAt) throw new AppError(400, "Archive this khaata book first")
        if (cleanText(req.body?.confirmName) !== business.name) throw new AppError(400, "The name you typed does not match")

        await mongoose.connection.transaction(async (session) => {
            const filter = { businessId: business._id, ownerId: req.userId }
            for (const Model of [Transaction, Customer, Reminder, Invoice, StockMovement, Product]) {
                await Model.deleteMany(filter, { session })
            }
            await Counter.deleteMany({ businessId: business._id }, { session })
            await Business.deleteOne({ _id: business._id, ownerId: req.userId }, { session })
            await User.updateOne({ _id: req.userId, defaultBusinessId: business._id }, { defaultBusinessId: null }, { session })
        })

        return res.status(200).json({ message: "Khaata book deleted" })
    } catch (error) {
        return sendError(res, error, "Could not delete the khaata book")
    }
}

// Deletes ALL of this user's data. The Firebase login itself stays (that needs the Firebase private key).
export const deleteAccount = async (req, res) => {
    try {
        if (req.body?.confirm !== "DELETE") throw new AppError(400, 'Type DELETE to confirm')

        const ownerId = req.userId
        const businessIds = await Business.distinct("_id", { ownerId })

        await mongoose.connection.transaction(async (session) => {
            for (const Model of [Transaction, Customer, Reminder, Invoice, StockMovement, Product, Business]) {
                await Model.deleteMany({ ownerId }, { session })
            }
            await Counter.deleteMany({ businessId: { $in: businessIds } }, { session })
            await User.deleteOne({ _id: ownerId }, { session })
        })

        res.clearCookie("token", {
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite
        })
        return res.status(200).json({ message: "Your account data was deleted" })
    } catch (error) {
        return sendError(res, error, "Could not delete your account")
    }
}