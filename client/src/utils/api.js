import axios from "axios"

<<<<<<< HEAD
// On your computer: set VITE_SERVER_URL=http://localhost:8000 in client/.env.
// Deployed: leave it unset, so requests go to the same address as the website.
export const ServerUrl = import.meta.env.VITE_SERVER_URL || ""
=======
// Local: http://localhost:8000. Deployed: empty, so requests go to the same site (the rewrite rule)
export const ServerUrl = "https://yourkhaata.onrender.com"
>>>>>>> ca9cbd9e3d7e33fbcb6681d865d623ab889a4254

const api = axios.create({
    baseURL: ServerUrl,
    withCredentials: true,
})

export default api
