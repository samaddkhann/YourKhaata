import { useState } from "react"
import toast from "react-hot-toast"
import api from "../utils/api"
import { balanceText, formatPaise } from "../utils/money"
import { KIND_LABELS } from "../utils/labels"
import Modal from "./Modal"
import { btnOutline, btnPrimary, inputClass, labelClass } from "../utils/styles"

function ReverseDialog({ entry, currentBalancePaise, onDone, onCancel }) {
    const [reason, setReason] = useState("")
    const [busy, setBusy] = useState(false)

    // Reversing adds the opposite entry, so the balance moves the other way
    const newBalance = currentBalancePaise - entry.effect * entry.amountPaise

    const handleReverse = async () => {
        if (reason.trim().length < 3) {
            toast.error("Please write a short reason (at least 3 characters)")
            return
        }
        setBusy(true)
        try {
            await api.post(`/api/transactions/${entry._id}/reverse`, { reason })
            toast.success("Entry reversed")
            onDone()
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not reverse the entry")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title="Reverse this entry?" onClose={onCancel}>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4 text-sm text-gray-700">
                <p className="font-medium">{KIND_LABELS[entry.kind]}: {formatPaise(entry.amountPaise)}</p>
                <p className="mt-2">Balance now: <span className="font-medium">{balanceText(currentBalancePaise)}</span></p>
                <p>Balance after reversal: <span className="font-medium">{balanceText(newBalance)}</span></p>
            </div>

            <p className="text-sm text-gray-600 mb-4">
                Nothing is deleted. A reversing entry is added, and the original stays on the statement marked "Reversed".
                If you want a corrected entry, add it after reversing.
            </p>

            <label htmlFor="r-reason" className={labelClass}>Reason *</label>
            <textarea id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={2} className={`${inputClass} mb-5`} placeholder="e.g. Wrong amount entered" />

            <div className="flex flex-wrap gap-3 justify-end">
                <button onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button onClick={handleReverse} disabled={busy} className={btnPrimary}>
                    {busy ? "Please wait..." : "Reverse entry"}
                </button>
            </div>
        </Modal>
    )
}

export default ReverseDialog