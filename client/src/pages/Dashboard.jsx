import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { motion } from "motion/react"
import toast from "react-hot-toast"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import api from "../utils/api"
import { formatPaise } from "../utils/money"
import { formatDate, presetRange } from "../utils/dates"
import { KIND_LABELS } from "../utils/labels"
import { btnPrimary, cardClass, softCardClass } from "../utils/styles"
import PageWrap from "../components/PageWrap"
import DateRangeFilter from "../components/DateRangeFilter"

function Stat({ label, value, dark = false, index = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -3 }}
            className={dark ? "bg-black text-white rounded-[24px] shadow-sm p-5" : `${cardClass} p-5`}
        >
            <p className={`text-sm ${dark ? "text-gray-300" : "text-gray-500"}`}>{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
        </motion.div>
    )
}

function Dashboard() {
    const { userData } = useSelector((state) => state.user)
    const { list, activeId, loading: businessLoading } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)
    const businessId = business?._id

    const [range, setRange] = useState({ preset: "month", ...presetRange("month") })
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!businessId) return
        if (!range.from || !range.to) return

        let ignore = false
        const run = async () => {
            setLoading(true)
            try {
                const result = await api.get(`/api/businesses/${businessId}/dashboard`, {
                    params: { from: range.from, to: range.to },
                })
                if (!ignore) setData(result.data)
            } catch (error) {
                if (!ignore) toast.error(error.response?.data?.message || "Could not load the dashboard")
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        run()

        return () => {
            ignore = true
        }
    }, [businessId, range])

    if (businessLoading) {
        return <div className={`${cardClass} h-32 animate-pulse`} />
    }

    if (!business) {
        return (
            <PageWrap>
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">Welcome, {userData.name}</p>
                    <p className="mt-1 mb-4 text-gray-600">Create your first Khaata book to begin.</p>
                    <Link to="/businesses" className={`${btnPrimary} inline-block`}>Create a Khaata book</Link>
                </div>
            </PageWrap>
        )
    }

    const chart = (data?.chart || []).map((row) => ({
        label: row.label,
        creditGiven: row.creditGiven / 100,
        paymentsReceived: row.paymentsReceived / 100,
    }))

    return (
        <PageWrap>
            <div className="mb-5">
                <h1 className="text-3xl font-semibold text-gray-800">Dashboard</h1>
                <p className="text-gray-500">{business.name}</p>
            </div>

            {/* Right now (not affected by the date filter) */}
            <p className="text-sm font-medium text-gray-500 mb-2">Right now</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <Stat dark label="▲ You'll get" value={formatPaise(data?.snapshot.toReceive || 0)} />
                <Stat label="▼ You'll give" value={formatPaise(data?.snapshot.toPay || 0)} index={1} />
                <Stat label="Customers" value={data?.snapshot.customers ?? 0} index={2} />
            </div>

            {/* Selected period */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-gray-500">Selected period</p>
            </div>
            <div className="mb-4">
                <DateRangeFilter value={range} onChange={setRange} />
            </div>

            <div className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ${loading ? "animate-pulse" : ""}`}>
                <Stat label="Credit given" value={formatPaise(data?.period.creditGiven || 0)} />
                <Stat label="Payments received" value={formatPaise(data?.period.paymentsReceived || 0)} index={1} />
                <Stat label="Payments made" value={formatPaise(data?.period.paymentsMade || 0)} index={2} />
                <Stat label="Net cash flow" value={formatPaise(data?.period.netCashFlow || 0)} index={3} />
            </div>

            {/* Chart */}
            <div className={`${cardClass} p-5 mb-6`}>
                <p className="font-semibold text-gray-800 mb-4">Credit given vs payments received</p>
                {chart.length === 0 ? (
                    <p className="text-gray-500 text-sm py-10 text-center">No entries in this period yet.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} width={60} />
                            <Tooltip formatter={(v) => formatPaise(Math.round(v * 100))} />
                            <Legend />
                            <Bar dataKey="creditGiven" name="Credit given" fill="#000000" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="paymentsReceived" name="Payments received" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-6">
                {/* Recent entries */}
                <div className={`${cardClass} p-5`}>
                    <p className="font-semibold text-gray-800 mb-3">Recent entries</p>
                    {!data || data.recent.length === 0 ? (
                        <p className="text-sm text-gray-500">Nothing yet. Open a customer's ledger to add an entry.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {data.recent.map((t) => (
                                <li key={t._id}>
                                    <Link to={`/customers/${t.customerId}`} className="flex justify-between gap-3 py-2 text-sm hover:bg-gray-50 rounded-lg px-2">
                                        <span>
                                            <span className="font-medium text-gray-800">{t.customerName}</span>
                                            <span className="block text-xs text-gray-500">
                                                {KIND_LABELS[t.kind]} • {formatDate(t.occurredAt)}
                                                {t.status === "reversed" ? " • reversed" : ""}
                                            </span>
                                        </span>
                                        <span className="font-medium text-gray-800 whitespace-nowrap">
                                            {t.effect === 1 ? "You gave" : "You got"} {formatPaise(t.amountPaise)}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="grid gap-4 content-start">
                    {/* Overdue */}
                    <div className={`${cardClass} p-5`}>
                        <p className="font-semibold text-gray-800 mb-3">Overdue customers</p>
                        {!data || data.overdue.length === 0 ? (
                            <p className="text-sm text-gray-500">No overdue balances.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {data.overdue.map((c) => (
                                    <li key={c._id}>
                                        <Link to={`/customers/${c._id}`} className="flex justify-between gap-3 py-2 text-sm hover:bg-gray-50 rounded-lg px-2">
                                            <span className="font-medium text-gray-800">{c.name}</span>
                                            <span className="font-medium text-gray-800">{formatPaise(c.balancePaise)}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Upcoming reminders */}
                    <div className={`${cardClass} p-5`}>
                        <p className="font-semibold text-gray-800 mb-3">Upcoming reminders</p>
                        {!data || data.upcoming.length === 0 ? (
                            <p className="text-sm text-gray-500">No pending reminders.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {data.upcoming.map((r) => (
                                    <li key={r._id} className="flex justify-between gap-3 py-2 text-sm px-2">
                                        <span>
                                            <span className="font-medium text-gray-800">{r.customerName}</span>
                                            <span className="block text-xs text-gray-500">{formatDate(r.remindAt)}</span>
                                        </span>
                                        <span className="font-medium text-gray-800">{formatPaise(r.amountPaise)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Link to="/reminders" className="inline-block mt-3 text-sm underline text-gray-600 hover:text-black">All reminders</Link>
                    </div>
                </div>
            </div>

            <details className={`${softCardClass} p-4 text-sm text-gray-600`}>
                <summary className="cursor-pointer font-medium text-gray-800">How these numbers are calculated</summary>
                <ul className="list-disc pl-5 mt-3 space-y-1">
                    <li><b>You'll get</b>: sum of all customer balances above zero, right now.</li>
                    <li><b>You'll give</b>: sum of all balances below zero (money you owe suppliers, plus customer advances).</li>
                    <li><b>Credit given</b>: udhaar entries in the period. It is not money received.</li>
                    <li><b>Payments received / made</b>: payment entries in the period.</li>
                    <li><b>Net cash flow</b>: payments received minus payments made. Credit is not cash, so it is not counted.</li>
                    <li><b>Overdue</b>: customers who still owe money and have a credit entry whose due date has passed.</li>
                    <li>Reversed entries and their reversal entries are never counted in the totals.</li>
                </ul>
            </details>
        </PageWrap>
    )
}

export default Dashboard