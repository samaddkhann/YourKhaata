const LABELS = {
    draft: "Draft",
    unpaid: "Unpaid",
    partially_paid: "Partially paid",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
}

const STYLES = {
    paid: "bg-black text-white",
    overdue: "bg-white text-gray-900 border border-black",
    cancelled: "bg-gray-200 text-gray-500 line-through",
    draft: "bg-gray-100 text-gray-600",
    unpaid: "bg-gray-100 text-gray-800",
    partially_paid: "bg-gray-300 text-gray-800",
}

function InvoiceStatus({ status }) {
    return (
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STYLES[status] || STYLES.unpaid}`}>
            {LABELS[status] || status}
        </span>
    )
}

export default InvoiceStatus