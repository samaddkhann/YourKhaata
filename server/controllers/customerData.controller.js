import Customer from "../models/customer.model.js"
import { sendError } from "../utils/appError.js"
import { validateCustomer } from "./customer.controller.js"

const MAX_ROWS = 500

export const exportCustomers = async (req, res) => {
    try {
        const customers = await Customer.find({ businessId: req.business._id, ownerId: req.userId, archivedAt: null })
            .sort({ nameLower: 1 })
            .limit(5000)
            .select("name phone email type balancePaise address notes")
            .lean()

        return res.status(200).json({ customers })
    } catch (error) {
        return sendError(res, error, "Could not export customers")
    }
}

// Each row is checked with the same rules as adding one customer by hand
export const importCustomers = async (req, res) => {
    try {
        if (req.business.archivedAt) return res.status(400).json({ message: "Restore this khaata book first" })

        const rows = req.body?.rows
        if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "The file has no rows" })
        if (rows.length > MAX_ROWS) return res.status(400).json({ message: `Please import up to ${MAX_ROWS} rows at a time` })

        const existing = await Customer.find({ businessId: req.business._id, archivedAt: null, phone: { $ne: "" } }).select("phone").lean()
        const seen = new Set(existing.map((c) => c.phone))

        const docs = []
        const problems = []

        rows.forEach((raw, index) => {
            const rowNo = index + 2 // row 1 is the header
            const { error, data } = validateCustomer(raw && typeof raw === "object" ? raw : {})
            if (error) {
                problems.push({ row: rowNo, message: error })
                return
            }
            if (data.phone) {
                if (seen.has(data.phone)) {
                    problems.push({ row: rowNo, message: "Skipped: this phone number already exists" })
                    return
                }
                seen.add(data.phone)
            }
            docs.push({ businessId: req.business._id, ownerId: req.userId, ...data, balancePaise: data.openingBalancePaise })
        })

        if (docs.length > 0) await Customer.insertMany(docs)

        return res.status(201).json({ created: docs.length, problems })
    } catch (error) {
        return sendError(res, error, "Could not import customers")
    }
}