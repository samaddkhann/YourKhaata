import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { getCurrentUser } from "../controllers/user.controller.js"
import { deleteAccount, exportMyData, updateProfile } from "../controllers/settings.controller.js"

const userRouter = express.Router()

userRouter.get("/current-user", isAuth, getCurrentUser)
userRouter.patch("/me", isAuth, updateProfile)
userRouter.get("/export", isAuth, exportMyData)
userRouter.delete("/me", isAuth, deleteAccount)

export default userRouter