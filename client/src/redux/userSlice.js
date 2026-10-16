import { createSlice } from "@reduxjs/toolkit"

const userSlice = createSlice({
    name: "user",
    initialState: {
        userData: null,
        loading: true, // true until we know if the user is logged in
    },
    reducers: {
        setUserData: (state, action) => {
            state.userData = action.payload
            state.loading = false
        },
    },
})

export const { setUserData } = userSlice.actions

export default userSlice.reducer