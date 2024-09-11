import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import mongoose from "mongoose";
import MeterReading from "../schema/meterReading.schema";
import { BadRequest } from "../errors/bad-request";

const MeterReadingController = {
  get: async (req: Request, res: Response) => {
    const meterReading = await MeterReading.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      {
        $lookup: {
          from: "Customer",
          localField: "username",
          foreignField: "username",
          as: "customer",
          pipeline: [
            {
              $project: {
                name: 1,
                username: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$customer" },
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
          pipeline: [
            {
              $project: {
                assetNumber: 1,
                model: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$asset" },
      {
        $project: {
          username: 0,
          assetId: 0,
        },
      },
    ]);
    res.status(STATUS_CODE.SUCCESS).send({ meterReading });
  },

  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};
    if (by && value) {
      match = {
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    const totalCount = await MeterReading.countDocuments(match);

    const meterReadings = await MeterReading.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: startIndex },
      { $limit: limit },
      {
        $lookup: {
          from: "Customer",
          localField: "username",
          foreignField: "username",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: "$asset" },
      {
        $project: {
          color: 1,
          mono: 1,
          createdAt: 1,
          invoiced: 1,
          customerUserName: "$customer.username",
          customerName: "$customer.name",
          assetId: "$asset.assetNumber",
          model: "$asset.model",
        },
      },
    ]).exec();

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ meterReadings, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: Request, res: Response) => {
    const lastReading: any = await MeterReading.findOne({
      assetId: req.body.assetId,
      username: req.body.username,
    }).sort({
      createdAt: -1,
    });
    if (
      lastReading?.mono > req.body.mono ||
      lastReading?.color > req.body.color
    )
      throw new BadRequest(
        `You can't create a reading lower than the previous readings.`
      );
    const meterReading = await MeterReading.create(req.body);

    res.status(STATUS_CODE.CREATED).send({
      meterReading,
    });
  },

  update: async (req: Request, res: Response) => {
    const [prevReading, nextReading]: any = await Promise.all([
      MeterReading.findOne({
        _id: { $lt: req.params.id },
        assetId: req.body.assetId,
        username: req.body.username,
      })
        .sort({ _id: -1 })
        .limit(1),
      MeterReading.findOne({
        _id: { $gt: req.params.id },
        assetId: req.body.assetId,
        username: req.body.username,
      })
        .sort({ _id: 1 })
        .limit(1),
    ]);

    if (
      prevReading &&
      (prevReading?.mono > req.body.mono || prevReading?.color > req.body.color)
    )
      throw new BadRequest(
        `You can't update a reading lower than the previous readings.`
      );

    if (
      nextReading &&
      (nextReading?.color < req.body.color || nextReading?.mono < req.body.mono)
    )
      throw new BadRequest(
        `You can't update a reading higher than the next readings.`
      );

    const meterReading = await MeterReading.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.status(STATUS_CODE.SUCCESS).send({ meterReading });
  },

  updateStatus: async (req: Request, res: Response) => {
    const data: any = {
      invoiced: req.body.invoiced,
    };
    if (req.body.sent) data.sent = req.body.sent;
    await MeterReading.findByIdAndUpdate(req.params.id, data, { new: true });
    res.status(STATUS_CODE.SUCCESS).send({ message: "success" });
  },

  remove: async (req: Request, res: Response) => {
    await MeterReading.findByIdAndDelete(req.params.id);
    res.status(STATUS_CODE.NO_CONTENT).send({});
  },
};

export default MeterReadingController;
