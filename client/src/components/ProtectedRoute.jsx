import { useSelector } from "react-redux"
import { Navigate } from "react-router-dom"

function ProtectedRoute({ children }) {
    const { userData, loading } = useSelector((state) => state.user)

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f3f3f3] flex items-center justify-center">
                <p className="text-gray-500 animate-pulse">Loading...</p>
            </div>
        )
    }

    if (!userData) {
        return <Navigate to="/auth" replace />
    }

    return children
}

export default ProtectedRoute