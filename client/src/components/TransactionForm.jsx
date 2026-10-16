import { useRef, useState } from "react"
import toast from "react-hot-toast"
import api from "../utils/api"
import { rupeesToPaise } from "../utils/money"
import { todayIst } from "../utils/dates"
import { KIND_LABELS, METHOD_LABELS, PAYMENT_KINDS, kindsForType } from "../utils/labels"
import { btnOutline, btnPrimary, inputClass, labelClass } from "../utils/styles"

function TransactionForm({ business, customer, initialKind, onSaved, onCancel }) {
    const kinds = kindsForType(customer.type)
    const [kind, setKind] = useState(initialKind || kinds[0])
    const [amount, setAmount] = useState("")
    const [date, setDate] = useState(todayIst())
    const [description, setDescription] = useState("")
    const [paymentMethod, setPaymentMethod] = useState("cash")
    const [referenceNo, setReferenceNo] = useState("")
    const [dueDate, setDueDate] = useState("")
    const [busy, setBusy] = useState(false)
    const [advanceMessage, setAdvanceMessage] = useState("")
    const keyRef = useRef(crypto.randomUUID())

    const submit = async (confirmAdvance = false) => {
        if (busy) return

        const paise = rupeesToPaise(amount)
        if (!paise) {
            toast.error("Enter an amount greater than zero, like 500 or 500.50")
            return
        }

        setBusy(true)
        try {
            const result = await api.post(`/api/businesses/${business._id}/transactions`, {
                customerId: customer._id,
                kind,
                amount,
                date,
                description,
                paymentMethod,
                referenceNo,
                dueDate,
                confirmAdvance,
                idempotencyKey: keyRef.current,
            })
            toast.success(result.status === 200 ? "This entry was already saved" : "Entry saved")
            onSaved()
        } catch (error) {
            const data = error.response?.data
            if (data?.code === "ADVANCE_CONFIRM_NEEDED") {
                setAdvanceMessage(data.message)
            } else {
                toast.error(data?.message || "Could not save. Please try again")
            }
        } finally {
            setBusy(false)
        }
    }

    const isPayment = PAYMENT_KINDS.includes(kind)

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                submit(false)
            }}
            className="flex flex-col gap-4"
        >
            <div>
                <label htmlFor="t-kind" className={labelClass}>Entry type</label>
                <select id="t-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
                    {kinds.map((k) => (
                        <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="t-amount" className={labelClass}>Amount (₹) *</label>
                    <input
                        id="t-amount"
                        value={amount}
                        onChange={(e) => {
                            setAmount(e.target.value)
                            setAdvanceMessage("")
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                        autoFocus
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="t-date" className={labelClass}>Date</label>
                    <input id="t-date" type="date" value={date} max={todayIst()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                </div>
            </div>

            {isPayment && (
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="t-method" className={labelClass}>Payment method</label>
                        <select id="t-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                            {Object.entries(METHOD_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="t-ref" className={labelClass}>Reference / cheque no.</label>
                        <input id="t-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} maxLength={50} className={inputClass} />
                    </div>
                </div>
            )}

            {kind === "CREDIT_GIVEN" && (
                <div>
                    <label htmlFor="t-due" className={labelClass}>Due date (optional)</label>
                    <input id="t-due" type="date" value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                </div>
            )}

            <div>
                <label htmlFor="t-desc" className={labelClass}>Details (optional)</label>
                <textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} placeholder="e.g. 2 kg sugar, 1 bag rice" className={inputClass} />
            </div>

            {advanceMessage && (
                <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-800 mb-3">{advanceMessage}</p>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => setAdvanceMessage("")} className={btnOutline}>Go back</button>
                        <button type="button" disabled={busy} onClick={() => submit(true)} className={btnPrimary}>
                            Yes, save as advance
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={busy || !!advanceMessage} className={btnPrimary}>
                    {busy ? "Saving..." : "Save entry"}
                </button>
            </div>
        </form>
    )
}

export default TransactionForm