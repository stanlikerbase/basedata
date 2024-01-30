import { body } from 'express-validator'

export const registerValidation = [
	body('email', 'Неверный формат почты'),
	body('password', 'Пароль должен быть минимум 5 символов').isLength({
		min: 5,
	}),
	body('fullName', 'Укажите имя').isLength({ min: 2 }),
	body('avatarUrl', 'Неправильная ссылка на аватар').optional().isURL(),
]

export const loginValidation = [
	body('email', 'Неверный формат почты'),
	body('password', 'Пароль должен быть минимум 5 символов').isLength({
		min: 5,
	}),
]

export const postCreateValidation = [
	body('title', 'Введите заголовок статьи').isLength({ min: 3 }).isString(),
	body('text', 'Пароль должен быть минимум 5 символов')
		.isLength({ min: 10 })
		.isString(),
	body('tags', 'Неверная ссылка на изображение').optional().isString(),
	body('imageUrl', 'Неверная ссылка на изображение').optional().isString(),
]
