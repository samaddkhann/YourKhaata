import mongoose from "mongoose"

export const BUSINESS_TYPES = ["grocery", "clothing", "wholesale", "personal", "other"]

const businessSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameLower: { type: String, required: true },
    ownerName: { type: String, trim: true, maxlength: 100, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    type: { type: String, enum: BUSINESS_TYPES, default: "other" },
    currency: { type: String, default: "INR" },

    // Invoice and payment settings
    gstin: { type: String, default: "" },
    upiId: { type: String, default: "" },
    invoicePrefix: { type: String, default: "INV" },
    invoiceTerms: { type: String, maxlength: 500, default: "" },

    archivedAt: { type: Date, default: null }
}, { timestamps: true })

businessSchema.index({ ownerId: 1, archivedAt: 1 })

const Business = mongoose.model("Business", businessSchema)

export default Business