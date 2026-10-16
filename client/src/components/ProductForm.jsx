import { useState } from "react"
import toast from "react-hot-toast"
import api from "../utils/api"
import { formatQty } from "../utils/invoiceMath"
import { btnOutline, btnPrimary, inputClass, labelClass } from "../utils/styles"

const rupeeText = (paise) => (paise ? (paise / 100).toFixed(2) : "")

function ProductForm({ business, initial, onSaved, onCancel }) {
    const [name, setName] = useState(initial?.name || "")
    const [sku, setSku] = useState(initial?.sku || "")
    const [category, setCategory] = useState(initial?.category || "")
    const [unit, setUnit] = useState(initial?.unit || "pcs")
    const [purchasePrice, setPurchasePrice] = useState(rupeeText(initial?.purchasePricePaise))
    const [sellingPrice, setSellingPrice] = useState(rupeeText(initial?.sellingPricePaise))
    const [openingStock, setOpeningStock] = useState("")
    const [lowStock, setLowStock] = useState(initial?.lowStockMilli ? formatQty(initial.lowStockMilli) : "")
    const [trackStock, setTrackStock] = useState(initial ? initial.trackStock : true)
    const [active, setActive] = useState(initial ? initial.active : true)
    const [busy, setBusy] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (busy) return
        if (name.trim().length === 0) {
            toast.error("Please enter the product name")
            return
        }

        setBusy(true)
        try {
            const payload = { name, sku, category, unit, purchasePrice, sellingPrice, lowStock, trackStock, openingStock, active }
            if (initial) {
                await api.patch(`/api/products/${initial._id}`, payload)
                toast.success("Product updated")
            } else {
                await api.post(`/api/businesses/${business._id}/products`, payload)
                toast.success("Product added")
            }
            onSaved()
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not save. Please try again")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label htmlFor="p-name" className={labelClass}>Name *</label>
                <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="p-sku" className={labelClass}>Code (optional)</label>
                    <input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={40} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="p-cat" className={labelClass}>Category</label>
                    <input id="p-cat" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="p-unit" className={labelClass}>Unit</label>
                    <input id="p-unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="pcs, kg, litre" className={inputClass} />
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="p-buy" className={labelClass}>Buying price (₹)</label>
                    <input id="p-buy" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} inputMode="decimal" className={inputClass} />
                </div>
                <div>
                    <label htmlFor="p-sell" className={labelClass}>Selling price (₹)</label>
                    <input id="p-sell" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} inputMode="decimal" className={inputClass} />
                </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} className="w-4 h-4 accent-black" />
                Track stock for this item (untick for a service)
            </label>

            {trackStock && (
                <div className="grid sm:grid-cols-2 gap-4">
                    {!initial && (
                        <div>
                            <label htmlFor="p-open" className={labelClass}>Opening stock</label>
                            <input id="p-open" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} inputMode="decimal" className={inputClass} />
                        </div>
                    )}
                    <div>
                        <label htmlFor="p-low" className={labelClass}>Alert me when stock is at or below</label>
                        <input id="p-low" value={lowStock} onChange={(e) => setLowStock(e.target.value)} inputMode="decimal" placeholder="e.g. 5" className={inputClass} />
                    </div>
                </div>
            )}

            {initial && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-black" />
                    Active (untick to hide this product)
                </label>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onCancel} disabled={busy} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving..." : initial ? "Save changes" : "Add product"}</button>
            </div>
        </form>
    )
}

export default ProductForm