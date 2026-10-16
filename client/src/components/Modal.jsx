import { useEffect } from "react"
import { motion } from "motion/react"
import { MdClose } from "react-icons/md"

function Modal({ title, onClose, children, wide = false }) {
    // Esc key closes the dialog
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    return (
        <motion.div
            className="fixed inset-0 z-[999] flex items-start sm:items-center justify-center overflow-y-auto bg-black/20 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`relative w-full ${wide ? "max-w-2xl" : "max-w-lg"} my-8 bg-white rounded-[24px] shadow-xl border border-gray-200 p-6 sm:p-8`}
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.3 }}
            >
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition no-print"
                    >
                        <MdClose size={20} />
                    </button>
                </div>
                {children}
            </motion.div>
        </motion.div>
    )
}

export default Modal
