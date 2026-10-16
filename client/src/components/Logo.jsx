import { MdAccountBalanceWallet } from "react-icons/md"
import { iconBoxClass } from "../utils/styles"

function Logo({ large = false, alwaysName = false }) {
    return (
        <div className="flex items-center gap-3">
            <div className={iconBoxClass}>
                <MdAccountBalanceWallet size={large ? 24 : 18} />
            </div>
            <span className={`font-semibold text-lg ${large || alwaysName ? "" : "hidden md:block"}`}>Your Khaata</span>
        </div>
    )
}

export default Logo