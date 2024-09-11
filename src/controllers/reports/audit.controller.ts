import { Request, Response } from "express";
import AuditReport from "../../schema/report/billingAudit.schema";
import { STATUS_CODE } from "../../constant/status";
import { BadRequest } from "../../errors/bad-request";
import { firstAndLastDateOfMonth } from "../../utils/functions";
import mongoose from "mongoose";
import Company from "../../schema/companyInfo.schema";

const AuditController = {
  getAll: async (req: Request, res: Response) => {
    console.log("Called");
    const [dates, companies] = await Promise.all([
      AuditReport.aggregate([
        {
          $group: {
            _id: {
              month: { $month: "$createdAt" },
              year: { $year: "$createdAt" },
            },
          },
        },
        {
          $sort: {
            "_id.year": -1, 
            "_id.month": -1, 
          },
        },
        { $limit: 10 }, // Limit to the 10 most recent entries
      ]),
      Company.find({}, "name"),
    ]);
    res.status(STATUS_CODE.SUCCESS).send({ dates, companies });
  },

  getByDate: async (req: Request, res: Response) => {
    let { by = "", value = "" } = req.query;
    if (by === "all") value = "";

    if (!req.body.date) {
      throw new BadRequest("Date is required");
    }

    const [startOfMonth, endOfMonth] = firstAndLastDateOfMonth(req.body.date);

    let match = {
      createdAt: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    };

    const totalCount = await AuditReport.countDocuments(match);

    const auditReports = await AuditReport.aggregate([
      {
        $match: match,
      },
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
          pipeline: [
            {
              $lookup: {
                from: "Customer",
                localField: "customerId",
                foreignField: "_id",
                as: "customer",
                pipeline: [
                  {
                    $lookup: {
                      from: "Company",
                      localField: "companyId",
                      foreignField: "_id",
                      as: "company",
                    },
                  },
                  { $unwind: "$company" },
                  {
                    $match: {
                      "company._id": new mongoose.Types.ObjectId(
                        req.body.companyId
                      ),
                    },
                  },
                  {
                    $project: {
                      "company.logo": 0,
                    },
                  },
                ],
              },
            },
            { $unwind: "$customer" },
            {
              $lookup: {
                from: "Item",
                localField: "itemId",
                foreignField: "_id",
                as: "item",
              },
            },
            { $unwind: "$item" },
          ],
        },
      },
      { $unwind: "$asset" },
      {
        $project: {
          monoBegin: 1,
          colorBegin: 1,
          monoEnd: 1,
          colorEnd: 1,
          dueDate: 1,
          asset: 1,
          id: "$_id",
          _id: 0,
        },
      },
    ]);

    res.status(STATUS_CODE.SUCCESS).send({
      auditReports,
    });
  },
};

export default AuditController;
