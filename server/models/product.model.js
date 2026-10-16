import mongoose from "mongoose"

const productSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameLower: { type: String, required: true },
    sku: { type: String, trim: true, maxlength: 40, default: "" },
    category: { type: String, trim: true, maxlength: 60, default: "" },
    unit: { type: String, trim: true, maxlength: 20, default: "pcs" },
    purchasePricePaise: { type: Number, min: 0, default: 0 },
    sellingPricePaise: { type: Number, min: 0, default: 0 },
    trackStock: { type: Boolean, default: true }, // false = a service
    stockMilli: { type: Number, default: 0 },
    lowStockMilli: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true }
}, { timestamps: true })

productSchema.index({ businessId: 1, active: 1, nameLower: 1 })
productSchema.index({ businessId: 1, sku: 1 })

const Product = mongoose.model("Product", productSchema)

export default Product