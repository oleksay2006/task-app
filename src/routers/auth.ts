import express, {
  type NextFunction,
  type Request,
  type Response,
  type Router
} from "express";
import authMiddleware from "../middleware/auth";
import AuthRequest from "../types/api/AuthRequest";
import User from "../models/user";
import { sendWelcomeEmail } from "../utils/sendGrid";
import logger from "../utils/logger";

const authRouter: Router = express.Router();

authRouter.post("/v1/auth/sign-up", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = new User(req.body);
    sendWelcomeEmail(user.email, user.name ? user.name : "Anonymus");
    const token = await user.generateAuthToken();
    res.send({
      user,
      token,
      message: "Signed-up successfully"
    });
  } catch (error) {
    next({
      statusCode: 400,
      error
    });
    logger.error(error);
  }
});

authRouter.post("/v1/auth/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByCredentials(req.body.email, req.body.password);
    const token = await user.generateAuthToken();
    res.send({
      user,
      token,
      message: "Logged in successfully"
    });
  } catch (error) {
    next({
      statusCode: 400,
      error
    });
  }
});

authRouter.post("/v1/auth/logout", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    req.user.tokens = req.user.tokens.filter((token) => {
      return token.token !== req.token;
    });

    await req.user.save();

    res.send({
      statusCode: 200,
      message: "Logged out successfully"
    });
  } catch (error) {
    next({
      statusCode: 500,
      error
    });
  }
});

authRouter.post("/v1/auth/logout-from-all-sessions", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    req.user.tokens = [];

    await req.user.save();

    res.send({
      statusCode: 200,
      message: "Logged out from all sessions successfully"
    });
  } catch (error) {
    next({
      statusCode: 500,
      error
    });
  }
});

export default authRouter;