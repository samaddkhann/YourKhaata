import Modal from "./Modal"
import { balanceText, formatPaise, formatPaisePdf } from "../utils/money"
import { formatDateTime } from "../utils/dates"
import { KIND_LABELS, METHOD_LABELS } from "../utils/labels"
import { downloadReceiptPdf } from "../utils/exportFile"
import { btnOutline, btnPrimary } from "../utils/styles"

function ReceiptModal({ entry, customer, business, onClose }) {
    const rows = [
        ["Receipt no.", entry.receiptNo],
        ["Date", formatDateTime(entry.occurredAt)],
        ["Received from / paid to", customer.name],
        ["Type", KIND_LABELS[entry.kind]],
        ["Amount", formatPaise(entry.amountPaise)],
        ["Payment method", METHOD_LABELS[entry.paymentMethod] || "Cash"],
        ["Reference", entry.referenceNo || "-"],
        ["Balance after this entry", balanceText(entry.runningBalancePaise)],
    ]

    const downloadPdf = () =>
        downloadReceiptPdf({
            filename: `${entry.receiptNo || "receipt"}.pdf`,
            lines: [
                business.name,
                `Receipt no: ${entry.receiptNo}`,
                `Date: ${formatDateTime(entry.occurredAt)}`,
                `Party: ${customer.name}`,
                `Type: ${KIND_LABELS[entry.kind]}`,
                `Amount: ${formatPaisePdf(entry.amountPaise)}`,
                `Method: ${METHOD_LABELS[entry.paymentMethod] || "Cash"}`,
                `Reference: ${entry.referenceNo || "-"}`,
            ],
        })

    return (
        <Modal title="Payment receipt" onClose={onClose}>
            <div className="print-area">
                <p className="text-lg font-semibold text-gray-800">{business.name}</p>
                {business.address && <p className="text-sm text-gray-600">{business.address}</p>}
                <dl className="mt-4 divide-y divide-gray-200 text-sm">
                    {rows.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 py-2">
                            <dt className="text-gray-500">{label}</dt>
                            <dd className="font-medium text-gray-800 text-right">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 text-xs text-gray-500">This payment was recorded manually by the business.</p>
            </div>

            <div className="flex flex-wrap gap-3 justify-end mt-6 no-print">
                <button onClick={onClose} className={btnOutline}>Close</button>
                <button onClick={downloadPdf} className={btnOutline}>Download PDF</button>
                <button onClick={() => window.print()} className={btnPrimary}>Print</button>
            </div>
        </Modal>
    )
}

export default ReceiptModal