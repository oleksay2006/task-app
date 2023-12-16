import {
  type Request,
  type Response,
  type NextFunction
} from "express";
import logger from "../utils/logger";

interface CustomError {
  statusCode: number;
  error: Error;
}

const logErrors = (
  customError: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(customError.error.stack);
  next(customError);
};

const clientErrorHandler = (
  customError: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(customError.statusCode).send({
    statusCode: customError.statusCode,
    message: customError.error.message
  });
};

export { logErrors, clientErrorHandler };
