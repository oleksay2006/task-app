import express from 'express';
import pino from 'pino';
import sgMail from '@sendgrid/mail';
import mongoose, { Schema, model, connect } from 'mongoose';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import bodyParser from 'body-parser';
import 'dotenv/config';

var logger = pino({
    transport: {
        target: 'pino-pretty'
    },
});

const logErrors = (customError, req, res, next) => {
    logger.error(customError.error.stack);
    next(customError);
};
const clientErrorHandler = (customError, req, res, next) => {
    res.status(customError.statusCode).send({
        statusCode: customError.statusCode,
        message: customError.error.message
    });
};

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}
const sendWelcomeEmail = (email, name) => {
    sgMail.send({
        to: email,
        from: "oleksay2006@gmail.com",
        subject: "Thanks for joining in!",
        text: `Welcome to the app, ${name}. Let me know how you get along with the app.`
    });
};
const sendCancelationEmail = (email, name) => {
    sgMail.send({
        to: email,
        from: "oleksay2006@gmail.com",
        subject: "Sorry to see you go!",
        text: `Goodbye, ${name}. I hope to see you back sometime soon.`
    });
};

const taskSchema = new Schema({
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
const Task = model("Task", taskSchema);

const userSchema = new Schema({
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
            validator: function (value) {
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
            validator: function (value) {
                return !Joi.string().email().validate(value).error;
            },
            message: (props) => `Email ${props.value} is not valid`
        }
    },
    age: {
        type: Number,
        required: true,
        validate: {
            validator: function (value) {
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
userSchema.statics.findByCredentials = async (email, password) => {
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
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
        user.tokens = user.tokens.concat({ token });
        await user.save();
        return token;
    }
    else {
        throw new Error("Unable to generate token");
    }
};
userSchema.methods.toJSON = function () {
    const user = this;
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.tokens;
    delete userObject.avatar;
    return userObject;
};
userSchema.pre("save", async function (next) {
    const user = this;
    if (user.isModified("password")) {
        user.password = await bcrypt.hash(user.password, 8);
    }
    next();
});
userSchema.pre("deleteOne", { document: true }, async function (next) {
    const user = this;
    await Task.deleteMany({ userId: user._id });
    next();
});
const User = model("User", userSchema);

const authMiddleware = async (req, res, next) => {
    try {
        if (req.headers.authorization && process.env.JWT_SECRET) {
            const token = req.headers.authorization.replace("Bearer ", "");
            // @ts-ignore
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });
            if (!user) {
                throw new Error("Unauthorized");
            }
            req.token = token;
            req.user = user;
            next();
        }
        else {
            throw new Error("Unauthorized");
        }
    }
    catch (error) {
        next({
            statusCode: 401,
            error
        });
    }
};

const upload = multer({
    limits: {
        fileSize: 1000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please upload an image"));
        }
        cb(null, true);
    }
});
const userRouter = express.Router();
userRouter.get("/v1/users/me", authMiddleware, async (req, res, next) => {
    res.send(req.user);
});
userRouter.patch("/v1/users/me", authMiddleware, async (req, res, next) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ["name", "email", "password", "age"];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
    if (!isValidOperation) {
        return res.status(400).send({ code: 400, message: "You are trying to edit invalid field" });
    }
    try {
        if (req.user) {
            // @ts-ignore
            updates.forEach((update) => req.user[update] = req.body[update]);
            await req.user.save();
            return res.send({
                user: req.user,
                message: "Updated successfully"
            });
        }
    }
    catch (error) {
        return next({
            statusCode: 400,
            error
        });
    }
});
userRouter.delete("/v1/users/me", authMiddleware, async (req, res, next) => {
    try {
        await req.user.deleteOne();
        sendCancelationEmail(req.user.email, req.user.name ? req.user.name : "Anonymus");
        res.send({
            user: req.user,
            message: "Deleted successfully"
        });
    }
    catch (error) {
        next({
            statusCode: 500,
            error
        });
    }
});
userRouter.post("/v1/users/me/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
    if (req.file) {
        req.user.avatar = await sharp(req.file.buffer).resize({ width: 250, height: 250 }).png().toBuffer();
        await req.user.save();
        res.send({
            message: "Image uploaded successfully"
        });
    }
}, (error, req, res, next) => {
    res.status(400).send({
        statusCode: 400,
        error
    });
});
userRouter.delete("/v1/users/me/avatar", authMiddleware, async (req, res, next) => {
    try {
        req.user.avatar = null;
        await req.user.save();
        res.send({
            message: "Avatar deleted successfully"
        });
    }
    catch (error) {
        next({
            statusCode: 400,
            error
        });
    }
});
userRouter.get("/v1/users/:id/avatar", async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || !user.avatar) {
            throw new Error("Not found");
        }
        res.set("Content-Type", "image/png").send(user.avatar);
    }
    catch (error) {
        next({
            statusCode: 400,
            error
        });
    }
});

