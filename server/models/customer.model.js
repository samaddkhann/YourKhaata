import mongoose from "mongoose"

export const CUSTOMER_TYPES = ["customer", "supplier", "both"]

const customerSchema = new mongoose.Schema({
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business",
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameLower: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    type: { type: String, enum: CUSTOMER_TYPES, default: "customer" },

    // Money in paise. Positive = they owe me. Negative = I owe them.
    openingBalancePaise: { type: Number, default: 0 },
    balancePaise: { type: Number, default: 0 },

    lastTransactionAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null }
}, { timestamps: true })

customerSchema.index({ businessId: 1, archivedAt: 1, nameLower: 1 })
customerSchema.index({ businessId: 1, phone: 1 })

const Customer = mongoose.model("Customer", customerSchema)

export default Customer