import mongoose, { model, Schema } from "mongoose";

interface ITask {
  description: string;
  completed?: boolean;
  userId: mongoose.Schema.Types.ObjectId;
}

const taskSchema = new Schema<ITask>({
  description: {
    type: String,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User"
  }
}, {
  timestamps: true
});

const Task = model<ITask>("Task", taskSchema);

export default Task;