const taskRouter = express.Router();
taskRouter.post("/v1/tasks", authMiddleware, async (req, res, next) => {
    try {
        const task = new Task({
            ...req.body,
            userId: req.user._id
        });
        await task.save();
        res.status(201).send({
            task,
            message: "Created successfully"
        });
    }
    catch (error) {
        return next({
            statusCode: 400,
            error
        });
    }
});
taskRouter.get("/v1/tasks", authMiddleware, async (req, res, next) => {
    const matchOptions = {};
    const sortOptions = {};
    if (req.query.completed) {
        matchOptions.completed = req.query.completed === "true";
    }
    if (req.query.sortBy && typeof req.query.sortBy === "string") {
        const parts = req.query.sortBy.split(":");
        sortOptions[parts[0]] = parts[1] === "desc" ? -1 : 1;
    }
    try {
        await req.user.populate({
            path: "tasks",
            match: matchOptions,
            options: {
                limit: parseInt(req.query.limit),
                skip: parseInt(req.query.skip),
                sort: sortOptions
            }
        });
        res.send(req.user.tasks);
    }
    catch (error) {
        return next({
            statusCode: 500,
            error
        });
    }
});
taskRouter.get("/v1/tasks/:id", authMiddleware, async (req, res, next) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
        task ? res.send(task) : res.status(404).send({ code: 404, message: "Cant find such task" });
    }
    catch (error) {
        return next({
            statusCode: 500,
            error
        });
    }
});
taskRouter.patch("/v1/tasks/:id", authMiddleware, async (req, res, next) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ["description", "completed"];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
    if (!isValidOperation) {
        return res.status(400).send({ code: 400, message: "You are trying to edit invalid field" });
    }
    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
        if (task) {
            // @ts-ignore
            updates.forEach((update) => task[update] = req.body[update]);
            await task.save();
            return res.send({
                task,
                message: "Updated successfully"
            });
        }
        return res.status(404).send({ code: 404, message: "No such task" });
    }
    catch (error) {
        return next({
            statusCode: 500,
            error
        });
    }
});
taskRouter.delete("/v1/tasks/:id", authMiddleware, async (req, res, next) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        task ? res.send({ task, message: "Deleted successfully" }) : res.status(404).send({ code: 404, message: "No such task" });
    }
    catch (error) {
        return next({
            statusCode: 500,
            error
        });
    }
});

const authRouter = express.Router();
authRouter.post("/v1/auth/sign-up", async (req, res, next) => {
    try {
        const user = new User(req.body);
        sendWelcomeEmail(user.email, user.name ? user.name : "Anonymus");
        const token = await user.generateAuthToken();
        res.send({
            user,
            token,
            message: "Signed-up successfully"
        });
    }
    catch (error) {
        next({
            statusCode: 400,
            error
        });
        logger.error(error);
    }
});
authRouter.post("/v1/auth/login", async (req, res, next) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password);
        const token = await user.generateAuthToken();
        res.send({
            user,
            token,
            message: "Logged in successfully"
        });
    }
    catch (error) {
        next({
            statusCode: 400,
            error
        });
    }
});
authRouter.post("/v1/auth/logout", authMiddleware, async (req, res, next) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token;
        });
        await req.user.save();
        res.send({
            statusCode: 200,
            message: "Logged out successfully"
        });
    }
    catch (error) {
        next({
            statusCode: 500,
            error
        });
    }
});
authRouter.post("/v1/auth/logout-from-all-sessions", authMiddleware, async (req, res, next) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        res.send({
            statusCode: 200,
            message: "Logged out from all sessions successfully"
        });
    }
    catch (error) {
        next({
            statusCode: 500,
            error
        });
    }
});

async function connectToMongo() {
    connect(process.env.MONGODB_URL ? process.env.MONGODB_URL : "").then(() => {
        logger.info("Connected to MongoDB");
    });
}

const app = express();
const port = process.env.PORT;
connectToMongo().catch((err) => logger.error(err));
app.use(express.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(authRouter);
app.use(userRouter);
app.use(taskRouter);
app.use(logErrors);
app.use(clientErrorHandler);
app.listen((port), () => {
    logger.info(`Server is up on port ` + port);
});
