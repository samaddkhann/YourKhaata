import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { AnimatePresence, motion } from "motion/react"
import toast from "react-hot-toast"
import { MdAdd } from "react-icons/md"
import api from "../utils/api"
import { formatPaise } from "../utils/money"
import { formatDate, todayIst, toIstDate } from "../utils/dates"
import { smsLink, whatsappLink } from "../utils/share"
import PageWrap from "../components/PageWrap"
import Modal from "../components/Modal"
import ConfirmDialog from "../components/ConfirmDialog"
import ReminderForm from "../components/ReminderForm"
import { btnOutline, btnPrimary, cardClass, inputClass, labelClass, softCardClass, tabClass } from "../utils/styles"

const TABS = [
    ["pending", "Pending"],
    ["sent", "Shared"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
]

function Reminders() {
    const { list, activeId, loading: businessLoading } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)
    const businessId = business?._id

    const [status, setStatus] = useState("pending")
    const [items, setItems] = useState(null)
    const [loading, setLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)
    const [showForm, setShowForm] = useState(false)
    const [rescheduling, setRescheduling] = useState(null)
    const [newDate, setNewDate] = useState(todayIst())
    const [cancelling, setCancelling] = useState(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!businessId) return
        let ignore = false
        const run = async () => {
            setLoading(true)
            try {
                const result = await api.get(`/api/businesses/${businessId}/reminders`, { params: { status } })
                if (!ignore) setItems(result.data)
            } catch (error) {
                if (!ignore) toast.error(error.response?.data?.message || "Could not load reminders")
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        run()
        return () => {
            ignore = true
        }
    }, [businessId, status, reloadKey])

    const reload = () => setReloadKey((k) => k + 1)

    const act = async (reminder, action, body = {}) => {
        setBusy(true)
        try {
            await api.post(`/api/reminders/${reminder._id}/${action}`, body)
            reload()
            return true
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong")
            return false
        } finally {
            setBusy(false)
        }
    }

    const share = async (reminder, channel) => {
        const phone = reminder.customerId?.phone
        const link = channel === "whatsapp" ? whatsappLink(phone, reminder.messageText) : smsLink(phone, reminder.messageText)
        if (!link) {
            toast.error("This customer has no valid phone number. Use Copy instead.")
            return
        }
        if (channel === "whatsapp") window.open(link, "_blank", "noopener")
        else window.location.href = link
        await act(reminder, "sent", { channel })
    }

    const copy = async (reminder) => {
        try {
            await navigator.clipboard.writeText(reminder.messageText)
            toast.success("Message copied")
        } catch (error) {
            toast.error("Could not copy. Please select the text and copy it by hand.")
        }
    }

    const reschedule = async () => {
        setBusy(true)
        try {
            await api.patch(`/api/reminders/${rescheduling._id}`, { remindAt: newDate })
            toast.success("Reminder rescheduled")
            setRescheduling(null)
            reload()
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not reschedule")
        } finally {
            setBusy(false)
        }
    }

    if (businessLoading) return <div className={`${cardClass} h-32 animate-pulse`} />

    if (!business) {
        return (
            <PageWrap>
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">Create a Khaata book first</p>
                    <Link to="/businesses" className={`${btnPrimary} inline-block mt-4`}>Go to Khaata Books</Link>
                </div>
            </PageWrap>
        )
    }

    const today = todayIst()

    return (
        <PageWrap>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-800">Payment Reminders</h1>
                    <p className="text-gray-500">Share a polite reminder on WhatsApp or SMS. You approve every message.</p>
                </div>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowForm(true)} className={`${btnPrimary} flex items-center gap-2`}>
                    <MdAdd size={20} /> New reminder
                </motion.button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {TABS.map(([key, label]) => (
                    <button key={key} onClick={() => setStatus(key)} className={tabClass(status === key)}>{label}</button>
                ))}
            </div>

            {loading && !items ? (
                <div className="grid gap-3">
                    {[1, 2].map((n) => <div key={n} className={`${softCardClass} h-24 animate-pulse`} />)}
                </div>
            ) : items && items.length === 0 ? (
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">No {TABS.find((t) => t[0] === status)[1].toLowerCase()} reminders</p>
                    {status === "pending" && (
                        <>
                            <p className="mt-1 mb-4 text-gray-600">Create one for a customer who owes you money.</p>
                            <button onClick={() => setShowForm(true)} className={btnPrimary}>New reminder</button>
                        </>
                    )}
                </div>
            ) : (
                <div className={`grid gap-3 ${loading ? "animate-pulse" : ""}`}>
                    {items?.map((r, index) => {
                                const followUpDue = r.status === "pending" && toIstDate(r.remindAt) <= today
                        return (
                            <motion.div
                                key={r._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04 }}
                                className={`${softCardClass} p-4`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link to={`/customers/${r.customerId?._id}`} className="font-semibold text-gray-800 hover:underline">
                                                {r.customerId?.name || "Customer"}
                                            </Link>
                                            {followUpDue && <span className="bg-black text-white text-xs font-medium px-2 py-0.5 rounded-full">Follow up today</span>}
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            Ask for {formatPaise(r.amountPaise)} • Remind on {formatDate(r.remindAt)}
                                            {r.dueDate ? ` • Due ${formatDate(r.dueDate)}` : ""}
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-3 text-sm text-gray-600 whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-200">{r.messageText}</p>

                                {(r.status === "pending" || r.status === "sent") && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <button disabled={busy} onClick={() => share(r, "whatsapp")} className={btnPrimary}>WhatsApp</button>
                                        <button disabled={busy} onClick={() => share(r, "sms")} className={btnOutline}>SMS</button>
                                        <button onClick={() => copy(r)} className={btnOutline}>Copy</button>
                                        {r.status === "pending" && (
                                            <button onClick={() => { setRescheduling(r); setNewDate(todayIst()) }} className={btnOutline}>Reschedule</button>
                                        )}
                                        <button disabled={busy} onClick={async () => { if (await act(r, "complete")) toast.success("Marked as completed") }} className={btnOutline}>Mark completed</button>
                                        <button onClick={() => setCancelling(r)} className={btnOutline}>Cancel</button>
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            )}

            <AnimatePresence>
                {showForm && (
                    <Modal title="New payment reminder" onClose={() => setShowForm(false)}>
                        <ReminderForm
                            business={business}
                            onCancel={() => setShowForm(false)}
                            onSaved={() => {
                                setShowForm(false)
                                setStatus("pending")
                                reload()
                            }}
                        />
                    </Modal>
                )}
                {rescheduling && (
                    <Modal title="Reschedule reminder" onClose={() => setRescheduling(null)}>
                        <label htmlFor="rs-date" className={labelClass}>New reminder date</label>
                        <input id="rs-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={`${inputClass} mb-5`} />
                        <div className="flex flex-wrap gap-3 justify-end">
                            <button onClick={() => setRescheduling(null)} disabled={busy} className={btnOutline}>Cancel</button>
                            <button onClick={reschedule} disabled={busy} className={btnPrimary}>Save</button>
                        </div>
                    </Modal>
                )}
                {cancelling && (
                    <ConfirmDialog
                        title="Cancel this reminder?"
                        message="It will move to the Cancelled tab. Nothing else changes."
                        confirmText="Cancel reminder"
                        busy={busy}
                        onCancel={() => setCancelling(null)}
                        onConfirm={async () => {
                            await act(cancelling, "cancel")
                            setCancelling(null)
                        }}
                    />
                )}
            </AnimatePresence>
        </PageWrap>
    )
}

export default Reminders