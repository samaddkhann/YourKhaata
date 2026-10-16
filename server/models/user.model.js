import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    firebaseUid: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    // Email is optional because people who login with a phone number have no email
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true },
    photoUrl: { type: String, default: "" },
    language: { type: String, enum: ["en", "hi"], default: "en" },
    defaultBusinessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null },
    lastLoginAt: Date
}, { timestamps: true })

const User = mongoose.model("User", userSchema)

export default User