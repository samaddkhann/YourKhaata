import mongoose from "mongoose"
import Customer, { CUSTOMER_TYPES } from "../models/customer.model.js"
import { rupeesToPaise } from "../utils/money.js"
import { cleanText, normalizeEmail, normalizePhone } from "../utils/validate.js"

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Checks the form data and returns clean data (only the fields we allow)
export const validateCustomer = (body) => {
    const name = cleanText(body.name)
    if (!name || name.length > 120) return { error: "Name is required (up to 120 characters)" }

    const phone = normalizePhone(body.phone)
    if (phone === null) return { error: "Enter a valid phone number" }

    const email = normalizeEmail(body.email)
    if (email === null) return { error: "Enter a valid email" }

    const address = cleanText(body.address)
    if (address.length > 300) return { error: "Address is too long" }

    const notes = cleanText(body.notes)
    if (notes.length > 500) return { error: "Notes are too long (max 500 characters)" }

    const type = body.type || "customer"
    if (!CUSTOMER_TYPES.includes(type)) return { error: "Invalid customer type" }

    const direction = body.openingDirection || "they_owe_me"
    if (!["they_owe_me", "i_owe_them"].includes(direction)) {
        return { error: "Invalid opening balance direction" }
    }

    let openingBalancePaise = 0
    const raw = body.openingBalance
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        const paise = rupeesToPaise(raw)
        if (paise === null) {
            return { error: "Opening balance must be a valid amount like 1500 or 1500.50" }
        }
        openingBalancePaise = direction === "i_owe_them" && paise !== 0 ? -paise : paise
    }

    return {
        data: { name, nameLower: name.toLowerCase(), phone, email, address, notes, type, openingBalancePaise }
    }
}

// Finds a customer only if it belongs to the logged-in user
const findOwnedCustomer = async (customerId, userId) => {
    if (!mongoose.isValidObjectId(customerId)) return null
    return Customer.findOne({ _id: customerId, ownerId: userId })
}

export const listCustomers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1)
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)

        const filter = {
            businessId: req.business._id,
            ownerId: req.userId,
            archivedAt: req.query.status === "archived" ? { $ne: null } : null
        }

        // "customer" also shows people who are "both"
        const { type, balance, sort } = req.query
        if (type === "customer" || type === "supplier") filter.type = { $in: [type, "both"] }
        if (type === "both") filter.type = "both"

        if (balance === "owes_me") filter.balancePaise = { $gt: 0 }
        if (balance === "i_owe") filter.balancePaise = { $lt: 0 }
        if (balance === "settled") filter.balancePaise = 0

        const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 50) : ""
        if (q) {
            const regex = new RegExp(escapeRegex(q.toLowerCase()))
            filter.$or = [{ nameLower: regex }, { phone: new RegExp(escapeRegex(q)) }]
        }

        let sortBy = { nameLower: 1 }
        if (sort === "balance") sortBy = { balancePaise: -1 }
        if (sort === "recent") sortBy = { lastTransactionAt: -1, createdAt: -1 }

        const [customers, total, totalsResult] = await Promise.all([
            Customer.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit),
            Customer.countDocuments(filter),
            // Money to receive / pay across ALL active customers (ignores the filters above)
            Customer.aggregate([
                { $match: { businessId: req.business._id, archivedAt: null } },
                {
                    $group: {
                        _id: null,
                        toReceive: { $sum: { $cond: [{ $gt: ["$balancePaise", 0] }, "$balancePaise", 0] } },
                        toPay: { $sum: { $cond: [{ $lt: ["$balancePaise", 0] }, { $multiply: ["$balancePaise", -1] }, 0] } }
                    }
                }
            ])
        ])

        const totals = totalsResult[0] || { toReceive: 0, toPay: 0 }

        return res.status(200).json({
            customers,
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
            totals: { toReceive: totals.toReceive, toPay: totals.toPay }
        })
    } catch (error) {
        console.log("listCustomers error:", error)
        return res.status(500).json({ message: "Could not load customers" })
    }
}

export const createCustomer = async (req, res) => {
    try {
        if (req.business.archivedAt) {
            return res.status(400).json({ message: "Restore this khaata book before adding customers" })
        }

        const body = req.body ?? {}
        const { error, data } = validateCustomer(body)
        if (error) return res.status(400).json({ message: error })

        // Warn about duplicate phone numbers (the user can still choose to add)
        if (data.phone && body.allowDuplicate !== true) {
            const existing = await Customer.findOne({
                businessId: req.business._id,
                phone: data.phone,
                archivedAt: null
            })
            if (existing) {
                return res.status(409).json({
                    code: "DUPLICATE_PHONE",
                    message: `${existing.name} already has this phone number.`
                })
            }
        }

        const customer = await Customer.create({
            businessId: req.business._id,
            ownerId: req.userId,
            ...data,
            balancePaise: data.openingBalancePaise
        })

        return res.status(201).json(customer)
    } catch (error) {
        console.log("createCustomer error:", error)
        return res.status(500).json({ message: "Could not add customer" })
    }
}

export const getCustomer = async (req, res) => {
    try {
        const customer = await findOwnedCustomer(req.params.customerId, req.userId)
        if (!customer) return res.status(404).json({ message: "Customer not found" })

        return res.status(200).json(customer)
    } catch (error) {
        console.log("getCustomer error:", error)
        return res.status(500).json({ message: "Could not load customer" })
    }
}

export const updateCustomer = async (req, res) => {
    try {
        const customer = await findOwnedCustomer(req.params.customerId, req.userId)
        if (!customer) return res.status(404).json({ message: "Customer not found" })

        const { error, data } = validateCustomer(req.body ?? {})
        if (error) return res.status(400).json({ message: error })

        // balance = opening balance + all ledger entries, so a changed opening balance
        // moves the current balance by the same difference
        const difference = data.openingBalancePaise - customer.openingBalancePaise

        Object.assign(customer, data)
        customer.balancePaise += difference
        await customer.save()

        return res.status(200).json(customer)
    } catch (error) {
        console.log("updateCustomer error:", error)
        return res.status(500).json({ message: "Could not update customer" })
    }
}

// Archiving hides the customer but keeps all their records
export const archiveCustomer = async (req, res) => {
    try {
        const customer = await findOwnedCustomer(req.params.customerId, req.userId)
        if (!customer) return res.status(404).json({ message: "Customer not found" })

        customer.archivedAt = new Date()
        await customer.save()

        return res.status(200).json({ message: "Customer archived" })
    } catch (error) {
        console.log("archiveCustomer error:", error)
        return res.status(500).json({ message: "Could not archive customer" })
    }
}

export const restoreCustomer = async (req, res) => {
    try {
        const customer = await findOwnedCustomer(req.params.customerId, req.userId)
        if (!customer) return res.status(404).json({ message: "Customer not found" })

        customer.archivedAt = null
        await customer.save()

        return res.status(200).json({ message: "Customer restored" })
    } catch (error) {
        console.log("restoreCustomer error:", error)
        return res.status(500).json({ message: "Could not restore customer" })
    }
}