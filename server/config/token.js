import jwt from "jsonwebtoken"

// Creates the login token that goes inside the cookie
const genToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "7d",
        issuer: "hisaab-ledger",
    })
}

// Same cookie settings are used for login and logout
export const cookieOptions = {
    httpOnly: true, // JavaScript in the browser cannot read this cookie
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
}

export default genToken