import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { BadRequest } from "../errors/bad-request";
import { MESSAGES, STATUS_CODE } from "../constant/status";

interface IUserPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: IUserPayload;
    }
  }
}

export const Protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { jwt: accessToken, refreshJwt }: any = req.session;

  if (!accessToken && !refreshJwt) {
    throw new BadRequest(
      "Access Denied. No token provided.",
      STATUS_CODE.CUSTOM_CODE
    );
  }

  try {
    const payload = jwt.verify(
      accessToken,
      process.env.JWT_KEY!
    ) as IUserPayload;

    req.currentUser = payload;
    next();
  } catch (err) {
    try {
      const { iat, exp, ...userInfo }: any = jwt.verify(
        refreshJwt,
        process.env.JWT_REFRESH_KEY!
      ) as any;

      const accessToken = jwt.sign(userInfo, process.env.JWT_KEY!, {
        expiresIn: process.env.JWT_EXPIRES_IN,
      });

      const refreshToken = jwt.sign(userInfo, process.env.JWT_REFRESH_KEY!, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      });

      req.session = {
        jwt: accessToken,
        refreshJwt: refreshToken,
      };

      req.currentUser = userInfo;
      next();
    } catch (error) {
      throw new BadRequest(MESSAGES.NOT_LOGGED_IN, STATUS_CODE.CUSTOM_CODE);
    }
  }
};
