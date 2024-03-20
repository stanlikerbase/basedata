import mongoose, { Schema } from 'mongoose'

const sessionSchema = new Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: 'User',
	},
	token: {
		type: String,
		required: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
		index: { expires: '30d' },
	},
})

export default mongoose.model('Session', sessionSchema)
