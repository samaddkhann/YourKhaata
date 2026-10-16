import mongoose from "mongoose"

const counterSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    value: { type: Number, default: 0 }
})

counterSchema.index({ businessId: 1, name: 1 }, { unique: true })

const Counter = mongoose.model("Counter", counterSchema)

// Atomic: two requests at the same time can never get the same number
export const nextNumber = async (businessId, name, session) => {
    const counter = await Counter.findOneAndUpdate(
        { businessId, name },
        { $inc: { value: 1 } },
        { upsert: true, new: true, session }
    )
    return counter.value
}

export default Counter