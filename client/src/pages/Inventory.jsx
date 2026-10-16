import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { AnimatePresence, motion } from "motion/react"
import toast from "react-hot-toast"
import { MdAdd, MdFileDownload, MdSearch } from "react-icons/md"
import api from "../utils/api"
import { formatPaise, rupeesNumber } from "../utils/money"
import { formatDateTime } from "../utils/dates"
import { formatQty } from "../utils/invoiceMath"
import { downloadCsv } from "../utils/exportFile"
import useDebounce from "../hooks/useDebounce"
import useT from "../hooks/useT"
import PageWrap from "../components/PageWrap"
import Modal from "../components/Modal"
import Pagination from "../components/Pagination"
import ProductForm from "../components/ProductForm"
import StockForm from "../components/StockForm"
import { btnOutline, btnPrimary, cardClass, inputClass, softCardClass, tabClass } from "../utils/styles"

const MOVEMENT_LABELS = {
    opening: "Opening stock",
    purchase: "Purchased",
    sale: "Sold",
    return: "Customer return",
    damage: "Damaged / lost",
    adjustment: "Correction",
    cancel_restore: "Invoice cancelled",
}

function stockText(p) {
    if (!p.trackStock) return "Service"
    return `${formatQty(p.stockMilli)} ${p.unit}`
}

