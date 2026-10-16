import Business from "../models/business.model.js"
import Transaction from "../models/transaction.model.js"
import { addRunningBalance } from "../services/ledgerMath.js"
import { findOwnedCustomer } from "../utils/findOwned.js"
import { parseIstDate } from "../utils/dates.js"

export const getCustomerLedger = async (req, res) => {
    try {
        const customer = await findOwnedCustomer(req.params.customerId, req.userId)
        if (!customer) return res.status(404).json({ message: "Customer not found" })

        const business = await Business.findOne({ _id: customer.businessId, ownerId: req.userId })
            .select("name phone address ownerName")

        const raw = await Transaction.find({ customerId: customer._id, ownerId: req.userId }).lean()
        const all = addRunningBalance(customer.openingBalancePaise, raw)

        // The ledger is the source of truth for the balance
        const balancePaise = all.length ? all[all.length - 1].runningBalancePaise : customer.openingBalancePaise
        if (balancePaise !== customer.balancePaise) {
            console.warn(`Balance mismatch for customer ${customer._id}: saved ${customer.balancePaise}, ledger ${balancePaise}`)
        }

        const sumGaveGot = (entries) => {
            let gave = 0
            let got = 0
            for (const e of entries) {
                if (e.status !== "active" || e.kind === "REVERSAL") continue
                if (e.effect === 1) gave += e.amountPaise
                else got += e.amountPaise
            }
            return { gave, got }
        }

        const from = parseIstDate(req.query.from)
        const to = parseIstDate(req.query.to, true)
        const kind = typeof req.query.kind === "string" ? req.query.kind : ""
        const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase().slice(0, 50) : ""

        const filtered = all.filter((e) =>
            (!from || e.occurredAt >= from) &&
            (!to || e.occurredAt <= to) &&
            (!kind || e.kind === kind) &&
            (!q || [e.description, e.referenceNo, e.receiptNo].join(" ").toLowerCase().includes(q))
        )

        // Balance just before the first day of the chosen period
        const before = from ? all.filter((e) => e.occurredAt < from) : []
        const balanceBeforePaise = before.length ? before[before.length - 1].runningBalancePaise : customer.openingBalancePaise

        const ordered = req.query.order === "asc" ? filtered : [...filtered].reverse()

        const page = Math.max(parseInt(req.query.page) || 1, 1)
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
        const showAll = req.query.all === "1"
        const entries = showAll ? ordered : ordered.slice((page - 1) * limit, page * limit)

        return res.status(200).json({
            customer: { ...customer.toObject(), balancePaise },
            business,
            summary: { openingPaise: customer.openingBalancePaise, balancePaise, ...sumGaveGot(all) },
            filteredTotals: sumGaveGot(filtered),
            balanceBeforePaise,
            entries,
            page: showAll ? 1 : page,
            total: filtered.length,
            totalPages: showAll ? 1 : Math.max(Math.ceil(filtered.length / limit), 1)
        })
    } catch (error) {
        console.log("getCustomerLedger error:", error)
        return res.status(500).json({ message: "Could not load the ledger" })
    }
}