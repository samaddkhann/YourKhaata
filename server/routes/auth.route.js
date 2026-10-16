import express from "express"
import rateLimit from "express-rate-limit"
import { firebaseAuth, logOut } from "../controllers/auth.controller.js"

const authRouter = express.Router()

// Max 30 login attempts per 15 minutes from one IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    message: { message: "Too many attempts. Please wait a few minutes" },
})

authRouter.post("/firebase", authLimiter, firebaseAuth)
authRouter.post("/logout", logOut)

export default authRouter