import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import connectDb from "./config/connectdb.js"
import authRouter from "./routes/auth.route.js"
import userRouter from "./routes/user.route.js"
import businessRouter from "./routes/business.route.js"
import customerRouter from "./routes/customer.route.js"
import transactionRouter from "./routes/transaction.route.js"
import reminderRouter from "./routes/reminder.route.js"
import invoiceRouter from "./routes/invoice.route.js"
import productRouter from "./routes/product.route.js"
import dns from "dns" 

dns.setServers([
    '1.1.1.1',
    '8.8.8.8'
])

// Stop immediately if an important setting is missing
const required = ["MONGODB_URL", "JWT_SECRET", "CLIENT_URL", "FIREBASE_PROJECT_ID"]
const missing = required.filter((name) => !process.env[name])
if (missing.length > 0) {
    console.log("Missing in server/.env:", missing.join(", "))
    process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
    console.log("JWT_SECRET must be at least 32 characters")
    process.exit(1)
}

const app = express()

app.set("trust proxy", 2)

app.use(helmet())
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}))
app.use(express.json({ limit: "1mb" }))
app.use(cookieParser())

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" })
})

app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/businesses", businessRouter)
app.use("/api/customers", customerRouter)
app.use("/api/transactions", transactionRouter)
app.use("/api/reminders", reminderRouter)
app.use("/api/invoices", invoiceRouter)
app.use("/api/products", productRouter)

// Any other URL
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    connectDb()
})

