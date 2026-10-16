import mongoose from "mongoose"
import Business from "../models/business.model.js"

const loadBusiness = async (req, res, next) => {
    try {
        const { businessId } = req.params

        if (!mongoose.isValidObjectId(businessId)) {
            return res.status(404).json({ message: "Khaata book not found" })
        }

        const business = await Business.findOne({ _id: businessId, ownerId: req.userId })

        if (!business) {
            return res.status(404).json({ message: "Khaata book not found" })
        }

        req.business = business
        next()
    } catch (error) {
        console.log("loadBusiness error:", error)
        return res.status(500).json({ message: "Something went wrong" })
    }
}

export default loadBusiness