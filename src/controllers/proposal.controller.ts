import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import Proposal from "../schema/proposal.schema";
import { BadRequest } from "../errors/bad-request";
import { Note } from "../schema/note.schema";
import mongoose from "mongoose";
import { NoteLookUp } from "../services/common.service";
import { s3Service } from "../services/s3.service";

const ProposalController = {
  get: async (req: Request, res: Response) => {
    const proposal = await Proposal.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      { $lookup: NoteLookUp },
    ]).exec();

    res.status(STATUS_CODE.SUCCESS).send({ proposal });
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
            $match: {
              "customer.username": {
                $regex: value,
                $options: "i",
              },
            },
          },
        ];
      } else {
        match = {
          [by as string]: { $regex: value, $options: "i" },
        };
      }
    }

    const totalCount = await Proposal.countDocuments(match);

    const proposals = await Proposal.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: startIndex },
      { $limit: limit },
      {
        $lookup: {
          from: "Customer",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      ...queries,
      {
        $project: {
          file: 1,
          customer: 1,
        },
      },
    ]).exec();

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ proposals, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: any, res: Response) => {
    let newNote = await Note.create({
      note: `Created new proposal`,
      author: req?.currentUser!.id,
    });
    if (!newNote._id) throw new BadRequest(MESSAGES.NOTE_ERROR);

    if (!req.file) throw new BadRequest("No file uploaded.");

    const fileResult = await s3Service.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const proposal = await Proposal.create({
      file: fileResult.Location,
      notes: newNote,
      customerId: req.body.customerId,
    });

    res.status(STATUS_CODE.CREATED).send({ proposal });
  },

  update: async (req: Request, res: Response) => {},

  remove: async (req: Request, res: Response) => {
    await Proposal.findByIdAndDelete(req.params.id);

    res.status(STATUS_CODE.NO_CONTENT).send({});
  },
};

export default ProposalController;
