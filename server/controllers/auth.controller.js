import adminAuth from "../config/firebase.js"
import genToken, { cookieOptions } from "../config/token.js"
import User from "../models/user.model.js"

// Frontend logs in with Firebase (Google, email or phone), then sends us the Firebase idToken.
// We verify it on the server, so nobody can pretend to be someone else.
export const firebaseAuth = async (req, res) => {
    try {
        const { idToken } = req.body ?? {}

        if (!idToken || typeof idToken !== "string") {
            return res.status(400).json({ message: "idToken is required" })
        }

        let decoded
        try {
            decoded = await adminAuth.verifyIdToken(idToken)
        } catch (error) {
            console.log("verifyIdToken failed:", error.code, error.message)
            return res.status(401).json({ message: "Invalid or expired login. Please sign in again" })
        }

        const isPhoneLogin = decoded.firebase?.sign_in_provider === "phone"
        const email = decoded.email ? decoded.email.toLowerCase() : ""
        const phone = decoded.phone_number || ""

        if (isPhoneLogin) {
            if (!phone) return res.status(400).json({ message: "Your account has no phone number" })
        } else {
            if (!email) return res.status(400).json({ message: "Your account has no email address" })
            if (!decoded.email_verified) {
                return res.status(401).json({ message: "Please verify your email first" })
            }
        }

        let user = await User.findOne({ firebaseUid: decoded.uid })
        if (!user && email) {
            user = await User.findOne({ email })
        }

        if (!user) {
            const fallbackName = email ? email.split("@")[0] : `User ${phone.slice(-4)}`
            const data = {
                firebaseUid: decoded.uid,
                name: decoded.name || fallbackName,
                photoUrl: decoded.picture || ""
            }
            if (email) data.email = email
            if (phone) data.phone = phone
            user = await User.create(data)
        }

        user.lastLoginAt = new Date()
        await user.save()

        const token = genToken(user._id)
        res.cookie("token", token, cookieOptions)

        // The token is also sent in the reply, for browsers that block cross-site cookies
        return res.status(200).json({ ...user.toObject(), token })
    } catch (error) {
        console.log("firebaseAuth error:", error)
        return res.status(500).json({ message: "Login failed. Please try again" })
    }
}

export const logOut = async (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
        })
        return res.status(200).json({ message: "Logged out successfully" })
    } catch (error) {
        return res.status(500).json({ message: "Logout failed" })
    }
}
