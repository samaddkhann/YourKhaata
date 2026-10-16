import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { motion } from "motion/react"
import toast from "react-hot-toast"
import { MdAdd, MdFileDownload, MdSearch } from "react-icons/md"
import api from "../utils/api"
import { formatPaise, rupeesNumber } from "../utils/money"
import { formatDate } from "../utils/dates"
import { downloadCsv } from "../utils/exportFile"
import useDebounce from "../hooks/useDebounce"
import useT from "../hooks/useT"
import PageWrap from "../components/PageWrap"
import DateRangeFilter from "../components/DateRangeFilter"
import Pagination from "../components/Pagination"
import InvoiceStatus from "../components/InvoiceStatus"
import { btnOutline, btnPrimary, cardClass, inputClass, softCardClass } from "../utils/styles"

function Invoices() {
    const t = useT()
    const { list, activeId, loading: businessLoading } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)
    const businessId = business?._id

    const [q, setQ] = useState("")
    const [status, setStatus] = useState("")
    const [range, setRange] = useState({ preset: "all", from: "", to: "" })
    const [page, setPage] = useState(1)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    const debouncedQ = useDebounce(q, 400)

    useEffect(() => {
        if (!businessId) return
        let ignore = false
        const run = async () => {
            setLoading(true)
            try {
                const result = await api.get(`/api/businesses/${businessId}/invoices`, {
                    params: { q: debouncedQ, status, from: range.from, to: range.to, page, limit: 15 },
                })
                if (!ignore) setData(result.data)
            } catch (error) {
                if (!ignore) toast.error(error.response?.data?.message || "Could not load invoices")
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        run()
        return () => {
            ignore = true
        }
    }, [businessId, debouncedQ, status, range, page])

    const exportCsv = async () => {
        try {
            const result = await api.get(`/api/businesses/${businessId}/invoices`, {
                params: { q: debouncedQ, status, from: range.from, to: range.to, export: 1 },
            })
            downloadCsv("invoice-summary.csv", [
                ["Invoice", "Date", "Customer", "Type", "Status", "Total (Rs)", "Paid (Rs)", "Balance (Rs)"],
                ...result.data.invoices.map((i) => [
                    i.number || "Draft", formatDate(i.issueDate), i.customerId?.name || "", i.type === "gst" ? "GST" : "Non-GST",
                    i.statusLabel, rupeesNumber(i.totalPaise), rupeesNumber(i.paidPaise), rupeesNumber(i.totalPaise - i.paidPaise),
                ]),
            ])
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not export")
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

    const filtersUsed = q || status || range.preset !== "all"

    return (
        <PageWrap>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-800">{t("invoices")}</h1>
                    <p className="text-gray-500">{business.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={exportCsv} className={`${btnOutline} flex items-center gap-1`}><MdFileDownload size={18} /> Export CSV</button>
                    <Link to="/invoices/new" className={`${btnPrimary} flex items-center gap-2`}><MdAdd size={20} /> {t("newInvoice")}</Link>
                </div>
            </div>

            <div className={`${cardClass} p-4 sm:p-5 mb-4`}>
                <DateRangeFilter allowAll value={range} onChange={(v) => { setRange(v); setPage(1) }} />
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div className="relative">
                        <MdSearch size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
                        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search invoice number or customer" aria-label="Search invoices" className={`${inputClass} pl-10`} />
                    </div>
                    <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by status" className={inputClass}>
                        <option value="">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partially paid</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {loading && !data ? (
                <div className="grid gap-3">{[1, 2, 3].map((n) => <div key={n} className={`${softCardClass} h-20 animate-pulse`} />)}</div>
            ) : data && data.invoices.length === 0 ? (
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">{filtersUsed ? "No invoices match your filters" : "No invoices yet"}</p>
                    {!filtersUsed && (
                        <>
                            <p className="mt-1 mb-4 text-gray-600">Make your first bill for a customer.</p>
                            <Link to="/invoices/new" className={`${btnPrimary} inline-block`}>{t("newInvoice")}</Link>
                        </>
                    )}
                </div>
            ) : (
                <div className={`grid gap-3 ${loading ? "animate-pulse" : ""}`}>
                    {data?.invoices.map((inv, index) => (
                        <motion.div key={inv._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} whileHover={{ y: -2 }}>
                            <Link to={`/invoices/${inv._id}`} className={`${softCardClass} p-4 flex flex-wrap items-center justify-between gap-3 hover:shadow-md transition-shadow`}>
                                <div>
                                    <p className="font-semibold text-gray-800">{inv.number || "Draft"}</p>
                                    <p className="text-sm text-gray-600">{inv.customerId?.name || "Customer"} • {formatDate(inv.issueDate)}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="font-semibold text-gray-800">{formatPaise(inv.totalPaise)}</p>
                                        {inv.status === "issued" && <p className="text-xs text-gray-500">Paid {formatPaise(inv.paidPaise)}</p>}
                                    </div>
                                    <InvoiceStatus status={inv.statusLabel} />
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}

            {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
        </PageWrap>
    )
}

export default Invoices