function Inventory() {
    const t = useT()
    const { list, activeId, loading: businessLoading } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)
    const businessId = business?._id

    const [q, setQ] = useState("")
    const [category, setCategory] = useState("")
    const [stock, setStock] = useState("")
    const [status, setStatus] = useState("active")
    const [page, setPage] = useState(1)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)

    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [stockFor, setStockFor] = useState(null)
    const [history, setHistory] = useState(null)

    const debouncedQ = useDebounce(q, 400)
    const reload = () => setReloadKey((k) => k + 1)

    useEffect(() => {
        if (!businessId) return
        let ignore = false
        const run = async () => {
            setLoading(true)
            try {
                const result = await api.get(`/api/businesses/${businessId}/products`, {
                    params: { q: debouncedQ, category, stock, status, page, limit: 15 },
                })
                if (!ignore) setData(result.data)
            } catch (error) {
                if (!ignore) toast.error(error.response?.data?.message || "Could not load products")
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        run()
        return () => {
            ignore = true
        }
    }, [businessId, debouncedQ, category, stock, status, page, reloadKey])

    const exportCsv = async () => {
        try {
            const result = await api.get(`/api/businesses/${businessId}/products`, { params: { q: debouncedQ, category, stock, status, export: 1 } })
            downloadCsv(stock === "low" ? "low-stock-report.csv" : "stock-report.csv", [
                ["Name", "Code", "Category", "Unit", "In stock", "Low-stock level", "Buying price (Rs)", "Selling price (Rs)", "Stock value (Rs)"],
                ...result.data.products.map((p) => [
                    p.name, p.sku, p.category, p.unit,
                    p.trackStock ? Number(formatQty(p.stockMilli)) : "Service",
                    p.lowStockMilli ? Number(formatQty(p.lowStockMilli)) : "",
                    rupeesNumber(p.purchasePricePaise), rupeesNumber(p.sellingPricePaise),
                    p.trackStock ? rupeesNumber(Math.round((Math.max(p.stockMilli, 0) * p.purchasePricePaise) / 1000)) : "",
                ]),
            ])
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not export")
        }
    }

    const openHistory = async (product) => {
        try {
            const result = await api.get(`/api/products/${product._id}/movements`)
            setHistory(result.data)
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not load the history")
        }
    }

    const closeForm = () => {
        setShowForm(false)
        setEditing(null)
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

    const s = data?.summary
    const filtersUsed = q || category || stock

    return (
        <PageWrap>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-800">{t("inventory")}</h1>
                    <p className="text-gray-500">{business.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={exportCsv} className={`${btnOutline} flex items-center gap-1`}><MdFileDownload size={18} /> Export CSV</button>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowForm(true)} className={`${btnPrimary} flex items-center gap-2`}>
                        <MdAdd size={20} /> {t("addProduct")}
                    </motion.button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    ["Products", s?.items ?? 0],
                    ["Low stock", s?.low ?? 0],
                    ["Out of stock", s?.out ?? 0],
                    ["Stock value (at buying price)", formatPaise(s?.stockValuePaise ?? 0)],
                ].map(([label, value], i) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`${cardClass} p-4`}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-xl font-semibold text-gray-800 mt-1">{value}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 mb-4">
                <div className="relative">
                    <MdSearch size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
                    <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search name or code" aria-label="Search products" className={`${inputClass} pl-10`} />
                </div>
                <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} aria-label="Filter by category" className={inputClass}>
                    <option value="">All categories</option>
                    {data?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={stock} onChange={(e) => { setStock(e.target.value); setPage(1) }} aria-label="Filter by stock" className={inputClass}>
                    <option value="">Any stock level</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                </select>
            </div>

            <div className="flex gap-2 mb-4">
                {["active", "inactive"].map((x) => (
                    <button key={x} onClick={() => { setStatus(x); setPage(1) }} className={`${tabClass(status === x)} capitalize`}>{x}</button>
                ))}
            </div>

            {loading && !data ? (
                <div className="grid gap-3">{[1, 2, 3].map((n) => <div key={n} className={`${softCardClass} h-20 animate-pulse`} />)}</div>
            ) : data && data.products.length === 0 ? (
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">{filtersUsed ? "No products match your filters" : "No products yet"}</p>
                    {!filtersUsed && status === "active" && (
                        <>
                            <p className="mt-1 mb-4 text-gray-600">Add the things you sell to track stock and bill faster.</p>
                            <button onClick={() => setShowForm(true)} className={btnPrimary}>{t("addProduct")}</button>
                        </>
                    )}
                </div>
            ) : (
                <div className={`grid gap-3 ${loading ? "animate-pulse" : ""}`}>
                    {data?.products.map((p, index) => {
                        const out = p.trackStock && p.stockMilli <= 0
                        const low = p.trackStock && !out && p.lowStockMilli > 0 && p.stockMilli <= p.lowStockMilli
                        return (
                            <motion.div key={p._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className={`${softCardClass} p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-gray-800">{p.name}</h3>
                                        {out && <span className="bg-black text-white text-xs font-medium rounded-full px-2 py-0.5">Out of stock</span>}
                                        {low && <span className="bg-white border border-black text-xs font-medium rounded-full px-2 py-0.5">Low stock</span>}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {[p.sku, p.category].filter(Boolean).join(" • ") || "No code or category"} • Sells at {formatPaise(p.sellingPricePaise)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-gray-800 mr-2">{stockText(p)}</span>
                                    {p.trackStock && <button onClick={() => setStockFor(p)} className={btnPrimary}>Update stock</button>}
                                    {p.trackStock && <button onClick={() => openHistory(p)} className={btnOutline}>History</button>}
                                    <button onClick={() => { setEditing(p); setShowForm(true) }} className={btnOutline}>Edit</button>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}

            <AnimatePresence>
                {showForm && (
                    <Modal title={editing ? "Edit product" : "Add product"} onClose={closeForm} wide>
                        <ProductForm business={business} initial={editing} onCancel={closeForm} onSaved={() => { closeForm(); reload() }} />
                    </Modal>
                )}
                {stockFor && (
                    <Modal title={`Update stock: ${stockFor.name}`} onClose={() => setStockFor(null)}>
                        <p className="text-sm text-gray-600 mb-4">Now in stock: <b>{stockText(stockFor)}</b></p>
                        <StockForm product={stockFor} onCancel={() => setStockFor(null)} onSaved={() => { setStockFor(null); reload() }} />
                    </Modal>
                )}
                {history && (
                    <Modal title={`Stock history: ${history.product.name}`} onClose={() => setHistory(null)} wide>
                        {history.movements.length === 0 ? (
                            <p className="text-sm text-gray-600">No stock changes yet.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 text-sm max-h-96 overflow-y-auto">
                                {history.movements.map((m) => (
                                    <li key={m._id} className="flex justify-between gap-3 py-2">
                                        <span>
                                            <span className="font-medium text-gray-800">{MOVEMENT_LABELS[m.type]}</span>
                                            <span className="block text-xs text-gray-500">{formatDateTime(m.createdAt)}{m.reason ? ` • ${m.reason}` : ""}</span>
                                        </span>
                                        <span className="text-right">
                                            <span className="font-medium text-gray-800">{m.quantityMilli > 0 ? "+" : ""}{formatQty(m.quantityMilli)}</span>
                                            <span className="block text-xs text-gray-500">Stock: {formatQty(m.balanceAfterMilli)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </PageWrap>
    )
}

export default Inventory