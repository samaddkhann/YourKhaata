import jwt from "jsonwebtoken"

// Creates the login token that goes inside the cookie
const genToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "7d",
        issuer: "hisaab-ledger",
    })
}

// Render sets RENDER=true by itself, so this works even if NODE_ENV was not set.
const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true"

// Website and server are on two different addresses, so online the cookie
// must be SameSite=None and Secure. On your computer it stays simple.
export const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
}

export default genToken
