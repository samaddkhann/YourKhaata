import mongoose from "mongoose"
import Product from "../models/product.model.js"
import StockMovement from "../models/stockMovement.model.js"
import { parseQtyMilli } from "../services/invoiceMath.js"
import { AppError, sendError } from "../utils/appError.js"
import { rupeesToPaise } from "../utils/money.js"
import { escapeRegex } from "../utils/regex.js"
import { cleanText } from "../utils/validate.js"

const milliOrZero = (value) => {
    const text = String(value ?? "").trim()
    if (text === "" || Number(text) === 0) return 0
    return parseQtyMilli(text) // null when invalid
}

const paiseOrZero = (value) => {
    const text = String(value ?? "").trim()
    return text === "" ? 0 : rupeesToPaise(text)
}

const readProduct = (body) => {
    const name = cleanText(body.name)
    if (!name || name.length > 120) throw new AppError(400, "Enter the product name (up to 120 characters)")

    const sku = cleanText(body.sku)
    if (sku.length > 40) throw new AppError(400, "The product code is too long")
    const category = cleanText(body.category)
    if (category.length > 60) throw new AppError(400, "The category is too long")
    const unit = cleanText(body.unit) || "pcs"
    if (unit.length > 20) throw new AppError(400, "The unit is too long")

    const purchasePricePaise = paiseOrZero(body.purchasePrice)
    const sellingPricePaise = paiseOrZero(body.sellingPrice)
    if (purchasePricePaise === null || sellingPricePaise === null) throw new AppError(400, "Enter valid prices like 250 or 250.50")

    const lowStockMilli = milliOrZero(body.lowStock)
    if (lowStockMilli === null) throw new AppError(400, "Enter a valid low-stock level")

    return {
        name, nameLower: name.toLowerCase(), sku, category, unit,
        purchasePricePaise, sellingPricePaise, lowStockMilli,
        trackStock: body.trackStock !== false
    }
}

const findOwnedProduct = async (productId, userId) => {
    if (!mongoose.isValidObjectId(productId)) return null
    return Product.findOne({ _id: productId, ownerId: userId })
}

export const listProducts = async (req, res) => {
    try {
        const exportMode = req.query.export === "1"
        const page = Math.max(parseInt(req.query.page) || 1, 1)
        const limit = exportMode ? 5000 : Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)

        const filter = {
            businessId: req.business._id,
            ownerId: req.userId,
            active: req.query.status === "inactive" ? false : true
        }

        if (typeof req.query.category === "string" && req.query.category) filter.category = req.query.category.slice(0, 60)

        if (req.query.stock === "out") {
            filter.trackStock = true
            filter.stockMilli = { $lte: 0 }
        }
        if (req.query.stock === "low") {
            filter.trackStock = true
            filter.stockMilli = { $gt: 0 }
            filter.lowStockMilli = { $gt: 0 }
            filter.$expr = { $lte: ["$stockMilli", "$lowStockMilli"] }
        }

        const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 50) : ""
        if (q) {
            filter.$or = [{ nameLower: new RegExp(escapeRegex(q.toLowerCase())) }, { sku: new RegExp(escapeRegex(q), "i") }]
        }

        const [products, total, summaryRows, categories] = await Promise.all([
            Product.find(filter).sort({ nameLower: 1 }).skip(exportMode ? 0 : (page - 1) * limit).limit(limit).lean(),
            Product.countDocuments(filter),
            Product.aggregate([
                { $match: { businessId: req.business._id, ownerId: req.userId, active: true } },
                {
                    $group: {
                        _id: null,
                        items: { $sum: 1 },
                        value: { $sum: { $divide: [{ $multiply: [{ $max: ["$stockMilli", 0] }, "$purchasePricePaise"] }, 1000] } },
                        out: { $sum: { $cond: [{ $and: [{ $eq: ["$trackStock", true] }, { $lte: ["$stockMilli", 0] }] }, 1, 0] } },
                        low: {
                            $sum: {
                                $cond: [{
                                    $and: [
                                        { $eq: ["$trackStock", true] },
                                        { $gt: ["$stockMilli", 0] },
                                        { $gt: ["$lowStockMilli", 0] },
                                        { $lte: ["$stockMilli", "$lowStockMilli"] }
                                    ]
                                }, 1, 0]
                            }
                        }
                    }
                }
            ]),
            Product.distinct("category", { businessId: req.business._id, ownerId: req.userId, category: { $ne: "" } })
        ])

        const s = summaryRows[0] || { items: 0, value: 0, out: 0, low: 0 }

        return res.status(200).json({
            products,
            page,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
            categories: categories.sort(),
            summary: { items: s.items, low: s.low, out: s.out, stockValuePaise: Math.round(s.value) }
        })
    } catch (error) {
        return sendError(res, error, "Could not load products")
    }
}

