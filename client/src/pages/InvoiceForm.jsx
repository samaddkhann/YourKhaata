import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import toast from "react-hot-toast"
import { MdAdd, MdDelete } from "react-icons/md"
import api from "../utils/api"
import { formatPaise, rupeesToPaise } from "../utils/money"
import { todayIst, toIstDate } from "../utils/dates"
import { GST_RATES, calcLine, formatQty, parseQtyMilli, sumTotals } from "../utils/invoiceMath"
import { setActiveBusiness } from "../redux/businessSlice"
import PageWrap from "../components/PageWrap"
import CustomerPicker from "../components/CustomerPicker"
import { btnOutline, btnPrimary, cardClass, inputClass, labelClass } from "../utils/styles"

const emptyLine = () => ({ key: crypto.randomUUID(), productId: "", name: "", qty: "1", unit: "pcs", rate: "", discount: "", taxRate: "18", hsn: "" })

function InvoiceForm() {
    const { invoiceId } = useParams()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { list, activeId } = useSelector((state) => state.business)
    const business = list.find((b) => b._id === activeId)

    const [type, setType] = useState("non_gst")
    const [customer, setCustomer] = useState(null)
    const [issueDate, setIssueDate] = useState(todayIst())
    const [dueDate, setDueDate] = useState("")
    const [interstate, setInterstate] = useState(false)
    const [placeOfSupply, setPlaceOfSupply] = useState("")
    const [buyerGstin, setBuyerGstin] = useState("")
    const [notes, setNotes] = useState("")
    const [lines, setLines] = useState([emptyLine()])
    const [products, setProducts] = useState([])
    const [busy, setBusy] = useState(false)
    const [loadingDraft, setLoadingDraft] = useState(!!invoiceId)
    const keyRef = useRef(crypto.randomUUID())

    // Products for the item picker
    useEffect(() => {
        if (!business) return
        const load = async () => {
            try {
                const result = await api.get(`/api/businesses/${business._id}/products`, { params: { limit: 100 } })
                setProducts(result.data.products)
            } catch (error) {
                // custom items still work without the list
            }
        }
        load()
    }, [business?._id]) // eslint-disable-line react-hooks/exhaustive-deps

    // Editing a draft: load it
    useEffect(() => {
        if (!invoiceId) return
        const load = async () => {
            try {
                const result = await api.get(`/api/invoices/${invoiceId}`)
                const inv = result.data.invoice
                if (inv.status !== "draft") {
                    toast.error("Only drafts can be edited")
                    navigate(`/invoices/${invoiceId}`)
                    return
                }
                dispatch(setActiveBusiness(inv.businessId))
                setType(inv.type)
                setCustomer(result.data.customer)
                setIssueDate(toIstDate(inv.issueDate))
                setDueDate(inv.dueDate ? toIstDate(inv.dueDate) : "")
                setInterstate(inv.interstate)
                setPlaceOfSupply(inv.placeOfSupply)
                setBuyerGstin(inv.buyerGstin)
                setNotes(inv.notes)
                setLines(inv.lines.map((l) => ({
                    key: crypto.randomUUID(),
                    productId: l.productId || "",
                    name: l.name,
                    qty: formatQty(l.qtyMilli),
                    unit: l.unit,
                    rate: (l.ratePaise / 100).toFixed(2),
                    discount: l.discountPaise ? (l.discountPaise / 100).toFixed(2) : "",
                    taxRate: String(l.taxRatePercent),
                    hsn: l.hsn,
                })))
            } catch (error) {
                toast.error(error.response?.data?.message || "Could not load the draft")
                navigate("/invoices")
            } finally {
                setLoadingDraft(false)
            }
        }
        load()
    }, [invoiceId]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!business || loadingDraft) {
        return business === undefined && !loadingDraft ? (
            <PageWrap>
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">Create a Khaata book first</p>
                    <Link to="/businesses" className={`${btnPrimary} inline-block mt-4`}>Go to Khaata Books</Link>
                </div>
            </PageWrap>
        ) : <div className={`${cardClass} h-32 animate-pulse`} />
    }

    const gst = type === "gst"

    const updateLine = (key, patch) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)))
    const removeLine = (key) => setLines((all) => (all.length > 1 ? all.filter((l) => l.key !== key) : all))

    const pickProduct = (key, productId) => {
        const p = products.find((x) => x._id === productId)
        if (!p) return updateLine(key, { productId: "" })
        updateLine(key, {
            productId: p._id,
            name: p.name,
            unit: p.unit,
            rate: p.sellingPricePaise ? (p.sellingPricePaise / 100).toFixed(2) : "",
        })
    }

    // Live preview only. The server recalculates everything when you save.
    const preview = lines.map((l) => {
        const qtyMilli = parseQtyMilli(l.qty)
        const ratePaise = rupeesToPaise(l.rate)
        const discountPaise = l.discount.trim() === "" ? 0 : rupeesToPaise(l.discount)
        if (!qtyMilli || ratePaise === null || discountPaise === null) return null
        const calc = calcLine({ qtyMilli, ratePaise, discountPaise, taxRatePercent: gst ? Number(l.taxRate) : 0 }, { gst, interstate })
        return discountPaise > calc.grossPaise ? null : calc
    })
    const totals = sumTotals(preview.filter(Boolean))

    const submit = async (finalize) => {
        if (busy) return
        if (!customer) {
            toast.error("Choose a customer")
            return
        }

        const payload = { customerId: customer._id, type, issueDate, dueDate, interstate, placeOfSupply, buyerGstin, notes, lines }
        setBusy(true)
        try {
            let id = invoiceId
            if (invoiceId) {
                await api.patch(`/api/invoices/${invoiceId}`, payload)
                if (finalize) await api.post(`/api/invoices/${invoiceId}/finalize`)
            } else {
                const result = await api.post(`/api/businesses/${business._id}/invoices`, {
                    ...payload, finalize, idempotencyKey: keyRef.current,
                })
                id = result.data._id
            }
            toast.success(finalize ? "Invoice created" : "Draft saved")
            navigate(`/invoices/${id}`)
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not save the invoice")
        } finally {
            setBusy(false)
        }
    }

    return (
        <PageWrap>
            <h1 className="text-3xl font-semibold text-gray-800 mb-6">{invoiceId ? "Edit draft invoice" : "New invoice"}</h1>

            <div className={`${cardClass} p-5 sm:p-6 mb-4`}>
                <div className="flex flex-wrap gap-2 mb-4">
                    {[["non_gst", "Normal bill"], ["gst", "GST invoice"]].map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setType(value)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${type === value ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {gst && !business.gstin && (
                    <p className="mb-4 text-sm bg-gray-100 rounded-lg p-3 text-gray-700">
                        Add your GSTIN in <Link to="/settings" className="underline">Settings</Link> before issuing a GST invoice.
                    </p>
                )}

                <label className={labelClass}>Customer *</label>
                <CustomerPicker business={business} value={customer} onChange={setCustomer} />

                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label htmlFor="i-date" className={labelClass}>Invoice date</label>
                        <input id="i-date" type="date" value={issueDate} max={todayIst()} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="i-due" className={labelClass}>Due date (optional)</label>
                        <input id="i-due" type="date" value={dueDate} min={issueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                    </div>
                </div>

                {gst && (
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label htmlFor="i-gstin" className={labelClass}>Buyer GSTIN (if any)</label>
                            <input id="i-gstin" value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())} maxLength={15} className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="i-pos" className={labelClass}>Place of supply</label>
                            <input id="i-pos" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} maxLength={60} placeholder="e.g. Delhi" className={inputClass} />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                            <input type="checkbox" checked={interstate} onChange={(e) => setInterstate(e.target.checked)} className="w-4 h-4 accent-black" />
                            Sale to another state (uses IGST instead of CGST + SGST)
                        </label>
                    </div>
                )}
            </div>

            <div className={`${cardClass} p-5 sm:p-6 mb-4`}>
                <p className="font-semibold text-gray-800 mb-3">Items</p>
                <div className="grid gap-4">
                    {lines.map((l, i) => (
                        <div key={l.key} className="border border-gray-200 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Item {i + 1}</span>
                                <button type="button" onClick={() => removeLine(l.key)} disabled={lines.length === 1} aria-label={`Remove item ${i + 1}`} className="p-1 rounded-full hover:bg-gray-100 disabled:text-gray-300">
                                    <MdDelete size={18} />
                                </button>
                            </div>

                            {products.length > 0 && (
                                <select value={l.productId} onChange={(e) => pickProduct(l.key, e.target.value)} aria-label="Pick a product" className={`${inputClass} mb-2`}>
                                    <option value="">Custom item (type below)</option>
                                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                                </select>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                <input value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} placeholder="Item name" aria-label="Item name" maxLength={120} className={`${inputClass} col-span-2 sm:col-span-3`} />
                                <input value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} placeholder="Qty" aria-label="Quantity" inputMode="decimal" className={inputClass} />
                                <input value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} placeholder="Unit" aria-label="Unit" maxLength={20} className={inputClass} />
                                <input value={l.rate} onChange={(e) => updateLine(l.key, { rate: e.target.value })} placeholder="Rate ₹" aria-label="Rate" inputMode="decimal" className={inputClass} />
                                <input value={l.discount} onChange={(e) => updateLine(l.key, { discount: e.target.value })} placeholder="Discount ₹" aria-label="Discount" inputMode="decimal" className={inputClass} />
                                {gst && (
                                    <>
                                        <select value={l.taxRate} onChange={(e) => updateLine(l.key, { taxRate: e.target.value })} aria-label="GST rate" className={inputClass}>
                                            {GST_RATES.map((r) => <option key={r} value={r}>GST {r}%</option>)}
                                        </select>
                                        <input value={l.hsn} onChange={(e) => updateLine(l.key, { hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="HSN/SAC" aria-label="HSN or SAC code" inputMode="numeric" className={inputClass} />
                                    </>
                                )}
                            </div>
                            <p className="text-right text-sm font-medium text-gray-800 mt-2">
                                Line total: {preview[i] ? formatPaise(preview[i].totalPaise) : "-"}
                            </p>
                        </div>
                    ))}
                </div>

                <button type="button" onClick={() => setLines((all) => [...all, emptyLine()])} disabled={lines.length >= 50} className={`${btnOutline} mt-4 flex items-center gap-1`}>
                    <MdAdd size={18} /> Add another item
                </button>
            </div>

            <div className={`${cardClass} p-5 sm:p-6 mb-4`}>
                <label htmlFor="i-notes" className={labelClass}>Notes (optional)</label>
                <textarea id="i-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} className={inputClass} />

                <dl className="mt-4 text-sm space-y-1 sm:w-80 sm:ml-auto">
                    <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{formatPaise(totals.subtotalPaise)}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd>- {formatPaise(totals.discountPaise)}</dd></div>
                    {gst && (
                        <>
                            <div className="flex justify-between"><dt className="text-gray-500">Taxable value</dt><dd>{formatPaise(totals.taxablePaise)}</dd></div>
                            {interstate ? (
                                <div className="flex justify-between"><dt className="text-gray-500">IGST</dt><dd>{formatPaise(totals.igstPaise)}</dd></div>
                            ) : (
                                <>
                                    <div className="flex justify-between"><dt className="text-gray-500">CGST</dt><dd>{formatPaise(totals.cgstPaise)}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">SGST</dt><dd>{formatPaise(totals.sgstPaise)}</dd></div>
                                </>
                            )}
                        </>
                    )}
                    <div className="flex justify-between text-base font-semibold text-gray-800 border-t border-gray-200 pt-2"><dt>Total</dt><dd>{formatPaise(totals.totalPaise)}</dd></div>
                </dl>
                <p className="text-xs text-gray-500 mt-2 sm:text-right">The final amounts are calculated again by the server when you save.</p>
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={() => navigate("/invoices")} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="button" onClick={() => submit(false)} disabled={busy} className={btnOutline}>Save as draft</button>
                <button type="button" onClick={() => submit(true)} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Create invoice"}</button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-right">Creating an invoice adds the amount to the customer's Khaata and reduces stock for tracked products.</p>
        </PageWrap>
    )
}

export default InvoiceForm