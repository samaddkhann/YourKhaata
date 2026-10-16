export const cardClass = "bg-white rounded-[24px] shadow-sm border border-gray-200"
export const softCardClass = "bg-white rounded-xl shadow-sm border border-gray-200"
export const popupClass = "bg-white shadow-xl border border-gray-200 rounded-xl"
export const iconBoxClass = "bg-black text-white p-2 rounded-lg"
export const pillClass = "flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-md hover:bg-gray-200 transition"

export const inputClass =
    "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-400 focus:border-black"
export const labelClass = "block text-sm font-medium text-gray-700 mb-1"

export const btnPrimary =
    "bg-black text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
export const btnOutline =
    "bg-white text-gray-800 border border-gray-300 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-100 transition disabled:text-gray-400 disabled:cursor-not-allowed"

// Small round tab buttons
export const tabClass = (active) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition ${active ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`