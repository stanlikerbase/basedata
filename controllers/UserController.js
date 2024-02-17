import bcrypt from 'bcrypt'
import { validationResult } from 'express-validator'
import jwt from 'jsonwebtoken'

import Session from '../models/Session.js'
import UserModel from '../models/User.js'

export const register = async (req, res) => {
	try {
		const errors = validationResult(req)
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array())
		}

		const password = req.body.password
		const salt = await bcrypt.genSalt(10)
		const hash = await bcrypt.hash(password, salt)

		const doc = new UserModel({
			email: req.body.email,
			fullName: req.body.fullName,
			avatarUrl: req.body.avatarUrl,
			passwordHash: hash,
		})

		const user = await doc.save()

		const token = generateToken(user._id)

		const { passwordHash, ...userData } = user._doc

		res.json({ ...userData, token })
	} catch (error) {
		console.log('error', error)
		res.status(500).json({
			message: 'Не удалось зарегистрироваться',
		})
	}
}

export const login = async (req, res) => {
	try {
		const user = await UserModel.findOne({ email: req.body.email })

		if (!user) {
			return res.status(400).json({ message: 'Неверный логин или пароль' })
		}

		const isValidPass = await bcrypt.compare(
			req.body.password,
			user.passwordHash
		)

		if (!isValidPass) {
			return res.status(400).json({ message: 'Неверный логин или пароль' })
		}

		// Получаем количество активных сессий для пользователя
		const sessions = await Session.find({ userId: user._id })

		// Устанавливаем лимит сессий
		const MAX_SESSIONS = user.maxConnections

		// Если сессий больше или равно лимиту, удаляем самую старую
		if (sessions.length >= MAX_SESSIONS) {
			// Сортируем сессии по дате создания и удаляем самую старую
			const oldestSession = sessions.sort(
				(a, b) => a.createdAt - b.createdAt
			)[0]
			await Session.findByIdAndDelete(oldestSession._id)
		}

		// Создаем новую сессию
		const newSession = new Session({
			userId: user._id,
			token: generateToken(user._id),
		})
		await newSession.save()
		await incrementConnectionCount(user._id)
		res.json({ token: newSession.token })
	} catch (error) {
		console.error('Login error:', error)
		res.status(500).json({ message: 'Не удалось авторизоваться' })
	}
}

export const logout = async (req, res) => {
	try {
		const token = req.headers.authorization?.split(' ')[1]

		if (!token) {
			return res.status(401).json({
				success: false,
				message: 'Токен не предоставлен',
			})
		}

		const sessionDeletionResult = await Session.deleteOne({ token })
		if (sessionDeletionResult.deletedCount === 0) {
			return res.status(404).json({
				success: false,
				message: 'Сессия не найдена или уже была удалена',
			})
		}
		await decrementConnectionCount(req.userId)

		res.json({
			success: true,
			message: 'Вы успешно вышли из системы',
		})
	} catch (error) {
		console.error('Ошибка при выходе:', error)
		res.status(500).json({
			success: false,
			message: 'Произошла ошибка при выходе',
		})
	}
}

export const getMe = async (req, res) => {
	try {
		const user = await UserModel.findById(req.userId)

		if (!user) {
			return res.status(404).json({
				message: 'Пользователь не найден',
			})
		}

		const { passwordHash, ...userData } = user._doc

		res.json(userData)
	} catch (error) {}
}

