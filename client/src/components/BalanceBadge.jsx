import { formatPaise } from "../utils/money"

function BalanceBadge({ paise }) {
    if (paise > 0) {
        return (
            <span className="inline-block bg-black text-white rounded-full px-3 py-1 text-sm font-medium">
                ▲ {formatPaise(paise)} You'll get
            </span>
        )
    }

    if (paise < 0) {
        return (
            <span className="inline-block bg-white text-gray-800 border border-gray-400 rounded-full px-3 py-1 text-sm font-medium">
                ▼ {formatPaise(-paise)} You'll give
            </span>
        )
    }

    return (
        <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-sm font-medium">
            Settled
        </span>
    )
}

export default BalanceBadge