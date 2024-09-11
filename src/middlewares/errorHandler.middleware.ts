import { Request, NextFunction, Response } from "express";
import { CustomError } from "../errors/custom-error";

//Global error handler
export const errorHandler = (
  err: Error | any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof CustomError) {
    return res.status(err.statusCode).send({ errors: err.serializeErrors() });
  }

  //TODO: We can handle more error here
  let customMessage = null;
  if (err.code === 11000) {
    customMessage = `Duplicate entry found for: ${Object.keys(err?.keyValue)}`;
  }

  res.status(400).send({
    errors: [
      {
        message:
          customMessage ??
          err.message ??
          err?._message ??
          "Something went wrong",
      },
    ],
  });
};
