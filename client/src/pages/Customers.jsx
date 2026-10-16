import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { AnimatePresence, motion } from "motion/react"
import toast from "react-hot-toast"
import { MdAdd, MdFileDownload, MdFileUpload, MdSearch } from "react-icons/md"
import api from "../utils/api"
import { formatPaise, rupeesNumber } from "../utils/money"
import useDebounce from "../hooks/useDebounce"
import PageWrap from "../components/PageWrap"
import Modal from "../components/Modal"
import ConfirmDialog from "../components/ConfirmDialog"
import CustomerForm from "../components/CustomerForm"
import BalanceBadge from "../components/BalanceBadge"
import Pagination from "../components/Pagination"
import { btnOutline, btnPrimary, cardClass, inputClass, softCardClass, tabClass } from "../utils/styles"
import CustomerImport from "../components/CustomerImport"
import { downloadCsv } from "../utils/exportFile"

function Customers() {
    const { list, activeId, loading: businessLoading } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)
    const businessId = business?._id

    const [q, setQ] = useState("")
    const [type, setType] = useState("")
    const [balance, setBalance] = useState("")
    const [sort, setSort] = useState("name")
    const [status, setStatus] = useState("active")
    const [page, setPage] = useState(1)

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)

    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [confirmArchive, setConfirmArchive] = useState(null)
    const [busy, setBusy] = useState(false)
    const [showImport, setShowImport] = useState(false)

    const debouncedQ = useDebounce(q, 400)

    // Back to page 1 when the Khaata book changes
    useEffect(() => {
        setPage(1)
    }, [businessId])

    useEffect(() => {
        if (!businessId) return

        let ignore = false // ignore old answers that arrive late

        const run = async () => {
            setLoading(true)
            try {
                const result = await api.get(`/api/businesses/${businessId}/customers`, {
                    params: { q: debouncedQ, type, balance, sort, status, page, limit: 10 },
                })
                if (!ignore) setData(result.data)
            } catch (error) {
                if (!ignore) toast.error(error.response?.data?.message || "Could not load customers")
            } finally {
                if (!ignore) setLoading(false)
            }
        }
        run()

        return () => {
            ignore = true
        }
    }, [businessId, debouncedQ, type, balance, sort, status, page, reloadKey])

    const reload = () => setReloadKey((k) => k + 1)
    const exportCustomers = async () => {
        try {
            const result = await api.get(`/api/businesses/${businessId}/customers/export`)
            downloadCsv(`customers-${business.name}.csv`, [
                ["Name", "Phone", "Email", "Type", "Balance in Rs (+ they owe you, - you owe them)", "Address", "Notes"],
                ...result.data.customers.map((c) => [c.name, c.phone, c.email, c.type, rupeesNumber(c.balancePaise), c.address, c.notes]),
            ])
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not export customers")
        }
    }

    const closeForm = () => {
        setShowForm(false)
        setEditing(null)
    }

    const changeFilter = (setter) => (e) => {
        setter(e.target.value)
        setPage(1)
    }

    const clearFilters = () => {
        setQ("")
        setType("")
        setBalance("")
        setSort("name")
        setPage(1)
    }

    const runAction = async (customer, action, message) => {
        setBusy(true)
        try {
            await api.post(`/api/customers/${customer._id}/${action}`)
            toast.success(message)
            reload()
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    if (businessLoading) {
        return <div className={`${cardClass} h-32 animate-pulse`} />
    }

    if (!business) {
        return (
            <PageWrap>
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">Create a Khaata book first</p>
                    <p className="mt-1 mb-4 text-gray-600">Customers live inside a Khaata book.</p>
                    <Link to="/businesses" className={`${btnPrimary} inline-block`}>Go to Khaata Books</Link>
                </div>
            </PageWrap>
        )
    }

    const filtersUsed = q || type || balance || sort !== "name"

    return (
        <PageWrap>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-800">Customers</h1>
                    <p className="text-gray-500">in {business.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowImport(true)} className={`${btnOutline} flex items-center gap-1`}><MdFileUpload size={18} /> Import</button>
                    <button onClick={exportCustomers} className={`${btnOutline} flex items-center gap-1`}><MdFileDownload size={18} /> Export</button>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowForm(true)} className={`${btnPrimary} flex items-center gap-2`}>
                        <MdAdd size={20} /> Add customer
                    </motion.button>
                </div>
            </div>

            {/* Totals across all active customers */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-black text-white rounded-[24px] shadow-sm p-5">
                    <p className="text-sm">▲ You'll get</p>
                    <p className="text-2xl font-semibold">{formatPaise(data?.totals.toReceive || 0)}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${cardClass} p-5`}>
                    <p className="text-sm text-gray-600">▼ You'll give</p>
                    <p className="text-2xl font-semibold text-gray-800">{formatPaise(data?.totals.toPay || 0)}</p>
                </motion.div>
            </div>

            {/* Search and filters */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
                <div className="relative sm:col-span-2">
                    <MdSearch size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
                    <input
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1) }}
                        placeholder="Search by name or phone"
                        aria-label="Search customers"
                        className={`${inputClass} pl-10`}
                    />
                </div>
                <select value={type} onChange={changeFilter(setType)} aria-label="Filter by type" className={inputClass}>
                    <option value="">All types</option>
                    <option value="customer">Customers</option>
                    <option value="supplier">Suppliers</option>
                    <option value="both">Both</option>
                </select>
                <select value={balance} onChange={changeFilter(setBalance)} aria-label="Filter by balance" className={inputClass}>
                    <option value="">Any balance</option>
                    <option value="owes_me">They owe me</option>
                    <option value="i_owe">I owe them</option>
                    <option value="settled">Settled</option>
                </select>
                <select value={sort} onChange={changeFilter(setSort)} aria-label="Sort by" className={inputClass}>
                    <option value="name">Sort: Name</option>
                    <option value="balance">Sort: Highest balance</option>
                    <option value="recent">Sort: Recent activity</option>
                </select>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {["active", "archived"].map((s) => (
                    <button key={s} onClick={() => { setStatus(s); setPage(1) }} className={`${tabClass(status === s)} capitalize`}>
                        {s}
                    </button>
                ))}
                {filtersUsed && (
                    <button onClick={clearFilters} className="ml-auto text-sm text-gray-600 underline hover:text-black">Clear filters</button>
                )}
            </div>

            {/* List */}
            {loading && !data ? (
                <div className="grid gap-3">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className={`${softCardClass} h-20 animate-pulse`} />
                    ))}
                </div>
            ) : data && data.customers.length === 0 ? (
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">
                        {filtersUsed ? "No customers match your search" : status === "archived" ? "No archived customers" : "No customers yet"}
                    </p>
                    {filtersUsed ? (
                        <button onClick={clearFilters} className={`${btnOutline} mt-4`}>Clear filters</button>
                    ) : status === "active" ? (
                        <>
                            <p className="mt-1 mb-4 text-gray-600">Add your first customer to start tracking udhaar.</p>
                            <button onClick={() => setShowForm(true)} className={btnPrimary}>Add customer</button>
                        </>
                    ) : null}
                </div>
            ) : (
                <div className={`grid gap-3 ${loading ? "animate-pulse" : ""}`}>
                    {data?.customers.map((c, index) => (
                        <motion.div
                            key={c._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            whileHover={{ y: -2 }}
                            className={`${softCardClass} p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 hover:shadow-md transition-shadow`}
                        >
                            <Link to={`/customers/${c._id}`} className="min-w-0 block">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-semibold text-gray-800 truncate hover:underline">{c.name}</h3>
                                    <span className="bg-gray-100 text-gray-600 text-xs font-medium rounded-full px-2 py-0.5 capitalize">{c.type}</span>
                                </div>
                                <p className="text-sm text-gray-500">{c.phone || "No phone"}</p>
                            </Link>

                            <div className="flex flex-wrap items-center gap-3">
                                <BalanceBadge paise={c.balancePaise} />
                                <Link to={`/customers/${c._id}`} className={btnPrimary}>Open ledger</Link>
                                <button onClick={() => { setEditing(c); setShowForm(true) }} className={btnOutline}>Edit</button>
                                {status === "active" ? (
                                    <button onClick={() => setConfirmArchive(c)} className={btnOutline}>Archive</button>
                                ) : (
                                    <button disabled={busy} onClick={() => runAction(c, "restore", "Customer restored")} className={btnPrimary}>Restore</button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}

            <AnimatePresence>
                {showForm && (
                    <Modal title={editing ? "Edit customer" : "Add customer"} onClose={closeForm}>
                        <CustomerForm
                            business={business}
                            initial={editing}
                            onCancel={closeForm}
                            onSaved={() => {
                                closeForm()
                                reload()
                            }}
                        />
                    </Modal>
                )}
                {showImport && (
                    <CustomerImport business={business} onClose={() => setShowImport(false)} onDone={reload} />
                )}
                {confirmArchive && (
                    <ConfirmDialog
                        title="Archive customer?"
                        message={`"${confirmArchive.name}" will be hidden from your list. Their balance and records are kept, and you can restore them from the Archived tab.`}
                        confirmText="Archive"
                        busy={busy}
                        onCancel={() => setConfirmArchive(null)}
                        onConfirm={async () => {
                            await runAction(confirmArchive, "archive", "Customer archived")
                            setConfirmArchive(null)
                        }}
                    />
                )}
            </AnimatePresence>
        </PageWrap>
    )
}

export default Customers