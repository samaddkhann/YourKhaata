import axios from "axios"

// On your computer: set VITE_SERVER_URL=http://localhost:8000 in client/.env.
// Deployed: leave it unset, so requests go to the same address as the website.
export const ServerUrl = import.meta.env.VITE_SERVER_URL || "https://yourkhaata.onrender.com"

const api = axios.create({
    baseURL: ServerUrl,
    withCredentials: true,
})

export default api
