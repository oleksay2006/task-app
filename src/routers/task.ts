import express, {
  type NextFunction,
  type Response,
  type Router
} from "express";
import Task from "../models/task";
import authMiddleware from "../middleware/auth";
import AuthRequest from "../types/api/AuthRequest";

const taskRouter: Router = express.Router();

taskRouter.post("/v1/tasks", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  } catch (error) {
    return next({
      statusCode: 400,
      error
    });
  }
});

taskRouter.get("/v1/tasks", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const matchOptions: { completed?: boolean } = {};
  const sortOptions: { [index: string]: number } = {};

  if (req.query.completed) {
    matchOptions.completed = req.query.completed === "true";
  }

  if (req.query.sortBy && typeof req.query.sortBy === "string") {
    const parts: string[] = req.query.sortBy.split(":");
    sortOptions[parts[0]] = parts[1] === "desc" ? -1 : 1;
  }

  try {
    await req.user.populate({
      path: "tasks",
      match: matchOptions,
      options: {
        limit: parseInt(<string>req.query.limit),
        skip: parseInt(<string>req.query.skip),
        sort: sortOptions
      }
    });
    res.send(req.user.tasks);
  } catch (error) {
    return next({
      statusCode: 500,
      error
    });
  }
});

taskRouter.get("/v1/tasks/:id", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });

    task ? res.send(task) : res.status(404).send({ code: 404, message: "Cant find such task" });
  } catch (error) {
    return next({
      statusCode: 500,
      error
    });
  }
});

taskRouter.patch("/v1/tasks/:id", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const updates = Object.keys(req.body);
  const allowedUpdates: string[] = ["description", "completed"];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ code: 400, message: "You are trying to edit invalid field" })
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
      })
    }

    return res.status(404).send({ code: 404, message: "No such task" });
  } catch (error) {
    return next({
      statusCode: 500,
      error
    });
  }
});

taskRouter.delete("/v1/tasks/:id", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    task ? res.send({ task, message: "Deleted successfully" }) : res.status(404).send({ code: 404, message: "No such task" });
  } catch (error) {
    return next({
      statusCode: 500,
      error
    });
  }
});

export default taskRouter;
