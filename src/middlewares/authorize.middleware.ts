import { NextFunction, Request, Response } from "express";
import { BadRequest } from "../errors/bad-request";
import { MESSAGES } from "../constant/status";

export const IsAuthorize = (...roles: any[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req?.currentUser!.role)) {
      throw new BadRequest(MESSAGES.PERMISSION_DENIED, 403);
    }

    next();
  };
};
