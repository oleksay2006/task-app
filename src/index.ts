import express from "express";
import logger from "./utils/logger";
import {
  logErrors,
  clientErrorHandler
} from "./middleware/errorHandlers";
import userRouter from "./routers/user";
import taskRouter from "./routers/task";
import authRouter from "./routers/auth";
import connectToMongo from "./db/mongoose";
import bodyParser from "body-parser";
import "dotenv/config";

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
