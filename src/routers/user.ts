import express, {
  type Request,
  type NextFunction,
  type Response,
  type Router
} from "express";
import { sendCancelationEmail } from "../utils/sendGrid";
import authMiddleware from "../middleware/auth";
import AuthRequest from "../types/api/AuthRequest";
import multer from "multer";
import User from "../models/user";
import sharp from "sharp";

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

const userRouter: Router = express.Router();

userRouter.get("/v1/users/me", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  res.send(req.user);
});

userRouter.patch("/v1/users/me", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const updates = Object.keys(req.body);
  const allowedUpdates: string[] = ["name", "email", "password", "age"];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ code: 400, message: "You are trying to edit invalid field" })
  }

  try {
    if (req.user) {
      // @ts-ignore
      updates.forEach((update) => req.user[update] = req.body[update]);
      await req.user.save();

      return res.send({
        user: req.user,
        message: "Updated successfully"
      })
    }
  } catch (error) {
    return next({
      statusCode: 400,
      error
    });
  }
});

userRouter.delete("/v1/users/me", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await req.user.deleteOne();
    sendCancelationEmail(req.user.email, req.user.name ? req.user.name : "Anonymus");

    res.send({
      user: req.user,
      message: "Deleted successfully"
    });
  } catch (error) {
    next({
      statusCode: 500,
      error
    });
  }
});

userRouter.post("/v1/users/me/avatar", authMiddleware, upload.single("avatar"), async (req: AuthRequest, res: Response) => {
  if (req.file) {
    req.user.avatar = await sharp(req.file.buffer).resize({ width: 250, height: 250 }).png().toBuffer();

    await req.user.save();

    res.send({
      message: "Image uploaded successfully"
    });
  }
}, (error: Error, req: AuthRequest, res: Response, next: NextFunction) => {
  res.status(400).send({
    statusCode: 400,
    error
  });
});

userRouter.delete("/v1/users/me/avatar", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    req.user.avatar = null;

    await req.user.save();

    res.send({
      message: "Avatar deleted successfully"
    });
  } catch (error) {
    next({
      statusCode: 400,
      error
    });
  }
});

userRouter.get("/v1/users/:id/avatar", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || !user.avatar) {
      throw new Error("Not found");
    }

    res.set("Content-Type", "image/png").send(user.avatar);
  } catch (error) {
    next({
      statusCode: 400,
      error
    });
  }
});

// userRouter.get("/v1/send-email", async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const msg = {
//       to: "oleksay2006@gmail.com", // Change to your recipient
//       from: "oleksii.yatsentiuk@proton.me", // Change to your verified sender
//       subject: "Sending with SendGrid is Fun",
//       text: "and easy to do anywhere, even with Node.js",
//       html: '<strong>and easy to do anywhere, even with Node.js</strong>',
//     };
//
//     await sgMail.send(msg);
//     logger.info("Email has been sent");
//
//     res.send({
//       message: "Email has been sent"
//     });
//   } catch (error) {
//     next({
//       statusCode: 400,
//       error
//     });
//   }
// });

export default userRouter;
