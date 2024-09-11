import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import Notification from "../schema/notification.schema";
import mongoose from "mongoose";

const NotificationController = {
  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {
      createdAt: { $gte: req.currentUser!.createdAt },
    };
    if (by && value) {
      match = {
        ...match,
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    const totalCount = await Notification.countDocuments(match);

    const notifications: any = await Notification.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: startIndex },
      { $limit: limit },
      {
        $project: {
          title: 1,
          message: 1,
          createdAt: 1,
          link: 1,
          read: {
            $cond: {
              if: {
                $in: [
                  new mongoose.Types.ObjectId(req.currentUser!.id),
                  "$readBy",
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },
    ]).exec();

    res.status(STATUS_CODE.SUCCESS).send({
      notifications,
      pages: Math.ceil(totalCount / limit),
    });
  },

  updateReadBy: async (req: Request, res: Response) => {
    const data = await Notification.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { readBy: req.currentUser!.id },
      },
      { new: true }
    );

    console.log("data", data);

    res.status(STATUS_CODE.NO_CONTENT).send({});
  },
};

export default NotificationController;
