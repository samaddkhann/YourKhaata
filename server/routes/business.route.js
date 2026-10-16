import express from "express"
import isAuth from "../middlewares/isAuth.js"
import loadBusiness from "../middlewares/loadBusiness.js"
import {
    archiveBusiness,
    createBusiness,
    getBusiness,
    listBusinesses,
    restoreBusiness,
    setDefaultBusiness,
    updateBusiness,
} from "../controllers/business.controller.js"
import { createCustomer, listCustomers } from "../controllers/customer.controller.js"
import { exportCustomers, importCustomers } from "../controllers/customerData.controller.js"
import { createTransaction } from "../controllers/transaction.controller.js"
import { createReminder, listReminders } from "../controllers/reminder.controller.js"
import { getDashboard, getOutstandingReport, getTransactionsReport } from "../controllers/report.controller.js"
import { createInvoice, listInvoices } from "../controllers/invoice.controller.js"
import { createProduct, listProducts } from "../controllers/product.controller.js"
import { getNotifications } from "../controllers/notification.controller.js"
import { deleteBusiness, updateInvoiceSettings } from "../controllers/settings.controller.js"

const businessRouter = express.Router()

businessRouter.get("/", isAuth, listBusinesses)
businessRouter.post("/", isAuth, createBusiness)

// Every route below checks that the business belongs to the logged-in user
businessRouter.get("/:businessId", isAuth, loadBusiness, getBusiness)
businessRouter.patch("/:businessId", isAuth, loadBusiness, updateBusiness)
businessRouter.delete("/:businessId", isAuth, loadBusiness, deleteBusiness)
businessRouter.post("/:businessId/archive", isAuth, loadBusiness, archiveBusiness)
businessRouter.post("/:businessId/restore", isAuth, loadBusiness, restoreBusiness)
businessRouter.post("/:businessId/default", isAuth, loadBusiness, setDefaultBusiness)
businessRouter.patch("/:businessId/invoice-settings", isAuth, loadBusiness, updateInvoiceSettings)

businessRouter.get("/:businessId/customers", isAuth, loadBusiness, listCustomers)
businessRouter.post("/:businessId/customers", isAuth, loadBusiness, createCustomer)
businessRouter.get("/:businessId/customers/export", isAuth, loadBusiness, exportCustomers)
businessRouter.post("/:businessId/customers/import", isAuth, loadBusiness, importCustomers)

businessRouter.post("/:businessId/transactions", isAuth, loadBusiness, createTransaction)

businessRouter.get("/:businessId/reminders", isAuth, loadBusiness, listReminders)
businessRouter.post("/:businessId/reminders", isAuth, loadBusiness, createReminder)

businessRouter.get("/:businessId/invoices", isAuth, loadBusiness, listInvoices)
businessRouter.post("/:businessId/invoices", isAuth, loadBusiness, createInvoice)

businessRouter.get("/:businessId/products", isAuth, loadBusiness, listProducts)
businessRouter.post("/:businessId/products", isAuth, loadBusiness, createProduct)

businessRouter.get("/:businessId/notifications", isAuth, loadBusiness, getNotifications)

businessRouter.get("/:businessId/dashboard", isAuth, loadBusiness, getDashboard)
businessRouter.get("/:businessId/reports/outstanding", isAuth, loadBusiness, getOutstandingReport)
businessRouter.get("/:businessId/reports/transactions", isAuth, loadBusiness, getTransactionsReport)

export default businessRouter