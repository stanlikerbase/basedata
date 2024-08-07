import bcrypt from 'bcrypt'
import { validationResult } from 'express-validator'
import jwt from 'jsonwebtoken'

import Session from '../models/Session.js'
import UserModel from '../models/User.js'

export const getAllLogins = async (req, res) => {
    try {
        // Находим всех пользователей и выбираем только поля email и subscribe
        const users = await UserModel.find({}, 'email subscribe');

        // Извлекаем email и subscribe из пользователей
        const logins = users.map(user => ({
            email: user.email,
            subscribe: user.subscribe
        }));

        res.json({
            success: true,
            logins
        });
    } catch (error) {
        console.error('Ошибка при получении логинов:', error);
        res.status(500).json({
            success: false,
            message: 'Произошла ошибка при получении логинов',
        });
    }
};

export const checkOnTGid = async (req, res) => {
    try {
        const { telegramID } = req.body;

        // Проверяем, что telegramID задан и не пустой
        if (!telegramID) {
            return res.status(400).json({
                success: false,
                message: 'Не указан telegramID',
            });
        }

        // Ищем пользователя по telegramID только среди тех, у кого это поле существует
        const user = await UserModel.findOne({ telegramID: { $exists: true, $eq: telegramID } });

        if (!user) {
            return res.json({
            success: false
        });
        }

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        res.status(500).json({
            success: false,
            message: 'Произошла ошибка при получении данных',
        });
    }
};

export async function saveTelegramID(req, res) {
    try {
	const { email, telegramID } = req.body;
        const user = await UserModel.findOne({ email });

        if (user) {
            user.telegramID = telegramID;
            await user.save();
            res.json({
            success: true,
            message: 'telegramID успешно добавлен',
            subscribe: user.subscribe,
        });
        } else {
            console.log('Пользователь не найден.');
        }
    } catch (error) {
        console.error('Ошибка при сохранении ID в базу данных:', error);
        throw error;
    }
}

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
			subscribe: req.body.subscribe,
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

export const changeSubscribe = async (req, res) => {
    try {
        const { email, newSubscribe } = req.body;

        // Находим пользователя по email
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден',
            });
        }

        // Обновляем поле подписки
        user.subscribe = newSubscribe;
        await user.save();

        res.json({
            success: true,
            message: 'Подписка успешно изменена',
            subscribe: user.subscribe,
        });
    } catch (error) {
        console.error('Ошибка при изменении подписки:', error);
        res.status(500).json({
            success: false,
            message: 'Произошла ошибка при изменении подписки',
        });
    }
};

export const getUser = async (req, res) => {
    try {
        const { email } = req.body;

        // Находим пользователя по email
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден',
            });
        }

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('Ошибка при получении пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Произошла ошибка при получении пользователя',
        });
    }
};


export const login = async (req, res) => {
	try {
		const user = await UserModel.findOne({ email: req.body.email })
		// const ver = '2.0.19'
		// console.log(ver, req.body.version, req.body.version === ver)
		// if (req.body.version === ver) {
		// 	return res.status(400).json({ message: 'Необходимо обновиться до версии ' + ver })
		// }

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

		// Преобразование даты подписки из строки в объект Date
		const subscriptionDate = new Date(user.subscribe.split('.').reverse().join('-'));

		// Проверка, не истекла ли дата подписки
		if (subscriptionDate < new Date()) {
			return res.status(403).json({ message: 'Срок вашей подписки истек. Напишите @wudu_z для продления.' });
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
				success: true,
				message: 'Токен не предоставлен',
			})
		}

		const sessionDeletionResult = await Session.deleteOne({ token })
		if (sessionDeletionResult.deletedCount === 0) {
			return res.status(404).json({
				success: true,
				message: 'Сессия не найдена или уже была удалена',
			})
		}
		// await decrementConnectionCount(req.userId)

		res.json({
			success: true,
			message: 'Вы успешно вышли из системы',
		})
	} catch (error) {
		console.error('Ошибка при выходе:', error)
		res.status(500).json({
			success: true,
			message: 'Произошла ошибка при выходе',
		})
	}
}

export const changePassword = async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;

        // Находим пользователя по email
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден',
            });
        }

        // Генерируем хеш нового пароля
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // Обновляем пароль в базе данных
        user.passwordHash = newHash;
        await user.save();

        res.json({
            success: true,
            message: 'Пароль успешно изменен',
        });
    } catch (error) {
        console.error('Ошибка при изменении пароля:', error);
        res.status(500).json({
            success: false,
            message: 'Произошла ошибка при изменении пароля',
        });
    }
};

export const getMe = async (req, res) => {
	try {
		const user = await UserModel.findById(req.userId)

		// Преобразование даты подписки из строки в объект Date
		const subscriptionDate = new Date(user.subscribe.split('.').reverse().join('-'));

		// Проверка, не истекла ли дата подписки
		if (subscriptionDate < new Date()) {
			return res.status(403).json({ 
				message: 'Сессия не найдена или истекла. Пожалуйста, войдите заново.',
			});
		}

		if (!user) {
			return res.status(404).json({
				message: 'Сессия не найдена или истекла. Пожалуйста, войдите заново.',
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

// Функция для сброса всех сессий у всех пользователей
export const deleteAllSessions = async (req, res) => {
    try {
        // Удаляем все сессии из коллекции Session
        const result = await Session.deleteMany({});

        res.status(200).json({
            success: true,
            message: `Удалено ${result.deletedCount} сессий`,
        });
    } catch (error) {
        console.error('Ошибка при удалении всех сессий:', error);
        res.status(500).json({
            success: false,
            message: 'Произошла ошибка при удалении всех сессий',
        });
    }
};

// Функция для сброса всех сессий у одного пользователя
export const deleteAllSessionsForUser = async (req, res) => {
    try {
        const { email } = req.body;

        // Находим пользователя по email
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден',
            });
        }

        // Удаляем все сессии для данного пользователя
        const result = await Session.deleteMany({ userId: user._id });

        res.status(200).json({
            success: true,
            message: `Удалено ${result.deletedCount} сессий для пользователя ${email}`,
        });
    } catch (error) {
        console.error('Ошибка при удалении сессий для пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Произошла ошибка при удалении сессий для пользователя',
        });
    }
};

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
    );

    if (!user) {
        throw new Error(`User with ID ${userId} not found`);
    }

    return user.connections;
}

function generateToken(userId) {
	const secretKey = process.env.JWT_SECRET
	const token = jwt.sign({ _id: userId }, secretKey, {
		expiresIn: '30d',
	})

	return token
}
