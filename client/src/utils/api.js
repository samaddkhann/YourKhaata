import axios from "axios"

// Your Render SERVER address (keep the same one you already use). No slash at the end.
const PRODUCTION_SERVER_URL = "https://yourkhaata.onrender.com"

// On your computer the server runs on port 8000. Anywhere else, use the Render server.
const onMyComputer = window.location.hostname === "localhost"
export const ServerUrl = onMyComputer ? "http://localhost:8000" : PRODUCTION_SERVER_URL.replace(/\/+$/, "")

// The login token is kept here, so Safari and iPhone work even though they block cross-site cookies
const TOKEN_KEY = "yourkhaata_token"

const readToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY)
    } catch (error) {
        return null
    }
}
const saveToken = (token) => {
    try {
        localStorage.setItem(TOKEN_KEY, token)
    } catch (error) {
        // storage not available: the cookie will be used instead
    }
}
const clearToken = () => {
    try {
        localStorage.removeItem(TOKEN_KEY)
    } catch (error) {
        // nothing to clear
    }
}

const api = axios.create({
    baseURL: ServerUrl,
    withCredentials: true,
})

// Every request carries the token (if we have one)
api.interceptors.request.use((config) => {
    const token = readToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (response) => {
        const url = response.config.url || ""

        // After login: keep the token and remove it from the data the pages receive
        if (url.includes("/api/auth/firebase") && response.data?.token) {
            saveToken(response.data.token)
            delete response.data.token
        }

        // After logout or deleting the account: forget the token
        const deletedAccount = url.includes("/api/user/me") && response.config.method === "delete"
        if (url.includes("/api/auth/logout") || deletedAccount) clearToken()

        return response
    },
    (error) => {
        const url = error.config?.url || ""
        if (url.includes("/api/auth/logout")) clearToken()
        // An old or expired token on page load: forget it
        if (error.response?.status === 401 && url.includes("/api/user/current-user")) clearToken()
        return Promise.reject(error)
    }
)

export default api
