import { configureStore } from "@reduxjs/toolkit"
import userSlice from "./userSlice"
import businessSlice from "./businessSlice"

export default configureStore({
    reducer: {
        user: userSlice,
        business: businessSlice,
    },
})