export const updateUserSetting = async (req, res) => {
	try {
		const userId = req.userId
		const { index, updatedSetting } = req.body

		// Проверка, что у пользователя не больше 5 настроек
		const user = await UserModel.findById(userId)

		if (Object.keys(user.settings).includes(index.toString())) {
			const updatedUser = await UserModel.findByIdAndUpdate(
				userId,
				{ $set: { [`settings.${index}`]: updatedSetting } },
				{ new: true }
			)

			return res.status(200).json({
				success: true,
				message: 'Настройка успешно обновлена',
				user: {
					_id: updatedUser._id,
					settings: updatedUser.settings,
				},
			})
		}

		if (!user || !user.settings || Object.keys(user.settings).length >= 5) {
			return res.status(400).json({
				success: false,
				message:
					'Нельзя добавить больше настроек. Максимальное количество - 5.',
			})
		}

		const updatedUser = await UserModel.findByIdAndUpdate(
			userId,
			{ $set: { [`settings.${index}`]: updatedSetting } },
			{ new: true }
		)

		if (!updatedUser) {
			return res.status(404).json({
				success: false,
				message: 'Пользователь не найден',
			})
		}

		return res.status(200).json({
			success: true,
			message: 'Настройка успешно сохранена',
			user: {
				_id: updatedUser._id,
				settings: updatedUser.settings,
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({
			success: false,
			message: 'Произошла ошибка при обновлении настройки',
		})
	}
}

export const getUserSetting = async (req, res) => {
	try {
		const user = await UserModel.findById(req.userId)

		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'Пользователь не найден',
			})
		}

		if (req.body !== null) {
			return res.status(200).json({
				success: true,
				message: 'Настройки успешно получены',
				user: {
					_id: user._id,
					settings: user.settings,
				},
			})
		}

		const { index } = req.body

		if (index < 0 || index >= user.settings.length) {
			return res.status(404).json({
				success: false,
				message: 'Настройка не найдена',
			})
		}

		res.status(200).json({
			success: true,
			message: 'Настройка успешно получена',
			user: {
				_id: user._id,
				settings: user.settings[index],
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({
			success: false,
			message: `Произошла ошибка при получении настройки: ${error.message}`,
		})
	}
}

export const deleteUserSetting = async (req, res) => {
	try {
		const userId = req.userId
		const { index } = req.body

		const updatedUser = await UserModel.findByIdAndUpdate(
			userId,
			{ $unset: { [`settings.${index}`]: 1 } },
			{ new: true }
		)

		if (!updatedUser) {
			return res.status(404).json({
				success: false,
				message: 'Пользователь не найден',
			})
		}

		// Используем $pull для удаления пустых элементов массива settings
		await UserModel.findByIdAndUpdate(
			userId,
			{ $pull: { settings: null, settings: undefined } },
			{ new: true }
		)

		res.status(200).json({
			success: true,
			message: 'Настройка успешно удалена',
			user: {
				_id: updatedUser._id,
				settings: updatedUser.settings,
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({
			success: false,
			message: 'Произошла ошибка при удалении настройки',
		})
	}
}

export const deleteAllUserSessionsByEmail = async (req, res) => {
	const { email } = req.body // Получаем email из тела запроса

	try {
		// Находим пользователя по email
		const user = await UserModel.findOne({ email: req.body.email })

		if (!user) {
			return res.status(400).json({ message: 'Неверный логин или пароль' })
		}
		// Получаем количество активных сессий для пользователя
		const sessions = await Session.find({ userId: user._id })
		res.json({
			success: true,
			sessions: `У пользователя ${email} количество сессий: ${sessions.length}.`,
			maxConnections: user.maxConnections
		})
	} catch (error) {
		console.error('Ошибка при удалении сессий пользователя:', error)
		res.status(500).json({
			success: false,
			message: 'Произошла ошибка при удалении сессий пользователя.',
			error: error.toString(),
		})
	}
}

export async function incrementConnectionCount(userId) {
	const user = await UserModel.findByIdAndUpdate(
		userId,
		{ $inc: { connections: 1 } },
		{ new: true }
	)

	return user.connections
}

export async function decrementConnectionCount(userId) {
	const user = await UserModel.findByIdAndUpdate(
		userId,
		{ $inc: { connections: -1 } },
		{ new: true }
	)

	return user.connections
}

function generateToken(userId) {
	const secretKey = 'secretTextForJWT'
	const token = jwt.sign({ _id: userId }, secretKey, {
		expiresIn: '7d',
	})

	return token
}
