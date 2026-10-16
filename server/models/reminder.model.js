import mongoose from "mongoose"

const reminderSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, default: null },
    remindAt: { type: Date, required: true },
    status: { type: String, enum: ["pending", "sent", "completed", "cancelled"], default: "pending" },
    channel: { type: String, enum: ["manual", "whatsapp", "sms"], default: "manual" },
    messageText: { type: String, required: true, maxlength: 1000 },
    history: [{
        _id: false,
        at: { type: Date, default: Date.now },
        action: String,
        channel: String
    }]
}, { timestamps: true })

reminderSchema.index({ businessId: 1, status: 1, remindAt: 1 })

const Reminder = mongoose.model("Reminder", reminderSchema)

export default Reminder