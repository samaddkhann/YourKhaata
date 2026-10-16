import express from "express"
import isAuth from "../middlewares/isAuth.js"
import {
    cancelInvoice,
    finalizeInvoice,
    getInvoice,
    payInvoice,
    updateInvoice,
} from "../controllers/invoice.controller.js"

const invoiceRouter = express.Router()

invoiceRouter.get("/:invoiceId", isAuth, getInvoice)
invoiceRouter.patch("/:invoiceId", isAuth, updateInvoice)
invoiceRouter.post("/:invoiceId/finalize", isAuth, finalizeInvoice)
invoiceRouter.post("/:invoiceId/pay", isAuth, payInvoice)
invoiceRouter.post("/:invoiceId/cancel", isAuth, cancelInvoice)

export default invoiceRouter