import { useState } from "react"
import toast from "react-hot-toast"
import api from "../utils/api"
import { rupeesToPaise } from "../utils/money"
import { btnOutline, btnPrimary, inputClass, labelClass } from "../utils/styles"

function CustomerForm({ business, initial, onSaved, onCancel }) {
    const [name, setName] = useState(initial?.name || "")
    const [phone, setPhone] = useState(initial?.phone || "")
    const [email, setEmail] = useState(initial?.email || "")
    const [type, setType] = useState(initial?.type || "customer")
    const [openingBalance, setOpeningBalance] = useState(
        initial && initial.openingBalancePaise !== 0 ? (Math.abs(initial.openingBalancePaise) / 100).toFixed(2) : ""
    )
    const [direction, setDirection] = useState(initial && initial.openingBalancePaise < 0 ? "i_owe_them" : "they_owe_me")
    const [address, setAddress] = useState(initial?.address || "")
    const [notes, setNotes] = useState(initial?.notes || "")
    const [busy, setBusy] = useState(false)

    // extra = { allowDuplicate: true } when the user chose to add a duplicate phone
    const save = async (extra = {}) => {
        const payload = {
            name, phone, email, type, address, notes,
            openingBalance, openingDirection: direction,
            ...extra,
        }

        if (initial) {
            await api.patch(`/api/customers/${initial._id}`, payload)
            toast.success("Customer updated")
        } else {
            await api.post(`/api/businesses/${business._id}/customers`, payload)
            toast.success("Customer added")
        }
        onSaved()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (busy) return

        if (name.trim().length === 0) {
            toast.error("Please enter the customer's name")
            return
        }
        if (openingBalance.trim() !== "" && rupeesToPaise(openingBalance) === null) {
            toast.error("Opening balance must be an amount like 1500 or 1500.50")
            return
        }

        setBusy(true)
        try {
            await save()
        } catch (error) {
            const data = error.response?.data
            if (data?.code === "DUPLICATE_PHONE") {
                if (window.confirm(`${data.message}\n\nAdd this customer anyway?`)) {
                    try {
                        await save({ allowDuplicate: true })
                    } catch (error2) {
                        toast.error(error2.response?.data?.message || "Could not save. Please try again")
                    }
                }
            } else {
                toast.error(data?.message || "Could not save. Please try again")
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label htmlFor="c-name" className={labelClass}>Full name *</label>
                <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="c-phone" className={labelClass}>Phone</label>
                    <input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} />
                </div>
                <div>
                    <label htmlFor="c-type" className={labelClass}>Type</label>
                    <select id="c-type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                        <option value="customer">Customer</option>
                        <option value="supplier">Supplier</option>
                        <option value="both">Both</option>
                    </select>
                </div>
            </div>

            <div>
                <label htmlFor="c-email" className={labelClass}>Email</label>
                <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="c-open" className={labelClass}>Opening balance (₹)</label>
                    <input id="c-open" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} inputMode="decimal" placeholder="0.00" className={inputClass} />
                </div>
                <div>
                    <label htmlFor="c-dir" className={labelClass}>Who owes whom?</label>
                    <select id="c-dir" value={direction} onChange={(e) => setDirection(e.target.value)} className={inputClass}>
                        <option value="they_owe_me">They owe me (You'll get)</option>
                        <option value="i_owe_them">I owe them (You'll give)</option>
                    </select>
                </div>
            </div>

            <div>
                <label htmlFor="c-address" className={labelClass}>Address</label>
                <textarea id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} rows={2} className={inputClass} />
            </div>

            <div>
                <label htmlFor="c-notes" className={labelClass}>Notes</label>
                <textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} className={inputClass} />
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={busy} className={btnPrimary}>
                    {busy ? "Saving..." : initial ? "Save changes" : "Add customer"}
                </button>
            </div>
        </form>
    )
}

export default CustomerForm