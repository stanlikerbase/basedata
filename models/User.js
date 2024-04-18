import mongoose, { Schema } from 'mongoose'

const validateSettings = function (value) {
	const settingsKeys = Object.keys(value)
	return (
		settingsKeys.length <= 5 &&
		settingsKeys.every(key => typeof value[key] === 'object')
	)
}

const UserSchema = new mongoose.Schema(
	{
		fullName: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		passwordHash: {
			type: String,
			required: true,
		},
		subscribe: {
			type: String,
			required: true,
		},
		avatarUrl: String,
		settings: {
			type: Schema.Types.Mixed,
			default: {},
			validate: [
				{
					validator: validateSettings,
					message: 'Settings object can contain up to 5 key-value pairs.',
				},
			],
		},
		connections: {
			type: Number,
			default: 0,
		},
		maxConnections: {
			type: Number,
			default: 20,
		},
	},
	{
		timestamps: true,
	}
)

export default mongoose.model('User', UserSchema)
