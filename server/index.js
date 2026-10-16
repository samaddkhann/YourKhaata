import "dotenv/config"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import connectDb from "./config/connectDb.js"
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
const required = ["MONGODB_URL", "JWT_SECRET", "FIREBASE_PROJECT_ID"]
const missing = required.filter((name) => !process.env[name])
if (missing.length > 0) {
    console.log("Missing environment variables:", missing.join(", "))
    process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
    console.log("JWT_SECRET must be at least 32 characters")
    process.exit(1)
}

const app = express()

// Render puts one proxy in front of this server
app.set("trust proxy", 1)

<<<<<<< HEAD
app.use(helmet({
    // Google login needs many Google addresses, and a mistake in a strict policy would break
    // login, so this one header is off. The other helmet protections stay on.
    contentSecurityPolicy: false,
    // Lets the Google login popup talk to this page
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
=======
app.use(helmet())
app.use(cors({
    origin: "https://yourkhaata-g9wt.onrender.com",
    credentials: true
>>>>>>> ca9cbd9e3d7e33fbcb6681d865d623ab889a4254
}))

// Only needed while developing (website on port 5173, server on port 8000)
const allowedOrigins = [process.env.CLIENT_URL?.replace(/\/+$/, ""), "http://localhost:5173"].filter(Boolean)
app.use(cors({ origin: allowedOrigins, credentials: true }))

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

// Serve the built website (client/dist) from this same server
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.join(__dirname, "..", "client", "dist")
const indexFile = path.join(clientDist, "index.html")

if (fs.existsSync(indexFile)) {
    app.use(express.static(clientDist))
    // Any other page address (like /customers) opens the website, which shows the right page
    app.use((req, res, next) => {
        if (req.method !== "GET" || req.path.startsWith("/api")) return next()
        res.sendFile(indexFile)
    })
}

// Unknown /api address
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" })
})

// Last safety net: always answer with JSON, never a stack trace
app.use((err, req, res, next) => {
    if (err?.type === "entity.parse.failed") return res.status(400).json({ message: "Request body is not valid JSON" })
    if (err?.type === "entity.too.large") return res.status(413).json({ message: "Request is too large" })
    console.log("Unhandled error:", err)
    res.status(500).json({ message: "Something went wrong. Please try again" })
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    connectDb()
})
