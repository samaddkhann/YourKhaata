import Business, { BUSINESS_TYPES } from "../models/business.model.js"
import User from "../models/user.model.js"
import { cleanText, normalizeEmail, normalizePhone } from "../utils/validate.js"

const MAX_BUSINESSES = 20

// Checks the form data and returns clean data (only the fields we allow)
const validateBusiness = (body) => {
    const name = cleanText(body.name)
    if (!name || name.length > 100) {
        return { error: "Khaata book name is required (up to 100 characters)" }
    }

    const ownerName = cleanText(body.ownerName)
    if (ownerName.length > 100) return { error: "Owner name is too long" }

    const phone = normalizePhone(body.phone)
    if (phone === null) return { error: "Enter a valid phone number" }

    const email = normalizeEmail(body.email)
    if (email === null) return { error: "Enter a valid email" }

    const address = cleanText(body.address)
    if (address.length > 300) return { error: "Address is too long" }

    const type = body.type || "other"
    if (!BUSINESS_TYPES.includes(type)) return { error: "Invalid business type" }

    return {
        data: { name, nameLower: name.toLowerCase(), ownerName, phone, email, address, type }
    }
}

export const listBusinesses = async (req, res) => {
    try {
        const archived = req.query.status === "archived"
        const filter = { ownerId: req.userId, archivedAt: archived ? { $ne: null } : null }

        const [businesses, user] = await Promise.all([
            Business.find(filter).sort({ createdAt: 1 }),
            User.findById(req.userId)
        ])

        const defaultId = String(user?.defaultBusinessId || "")
        const result = businesses.map((b) => ({
            ...b.toObject(),
            isDefault: String(b._id) === defaultId
        }))

        return res.status(200).json(result)
    } catch (error) {
        console.log("listBusinesses error:", error)
        return res.status(500).json({ message: "Could not load khaata books" })
    }
}

export const createBusiness = async (req, res) => {
    try {
        const { error, data } = validateBusiness(req.body ?? {})
        if (error) return res.status(400).json({ message: error })

        const total = await Business.countDocuments({ ownerId: req.userId })
        if (total >= MAX_BUSINESSES) {
            return res.status(400).json({ message: `You can create up to ${MAX_BUSINESSES} khaata books` })
        }

        const duplicate = await Business.findOne({
            ownerId: req.userId,
            nameLower: data.nameLower,
            archivedAt: null
        })
        if (duplicate) {
            return res.status(409).json({ message: "You already have a khaata book with this name" })
        }

        const business = await Business.create({ ownerId: req.userId, ...data })

        // The first khaata book becomes the default
        const user = await User.findById(req.userId)
        if (user && !user.defaultBusinessId) {
            user.defaultBusinessId = business._id
            await user.save()
        }

        return res.status(201).json(business)
    } catch (error) {
        console.log("createBusiness error:", error)
        return res.status(500).json({ message: "Could not create khaata book" })
    }
}

export const getBusiness = async (req, res) => {
    return res.status(200).json(req.business)
}

export const updateBusiness = async (req, res) => {
    try {
        const { error, data } = validateBusiness(req.body ?? {})
        if (error) return res.status(400).json({ message: error })

        const duplicate = await Business.findOne({
            ownerId: req.userId,
            nameLower: data.nameLower,
            archivedAt: null,
            _id: { $ne: req.business._id }
        })
        if (duplicate) {
            return res.status(409).json({ message: "You already have a khaata book with this name" })
        }

        Object.assign(req.business, data)
        await req.business.save()

        return res.status(200).json(req.business)
    } catch (error) {
        console.log("updateBusiness error:", error)
        return res.status(500).json({ message: "Could not update khaata book" })
    }
}

export const archiveBusiness = async (req, res) => {
    try {
        req.business.archivedAt = new Date()
        await req.business.save()

        // If this was the default, pick another active one
        const user = await User.findById(req.userId)
        if (user && String(user.defaultBusinessId) === String(req.business._id)) {
            const other = await Business.findOne({ ownerId: req.userId, archivedAt: null }).sort({ createdAt: 1 })
            user.defaultBusinessId = other ? other._id : null
            await user.save()
        }

        return res.status(200).json({ message: "Khaata book archived" })
    } catch (error) {
        console.log("archiveBusiness error:", error)
        return res.status(500).json({ message: "Could not archive khaata book" })
    }
}

export const restoreBusiness = async (req, res) => {
    try {
        req.business.archivedAt = null
        await req.business.save()

        const user = await User.findById(req.userId)
        if (user && !user.defaultBusinessId) {
            user.defaultBusinessId = req.business._id
            await user.save()
        }

        return res.status(200).json({ message: "Khaata book restored" })
    } catch (error) {
        console.log("restoreBusiness error:", error)
        return res.status(500).json({ message: "Could not restore khaata book" })
    }
}

export const setDefaultBusiness = async (req, res) => {
    try {
        if (req.business.archivedAt) {
            return res.status(400).json({ message: "Restore this khaata book first" })
        }

        await User.findByIdAndUpdate(req.userId, { defaultBusinessId: req.business._id })

        return res.status(200).json({ message: "Default khaata book updated" })
    } catch (error) {
        console.log("setDefaultBusiness error:", error)
        return res.status(500).json({ message: "Could not set default" })
    }
}