export const createProduct = async (req, res) => {
    try {
        if (req.business.archivedAt) throw new AppError(400, "Restore this khaata book first")

        const body = req.body ?? {}
        const data = readProduct(body)

        const openingMilli = data.trackStock ? milliOrZero(body.openingStock) : 0
        if (openingMilli === null) throw new AppError(400, "Enter a valid opening stock")

        if (data.sku) {
            const duplicate = await Product.findOne({ businessId: req.business._id, sku: data.sku, active: true })
            if (duplicate) throw new AppError(409, "Another product already uses this code")
        }

        const product = await mongoose.connection.transaction(async (session) => {
            const [created] = await Product.create([{
                businessId: req.business._id,
                ownerId: req.userId,
                ...data,
                stockMilli: openingMilli
            }], { session })

            if (openingMilli > 0) {
                await StockMovement.create([{
                    businessId: req.business._id,
                    ownerId: req.userId,
                    productId: created._id,
                    type: "opening",
                    quantityMilli: openingMilli,
                    balanceAfterMilli: openingMilli,
                    reason: "Opening stock",
                    createdBy: req.userId
                }], { session })
            }
            return created
        })

        return res.status(201).json(product)
    } catch (error) {
        return sendError(res, error, "Could not add the product")
    }
}

export const updateProduct = async (req, res) => {
    try {
        const product = await findOwnedProduct(req.params.productId, req.userId)
        if (!product) throw new AppError(404, "Product not found")

        const body = req.body ?? {}
        const data = readProduct(body)

        if (data.sku && data.sku !== product.sku) {
            const duplicate = await Product.findOne({ businessId: product.businessId, sku: data.sku, active: true, _id: { $ne: product._id } })
            if (duplicate) throw new AppError(409, "Another product already uses this code")
        }

        Object.assign(product, data)
        if (typeof body.active === "boolean") product.active = body.active
        await product.save()

        return res.status(200).json(product)
    } catch (error) {
        return sendError(res, error, "Could not update the product")
    }
}

const STOCK_TYPES = {
    purchase: { sign: 1, type: "purchase", needReason: false },
    return: { sign: 1, type: "return", needReason: false },
    damage: { sign: -1, type: "damage", needReason: true },
    adjust_add: { sign: 1, type: "adjustment", needReason: true },
    adjust_remove: { sign: -1, type: "adjustment", needReason: true }
}

export const addStockMovement = async (req, res) => {
    try {
        const product = await findOwnedProduct(req.params.productId, req.userId)
        if (!product) throw new AppError(404, "Product not found")
        if (!product.trackStock) throw new AppError(400, "Stock is not tracked for this item")

        const body = req.body ?? {}
        const rule = Object.hasOwn(STOCK_TYPES, body.type) ? STOCK_TYPES[body.type] : null
        if (!rule) throw new AppError(400, "Choose what happened to the stock")

        const qty = parseQtyMilli(body.quantity)
        if (!qty) throw new AppError(400, "Enter a quantity above zero (up to 3 decimals)")

        const reason = cleanText(body.reason)
        if (reason.length > 200) throw new AppError(400, "The reason is too long")
        if (rule.needReason && reason.length < 3) throw new AppError(400, "Please write a short reason")

        const result = await mongoose.connection.transaction(async (session) => {
            const filter = { _id: product._id, ownerId: req.userId }
            if (rule.sign < 0) filter.stockMilli = { $gte: qty } // never go below zero

            const updated = await Product.findOneAndUpdate(filter, { $inc: { stockMilli: rule.sign * qty } }, { new: true, session })
            if (!updated) throw new AppError(409, "Not enough stock to remove that quantity")

            const [movement] = await StockMovement.create([{
                businessId: product.businessId,
                ownerId: req.userId,
                productId: product._id,
                type: rule.type,
                quantityMilli: rule.sign * qty,
                balanceAfterMilli: updated.stockMilli,
                reason,
                createdBy: req.userId
            }], { session })

            return { product: updated, movement }
        })

        return res.status(201).json(result)
    } catch (error) {
        return sendError(res, error, "Could not update the stock")
    }
}

export const listMovements = async (req, res) => {
    try {
        const product = await findOwnedProduct(req.params.productId, req.userId)
        if (!product) throw new AppError(404, "Product not found")

        const movements = await StockMovement.find({ productId: product._id, ownerId: req.userId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()

        return res.status(200).json({ product, movements })
    } catch (error) {
        return sendError(res, error, "Could not load the stock history")
    }
}