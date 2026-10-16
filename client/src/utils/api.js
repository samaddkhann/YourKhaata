import axios from "axios"

// Local: http://localhost:8000. Deployed: empty, so requests go to the same site (the Vercel proxy)
export const ServerUrl = import.meta.env.VITE_SERVER_URL || ""

const api = axios.create({
    baseURL: ServerUrl,
    withCredentials: true,
})

export default api