import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AnimatePresence } from "motion/react"
import toast from "react-hot-toast"
import { MdPictureAsPdf, MdPrint } from "react-icons/md"
import api from "../utils/api"
import { formatPaise, formatPaisePdf, rupeesToPaise } from "../utils/money"
import { formatDate, todayIst } from "../utils/dates"
import { formatQty } from "../utils/invoiceMath"
import { METHOD_LABELS } from "../utils/labels"
import { downloadDocumentPdf } from "../utils/exportFile"
import PageWrap from "../components/PageWrap"
import Modal from "../components/Modal"
import ConfirmDialog from "../components/ConfirmDialog"
import InvoiceStatus from "../components/InvoiceStatus"
import { btnOutline, btnPrimary, cardClass, inputClass, labelClass } from "../utils/styles"

function PayForm({ invoice, remainingPaise, onSaved, onCancel }) {
    const [amount, setAmount] = useState((remainingPaise / 100).toFixed(2))
    const [date, setDate] = useState(todayIst())
    const [paymentMethod, setPaymentMethod] = useState("cash")
    const [referenceNo, setReferenceNo] = useState("")
    const [busy, setBusy] = useState(false)
    const keyRef = useRef(crypto.randomUUID())

    const submit = async (e) => {
        e.preventDefault()
        if (busy) return
        const paise = rupeesToPaise(amount)
        if (!paise) return toast.error("Enter an amount above zero")
        if (paise > remainingPaise) return toast.error(`Only ${formatPaise(remainingPaise)} is left to pay`)

        setBusy(true)
        try {
            await api.post(`/api/invoices/${invoice._id}/pay`, { amount, date, paymentMethod, referenceNo, idempotencyKey: keyRef.current })
            toast.success("Payment recorded")
            onSaved()
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not record the payment")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">Left to pay: <b>{formatPaise(remainingPaise)}</b>. A part payment is fine.</p>
            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="pay-amt" className={labelClass}>Amount (₹)</label>
                    <input id="pay-amt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus className={inputClass} />
                </div>
                <div>
                    <label htmlFor="pay-date" className={labelClass}>Date</label>
                    <input id="pay-date" type="date" value={date} max={todayIst()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="pay-method" className={labelClass}>Method</label>
                    <select id="pay-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                        {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="pay-ref" className={labelClass}>Reference (optional)</label>
                    <input id="pay-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} maxLength={50} className={inputClass} />
                </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save payment"}</button>
            </div>
        </form>
    )
}

function InvoiceView() {
    const { invoiceId } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState(null)
    const [notFound, setNotFound] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)
    const [showPay, setShowPay] = useState(false)
    const [showCancel, setShowCancel] = useState(false)
    const [reason, setReason] = useState("")
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let ignore = false
        const run = async () => {
            try {
                const result = await api.get(`/api/invoices/${invoiceId}`)
                if (!ignore) setData(result.data)
            } catch (error) {
                if (ignore) return
                if (error.response?.status === 404) setNotFound(true)
                else toast.error(error.response?.data?.message || "Could not load the invoice")
            }
        }
        run()
        return () => {
            ignore = true
        }
    }, [invoiceId, reloadKey])

    const reload = () => setReloadKey((k) => k + 1)

    if (notFound) {
        return (
            <PageWrap>
                <div className={`${cardClass} p-10 text-center`}>
                    <p className="font-semibold text-lg text-gray-800">Invoice not found</p>
                    <Link to="/invoices" className={`${btnPrimary} inline-block mt-4`}>Back to invoices</Link>
                </div>
            </PageWrap>
        )
    }
    if (!data) return <div className={`${cardClass} h-40 animate-pulse`} />

    const { invoice, customer, business, payments } = data
    const gst = invoice.type === "gst"
    const remaining = invoice.totalPaise - invoice.paidPaise
    const title = invoice.number || "Draft invoice"
    const activePayments = payments.filter((p) => p.status === "active")

    const act = async (path, body, message) => {
        setBusy(true)
        try {
            await api.post(`/api/invoices/${invoiceId}/${path}`, body)
            toast.success(message)
            reload()
            return true
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong")
            return false
        } finally {
            setBusy(false)
        }
    }

    const downloadPdf = () => {
        const head = gst ? ["Item", "HSN", "Qty", "Rate", "Taxable", "GST", "Amount"] : ["Item", "Qty", "Rate", "Discount", "Amount"]
        const body = invoice.lines.map((l) =>
            gst
                ? [l.name, l.hsn || "-", `${formatQty(l.qtyMilli)} ${l.unit}`, formatPaisePdf(l.ratePaise), formatPaisePdf(l.taxablePaise), `${l.taxRatePercent}%`, formatPaisePdf(l.totalPaise)]
                : [l.name, `${formatQty(l.qtyMilli)} ${l.unit}`, formatPaisePdf(l.ratePaise), l.discountPaise ? formatPaisePdf(l.discountPaise) : "-", formatPaisePdf(l.totalPaise)]
        )
        const totals = [["Subtotal", formatPaisePdf(invoice.subtotalPaise)]]
        if (invoice.discountPaise) totals.push(["Discount", "- " + formatPaisePdf(invoice.discountPaise)])
        if (gst) {
            totals.push(["Taxable value", formatPaisePdf(invoice.taxablePaise)])
            if (invoice.interstate) totals.push(["IGST", formatPaisePdf(invoice.igstPaise)])
            else totals.push(["CGST", formatPaisePdf(invoice.cgstPaise)], ["SGST", formatPaisePdf(invoice.sgstPaise)])
        }
        totals.push(["Total", formatPaisePdf(invoice.totalPaise)], ["Paid", formatPaisePdf(invoice.paidPaise)], ["Balance due", formatPaisePdf(remaining)])

        downloadDocumentPdf({
            filename: `${invoice.number || "draft-invoice"}.pdf`,
            title: gst ? "TAX INVOICE" : "INVOICE",
            leftLines: [
                business.name,
                ...(business.address ? [business.address] : []),
                ...(business.phone ? [`Phone: ${business.phone}`] : []),
                ...(gst ? [`GSTIN: ${invoice.sellerGstin}`] : []),
            ],
            rightLines: [
                `Invoice no: ${invoice.number || "Draft"}`,
                `Date: ${formatDate(invoice.issueDate)}`,
                ...(invoice.dueDate ? [`Due: ${formatDate(invoice.dueDate)}`] : []),
                `Bill to: ${customer.name}`,
                ...(gst && invoice.buyerGstin ? [`Buyer GSTIN: ${invoice.buyerGstin}`] : []),
                ...(gst && invoice.placeOfSupply ? [`Place of supply: ${invoice.placeOfSupply}`] : []),
            ],
            head,
            body,
            totals,
            footerLines: [
                ...(invoice.notes ? [invoice.notes] : []),
                ...(business.upiId ? [`Pay by UPI: ${business.upiId}`] : []),
                ...(business.invoiceTerms ? [business.invoiceTerms] : []),
            ],
        })
    }

    return (
        <PageWrap>
            <div className="print-area">
                <div className={`${cardClass} p-5 sm:p-6`}>
                    <Link to="/invoices" className="no-print text-sm text-gray-600 hover:text-black">← Invoices</Link>
                    <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
                            <p className="text-sm text-gray-600">{gst ? "GST invoice" : "Normal bill"} • {formatDate(invoice.issueDate)}{invoice.dueDate ? ` • Due ${formatDate(invoice.dueDate)}` : ""}</p>
                        </div>
                        <InvoiceStatus status={invoice.statusLabel} />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 mt-5 text-sm">
                        <div>
                            <p className="text-gray-500">From</p>
                            <p className="font-medium text-gray-800">{business.name}</p>
                            {business.address && <p className="text-gray-600">{business.address}</p>}
                            {gst && <p className="text-gray-600">GSTIN: {invoice.sellerGstin}</p>}
                        </div>
                        <div>
                            <p className="text-gray-500">Bill to</p>
                            <Link to={`/customers/${invoice.customerId}`} className="font-medium text-gray-800 hover:underline">{customer.name}</Link>
                            {customer.phone && <p className="text-gray-600">{customer.phone}</p>}
                            {gst && invoice.buyerGstin && <p className="text-gray-600">GSTIN: {invoice.buyerGstin}</p>}
                            {gst && invoice.placeOfSupply && <p className="text-gray-600">Place of supply: {invoice.placeOfSupply}</p>}
                        </div>
                    </div>

                    <div className="overflow-x-auto mt-5">
                        <table className="w-full min-w-[560px] text-sm text-left">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-200">
                                    <th className="px-2 py-2 font-medium">Item</th>
                                    {gst && <th className="px-2 py-2 font-medium">HSN/SAC</th>}
                                    <th className="px-2 py-2 font-medium text-right">Qty</th>
                                    <th className="px-2 py-2 font-medium text-right">Rate</th>
                                    <th className="px-2 py-2 font-medium text-right">Discount</th>
                                    {gst && <th className="px-2 py-2 font-medium text-right">GST</th>}
                                    <th className="px-2 py-2 font-medium text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.lines.map((l, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="px-2 py-2 text-gray-800">{l.name}</td>
                                        {gst && <td className="px-2 py-2">{l.hsn || "-"}</td>}
                                        <td className="px-2 py-2 text-right">{formatQty(l.qtyMilli)} {l.unit}</td>
                                        <td className="px-2 py-2 text-right">{formatPaise(l.ratePaise)}</td>
                                        <td className="px-2 py-2 text-right">{l.discountPaise ? formatPaise(l.discountPaise) : "-"}</td>
                                        {gst && <td className="px-2 py-2 text-right">{l.taxRatePercent}%</td>}
                                        <td className="px-2 py-2 text-right font-medium">{formatPaise(l.totalPaise)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <dl className="mt-4 text-sm space-y-1 sm:w-80 sm:ml-auto">
                        <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{formatPaise(invoice.subtotalPaise)}</dd></div>
                        {invoice.discountPaise > 0 && <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd>- {formatPaise(invoice.discountPaise)}</dd></div>}
                        {gst && (
                            <>
                                <div className="flex justify-between"><dt className="text-gray-500">Taxable value</dt><dd>{formatPaise(invoice.taxablePaise)}</dd></div>
                                {invoice.interstate ? (
                                    <div className="flex justify-between"><dt className="text-gray-500">IGST</dt><dd>{formatPaise(invoice.igstPaise)}</dd></div>
                                ) : (
                                    <>
                                        <div className="flex justify-between"><dt className="text-gray-500">CGST</dt><dd>{formatPaise(invoice.cgstPaise)}</dd></div>
                                        <div className="flex justify-between"><dt className="text-gray-500">SGST</dt><dd>{formatPaise(invoice.sgstPaise)}</dd></div>
                                    </>
                                )}
                            </>
                        )}
                        <div className="flex justify-between text-base font-semibold text-gray-800 border-t border-gray-200 pt-2"><dt>Total</dt><dd>{formatPaise(invoice.totalPaise)}</dd></div>
                        {invoice.status === "issued" && (
                            <>
                                <div className="flex justify-between"><dt className="text-gray-500">Paid</dt><dd>{formatPaise(invoice.paidPaise)}</dd></div>
                                <div className="flex justify-between font-semibold text-gray-800"><dt>Balance due</dt><dd>{formatPaise(remaining)}</dd></div>
                            </>
                        )}
                    </dl>

                    {invoice.notes && <p className="mt-4 text-sm text-gray-600">{invoice.notes}</p>}
                    {business.upiId && <p className="mt-2 text-sm text-gray-600">Pay by UPI: {business.upiId}</p>}
                    {business.invoiceTerms && <p className="mt-2 text-xs text-gray-500">{business.invoiceTerms}</p>}
                    {invoice.status === "cancelled" && <p className="mt-4 text-sm font-medium text-gray-700">Cancelled: {invoice.cancelReason}</p>}
                </div>

                {payments.length > 0 && (
                    <div className={`${cardClass} p-5 sm:p-6 mt-4`}>
                        <p className="font-semibold text-gray-800 mb-2">Payments</p>
                        <ul className="divide-y divide-gray-100 text-sm">
                            {payments.map((p) => (
                                <li key={p._id} className="flex justify-between gap-3 py-2">
                                    <span className={p.status === "reversed" ? "text-gray-400 line-through" : "text-gray-700"}>
                                        {formatDate(p.occurredAt)} • {METHOD_LABELS[p.paymentMethod] || "Cash"} • {p.receiptNo}
                                        {p.status === "reversed" ? " (reversed)" : ""}
                                    </span>
                                    <span className="font-medium text-gray-800">{formatPaise(p.amountPaise)}</span>
                                </li>
                            ))}
                        </ul>
                        {activePayments.length > 0 && <p className="text-xs text-gray-500 mt-2">To undo a payment, reverse it in the customer's ledger.</p>}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 no-print">
                {invoice.status === "draft" && (
                    <>
                        <button onClick={() => navigate(`/invoices/${invoiceId}/edit`)} className={btnOutline}>Edit draft</button>
                        <button disabled={busy} onClick={() => act("finalize", {}, "Invoice created")} className={btnPrimary}>Create invoice</button>
                    </>
                )}
                {invoice.status === "issued" && remaining > 0 && <button onClick={() => setShowPay(true)} className={btnPrimary}>Record payment</button>}
                <button onClick={downloadPdf} className={`${btnOutline} flex items-center gap-1`}><MdPictureAsPdf size={18} /> PDF</button>
                <button onClick={() => window.print()} className={`${btnOutline} flex items-center gap-1`}><MdPrint size={18} /> Print</button>
                {invoice.status !== "cancelled" && <button onClick={() => { setReason(""); setShowCancel(true) }} className={btnOutline}>Cancel invoice</button>}
            </div>

            <AnimatePresence>
                {showPay && (
                    <Modal title="Record payment" onClose={() => setShowPay(false)}>
                        <PayForm invoice={invoice} remainingPaise={remaining} onCancel={() => setShowPay(false)} onSaved={() => { setShowPay(false); reload() }} />
                    </Modal>
                )}
                {showCancel && (
                    <ConfirmDialog
                        title="Cancel this invoice?"
                        message={
                            <span>
                                {invoice.status === "issued" ? "The amount is taken off the customer's Khaata and the stock is put back. " : ""}
                                An invoice with payments cannot be cancelled until those payments are reversed.
                                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={150} placeholder="Reason (required)" aria-label="Reason for cancelling" className={`${inputClass} mt-3`} />
                            </span>
                        }
                        confirmText="Cancel invoice"
                        busy={busy}
                        onCancel={() => setShowCancel(false)}
                        onConfirm={async () => {
                            if (reason.trim().length < 3) return toast.error("Please write a short reason")
                            if (await act("cancel", { reason }, "Invoice cancelled")) setShowCancel(false)
                        }}
                    />
                )}
            </AnimatePresence>
        </PageWrap>
    )
}

export default InvoiceView