import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { AnimatePresence } from "motion/react"
import toast from "react-hot-toast"
import { signOut } from "firebase/auth"
import { auth } from "../utils/firebase"
import api from "../utils/api"
import { loadBusinesses } from "../utils/loadBusinesses"
import { setUserData } from "../redux/userSlice"
import { clearBusinesses } from "../redux/businessSlice"
import useT from "../hooks/useT"
import PageWrap from "../components/PageWrap"
import Modal from "../components/Modal"
import { btnOutline, btnPrimary, cardClass, inputClass, labelClass } from "../utils/styles"

function Settings() {
    const t = useT()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { userData } = useSelector((state) => state.user)
    const { list, activeId } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)

    // Profile
    const [name, setName] = useState(userData.name)
    const [language, setLanguage] = useState(userData.language || "en")
    const [savingProfile, setSavingProfile] = useState(false)

    // Invoice settings
    const [gstin, setGstin] = useState("")
    const [upiId, setUpiId] = useState("")
    const [invoicePrefix, setInvoicePrefix] = useState("INV")
    const [invoiceTerms, setInvoiceTerms] = useState("")
    const [savingInvoice, setSavingInvoice] = useState(false)

    // Danger zone
    const [archived, setArchived] = useState([])
    const [deleting, setDeleting] = useState(null)
    const [typed, setTyped] = useState("")
    const [showAccountDelete, setShowAccountDelete] = useState(false)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!business) return
        setGstin(business.gstin || "")
        setUpiId(business.upiId || "")
        setInvoicePrefix(business.invoicePrefix || "INV")
        setInvoiceTerms(business.invoiceTerms || "")
    }, [business?._id]) // eslint-disable-line react-hooks/exhaustive-deps

    const loadArchived = async () => {
        try {
            const result = await api.get("/api/businesses", { params: { status: "archived" } })
            setArchived(result.data)
        } catch (error) {
            toast.error("Could not load archived Khaata books")
        }
    }

    useEffect(() => {
        loadArchived()
    }, [])

    const saveProfile = async (e) => {
        e.preventDefault()
        if (savingProfile) return
        setSavingProfile(true)
        try {
            const result = await api.patch("/api/user/me", { name, language })
            dispatch(setUserData(result.data))
            toast.success("Profile saved")
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not save")
        } finally {
            setSavingProfile(false)
        }
    }

    const saveInvoice = async (e) => {
        e.preventDefault()
        if (savingInvoice || !business) return
        setSavingInvoice(true)
        try {
            await api.patch(`/api/businesses/${business._id}/invoice-settings`, { gstin, upiId, invoicePrefix, invoiceTerms })
            await loadBusinesses(dispatch)
            toast.success("Settings saved")
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not save")
        } finally {
            setSavingInvoice(false)
        }
    }

    const exportData = async () => {
        try {
            const result = await api.get("/api/user/export")
            const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = "your-Khaata-export.json"
            link.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not export your data")
        }
    }

    const deleteBusiness = async () => {
        setBusy(true)
        try {
            await api.delete(`/api/businesses/${deleting._id}`, { data: { confirmName: typed } })
            toast.success("Khaata book deleted")
            setDeleting(null)
            setTyped("")
            await loadArchived()
            await loadBusinesses(dispatch)
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not delete")
        } finally {
            setBusy(false)
        }
    }

    const deleteAccount = async () => {
        setBusy(true)
        try {
            await api.delete("/api/user/me", { data: { confirm: typed } })
            await signOut(auth)
            dispatch(clearBusinesses())
            dispatch(setUserData(null))
            navigate("/auth")
            toast.success("Your data was deleted")
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not delete your account")
        } finally {
            setBusy(false)
        }
    }

    return (
        <PageWrap>
            <h1 className="text-3xl font-semibold text-gray-800 mb-6">{t("settings")}</h1>

            <form onSubmit={saveProfile} className={`${cardClass} p-5 sm:p-6 mb-4`}>
                <p className="font-semibold text-gray-800 mb-4">Your profile</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="s-name" className={labelClass}>Your name</label>
                        <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="s-lang" className={labelClass}>Language (menu and headings)</label>
                        <select id="s-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
                            <option value="en">English</option>
                            <option value="hi">हिन्दी (Hindi)</option>
                        </select>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-3">Login: {userData.email || userData.phone}</p>
                <button type="submit" disabled={savingProfile} className={`${btnPrimary} mt-4`}>{savingProfile ? "Saving..." : "Save profile"}</button>
            </form>

            {business && (
                <form onSubmit={saveInvoice} className={`${cardClass} p-5 sm:p-6 mb-4`}>
                    <p className="font-semibold text-gray-800">Billing settings for "{business.name}"</p>
                    <p className="text-sm text-gray-500 mb-4">Used on invoices and in payment reminders. This is software, not tax advice. Please check GST rules with your accountant.</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="s-gstin" className={labelClass}>Your GSTIN (for GST invoices)</label>
                            <input id="s-gstin" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="s-upi" className={labelClass}>UPI ID (shown on invoices and reminders)</label>
                            <input id="s-upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="shop@upi" className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="s-prefix" className={labelClass}>Invoice number prefix</label>
                            <input id="s-prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())} maxLength={10} className={inputClass} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label htmlFor="s-terms" className={labelClass}>Terms shown on invoices</label>
                        <textarea id="s-terms" value={invoiceTerms} onChange={(e) => setInvoiceTerms(e.target.value)} maxLength={500} rows={2} className={inputClass} />
                    </div>
                    <button type="submit" disabled={savingInvoice} className={`${btnPrimary} mt-4`}>{savingInvoice ? "Saving..." : "Save billing settings"}</button>
                </form>
            )}

            <div className={`${cardClass} p-5 sm:p-6 mb-4`}>
                <p className="font-semibold text-gray-800">Your data</p>
                <p className="text-sm text-gray-500 mb-4">Download everything you have saved (customers, entries, invoices, stock) as one file. Amounts are in paise.</p>
                <button onClick={exportData} className={btnOutline}>Download my data</button>
            </div>

            <div className={`${cardClass} p-5 sm:p-6`}>
                <p className="font-semibold text-gray-800">Delete data</p>
                <p className="text-sm text-gray-500 mb-4">Deleting cannot be undone. Download your data first.</p>

                <p className="text-sm font-medium text-gray-700 mb-2">Archived Khaata books</p>
                {archived.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-4">None. Archive a Khaata book first if you want to delete it for good.</p>
                ) : (
                    <ul className="mb-4 divide-y divide-gray-100">
                        {archived.map((b) => (
                            <li key={b._id} className="flex items-center justify-between gap-3 py-2">
                                <span className="text-sm text-gray-800">{b.name}</span>
                                <button onClick={() => { setDeleting(b); setTyped("") }} className={btnOutline}>Delete forever</button>
                            </li>
                        ))}
                    </ul>
                )}

                <button onClick={() => { setShowAccountDelete(true); setTyped("") }} className={btnOutline}>Delete my account data</button>
            </div>

            <AnimatePresence>
                {deleting && (
                    <Modal title="Delete this Khaata book forever?" onClose={() => setDeleting(null)}>
                        <p className="text-sm text-gray-600 mb-3">All its customers, entries, invoices, reminders and stock will be erased. Type <b>{deleting.name}</b> to confirm.</p>
                        <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the Khaata book name" className={`${inputClass} mb-5`} />
                        <div className="flex flex-wrap gap-3 justify-end">
                            <button onClick={() => setDeleting(null)} disabled={busy} className={btnOutline}>Cancel</button>
                            <button onClick={deleteBusiness} disabled={busy || typed !== deleting.name} className={btnPrimary}>Delete forever</button>
                        </div>
                    </Modal>
                )}
                {showAccountDelete && (
                    <Modal title="Delete all your data?" onClose={() => setShowAccountDelete(false)}>
                        <p className="text-sm text-gray-600 mb-3">Every Khaata book, customer, entry, invoice and product is erased and you are logged out. Your login (Google, email or phone) is not removed, so signing in again starts a fresh empty account. Type <b>DELETE</b> to confirm.</p>
                        <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type DELETE" className={`${inputClass} mb-5`} />
                        <div className="flex flex-wrap gap-3 justify-end">
                            <button onClick={() => setShowAccountDelete(false)} disabled={busy} className={btnOutline}>Cancel</button>
                            <button onClick={deleteAccount} disabled={busy || typed !== "DELETE"} className={btnPrimary}>Delete everything</button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </PageWrap>
    )
}

export default Settings