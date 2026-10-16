import { initializeApp, getApps } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

// Only the Project ID is needed to verify login tokens. No private key.
if (getApps().length === 0) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })
}

const adminAuth = getAuth()

export default adminAuth