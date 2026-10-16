import { useState } from "react"
import toast from "react-hot-toast"
import api from "../utils/api"
import { btnOutline, btnPrimary, inputClass, labelClass } from "../utils/styles"

const TYPES = [
    ["grocery", "Grocery store"],
    ["clothing", "Clothing store"],
    ["wholesale", "Wholesale"],
    ["personal", "Personal ledger"],
    ["other", "Other"],
]

function BusinessForm({ initial, onSaved, onCancel }) {
    const [name, setName] = useState(initial?.name || "")
    const [ownerName, setOwnerName] = useState(initial?.ownerName || "")
    const [phone, setPhone] = useState(initial?.phone || "")
    const [email, setEmail] = useState(initial?.email || "")
    const [address, setAddress] = useState(initial?.address || "")
    const [type, setType] = useState(initial?.type || "grocery")
    const [busy, setBusy] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (busy) return

        if (name.trim().length === 0) {
            toast.error("Please enter a name for your Khaata book")
            return
        }

        setBusy(true)
        try {
            const payload = { name, ownerName, phone, email, address, type }
            if (initial) {
                await api.patch(`/api/businesses/${initial._id}`, payload)
                toast.success("Khaata book updated")
            } else {
                await api.post("/api/businesses", payload)
                toast.success("Khaata book created")
            }
            onSaved()
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not save. Please try again")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label htmlFor="b-name" className={labelClass}>Khaata book name *</label>
                <input id="b-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} placeholder="e.g. Sharma General Store" />
            </div>

            <div>
                <label htmlFor="b-type" className={labelClass}>Business type</label>
                <select id="b-type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                    {TYPES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="b-owner" className={labelClass}>Owner name</label>
                <input id="b-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={100} className={inputClass} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="b-phone" className={labelClass}>Phone</label>
                    <input id="b-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} inputMode="tel" />
                </div>
                <div>
                    <label htmlFor="b-email" className={labelClass}>Email</label>
                    <input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                </div>
            </div>

            <div>
                <label htmlFor="b-address" className={labelClass}>Address</label>
                <textarea id="b-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} rows={2} className={inputClass} />
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={busy} className={btnPrimary}>
                    {busy ? "Saving..." : initial ? "Save changes" : "Create"}
                </button>
            </div>
        </form>
    )
}

export default BusinessForm