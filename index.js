import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import * as UserController from './controllers/UserController.js'
import checkAuth from './utils/checkAuth.js'
import { loginValidation, registerValidation } from './validations.js'

mongoose
	.connect(
		process.env.MONGO_DB_URL
	)
	.then(() => {
		console.log('DB ok')
	})
	.catch(err => {
		console.log('BD Error ', err)
	})

const app = express()
app.use(cors())
app.use(express.json())

app.post('/auth/login', loginValidation, UserController.login)
app.post('/auth/change-pass', UserController.changePassword)
app.get('/auth/logout', UserController.logout)
app.get('/auth/me', checkAuth, UserController.getMe)
app.post('/auth/change-subscribe', UserController.changeSubscribe);
app.post('/auth/addTelegram', UserController.saveTelegramID)
app.get(
	'/delete-all-sessions',
	checkAuth,
	UserController.deleteAllUserSessionsByEmail
)
app.post('/auth/register', registerValidation, UserController.register)

app.post('/auth/user', UserController.getUser)
app.get('/logins', UserController.getAllLogins)
app.post('/save-settings', checkAuth, UserController.updateUserSetting)
app.post('/get-settings', checkAuth, UserController.getUserSetting)
app.post('/delete-settings', checkAuth, UserController.deleteUserSetting)
app.post('/get-tg-user', UserController.checkOnTGid)
app.post('/get-count-settings', checkAuth, UserController.deleteAllUserSessionsByEmail)

app.delete('/auth/sessions', UserController.deleteAllSessions);
app.delete('/auth/user-sessions', UserController.deleteAllSessionsForUser);

app.listen(1337, err => {
	if (err) {
		return console.log(err)
	}
	console.log('Server OK')
})
