import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { AnimatePresence, motion } from "motion/react"
import toast from "react-hot-toast"
import { MdArrowBack, MdNotificationsActive, MdPictureAsPdf, MdPrint, MdSearch } from "react-icons/md"
import api from "../utils/api"
import { balancePdf, formatPaise, formatPaisePdf } from "../utils/money"
import { formatDate, formatDateTime } from "../utils/dates"
import { KIND_LABELS, PAYMENT_KINDS, kindsForType } from "../utils/labels"
import { downloadPdf } from "../utils/exportFile"
import { setActiveBusiness } from "../redux/businessSlice"
import useDebounce from "../hooks/useDebounce"
import PageWrap from "../components/PageWrap"
import Modal from "../components/Modal"
import BalanceBadge from "../components/BalanceBadge"
import DateRangeFilter from "../components/DateRangeFilter"
import Pagination from "../components/Pagination"
import TransactionForm from "../components/TransactionForm"
import ReverseDialog from "../components/ReverseDialog"
import ReceiptModal from "../components/ReceiptModal"
import ReminderForm from "../components/ReminderForm"
import { btnOutline, btnPrimary, cardClass, inputClass } from "../utils/styles"

// "▲ ₹800.00" (you'll get), "▼ ₹300.00" (you'll give)
const signedBalance = (paise) => (paise > 0 ? `▲ ${formatPaise(paise)}` : paise < 0 ? `▼ ${formatPaise(-paise)}` : formatPaise(0))

