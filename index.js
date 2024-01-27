import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import * as UserController from './controllers/UserController.js'
import checkAuth from './utils/checkAuth.js'
import { loginValidation, registerValidation } from './validations.js'

const mongoURL =
	'mongodb+srv://admin:a1b2c3@admin.cxgupo5.mongodb.net/data?retryWrites=true&w=majority'
mongoose
	.connect(
		'mongodb+srv://admin:a1b2c3@admin.cxgupo5.mongodb.net/datab?retryWrites=true&w=majority'
	)
	.then(() => {
		process.env.MONGO_DB_URL
	})
	.catch(err => {
		console.log('BD Error ', err)
	})

const app = express()
app.use(cors())
app.use(express.json())

app.post('/auth/login', loginValidation, UserController.login)
app.get('/auth/logout', checkAuth, UserController.logout)
app.post('/auth/register', registerValidation, UserController.register)

app.get('/auth/me', checkAuth, UserController.getMe)
app.post('/save-settings', checkAuth, UserController.updateUserSetting)
app.post('/get-settings', checkAuth, UserController.getUserSetting)
app.post('/delete-settings', checkAuth, UserController.deleteUserSetting)

app.listen(1337, err => {
	if (err) {
		return console.log(err)
	}
	console.log('Server OK')
})
