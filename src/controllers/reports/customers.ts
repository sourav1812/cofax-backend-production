
import mongoose from "mongoose";
import CustomersReport from "../../schema/report/customers.schema";
import { STATUS_CODE } from "../../constant/status";
import { Request, Response } from "express";

const ReportController = {
  get: async (req: Request, res: Response) => {
    const report = await CustomersReport.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      {
        $lookup:{
            from: "Customer",
            localField: "success",
            foreignField: "_id",
            as: "success"
        },
      },
      {
        $lookup:{
            from: "Customer",
            localField: "failed",
            foreignField: "_id",
            as: "failed"
        },
      },
    ]);
    res.status(STATUS_CODE.SUCCESS).send({ report });
  },
};

export default ReportController;
