import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { reverseTransaction } from "../controllers/transaction.controller.js"

const transactionRouter = express.Router()

transactionRouter.post("/:transactionId/reverse", isAuth, reverseTransaction)

export default transactionRouter