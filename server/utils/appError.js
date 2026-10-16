// An error we throw on purpose. Its message is safe to show to the user.
export class AppError extends Error {
    constructor(status, message, code) {
        super(message)
        this.status = status
        this.code = code
    }
}

// Sends the right response for any error
export const sendError = (res, error, fallbackMessage) => {
    if (error instanceof AppError) {
        return res.status(error.status).json({ message: error.message, code: error.code })
    }
    console.log(fallbackMessage, error)
    return res.status(500).json({ message: fallbackMessage })
}