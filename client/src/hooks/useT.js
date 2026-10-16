import { useSelector } from "react-redux"
import { translations } from "../utils/translations"

// const t = useT();  t("customers")  ->  "Customers" or "ग्राहक"
function useT() {
    const language = useSelector((state) => state.user.userData?.language) || "en"
    return (key) => translations[language]?.[key] ?? translations.en[key] ?? key
}

export default useT