import {
  model,
  Schema,
  type Model,
  type HydratedDocument
} from "mongoose";
import bcrypt from "bcryptjs";
import Joi from "joi";
import jwt from "jsonwebtoken";
import IUser from "../types/entities/User";
import Task from "./task";

interface IUserMethods {
  generateAuthToken(): Promise<string>;
  getPublicProfile(): {

  }
}

interface UserModel extends Model<IUser, {}, IUserMethods> {
  findByCredentials(email: string, password: string): Promise<HydratedDocument<IUser, IUserMethods>>;
}

const userSchema = new Schema<IUser, UserModel, IUserMethods>({
  name: {
    type: String,
    default: "Anonymous",
    trim: true
  },
  password: {
    type: String,
    required: true,
    trim: true,
    minLength: 6,
    validate: {
      validator: function(value: string) {
        return !value.includes("password");
      },
      message: (props) => "Password contains 'password' word"
    }
  },
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(value: string) {
        return !Joi.string().email().validate(value).error;
      },
      message: (props) => `Email ${props.value} is not valid`
    }
  },
  age: {
    type: Number,
    required: true,
    validate: {
      validator: function(value: number) {
        return value > 0;
      },
      message: (props) => `Age ${props.value} is negative number`
    }
  },
  tokens: [{
      token: {
        type: String,
        required: true
      }
  }],
  avatar: {
    type: Buffer
  }
}, {
  timestamps: true
});

userSchema.virtual("tasks", {
  ref: "Task",
  localField: "_id",
  foreignField: "userId"
});

userSchema.statics.findByCredentials = async (email: string, password: string) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Unable to login");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Unable to login");
  }

  return user;
};
userSchema.methods.generateAuthToken = async function () {
  const user = this;

  if (process.env.JWT_SECRET) {
    const token: string = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    user.tokens = user.tokens.concat({ token });
    await user.save();

    return token;
  } else {
    throw new Error("Unable to generate token");
  }
};
userSchema.methods.toJSON = function () {
  const user = this;
  const userObject: Partial<IUser> = user.toObject();

  delete userObject.password;
  delete userObject.tokens;
  delete userObject.avatar;

  return userObject;
};

userSchema.pre("save", async function(next) {
  const user = this;

  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 8);
  }

  next();
});
userSchema.pre("deleteOne", { document: true }, async function(next) {
  const user = this;

  await Task.deleteMany({ userId: user._id });

  next();
});

const User = model<IUser, UserModel>("User", userSchema);

export default User;
