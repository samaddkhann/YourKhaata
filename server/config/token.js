import jwt from "jsonwebtoken"

// Creates the login token that goes inside the cookie
const genToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "7d",
        issuer: "hisaab-ledger",
    })
}

const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true"

// Same cookie settings are used for login and logout
export const cookieOptions = {
    httpOnly: true, // JavaScript in the browser cannot read this cookie
    secure: isProduction, // HTTPS only when deployed
    sameSite: "lax", // fine now, because the website and server share one address
    maxAge: 7 * 24 * 60 * 60 * 1000,
}

export default genToken