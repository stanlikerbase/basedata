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
app.get('/auth/logout', checkAuth, UserController.logout)
app.get(
	'/delete-all-sessions',
	checkAuth,
	UserController.deleteAllUserSessionsByEmail
)
app.post('/auth/register', registerValidation, UserController.register)

app.get('/auth/me', checkAuth, UserController.getMe)
app.post('/save-settings', checkAuth, UserController.updateUserSetting)
app.post('/get-settings', checkAuth, UserController.getUserSetting)
app.post('/delete-settings', checkAuth, UserController.deleteUserSetting)

app.post('/get-count-settings', checkAuth, UserController.deleteAllUserSessionsByEmail)

app.listen(1337, err => {
	if (err) {
		return console.log(err)
	}
	console.log('Server OK')
})
