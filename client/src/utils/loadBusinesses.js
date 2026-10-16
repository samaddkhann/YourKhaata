import api from "./api"
import { setBusinesses } from "../redux/businessSlice"

// Loads the user's active khaata books into Redux (used by the selector at the top)
export const loadBusinesses = async (dispatch) => {
    const result = await api.get("/api/businesses")
    dispatch(setBusinesses(result.data))
}