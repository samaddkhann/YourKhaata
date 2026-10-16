import { useEffect, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Navigate, useNavigate } from "react-router-dom"
import { motion } from "motion/react"
import toast from "react-hot-toast"
import { FcGoogle } from "react-icons/fc"
import { IoSparkles } from "react-icons/io5"
import { MdPhoneAndroid } from "react-icons/md"
import {
    signInWithPopup,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile,
    signOut,
} from "firebase/auth"
import { auth, provider } from "../utils/firebase"
import api from "../utils/api"
import { setUserData } from "../redux/userSlice"
import Logo from "../components/Logo"
import { inputClass, labelClass } from "../utils/styles"

// Turns technical errors into friendly messages
const friendlyError = (error) => {
    switch (error.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Wrong email or password"
        case "auth/email-already-in-use":
            return "This email is already registered. Please login"
        case "auth/weak-password":
            return "Password must be at least 6 characters"
        case "auth/invalid-email":
            return "Please enter a valid email"
        case "auth/user-disabled":
            return "This account has been disabled"
        case "auth/too-many-requests":
            return "Too many attempts. Please try again later"
        case "auth/popup-closed-by-user":
            return "Google sign-in was cancelled"
        case "auth/invalid-phone-number":
            return "Please enter a valid mobile number"
        case "auth/invalid-verification-code":
            return "Wrong OTP. Please check and try again"
        case "auth/code-expired":
            return "This OTP has expired. Please request a new one"
        case "auth/quota-exceeded":
            return "SMS limit reached. Please try again later"
        case "auth/captcha-check-failed":
            return "Security check failed. Refresh the page and try again"
        case "auth/billing-not-enabled":
            return "Real SMS needs a Firebase billing plan. Use a test phone number for now"
        case "auth/operation-not-allowed":
            return "Phone login is not enabled in Firebase. Enable Phone under Authentication > Sign-in method"
        case "auth/invalid-app-credential":
            return "Security check failed. Refresh the page and try again"
        case "auth/missing-phone-number":
            return "Please enter your mobile number"
        case "auth/network-request-failed":
        case "ERR_NETWORK":
            return "Network problem. Check your internet and try again"
        default:
            return error.response?.data?.message || `Something went wrong (${error.code || "unknown"}). Please try again`
    }
}
const outlineBtn =
    "w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-800 border border-gray-300 rounded-full hover:bg-gray-100 transition disabled:text-gray-400 disabled:cursor-not-allowed"

