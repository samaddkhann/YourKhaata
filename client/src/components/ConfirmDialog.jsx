import Modal from "./Modal"
import { btnOutline, btnPrimary } from "../utils/styles"

function ConfirmDialog({ title, message, confirmText = "Confirm", busy = false, onConfirm, onCancel }) {
    return (
        <Modal title={title} onClose={onCancel}>
            <div className="mb-6 text-gray-600">{message}</div>
            <div className="flex flex-wrap gap-3 justify-end">
                <button onClick={onCancel} disabled={busy} className={btnOutline}>
                    Cancel
                </button>
                <button onClick={onConfirm} disabled={busy} className={btnPrimary}>
                    {busy ? "Please wait..." : confirmText}
                </button>
            </div>
        </Modal>
    )
}

export default ConfirmDialog