import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { AnimatePresence, motion } from "motion/react"
import toast from "react-hot-toast"
import { signOut } from "firebase/auth"
import { HiOutlineLogout } from "react-icons/hi"
import {
    MdBarChart,
    MdClose,
    MdDashboard,
    MdInventory2,
    MdMenu,
    MdMenuBook,
    MdNotificationsActive,
    MdPeople,
    MdReceipt,
    MdSettings,
} from "react-icons/md"
import { auth } from "../utils/firebase"
import api from "../utils/api"
import { loadBusinesses } from "../utils/loadBusinesses"
import { setUserData } from "../redux/userSlice"
import { clearBusinesses, setActiveBusiness } from "../redux/businessSlice"
import { cardClass, popupClass, pillClass } from "../utils/styles"
import useT from "../hooks/useT"
import Logo from "./Logo"
import NotificationBell from "./NotificationBell"

const navItems = [
    { to: "/dashboard", key: "dashboard", icon: MdDashboard },
    { to: "/businesses", key: "khaataBooks", icon: MdMenuBook },
    { to: "/customers", key: "customers", icon: MdPeople },
    { to: "/invoices", key: "invoices", icon: MdReceipt },
    { to: "/inventory", key: "inventory", icon: MdInventory2 },
    { to: "/reminders", key: "reminders", icon: MdNotificationsActive },
    { to: "/reports", key: "reports", icon: MdBarChart },
    { to: "/settings", key: "settings", icon: MdSettings },
]

function SidebarLinks({ onNavigate }) {
    const t = useT()
    return (
        <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                        `rounded-xl transition ${isActive ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100"}`
                    }
                >
                    <motion.div whileHover={{ x: 4 }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium">
                        <item.icon size={20} />
                        {t(item.key)}
                    </motion.div>
                </NavLink>
            ))}
        </nav>
    )
}

function AppLayout() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [showUserPopup, setShowUserPopup] = useState(false)
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const t = useT()
    const { userData } = useSelector((state) => state.user)
    const { list, activeId } = useSelector((state) => state.business)

    // Load the user's khaata books once when the app opens
    useEffect(() => {
        const load = async () => {
            try {
                await loadBusinesses(dispatch)
            } catch (error) {
                toast.error("Could not load your Khaata books")
            }
        }
        load()
    }, [dispatch])

    const handleLogout = async () => {
        try {
            await api.post("/api/auth/logout")
            await signOut(auth)
            dispatch(clearBusinesses())
            dispatch(setUserData(null))
            setShowUserPopup(false)
            navigate("/auth")
        } catch (error) {
            toast.error("Logout failed. Please try again")
        }
    }

    return (
        <div className="min-h-screen bg-[#f3f3f3] px-4 pt-6 pb-10">
            <div className="max-w-7xl mx-auto">
                <motion.header
                    initial={{ opacity: 0, y: -40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`${cardClass} px-4 sm:px-8 py-4 flex justify-between items-center relative no-print`}
                >
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open menu"
                            className="md:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                        >
                            <MdMenu size={20} />
                        </button>
                        <div className="cursor-pointer" onClick={() => navigate("/dashboard")}>
                            <Logo />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5 relative">
                        {list.length > 0 ? (
                            <select
                                value={activeId || ""}
                                onChange={(e) => dispatch(setActiveBusiness(e.target.value))}
                                aria-label="Select Khaata book"
                                className={`${pillClass} max-w-[38vw] sm:max-w-xs cursor-pointer`}
                            >
                                {list.map((b) => (
                                    <option key={b._id} value={b._id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <NavLink to="/businesses" className={pillClass}>
                                New Khaata book
                            </NavLink>
                        )}

                        <NotificationBell />

                        <div className="relative">
                            <button
                                onClick={() => setShowUserPopup(!showUserPopup)}
                                aria-label="Open profile menu"
                                className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-semibold"
                            >
                                {userData.name.slice(0, 1).toUpperCase()}
                            </button>

                            {showUserPopup && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserPopup(false)} />
                                    <div className={`absolute right-0 mt-3 w-56 ${popupClass} p-4 z-50`}>
                                        <p className="text-md text-gray-800 font-medium truncate">{userData.name}</p>
                                        <p className="text-xs text-gray-500 mb-2 truncate">{userData.email || userData.phone}</p>
                                        <button
                                            onClick={() => {
                                                setShowUserPopup(false)
                                                navigate("/settings")
                                            }}
                                            className="w-full text-left text-sm py-2 hover:text-black text-gray-600"
                                        >
                                            {t("settings")}
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left text-sm py-2 flex items-center gap-2 text-gray-800 font-medium"
                                        >
                                            <HiOutlineLogout size={16} />
                                            {t("logout")}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </motion.header>

                <div className="flex gap-6 mt-6 items-start">
                    <aside className={`hidden md:block w-64 shrink-0 ${cardClass} p-4 sticky top-6 no-print`}>
                        <SidebarLinks />
                    </aside>

                    <main className="flex-1 min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>

            <AnimatePresence>
                {drawerOpen && (
                    <>
                        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setDrawerOpen(false)} />
                        <motion.aside
                            className="fixed top-0 left-0 z-50 h-full w-72 max-w-[85%] bg-white shadow-xl border-r border-gray-200 p-4 overflow-y-auto md:hidden"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ duration: 0.25 }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <Logo alwaysName />
                                <button
                                    onClick={() => setDrawerOpen(false)}
                                    aria-label="Close menu"
                                    className="p-2 rounded-full hover:bg-gray-100 transition"
                                >
                                    <MdClose size={20} />
                                </button>
                            </div>
                            <SidebarLinks onNavigate={() => setDrawerOpen(false)} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

export default AppLayout