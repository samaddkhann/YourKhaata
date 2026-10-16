import mongoose from "mongoose"

const lineSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, required: true },
    hsn: { type: String, default: "" },
    unit: { type: String, default: "pcs" },
    qtyMilli: { type: Number, required: true },
    ratePaise: { type: Number, required: true },
    discountPaise: { type: Number, default: 0 },
    taxRatePercent: { type: Number, default: 0 },
    grossPaise: Number,
    taxablePaise: Number,
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    totalPaise: Number
}, { _id: false })

const invoiceSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    number: { type: String }, // set when the invoice is issued. Drafts have no number.
    type: { type: String, enum: ["gst", "non_gst"], default: "non_gst" },
    status: { type: String, enum: ["draft", "issued", "cancelled"], default: "draft" },

    issueDate: { type: Date, required: true },
    dueDate: { type: Date, default: null },

    interstate: { type: Boolean, default: false },
    placeOfSupply: { type: String, default: "" },
    sellerGstin: { type: String, default: "" },
    buyerGstin: { type: String, default: "" },
    notes: { type: String, maxlength: 500, default: "" },

    lines: [lineSchema],

    subtotalPaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    taxablePaise: { type: Number, default: 0 },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    taxPaise: { type: Number, default: 0 },
    totalPaise: { type: Number, required: true },

    // Kept in step with the ledger: +amount when a payment is saved, -amount when it is reversed
    paidPaise: { type: Number, default: 0 },

    ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },

    idempotencyKey: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true })

invoiceSchema.index({ businessId: 1, createdAt: -1 })
invoiceSchema.index({ businessId: 1, number: 1 }, { unique: true, partialFilterExpression: { number: { $type: "string" } } })
invoiceSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } })

const Invoice = mongoose.model("Invoice", invoiceSchema)

export default Invoice