import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist"
  },
  external: [
    "mongodb",
    "pino",
    "mongoose",
    "joi",
    "express",
    "body-parser",
    "bcryptjs",
    "jsonwebtoken",
    "dotenv/config",
    "multer",
    "sharp",
    "@sendgrid/mail"
  ],
  plugins: [typescript()],
};