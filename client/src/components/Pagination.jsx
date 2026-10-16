import { btnOutline } from "../utils/styles"

function Pagination({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null

    return (
        <div className="flex items-center justify-center gap-4 mt-6 no-print">
            <button disabled={page <= 1} onClick={() => onChange(page - 1)} className={btnOutline}>
                Previous
            </button>
            <span className="text-sm font-medium text-gray-700">
                Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={btnOutline}>
                Next
            </button>
        </div>
    )
}

export default Pagination