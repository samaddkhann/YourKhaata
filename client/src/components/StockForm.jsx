import { useState } from "react"
import toast from "react-hot-toast"
import api from "../utils/api"
import { btnOutline, btnPrimary, inputClass, labelClass } from "../utils/styles"

const TYPES = [
    ["purchase", "Stock purchased (add)"],
    ["return", "Customer return (add)"],
    ["damage", "Damaged or lost (remove)"],
    ["adjust_add", "Correction: add"],
    ["adjust_remove", "Correction: remove"],
]

function StockForm({ product, onSaved, onCancel }) {
    const [type, setType] = useState("purchase")
    const [quantity, setQuantity] = useState("")
    const [reason, setReason] = useState("")
    const [busy, setBusy] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (busy) return
        if (quantity.trim() === "") {
            toast.error("Enter the quantity")
            return
        }

        setBusy(true)
        try {
            await api.post(`/api/products/${product._id}/stock`, { type, quantity, reason })
            toast.success("Stock updated")
            onSaved()
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not update the stock")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label htmlFor="s-type" className={labelClass}>What happened?</label>
                <select id="s-type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                    {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="s-qty" className={labelClass}>Quantity ({product.unit})</label>
                <input id="s-qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" autoFocus className={inputClass} />
            </div>
            <div>
                <label htmlFor="s-reason" className={labelClass}>Reason {type === "purchase" || type === "return" ? "(optional)" : "*"}</label>
                <input id="s-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} />
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save"}</button>
            </div>
        </form>
    )
}

export default StockForm