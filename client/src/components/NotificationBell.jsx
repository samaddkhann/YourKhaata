import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { MdNotifications } from "react-icons/md"
import api from "../utils/api"
import useT from "../hooks/useT"
import { popupClass } from "../utils/styles"

function NotificationBell() {
    const { activeId } = useSelector((state) => state.business)
    const [items, setItems] = useState([])
    const [open, setOpen] = useState(false)
    const navigate = useNavigate()
    const t = useT()

    useEffect(() => {
        if (!activeId) {
            setItems([])
            return
        }
        let ignore = false
        const load = async () => {
            try {
                const result = await api.get(`/api/businesses/${activeId}/notifications`)
                if (!ignore) setItems(result.data.items)
            } catch (error) {
                // a missed refresh is not worth an error message
            }
        }
        load()
        const timer = setInterval(load, 60000)
        return () => {
            ignore = true
            clearInterval(timer)
        }
    }, [activeId])

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                aria-label={t("notifications")}
                className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
            >
                <MdNotifications size={20} />
                {items.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
                        {items.length}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className={`absolute right-0 mt-3 w-72 ${popupClass} p-4 z-50`}>
                        <p className="font-medium text-gray-800 mb-2">{t("notifications")}</p>
                        {items.length === 0 ? (
                            <p className="text-sm text-gray-500">{t("allCaughtUp")}</p>
                        ) : (
                            items.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => {
                                        setOpen(false)
                                        navigate(n.link)
                                    }}
                                    className="w-full text-left py-2 border-t border-gray-100 hover:bg-gray-50 rounded-lg px-1 transition"
                                >
                                    <span className="block text-sm font-medium text-gray-800">{n.title}</span>
                                    <span className="block text-xs text-gray-500">{n.text}</span>
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export default NotificationBell