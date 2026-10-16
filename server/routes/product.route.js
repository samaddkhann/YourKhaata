import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { addStockMovement, listMovements, updateProduct } from "../controllers/product.controller.js"

const productRouter = express.Router()

productRouter.patch("/:productId", isAuth, updateProduct)
productRouter.post("/:productId/stock", isAuth, addStockMovement)
productRouter.get("/:productId/movements", isAuth, listMovements)

export default productRouter