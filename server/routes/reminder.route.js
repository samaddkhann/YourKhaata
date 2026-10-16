import express from "express"
import isAuth from "../middlewares/isAuth.js"
import {
    cancelReminder,
    markCompleted,
    markSent,
    updateReminder,
} from "../controllers/reminder.controller.js"

const reminderRouter = express.Router()

reminderRouter.patch("/:reminderId", isAuth, updateReminder)
reminderRouter.post("/:reminderId/sent", isAuth, markSent)
reminderRouter.post("/:reminderId/complete", isAuth, markCompleted)
reminderRouter.post("/:reminderId/cancel", isAuth, cancelReminder)

export default reminderRouter