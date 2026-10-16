import jwt from "jsonwebtoken"

const isAuth = (req, res, next) => {
    try {
        const { token } = req.cookies

        if (!token) {
            return res.status(401).json({ message: "Please login first" })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: "hisaab-ledger",
        })

        req.userId = decoded.userId
        next()
    } catch (error) {
        // expired, fake or broken token
        return res.status(401).json({ message: "Session expired. Please login again" })
    }
}

export default isAuth