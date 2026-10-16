import express from "express"
import isAuth from "../middlewares/isAuth.js"
import {
    archiveCustomer,
    getCustomer,
    restoreCustomer,
    updateCustomer,
} from "../controllers/customer.controller.js"
import { getCustomerLedger } from "../controllers/ledger.controller.js"

const customerRouter = express.Router()

customerRouter.get("/:customerId", isAuth, getCustomer)
customerRouter.get("/:customerId/ledger", isAuth, getCustomerLedger)
customerRouter.patch("/:customerId", isAuth, updateCustomer)
customerRouter.post("/:customerId/archive", isAuth, archiveCustomer)
customerRouter.post("/:customerId/restore", isAuth, restoreCustomer)

export default customerRouter