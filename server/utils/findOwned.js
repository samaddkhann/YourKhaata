import mongoose from "mongoose"
import Customer from "../models/customer.model.js"

// A customer is returned only if it belongs to the logged-in user
export const findOwnedCustomer = async (customerId, userId) => {
    if (!mongoose.isValidObjectId(customerId)) return null
    return Customer.findOne({ _id: customerId, ownerId: userId })
}