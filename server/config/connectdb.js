import mongoose from "mongoose"

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("DataBase Connected")
    } catch (error) {
        console.log("DataBase Error:", error.message)
        process.exit(1) // no point running the server without a database
    }
}

export default connectDb