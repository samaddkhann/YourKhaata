import { presetRange, todayIst } from "../utils/dates"
import { inputClass, tabClass } from "../utils/styles"

const PRESETS = [
    ["today", "Today"],
    ["week", "This week"],
    ["month", "This month"],
    ["year", "This year"],
]

// value = { preset, from, to }
function DateRangeFilter({ value, onChange, allowAll = false }) {
    const choose = (preset) => {
        if (preset === "custom") {
            onChange({ preset, from: value.from || todayIst(), to: value.to || todayIst() })
        } else {
            onChange({ preset, ...presetRange(preset) })
        }
    }

    const buttons = [...(allowAll ? [["all", "All time"]] : []), ...PRESETS, ["custom", "Custom"]]

    return (
        <div className="flex flex-wrap items-center gap-2 no-print">
            {buttons.map(([key, label]) => (
                <button key={key} type="button" onClick={() => choose(key)} className={tabClass(value.preset === key)}>
                    {label}
                </button>
            ))}

            {value.preset === "custom" && (
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="date"
                        aria-label="From date"
                        value={value.from}
                        max={value.to || todayIst()}
                        onChange={(e) => onChange({ ...value, from: e.target.value })}
                        className={`${inputClass} w-auto`}
                    />
                    <span className="text-gray-600">to</span>
                    <input
                        type="date"
                        aria-label="To date"
                        value={value.to}
                        min={value.from}
                        max={todayIst()}
                        onChange={(e) => onChange({ ...value, to: e.target.value })}
                        className={`${inputClass} w-auto`}
                    />
                </div>
            )}
        </div>
    )
}

export default DateRangeFilter