function Auth() {
    const [mode, setMode] = useState("login") // "login" | "signup" | "reset" | "phone"
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [phone, setPhone] = useState("")
    const [otp, setOtp] = useState("")
    const [otpSent, setOtpSent] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [busy, setBusy] = useState(false)

    const verifierRef = useRef(null)
    const confirmationRef = useRef(null)

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { userData } = useSelector((state) => state.user)

    // Resend-OTP countdown
    useEffect(() => {
        if (cooldown <= 0) return
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [cooldown])

    // Clean up the invisible reCAPTCHA when leaving the page
    useEffect(() => {
        return () => {
            verifierRef.current?.clear()
            verifierRef.current = null
        }
    }, [])

    // Already logged in? Go to dashboard
    if (userData) {
        return <Navigate to="/dashboard" replace />
    }

    const goMode = (next) => {
        setMode(next)
        setOtp("")
        setOtpSent(false)
        confirmationRef.current = null
    }

    // Send the Firebase token to our server, which sets the login cookie
    const loginToServer = async (firebaseUser) => {
        const idToken = await firebaseUser.getIdToken()
        const result = await api.post("/api/auth/firebase", { idToken })
        dispatch(setUserData(result.data))
        navigate("/dashboard")
    }

    const handleGoogle = async () => {
        setBusy(true)
        try {
            const response = await signInWithPopup(auth, provider)
            await loginToServer(response.user)
        } catch (error) {
            toast.error(friendlyError(error))
        } finally {
            setBusy(false)
        }
    }

    const sendOtp = async () => {
        if (!/^[6-9]\d{9}$/.test(phone)) {
            toast.error("Enter a valid 10-digit Indian mobile number")
            return
        }
        setBusy(true)
        try {
            verifierRef.current?.clear()
            const box = document.getElementById("recaptcha-container")
            if (box) box.innerHTML = ""
            verifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" })
            confirmationRef.current = await signInWithPhoneNumber(auth, "+91" + phone, verifierRef.current)
            setOtpSent(true)
            setCooldown(30)
            toast.success("OTP sent to +91 " + phone)
        } catch (error) {
            console.error("Phone login error:", error)
            toast.error(friendlyError(error))
            verifierRef.current?.clear()
            verifierRef.current = null
        } finally {
            setBusy(false)
        }
    }

    const verifyOtp = async () => {
        if (!/^\d{6}$/.test(otp)) {
            toast.error("Enter the 6-digit OTP")
            return
        }
        if (!confirmationRef.current) {
            toast.error("Please request a new OTP")
            return
        }
        setBusy(true)
        try {
            const result = await confirmationRef.current.confirm(otp)
            await loginToServer(result.user)
        } catch (error) {
            toast.error(friendlyError(error))
        } finally {
            setBusy(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (busy) return

        if (mode === "phone") {
            if (otpSent) await verifyOtp()
            else await sendOtp()
            return
        }

        setBusy(true)
        try {
            if (mode === "signup") {
                if (name.trim().length < 2) {
                    toast.error("Please enter your name")
                    return
                }
                const response = await createUserWithEmailAndPassword(auth, email, password)
                await updateProfile(response.user, { displayName: name.trim() })
                await sendEmailVerification(response.user)
                await signOut(auth)
                toast.success("Verification email sent. Verify it, then login.")
                setPassword("")
                goMode("login")
            } else if (mode === "login") {
                const response = await signInWithEmailAndPassword(auth, email, password)
                if (!response.user.emailVerified) {
                    await signOut(auth)
                    toast.error("Please verify your email first. Check your inbox.")
                    return
                }
                await loginToServer(response.user)
            } else {
                await sendPasswordResetEmail(auth, email)
                toast.success("If this email is registered, a reset link has been sent.")
                goMode("login")
            }
        } catch (error) {
            toast.error(friendlyError(error))
        } finally {
            setBusy(false)
        }
    }

    const titles = { login: "Welcome!", signup: "Create your account", reset: "Reset password", phone: "Login with phone" }
    const buttonText = {
        login: "Login",
        signup: "Sign up",
        reset: "Send reset link",
        phone: otpSent ? "Verify OTP and login" : "Send OTP",
    }

    return (
        <div className="min-h-screen bg-[#f3f3f3] flex items-center justify-center px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.05 }}
                className="w-full max-w-lg p-8 sm:p-12 rounded-[32px] bg-white shadow-2xl border border-gray-200"
            >
                <div className="flex items-center justify-center mb-6">
                    <Logo large />
                </div>

                <h1 className="text-2xl md:text-3xl font-semibold text-center leading-snug mb-4">
                    Manage your udhaar with
                    <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full inline-flex items-center gap-2 ml-2">
                        Smart Khaata
                    </span>
                </h1>

                <p className="text-gray-500 text-center text-sm md:text-base leading-relaxed mb-8">
                    Track credit, payments and reminders for every customer, all in one place.
                </p>

                <h2 className="text-lg font-semibold text-gray-800 mb-4">{titles[mode]}</h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {mode === "signup" && (
                        <div>
                            <label htmlFor="name" className={labelClass}>Your name</label>
                            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className={inputClass} />
                        </div>
                    )}

                    {(mode === "login" || mode === "signup" || mode === "reset") && (
                        <div>
                            <label htmlFor="email" className={labelClass}>Email</label>
                            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                        </div>
                    )}

                    {(mode === "login" || mode === "signup") && (
                        <div>
                            <label htmlFor="password" className={labelClass}>Password</label>
                            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className={inputClass} />
                        </div>
                    )}

                    {mode === "phone" && (
                        <>
                            <div>
                                <label htmlFor="phone" className={labelClass}>Mobile number</label>
                                <div className="flex">
                                    <span className="flex items-center px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-100 text-gray-700">+91</span>
                                    <input
                                        id="phone"
                                        type="tel"
                                        inputMode="numeric"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                        disabled={otpSent}
                                        placeholder="10-digit number"
                                        className={`${inputClass} rounded-l-none`}
                                    />
                                </div>
                            </div>

                            {otpSent && (
                                <div>
                                    <label htmlFor="otp" className={labelClass}>6-digit OTP</label>
                                    <input
                                        id="otp"
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        autoFocus
                                        className={`${inputClass} tracking-widest`}
                                    />
                                    <div className="flex justify-between mt-2 text-sm">
                                        <button type="button" onClick={() => goMode("phone")} className="underline text-gray-600 hover:text-black">
                                            Change number
                                        </button>
                                        <button
                                            type="button"
                                            disabled={cooldown > 0 || busy}
                                            onClick={sendOtp}
                                            className="underline text-gray-600 hover:text-black disabled:text-gray-400 disabled:no-underline"
                                        >
                                            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <motion.button
                        type="submit"
                        disabled={busy}
                        whileHover={{ opacity: 0.9, scale: 1.03 }}
                        whileTap={{ opacity: 1, scale: 0.98 }}
                        className="w-full py-3 bg-black text-white rounded-full shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {busy ? "Please wait..." : buttonText[mode]}
                    </motion.button>
                </form>

                {/* Invisible reCAPTCHA for phone login lives here */}
                <div id="recaptcha-container"></div>

                {mode === "login" && (
                    <>
                        <p className="text-center my-4 text-sm text-gray-500">OR</p>
                        <div className="flex flex-col gap-3">
                            <motion.button
                                type="button"
                                onClick={handleGoogle}
                                disabled={busy}
                                whileHover={{ opacity: 0.9, scale: 1.03 }}
                                whileTap={{ opacity: 1, scale: 0.98 }}
                                className={outlineBtn}
                            >
                                <FcGoogle size={20} />
                                Continue with Google
                            </motion.button>

                            <motion.button
                                type="button"
                                onClick={() => goMode("phone")}
                                disabled={busy}
                                whileHover={{ opacity: 0.9, scale: 1.03 }}
                                whileTap={{ opacity: 1, scale: 0.98 }}
                                className={outlineBtn}
                            >
                                <MdPhoneAndroid size={20} />
                                Continue with phone number
                            </motion.button>
                        </div>
                    </>
                )}

                <div className="mt-6 flex flex-col gap-2 text-sm">
                    {mode === "login" && (
                        <>
                            <button type="button" onClick={() => goMode("reset")} className="text-left text-gray-600 underline hover:text-black">
                                Forgot password?
                            </button>
                            <button type="button" onClick={() => goMode("signup")} className="text-left text-gray-600 underline hover:text-black">
                                New here? Create an account
                            </button>
                        </>
                    )}
                    {mode === "phone" && (
                        <button type="button" onClick={() => goMode("login")} className="text-left text-gray-600 underline hover:text-black">
                            Use email or Google instead
                        </button>
                    )}
                    {(mode === "signup" || mode === "reset") && (
                        <button type="button" onClick={() => goMode("login")} className="text-left text-gray-600 underline hover:text-black">
                            Back to login
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

export default Auth