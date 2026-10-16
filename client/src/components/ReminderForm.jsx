import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import api from "../utils/api"
import { rupeesToPaise, formatPaise } from "../utils/money"
import { todayIst } from "../utils/dates"
import { buildReminderText } from "../utils/share"
import { btnOutline, btnPrimary, inputClass, labelClass } from "../utils/styles"

function ReminderForm({ business, customer, onSaved, onCancel }) {
    const [customers, setCustomers] = useState(customer ? [customer] : [])
    const [customerId, setCustomerId] = useState(customer?._id || "")
    const [amount, setAmount] = useState("")
    const [remindAt, setRemindAt] = useState(todayIst())
    const [dueDate, setDueDate] = useState("")
    const [message, setMessage] = useState("")
    const [touched, setTouched] = useState(false)
    const [busy, setBusy] = useState(false)

    // When no customer is given, load the people who owe money
    useEffect(() => {
        if (customer) return
        const load = async () => {
            try {
                const result = await api.get(`/api/businesses/${business._id}/customers`, {
                    params: { balance: "owes_me", limit: 100, sort: "balance" },
                })
                setCustomers(result.data.customers)
            } catch (error) {
                toast.error("Could not load customers")
            }
        }
        load()
    }, [business._id, customer])

    const selected = customers.find((c) => c._id === customerId)
    const amountPaise = amount.trim() ? rupeesToPaise(amount) : selected?.balancePaise

    // Write the default message (until the user edits it)
    useEffect(() => {
        if (touched || !selected || !amountPaise || amountPaise <= 0) return
        setMessage(
            buildReminderText({
                customerName: selected.name,
                businessName: business.name,
                amountPaise,
                dueDate,
                upiId: business.upiId,
            })
        )
    }, [touched, selected, amountPaise, dueDate, business.name, business.upiId])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (busy) return
        if (!selected) {
            toast.error("Choose a customer")
            return
        }
        if (!amountPaise || amountPaise <= 0) {
            toast.error("Enter a valid amount")
            return
        }
        if (message.trim().length === 0) {
            toast.error("The message cannot be empty")
            return
        }

        setBusy(true)
        try {
            await api.post(`/api/businesses/${business._id}/reminders`, {
                customerId, amount, remindAt, dueDate, messageText: message,
            })
            toast.success("Reminder created")
            onSaved()
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not create the reminder")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label htmlFor="r-customer" className={labelClass}>Customer *</label>
                <select id="r-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={!!customer} className={inputClass}>
                    <option value="">Choose a customer</option>
                    {customers.map((c) => (
                        <option key={c._id} value={c._id}>
                            {c.name} ({formatPaise(c.balancePaise)})
                        </option>
                    ))}
                </select>
                {!customer && customers.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No customer owes you money right now.</p>
                )}
            </div>

            <div>
                <label htmlFor="r-amount" className={labelClass}>Amount to ask for (₹)</label>
                <input
                    id="r-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder={selected ? `Leave empty for full ${formatPaise(selected.balancePaise)}` : "Leave empty for the full amount"}
                    className={inputClass}
                />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="r-date" className={labelClass}>Remind me on</label>
                    <input id="r-date" type="date" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="r-due" className={labelClass}>Payment due date (optional)</label>
                    <input id="r-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                </div>
            </div>

            <div>
                <label htmlFor="r-msg" className={labelClass}>Message (you can edit it)</label>
                <textarea
                    id="r-msg"
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value)
                        setTouched(true)
                    }}
                    rows={5}
                    maxLength={1000}
                    className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">Add your UPI ID or payment instructions here if you like.</p>
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Create reminder"}</button>
            </div>
        </form>
    )
}

export default ReminderForm