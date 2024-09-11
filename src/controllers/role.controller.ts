import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import { NoteLookUp } from "../services/common.service";
import { BadRequest } from "../errors/bad-request";
import { Note } from "../schema/note.schema";
import mongoose from "mongoose";
import Role from "../schema/role.schema";

const RoleController = {
  get: async (req: Request, res: Response) => {
    const role = await Role.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      {
        $lookup: NoteLookUp,
      },
      {
        $project: {
          name: 1,
          description: 1,
          isActive: 1,
          notes: 1,
          id: "$_id",
          _id: 0,
        },
      },
    ]);
    res.status(STATUS_CODE.SUCCESS).send({ role });
  },

  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = { name: { $ne: "super-admin" } };
    if (by && value) {
      match = {
        ...match,
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    const totalCount = await Role.countDocuments(match);

    const roles = await Role.aggregate([
      { $match: match },
      { $skip: startIndex },
      { $limit: limit },
    ]).exec();

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ roles, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: Request, res: Response) => {
    const { note, ...rest } = req.body;

    let newNote: any;
    if (note) {
      newNote = await Note.create({ note, author: req?.currentUser!.id });
      if (!newNote._id)
        throw new BadRequest("Something went wronge try again.");
    }

    const role = await Role.create({
      ...rest,
      notes: note ? newNote._id : undefined,
    });

    res.status(STATUS_CODE.CREATED).send({ role });
  },

  update: async (req: Request, res: Response) => {
    const { note, ...rest } = req.body;
    let newNotes: any;
    if (note) {
      newNotes = await Note.create({ note, author: req?.currentUser!.id });
      if (!newNotes?._id) throw new BadRequest(MESSAGES.NOTE_ERROR);
    }

    const updateObject = note
      ? { $push: { notes: newNotes?._id }, ...rest }
      : rest;

    const updatedRole = await Role.findByIdAndUpdate(
      req.params.id,
      updateObject,
      { new: true }
    );

    res.status(STATUS_CODE.SUCCESS).send({ role: updatedRole });
  },

  updateStatus: async (req: Request, res: Response) => {
    await Role.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    );
    res.status(STATUS_CODE.SUCCESS).send({ message: "success" });
  },
};

export default RoleController;
