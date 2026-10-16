import { sendError } from "../utils/appError.js"
import { addEntry, reverseEntry } from "../services/ledger.service.js"

export const createTransaction = async (req, res) => {
    try {
        const { entry, duplicate } = await addEntry({
            business: req.business,
            userId: req.userId,
            body: req.body ?? {}
        })
        return res.status(duplicate ? 200 : 201).json(entry)
    } catch (error) {
        return sendError(res, error, "Could not save the entry")
    }
}

export const reverseTransaction = async (req, res) => {
    try {
        const reversal = await reverseEntry({
            transactionId: req.params.transactionId,
            userId: req.userId,
            reason: req.body?.reason
        })
        return res.status(201).json(reversal)
    } catch (error) {
        return sendError(res, error, "Could not reverse the entry")
    }
}