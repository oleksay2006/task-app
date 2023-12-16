import {
  type NextFunction,
  type Response
} from "express";
import User from "../models/user";
import jwt from "jsonwebtoken";
import AuthRequest from "../types/api/AuthRequest";

const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.headers.authorization && process.env.JWT_SECRET) {
      const token = req.headers.authorization.replace("Bearer ", "");
      // @ts-ignore
      const decoded: { _id: string; iat: number } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });

      if (!user) {
        throw new Error("Unauthorized");
      }

      req.token = token;
      req.user = user;
      next();
    } else {
      throw new Error("Unauthorized");
    }
  } catch (error) {
    next({
      statusCode: 401,
      error
    });
  }
};

export default authMiddleware;
