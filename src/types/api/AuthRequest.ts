import { type Request } from "express";
import IUser from "../entities/User";
import { type HydratedDocument } from "mongoose";

export default interface AuthRequest extends Request {
  user: HydratedDocument<IUser>;
  token: string;
}
