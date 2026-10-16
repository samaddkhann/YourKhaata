import mongoose from "mongoose"

const stockMovementSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    type: {
        type: String,
        enum: ["opening", "purchase", "sale", "return", "damage", "adjustment", "cancel_restore"],
        required: true
    },
    quantityMilli: { type: Number, required: true }, // + adds stock, - removes stock
    balanceAfterMilli: { type: Number, required: true },
    reason: { type: String, maxlength: 200, default: "" },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true })

stockMovementSchema.index({ productId: 1, createdAt: -1 })

const StockMovement = mongoose.model("StockMovement", stockMovementSchema)

export default StockMovement