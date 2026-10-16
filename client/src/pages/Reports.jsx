import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import toast from "react-hot-toast"
import { MdPictureAsPdf, MdPrint, MdTableChart } from "react-icons/md"
import api from "../utils/api"
import { formatPaise, formatPaisePdf, rupeesNumber } from "../utils/money"
import { formatDate, presetRange } from "../utils/dates"
import { KIND_LABELS, METHOD_LABELS } from "../utils/labels"
import { downloadCsv, downloadPdf } from "../utils/exportFile"
import PageWrap from "../components/PageWrap"
import DateRangeFilter from "../components/DateRangeFilter"
import { btnOutline, btnPrimary, cardClass, inputClass, tabClass } from "../utils/styles"

const TABS = [
    ["receivable", "You'll get"],
    ["payable", "You'll give"],
    ["transactions", "Transactions"],
]

function Reports() {
    const { list, activeId, loading: businessLoading } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)
    const businessId = business?._id

    const [tab, setTab] = useState("receivable")
    const [range, setRange] = useState({ preset: "month", ...presetRange("month") })
    const [kind, setKind] = useState("")
    const [method, setMethod] = useState("")
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!businessId) return
        if (tab === "transactions" && (!range.from || !range.to)) return

        let ignore = false
        const run = async () => {
            setLoading(true)
            try {
                const isTxn = tab === "transactions"
                const result = await api.get(
                    `/api/businesses/${businessId}/reports/${isTxn ? "transactions" : "outstanding"}`,
                    { params: isTxn ? { from: range.from, to: range.to, kind, method } : { side: tab } }
                )
                if (!ignore) setData(result.data)
            } catch (error) {
                if (!ignore) toast.error(error.response?.data?.message || "Could not load the report")
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        run()
        return () => {
            ignore = true
        }
    }, [businessId, tab, range, kind, method])

    // One builder for screen, PDF and CSV. "money" decides how amounts are written.
    const buildTable = (money) => {
        if (!data || data.report !== tab) return null

        if (tab === "transactions") {
            return {
                title: "Transactions report",
                period: `${formatDate(range.from)} to ${formatDate(range.to)}`,
                head: ["Date", "Customer", "Type", "Details", "Method", "You gave", "You got", "Status"],
                rows: data.rows.map((r) => [
                    formatDate(r.occurredAt),
                    r.customerName,
                    KIND_LABELS[r.kind],
                    [r.description, r.referenceNo].filter(Boolean).join(" - "),
                    METHOD_LABELS[r.paymentMethod] || "",
                    r.effect === 1 ? money(r.amountPaise) : "",
                    r.effect === -1 ? money(r.amountPaise) : "",
                    r.status === "reversed" ? "Reversed" : "",
                ]),
                summary: [
                    ["You gave", money(data.totals.youGave)],
                    ["You got", money(data.totals.youGot)],
                    ["Net cash flow (payments received - payments made)", money(data.totals.netCashFlow)],
                ],
            }
        }

        return {
            title: tab === "receivable" ? "Outstanding: money you'll get" : "Outstanding: money you'll give",
            period: `As on ${formatDate(new Date())}`,
            head: ["Name", "Phone", "Type", "Balance"],
            rows: data.rows.map((r) => [r.name, r.phone || "", r.type, money(Math.abs(r.balancePaise))]),
            summary: [["Total", money(data.totalPaise)]],
        }
    }

    const screen = buildTable(formatPaise)

    const exportPdf = () => {
        const t = buildTable(formatPaisePdf)
        downloadPdf({
            filename: `${tab}-report.pdf`,
            title: t.title,
            lines: [business.name, t.period, ...t.summary.map(([label, value]) => `${label}: ${value}`)],
            head: t.head,
            body: t.rows,
        })
    }

    const exportCsv = () => {
        const t = buildTable(rupeesNumber)
        downloadCsv(`${tab}-report.csv`, [
            [business.name],
            [t.title],
            [t.period],
            [],
            t.head,
            ...t.rows,
            [],
            ...t.summary,
        ])
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

    return (
        <PageWrap>
            <div className="mb-5">
                <h1 className="text-3xl font-semibold text-gray-800">Reports</h1>
                <p className="text-gray-500">{business.name}</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 no-print">
                {TABS.map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)} className={tabClass(tab === key)}>{label}</button>
                ))}
            </div>

            {tab === "transactions" && (
                <div className={`${cardClass} p-4 sm:p-5 mb-4 no-print`}>
                    <DateRangeFilter value={range} onChange={setRange} />
                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type" className={inputClass}>
                            <option value="">All entry types</option>
                            {Object.entries(KIND_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Filter by payment method" className={inputClass}>
                            <option value="">All payment methods</option>
                            {Object.entries(METHOD_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3 mb-4 no-print">
                <button disabled={!screen} onClick={exportPdf} className={`${btnOutline} flex items-center gap-1`}><MdPictureAsPdf size={18} /> PDF</button>
                <button disabled={!screen} onClick={exportCsv} className={`${btnOutline} flex items-center gap-1`}><MdTableChart size={18} /> CSV</button>
                <button disabled={!screen} onClick={() => window.print()} className={`${btnOutline} flex items-center gap-1`}><MdPrint size={18} /> Print</button>
            </div>

            <div className={`print-area ${cardClass} p-4 sm:p-5 ${loading ? "animate-pulse" : ""}`}>
                {!screen ? (
                    <div className="h-24" />
                ) : (
                    <>
                        <p className="text-xl font-semibold text-gray-800">{screen.title}</p>
                        <p className="text-sm text-gray-500">{business.name} • {screen.period}</p>

                        <div className="flex flex-wrap gap-x-8 gap-y-1 mt-3 text-sm">
                            {screen.summary.map(([label, value]) => (
                                <p key={label}><span className="text-gray-500">{label}: </span><span className="font-semibold text-gray-800">{value}</span></p>
                            ))}
                        </div>

                        {screen.rows.length === 0 ? (
                            <p className="text-center text-gray-600 py-10">Nothing to show for these filters.</p>
                        ) : (
                            <div className="overflow-x-auto mt-4">
                                <table className="w-full min-w-[640px] text-sm text-left">
                                    <thead>
                                        <tr className="text-gray-500 border-b border-gray-200">
                                            {screen.head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {screen.rows.map((row, i) => (
                                            <tr key={i} className="border-b border-gray-100">
                                                {row.map((cell, j) => <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {tab === "transactions" && (
                            <p className="text-xs text-gray-500 mt-3">Totals count only active entries. Reversed entries and their reversals are shown but not counted. Up to 5,000 rows are shown.</p>
                        )}
                    </>
                )}
            </div>
        </PageWrap>
    )
}

export default Reports