import axios from "axios"

// Local: http://localhost:8000. Deployed: empty, so requests go to the same site (the rewrite rule)
export const ServerUrl = "https://yourkhaata.onrender.com"

const api = axios.create({
    baseURL: ServerUrl,
    withCredentials: true,
})

export default api