function CustomerLedger() {
    const { customerId } = useParams()
    const dispatch = useDispatch()
    const { list } = useSelector((state) => state.business)

    const [range, setRange] = useState({ preset: "all", from: "", to: "" })
    const [kind, setKind] = useState("")
    const [q, setQ] = useState("")
    const [page, setPage] = useState(1)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    const [txnKind, setTxnKind] = useState(null)
    const [reversing, setReversing] = useState(null)
    const [receipt, setReceipt] = useState(null)
    const [showReminder, setShowReminder] = useState(false)

    const debouncedQ = useDebounce(q, 400)

    useEffect(() => {
        let ignore = false

        const run = async () => {
            setLoading(true)
            try {
                const result = await api.get(`/api/customers/${customerId}/ledger`, {
                    params: { from: range.from, to: range.to, kind, q: debouncedQ, page, limit: 20 },
                })
                if (ignore) return
                setData(result.data)
                setNotFound(false)
                // Keep the selector at the top on this customer's Khaata book
                const bid = result.data.business?._id
                if (bid && list.some((b) => b._id === bid)) dispatch(setActiveBusiness(bid))
            } catch (error) {
                if (ignore) return
                if (error.response?.status === 404) setNotFound(true)
                else toast.error(error.response?.data?.message || "Could not load the ledger")
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        run()

        return () => {
            ignore = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId, range, kind, debouncedQ, page, reloadKey])

    const reload = () => setReloadKey((k) => k + 1)

    const downloadStatement = async () => {
        try {
            const result = await api.get(`/api/customers/${customerId}/ledger`, {
                params: { from: range.from, to: range.to, all: 1, order: "asc" },
            })
            const d = result.data
            const period = range.from ? `${formatDate(range.from)} to ${formatDate(range.to || new Date())}` : "All time"
            downloadPdf({
                filename: `statement-${d.customer.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`,
                title: `Account statement: ${d.customer.name}`,
                lines: [
                    `${d.business.name}${d.business.phone ? "  |  " + d.business.phone : ""}`,
                    `Period: ${period}`,
                    `Balance before period: ${balancePdf(d.balanceBeforePaise)}`,
                    `You gave: ${formatPaisePdf(d.filteredTotals.gave)}   You got: ${formatPaisePdf(d.filteredTotals.got)}`,
                    `Closing balance: ${balancePdf(d.summary.balancePaise)}`,
                ],
                head: ["Date", "Details", "You gave", "You got", "Balance"],
                body: d.entries.map((e) => [
                    formatDate(e.occurredAt),
                    [KIND_LABELS[e.kind], e.description, e.referenceNo, e.status === "reversed" ? "(reversed)" : ""].filter(Boolean).join(" - "),
                    e.effect === 1 ? formatPaisePdf(e.amountPaise) : "",
                    e.effect === -1 ? formatPaisePdf(e.amountPaise) : "",
                    balancePdf(e.runningBalancePaise),
                ]),
            })
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not create the statement")
        }
    }

    if (notFound) {
        return (
            <PageWrap>
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">Customer not found</p>
                    <Link to="/customers" className={`${btnPrimary} inline-block mt-4`}>Back to customers</Link>
                </div>
            </PageWrap>
        )
    }

    if (!data) {
        return <div className={`${cardClass} h-40 animate-pulse`} />
    }

    const c = data.customer
    const filtersUsed = range.preset !== "all" || kind || q

    return (
        <PageWrap>
            <div className={receipt ? "" : "print-area"}>
                {/* Header */}
                <div className={`${cardClass} p-5 sm:p-6`}>
                    <Link to="/customers" className="no-print inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black mb-3">
                        <MdArrowBack size={18} /> Customers
                    </Link>

                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-800">{c.name}</h1>
                            <p className="text-sm text-gray-600">
                                {c.phone || "No phone"} • <span className="capitalize">{c.type}</span> • {data.business.name}
                            </p>
                        </div>
                        <BalanceBadge paise={c.balancePaise} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 text-sm">
                        <div className="bg-gray-100 rounded-xl p-3">
                            <p className="text-gray-500">Opening balance</p>
                            <p className="font-semibold text-gray-800">{signedBalance(data.summary.openingPaise)}</p>
                        </div>
                        <div className="bg-gray-100 rounded-xl p-3">
                            <p className="text-gray-500">Total you gave</p>
                            <p className="font-semibold text-gray-800">{formatPaise(data.summary.gave)}</p>
                        </div>
                        <div className="bg-gray-100 rounded-xl p-3">
                            <p className="text-gray-500">Total you got</p>
                            <p className="font-semibold text-gray-800">{formatPaise(data.summary.got)}</p>
                        </div>
                    </div>

                    <div className="no-print flex flex-wrap gap-3 mt-5">
                        {kindsForType(c.type).map((k) => (
                            <motion.button
                                key={k}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setTxnKind(k)}
                                disabled={!!c.archivedAt}
                                className={PAYMENT_KINDS.includes(k) ? btnOutline : btnPrimary}
                            >
                                {KIND_LABELS[k]}
                            </motion.button>
                        ))}
                        <button onClick={() => setShowReminder(true)} disabled={c.balancePaise <= 0} className={`${btnOutline} flex items-center gap-1`}>
                            <MdNotificationsActive size={18} /> Remind
                        </button>
                        <button onClick={downloadStatement} className={`${btnOutline} flex items-center gap-1`}>
                            <MdPictureAsPdf size={18} /> Statement PDF
                        </button>
                        <button onClick={() => window.print()} className={`${btnOutline} flex items-center gap-1`}>
                            <MdPrint size={18} /> Print
                        </button>
                    </div>
                    {c.archivedAt && <p className="no-print mt-3 text-sm text-gray-600">This customer is archived. Restore them to add new entries.</p>}
                </div>

                {/* Filters */}
                <div className={`${cardClass} p-4 sm:p-5 mt-4 no-print`}>
                    <DateRangeFilter
                        allowAll
                        value={range}
                        onChange={(value) => {
                            setRange(value)
                            setPage(1)
                        }}
                    />
                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <div className="relative">
                            <MdSearch size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
                            <input
                                value={q}
                                onChange={(e) => {
                                    setQ(e.target.value)
                                    setPage(1)
                                }}
                                placeholder="Search details or reference"
                                aria-label="Search entries"
                                className={`${inputClass} pl-10`}
                            />
                        </div>
                        <select
                            value={kind}
                            onChange={(e) => {
                                setKind(e.target.value)
                                setPage(1)
                            }}
                            aria-label="Filter by type"
                            className={inputClass}
                        >
                            <option value="">All entry types</option>
                            {Object.entries(KIND_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Ledger table */}
                <div className={`${cardClass} p-4 sm:p-5 mt-4 ${loading ? "animate-pulse" : ""}`}>
                    {data.entries.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="font-semibold text-gray-800">{filtersUsed ? "No entries match your filters" : "No entries yet"}</p>
                            {!filtersUsed && <p className="text-sm text-gray-600 mt-1">Use the buttons above to record udhaar or a payment.</p>}
                            {filtersUsed && (
                                <button
                                    onClick={() => {
                                        setRange({ preset: "all", from: "", to: "" })
                                        setKind("")
                                        setQ("")
                                        setPage(1)
                                    }}
                                    className={`${btnOutline} mt-4 no-print`}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-sm text-left">
                                <thead>
                                    <tr className="text-gray-500 border-b border-gray-200">
                                        <th className="px-3 py-2 font-medium">Date</th>
                                        <th className="px-3 py-2 font-medium">Details</th>
                                        <th className="px-3 py-2 font-medium text-right">You gave</th>
                                        <th className="px-3 py-2 font-medium text-right">You got</th>
                                        <th className="px-3 py-2 font-medium text-right">Balance</th>
                                        <th className="px-3 py-2 font-medium no-print"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.entries.map((e) => (
                                        <tr key={e._id} className="border-b border-gray-100 align-top">
                                            <td className="px-3 py-3 whitespace-nowrap text-gray-600">{formatDateTime(e.occurredAt)}</td>
                                            <td className="px-3 py-3">
                                                <p className={`font-medium ${e.status === "reversed" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                                                    {KIND_LABELS[e.kind]}
                                                </p>
                                                {e.status === "reversed" && (
                                                    <span className="inline-block text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 mt-1">Reversed</span>
                                                )}
                                                {e.description && <p className="text-gray-600">{e.description}</p>}
                                                {(e.referenceNo || e.receiptNo) && (
                                                    <p className="text-xs text-gray-500">{[e.receiptNo, e.referenceNo].filter(Boolean).join(" • ")}</p>
                                                )}
                                                {e.dueDate && <p className="text-xs text-gray-500">Due {formatDate(e.dueDate)}</p>}
                                            </td>
                                            <td className={`px-3 py-3 text-right whitespace-nowrap ${e.status === "reversed" ? "text-gray-400 line-through" : ""}`}>
                                                {e.effect === 1 ? formatPaise(e.amountPaise) : ""}
                                            </td>
                                            <td className={`px-3 py-3 text-right whitespace-nowrap ${e.status === "reversed" ? "text-gray-400 line-through" : ""}`}>
                                                {e.effect === -1 ? formatPaise(e.amountPaise) : ""}
                                            </td>
                                            <td className="px-3 py-3 text-right whitespace-nowrap font-semibold text-gray-800">
                                                {signedBalance(e.runningBalancePaise)}
                                            </td>
                                            <td className="px-3 py-3 no-print">
                                                <div className="flex gap-2 justify-end">
                                                    {e.receiptNo && e.status === "active" && (
                                                        <button onClick={() => setReceipt(e)} className={btnOutline}>Receipt</button>
                                                    )}
                                                    {e.status === "active" && e.kind !== "REVERSAL" && (
                                                        <button onClick={() => setReversing(e)} className={btnOutline}>Reverse</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-3">▲ = you'll get from them. ▼ = you'll give them. Newest entries are shown first.</p>
                </div>
            </div>

            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />

            <AnimatePresence>
                {txnKind && (
                    <Modal title={KIND_LABELS[txnKind]} onClose={() => setTxnKind(null)}>
                        <TransactionForm
                            business={data.business}
                            customer={c}
                            initialKind={txnKind}
                            onCancel={() => setTxnKind(null)}
                            onSaved={() => {
                                setTxnKind(null)
                                setPage(1)
                                reload()
                            }}
                        />
                    </Modal>
                )}
                {reversing && (
                    <ReverseDialog
                        entry={reversing}
                        currentBalancePaise={c.balancePaise}
                        onCancel={() => setReversing(null)}
                        onDone={() => {
                            setReversing(null)
                            reload()
                        }}
                    />
                )}
                {receipt && <ReceiptModal entry={receipt} customer={c} business={data.business} onClose={() => setReceipt(null)} />}
                {showReminder && (
                    <Modal title="New payment reminder" onClose={() => setShowReminder(false)}>
                        <ReminderForm
                            business={data.business}
                            customer={c}
                            onCancel={() => setShowReminder(false)}
                            onSaved={() => {
                                setShowReminder(false)
                                toast("Open Reminders to share it on WhatsApp or SMS")
                            }}
                        />
                    </Modal>
                )}
            </AnimatePresence>
        </PageWrap>
    )
}

export default CustomerLedger