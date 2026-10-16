import { useState } from "react"
import Papa from "papaparse"
import toast from "react-hot-toast"
import api from "../utils/api"
import { downloadCsv } from "../utils/exportFile"
import Modal from "./Modal"
import { btnOutline, btnPrimary } from "../utils/styles"

const HEADER_MAP = {
    name: "name",
    phone: "phone",
    email: "email",
    type: "type",
    openingbalance: "openingBalance",
    openingdirection: "openingDirection",
    address: "address",
    notes: "notes",
}

function CustomerImport({ business, onClose, onDone }) {
    const [rows, setRows] = useState([])
    const [fileName, setFileName] = useState("")
    const [result, setResult] = useState(null)
    const [busy, setBusy] = useState(false)

    const downloadTemplate = () =>
        downloadCsv("customers-template.csv", [
            ["name", "phone", "email", "type", "openingBalance", "openingDirection", "address", "notes"],
            ["Ramesh Kumar", "9876543210", "", "customer", "1500", "they_owe_me", "Main Road", ""],
        ])

    const readFile = (file) => {
        if (!file) return
        setResult(null)
        setFileName(file.name)
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""),
            complete: (parsed) => {
                const cleaned = parsed.data.map((raw) => {
                    const row = {}
                    for (const [key, value] of Object.entries(raw)) {
                        if (HEADER_MAP[key]) row[HEADER_MAP[key]] = String(value ?? "").trim()
                    }
                    if (row.type) row.type = row.type.toLowerCase()
                    if (row.openingDirection) row.openingDirection = row.openingDirection.toLowerCase().replace(/\s+/g, "_")
                    if (!row.type) delete row.type
                    if (!row.openingDirection) delete row.openingDirection
                    return row
                })
                if (cleaned.length === 0) toast.error("The file has no rows")
                if (cleaned.length > 500) toast.error("Please import up to 500 rows at a time")
                setRows(cleaned.slice(0, 500))
            },
            error: () => toast.error("Could not read this file"),
        })
    }

    const upload = async () => {
        setBusy(true)
        try {
            const res = await api.post(`/api/businesses/${business._id}/customers/import`, { rows })
            setResult(res.data)
            if (res.data.created > 0) onDone()
        } catch (error) {
            toast.error(error.response?.data?.message || "Import failed")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title="Import customers from CSV" onClose={onClose} wide>
            <p className="text-sm text-gray-600 mb-3">
                Columns: name, phone, email, type (customer / supplier / both), openingBalance, openingDirection (they_owe_me or i_owe_them), address, notes.
                Only <b>name</b> is required.
            </p>
            <button type="button" onClick={downloadTemplate} className={`${btnOutline} mb-4`}>Download template</button>

            <input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} aria-label="Choose a CSV file" className="block w-full text-sm mb-4" />

            {rows.length > 0 && !result && (
                <div className="mb-4">
                    <p className="text-sm font-medium text-gray-800 mb-2">{fileName}: {rows.length} rows found. First rows:</p>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="text-gray-500">
                                    <th className="px-2 py-1">Name</th><th className="px-2 py-1">Phone</th><th className="px-2 py-1">Type</th><th className="px-2 py-1">Opening</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 5).map((r, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                        <td className="px-2 py-1">{r.name}</td><td className="px-2 py-1">{r.phone}</td>
                                        <td className="px-2 py-1">{r.type || "customer"}</td><td className="px-2 py-1">{r.openingBalance}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {result && (
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
                    <p className="font-medium text-gray-800">{result.created} customers added.</p>
                    {result.problems.length > 0 && (
                        <>
                            <p className="mt-2 text-gray-700">{result.problems.length} rows were skipped:</p>
                            <ul className="mt-1 max-h-40 overflow-y-auto list-disc pl-5 text-gray-600">
                                {result.problems.map((p, i) => <li key={i}>Row {p.row}: {p.message}</li>)}
                            </ul>
                        </>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
                <button type="button" onClick={onClose} className={btnOutline}>{result ? "Close" : "Cancel"}</button>
                {!result && (
                    <button type="button" disabled={busy || rows.length === 0} onClick={upload} className={btnPrimary}>
                        {busy ? "Importing..." : `Import ${rows.length || ""} rows`}
                    </button>
                )}
            </div>
        </Modal>
    )
}

export default CustomerImport