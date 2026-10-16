import { createSlice } from "@reduxjs/toolkit"

const businessSlice = createSlice({
    name: "business",
    initialState: {
        list: [],        // active khaata books only
        activeId: null,  // the one currently selected
        loading: true,
    },
    reducers: {
        setBusinesses: (state, action) => {
            state.list = action.payload
            state.loading = false

            // Keep the selection if it still exists, else use the default, else the first
            const stillThere = state.list.some((b) => b._id === state.activeId)
            if (!stillThere) {
                const chosen = state.list.find((b) => b.isDefault) || state.list[0]
                state.activeId = chosen ? chosen._id : null
            }
        },
        setActiveBusiness: (state, action) => {
            state.activeId = action.payload
        },
        clearBusinesses: (state) => {
            state.list = []
            state.activeId = null
            state.loading = true
        },
    },
})

export const { setBusinesses, setActiveBusiness, clearBusinesses } = businessSlice.actions

export default businessSlice.reducer