import mongoose from "mongoose"

export const KINDS = ["CREDIT_GIVEN", "PAYMENT_RECEIVED", "PURCHASE_ON_CREDIT", "PAYMENT_MADE", "REVERSAL"]
export const PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "cheque", "other"]

const transactionSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    seq: { type: Number, required: true },
    kind: { type: String, enum: KINDS, required: true },
    effect: { type: Number, enum: [1, -1], required: true },

    // Money in whole paise, always positive. The direction is in "effect".
    amountPaise: {
        type: Number,
        required: true,
        min: 1,
        validate: { validator: Number.isInteger, message: "Amount must be a whole number of paise" }
    },

    occurredAt: { type: Date, required: true },
    dueDate: { type: Date, default: null },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    paymentMethod: { type: String, enum: [...PAYMENT_METHODS, ""], default: "" },
    referenceNo: { type: String, trim: true, maxlength: 50, default: "" },
    receiptNo: { type: String, default: "" },

    status: { type: String, enum: ["active", "reversed"], default: "active" },
    reversesTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    reversedByTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    reason: { type: String, default: "" },

    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },

    idempotencyKey: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true })

transactionSchema.index({ customerId: 1, occurredAt: 1, seq: 1 })
transactionSchema.index({ businessId: 1, occurredAt: -1 })
transactionSchema.index({ businessId: 1, kind: 1, occurredAt: -1 })
transactionSchema.index({ invoiceId: 1 })
transactionSchema.index(
    { businessId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
)

const Transaction = mongoose.model("Transaction", transactionSchema)

export default Transaction