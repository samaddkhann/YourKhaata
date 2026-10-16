import { useEffect, useState } from "react"
import api from "../utils/api"
import useDebounce from "../hooks/useDebounce"
import { formatPaise } from "../utils/money"
import { btnOutline, inputClass } from "../utils/styles"

function CustomerPicker({ business, value, onChange }) {
    const [q, setQ] = useState("")
    const [results, setResults] = useState([])
    const debounced = useDebounce(q, 300)

    useEffect(() => {
        if (value) return
        let ignore = false
        const run = async () => {
            try {
                const result = await api.get(`/api/businesses/${business._id}/customers`, {
                    params: { q: debounced, type: "customer", limit: 8 },
                })
                if (!ignore) setResults(result.data.customers)
            } catch (error) {
                // the page shows other errors, so stay quiet here
            }
        }
        run()
        return () => {
            ignore = true
        }
    }, [business._id, debounced, value])

    if (value) {
        return (
            <div className="flex items-center justify-between gap-3 bg-gray-100 rounded-lg px-3 py-2">
                <div>
                    <p className="font-medium text-gray-800">{value.name}</p>
                    <p className="text-xs text-gray-500">{value.phone || "No phone"}</p>
                </div>
                <button type="button" onClick={() => onChange(null)} className={btnOutline}>Change</button>
            </div>
        )
    }

    return (
        <div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer by name or phone" aria-label="Search customer" className={inputClass} />
            <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                {results.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No customers found. Add one on the Customers page first.</p>
                ) : (
                    results.map((c) => (
                        <button key={c._id} type="button" onClick={() => onChange(c)} className="w-full text-left px-3 py-2 hover:bg-gray-100 transition">
                            <span className="font-medium text-gray-800">{c.name}</span>
                            <span className="block text-xs text-gray-500">{c.phone || "No phone"} • {formatPaise(c.balancePaise)}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

export default CustomerPicker