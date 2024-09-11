import { MESSAGES, STATUS_CODE } from "../constant/status";
import crypto from "crypto";
import { Request, Response } from "express";
import { BadRequest } from "../errors/bad-request";
import jwt from "jsonwebtoken";
import UserService from "../services/user.service";
import { Password } from "../services/password.service";
import User from "../schema/user.schema";
import sendEmail from "../services/sendMail.service";
import { getHtml } from "../utils/functions";

export const createAndSendToken = async (
  user: any,
  res: Response,
  req: Request
) => {
  const userInfo = {
    id: user.id,
    email: user.email,
    role: user.role.name ?? "none",
    createdAt: user.createdAt,
  };

  const userJwt = jwt.sign(userInfo, process.env.JWT_KEY!, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  const refreshJwt = jwt.sign(userInfo, process.env.JWT_REFRESH_KEY!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

  req.session = {
    jwt: userJwt,
    refreshJwt,
  };

  res.status(STATUS_CODE.SUCCESS).send({ user });
};

const AuthController = {
  //! We might remove this function: because only admin can create new user
  register: async (req: Request, res: Response) => {
    const { email } = req.body;

    if (req.body.role === "super-admin") {
      throw new BadRequest(MESSAGES.PERMISSION_DENIED, STATUS_CODE.NO_ACCESS);
    }

    if (await UserService.isExist(email)) {
      throw new BadRequest(MESSAGES.EMAIL_ALREADY_EXISTS);
    }

    await UserService.createNew(req.body);

    res.status(STATUS_CODE.SUCCESS).send({ message: "success" });
  },

  // /v1/auth/signIn
  signIn: async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate("role");

    if (!user) {
      throw new BadRequest("Email or password is incorrect");
    }

    const passwordMatch = await Password.compare(user.password, password);

    if (!passwordMatch) {
      throw new BadRequest("Email or password is incorrect");
    }

    createAndSendToken(user, res, req);
  },

  refreshToken: (req: Request, res: Response) => {
    const refreshToken = req.session!.refreshJwt;
    if (!refreshToken) {
      throw new BadRequest("Access Denied. No refresh token provided.");
    }

    const { iat, exp, ...userInfo }: any = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_KEY!
    );

    const accessToken = jwt.sign(userInfo, process.env.JWT_KEY!, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
    const refreshJwt = jwt.sign(userInfo, process.env.JWT_REFRESH_KEY!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    });

    req.session = {
      jwt: accessToken,
      refreshJwt,
    };
    res.status(STATUS_CODE.NO_CONTENT).send({});
  },

  // /v1/auth/signOut
  signOut: (req: Request, res: Response) => {
    req.session = null;

    res.status(200).send({});
  },

  profile: async (req: Request, res: Response) => {
    const user = await UserService.getInfo(req?.currentUser!.email);
    res
      .status(STATUS_CODE.SUCCESS)
      .send({ user: user ?? req?.currentUser ?? null });
  },

  forgotPassword: async (req: Request, res: Response) => {
    // 1) Get user based on POSTed email
    const user: any = await User.findOne({ email: req.body.email });

    if (!user) {
      throw new BadRequest("There is no user with email address.");
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();

    await user.save({ validateBeforeSave: false });

    //preparing email data/contents
    const userData = {
      ...user._doc,
      link: `https://cofax.geeky.dev/create-new-password/${resetToken}`,
    };

    const forgotPasswordHTML: any = await getHtml(
      "/emails/forget_password.ejs",
      userData
    );

    // 3) Send it to user's email
    try {
      await sendEmail({
        email: user.email,
        subject: "Cofax - Reset Password",
        message: "Forgot your password?",
        content: forgotPasswordHTML,
      });

      res.status(200).send({ message: "success" });
    } catch (err: any) {
      console.log("err", err);

      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      throw new BadRequest(
        "There was an error sending the email. Try again later!",
        500
      );
    }
  },

  resetPassword: async (req: Request, res: Response) => {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user: any = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    // 2) If token has expired
    if (!user) {
      throw new BadRequest("Token is invalid or has expired", 400);
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3) Update changedPasswordAt property for the user
    // 4) Log the user in, send JWT

    createAndSendToken(user, res, req);
  },

  updatePassword: async (req: Request, res: Response) => {
    // 1) Get user from collection
    const user: any = await User.findById(req.currentUser!.id).select(
      "+password"
    );

    // 2) Check if POSTed current password is correct
    if (!(await Password.compare(user.password, req.body.password))) {
      throw new BadRequest("Your current password is wrong.", 401);
    }

    // 3) If so, update password
    user.password = req.body.password;
    await user.save();
    // User.findByIdAndUpdate will NOT work as intended!

    // 4) Log user in, send JWT
    createAndSendToken(user, res, req);
  },
};

export default AuthController;
