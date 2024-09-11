import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import TechStock from "../schema/techStock.schema";
import { BadRequest } from "../errors/bad-request";
import { checkItemQuantity } from "../services/common.service";
import mongoose from "mongoose";
import Item from "../schema/item.schema";
import { Note } from "../schema/note.schema";

const TechnicianStockController = {
  get: async (req: Request, res: Response) => {
    const stock = await TechStock.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      {
        $lookup: {
          from: "Note",
          localField: "notes",
          foreignField: "_id",
          pipeline: [
            { $sort: { createdAt: -1 } },
            {
              $lookup: {
                from: "User",
                localField: "author",
                foreignField: "_id",
                as: "author",
              },
            },
            {
              $unwind: "$author",
            },
            {
              $project: {
                "author._id": 1,
                "author.username": 1,
                note: 1,
                createdAt: 1,
              },
            },
          ],
          as: "notes",
        },
      },
    ]).exec();
    res.status(STATUS_CODE.SUCCESS).send({ stock });
  },

  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {},
      queries: any = [];
    if (by && value) {
      if (by === "username") {
        queries = [
          {
            $match: { "technician.username": value },
          },
        ];
      } else if (by === "_id") {
        const ID: any = value;
        match = {
          _id: new mongoose.Types.ObjectId(ID),
        };
      } else {
        match = {
          [by as string]: { $regex: value, $options: "i" },
        };
      }
    }
    const totalCount = await TechStock.countDocuments(match);

    const stocks = await TechStock.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: startIndex },
      { $limit: limit },
      {
        $lookup: {
          from: "User",
          localField: "technicianId",
          foreignField: "_id",
          as: "technician",
        },
      },
      {
        $unwind: "$technician",
      },
      {
        $lookup: {
          from: "Item",
          localField: "itemId",
          foreignField: "_id",
          as: "item",
        },
      },
      {
        $unwind: "$item",
      },
      ...queries,
      {
        $group: {
          _id: "$technicianId",
          totalItems: { $sum: "$quantity" },
          username: { $first: "$technician.username" },
          items: {
            $push: {
              item: "$item.name",
              itemId: "$item._id",
              quantity: "$quantity",
              id: "$_id",
            },
          },
        },
      },
      {
        $project: {
          techId: "$_id",
          totalItems: 1,
          username: 1,
          items: 1,
          _id: 0,
        },
      },
    ]).exec();

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ stocks, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: Request, res: Response) => {
    const { note, ...rest } = req.body;
    if (rest.quantity < 1)
      throw new BadRequest("Quatity must be atleast 1", 400);

    await checkItemQuantity(rest);

    const session = await mongoose.startSession();
    try {
      //for starting a new transaction
      session.startTransaction();
      await Item.updateOne(
        { partId: rest.partId },
        { $inc: { quantity: -rest.quantity } },
        { session }
      );

      let newNote: any;
      if (note) {
        newNote = await Note.create([{ note, author: req?.currentUser!.id }], {
          session,
        });

        if (!newNote[0]._id) await session.abortTransaction();
      }

      const asset = await TechStock.create(
        [{ ...rest, notes: note ? newNote[0]._id : undefined }],
        { session }
      );

      //for committing all operations
      await session.commitTransaction();
      res.status(STATUS_CODE.CREATED).send({ asset });
    } catch (error: any) {
      // for rollback the operations
      await session.abortTransaction();
      // res.status(400).send(error.message);
      throw new BadRequest(error.message, 400);
    } finally {
      session.endSession();
    }
  },

  update: async (req: Request, res: Response) => {},

  remove: async (req: Request, res: Response) => {},
};

export default TechnicianStockController;
