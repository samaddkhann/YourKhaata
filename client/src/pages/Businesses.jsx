import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { AnimatePresence, motion } from "motion/react"
import toast from "react-hot-toast"
import { MdAdd } from "react-icons/md"
import api from "../utils/api"
import { loadBusinesses } from "../utils/loadBusinesses"
import { setActiveBusiness } from "../redux/businessSlice"
import PageWrap from "../components/PageWrap"
import Modal from "../components/Modal"
import ConfirmDialog from "../components/ConfirmDialog"
import BusinessForm from "../components/BusinessForm"
import { btnOutline, btnPrimary, cardClass, softCardClass, tabClass } from "../utils/styles"

const TYPE_LABELS = {
    grocery: "Grocery store",
    clothing: "Clothing store",
    wholesale: "Wholesale",
    personal: "Personal ledger",
    other: "Other",
}

function Businesses() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { activeId } = useSelector((state) => state.business)

    const [tab, setTab] = useState("active")
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [confirmArchive, setConfirmArchive] = useState(null)
    const [busy, setBusy] = useState(false)

    const fetchTab = async () => {
        try {
            const result = await api.get("/api/businesses", { params: { status: tab } })
            setItems(result.data)
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not load Khaata books")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setLoading(true)
        fetchTab()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab])

    // Refresh this page AND the selector at the top
    const refreshAll = async () => {
        try {
            await Promise.all([fetchTab(), loadBusinesses(dispatch)])
        } catch (error) {
            toast.error("Could not refresh the list")
        }
    }

    const runAction = async (path, message) => {
        setBusy(true)
        try {
            await api.post(path)
            toast.success(message)
            await refreshAll()
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    const openCustomers = (business) => {
        dispatch(setActiveBusiness(business._id))
        navigate("/customers")
    }

    const closeForm = () => {
        setShowForm(false)
        setEditing(null)
    }

    return (
        <PageWrap>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-800">Khaata Books</h1>
                    <p className="text-gray-500">Keep a separate ledger for each shop or purpose.</p>
                </div>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowForm(true)} className={`${btnPrimary} flex items-center gap-2`}>
                    <MdAdd size={20} /> New Khaata Book
                </motion.button>
            </div>

            <div className="flex gap-2 mb-6">
                {["active", "archived"].map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={`${tabClass(tab === t)} capitalize`}>
                        {t}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="grid gap-4">
                    {[1, 2].map((n) => (
                        <div key={n} className={`${softCardClass} h-28 animate-pulse`} />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">
                        {tab === "active" ? "No Khaata books yet" : "No archived Khaata books"}
                    </p>
                    {tab === "active" && (
                        <>
                            <p className="mt-1 mb-4 text-gray-600">Create your first one to start adding customers.</p>
                            <button onClick={() => setShowForm(true)} className={btnPrimary}>Create a Khaata book</button>
                        </>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {items.map((b, index) => (
                        <motion.div
                            key={b._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.06 }}
                            whileHover={{ y: -3 }}
                            className={`${cardClass} p-5 hover:shadow-md transition-shadow`}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-xl font-semibold text-gray-800">{b.name}</h3>
                                        {b.isDefault && (
                                            <span className="bg-black text-white text-xs font-medium px-2 py-1 rounded-full">Default</span>
                                        )}
                                        {b._id === activeId && (
                                            <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">Selected</span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-gray-600">{TYPE_LABELS[b.type] || "Other"}</p>
                                    {(b.ownerName || b.phone) && (
                                        <p className="text-sm text-gray-500">{[b.ownerName, b.phone].filter(Boolean).join(" • ")}</p>
                                    )}
                                    {b.address && <p className="text-sm text-gray-500">{b.address}</p>}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {tab === "active" ? (
                                        <>
                                            <button onClick={() => openCustomers(b)} className={btnPrimary}>Open</button>
                                            <button onClick={() => { setEditing(b); setShowForm(true) }} className={btnOutline}>Edit</button>
                                            {!b.isDefault && (
                                                <button disabled={busy} onClick={() => runAction(`/api/businesses/${b._id}/default`, "Default Khaata book updated")} className={btnOutline}>
                                                    Make default
                                                </button>
                                            )}
                                            <button onClick={() => setConfirmArchive(b)} className={btnOutline}>Archive</button>
                                        </>
                                    ) : (
                                        <button disabled={busy} onClick={() => runAction(`/api/businesses/${b._id}/restore`, "Khaata book restored")} className={btnPrimary}>
                                            Restore
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {showForm && (
                    <Modal title={editing ? "Edit Khaata book" : "New Khaata book"} onClose={closeForm}>
                        <BusinessForm
                            initial={editing}
                            onCancel={closeForm}
                            onSaved={() => {
                                closeForm()
                                refreshAll()
                            }}
                        />
                    </Modal>
                )}
                {confirmArchive && (
                    <ConfirmDialog
                        title="Archive Khaata book?"
                        message={`"${confirmArchive.name}" will be hidden from your list. Nothing is deleted and you can restore it any time from the Archived tab.`}
                        confirmText="Archive"
                        busy={busy}
                        onCancel={() => setConfirmArchive(null)}
                        onConfirm={async () => {
                            await runAction(`/api/businesses/${confirmArchive._id}/archive`, "Khaata book archived")
                            setConfirmArchive(null)
                        }}
                    />
                )}
            </AnimatePresence>
        </PageWrap>
    )
}

export default Businesses