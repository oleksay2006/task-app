import { connect } from "mongoose";
import logger from "../utils/logger";

export default async function connectToMongo() {
  connect(process.env.MONGODB_URL ? process.env.MONGODB_URL : "").then(() => {
    logger.info("Connected to MongoDB");
  });
}
