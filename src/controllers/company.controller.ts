import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import Company from "../schema/companyInfo.schema";
import mongoose from "mongoose";
import { BadRequest } from "../errors/bad-request";
import { Note } from "../schema/note.schema";
import { NoteLookUp } from "../services/common.service";

const CompanyController = {
  get: async (req: Request, res: Response) => {
    const company = await Company.aggregate([
      {
        $match: {
          name: req.params.id,
        },
      },
      {
        $lookup: NoteLookUp,
      },
      {
        $project: {
          id: "$_id",
          _id: 0,
          name: 1,
          city: 1,
          host: 1,
          hostEmail: 1,
          hostPort: 1,
          address: 1,
          postCode: 1,
          phoneNumber: 1,
          hstNumber: 1,
          logo: 1,
          notes: 1,
          footerNote: 1,
        },
      },
    ]).exec();
    res.status(STATUS_CODE.SUCCESS).send({ company: company[0] });
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

    const companies = await Company.find(match)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .exec();
    res.status(STATUS_CODE.SUCCESS).send({ companies });
  },

  create: async (req: Request, res: Response) => {
    // const { note, ...rest } = req.body;
    const { ...rest } = req.body;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // let newNote: any;
      // if (note) {
      //   newNote = await Note.create([{ note, author: req?.currentUser!.id }], {
      //     session,
      //   });

      //   if (!newNote[0]._id) {
      //     await session.abortTransaction();
      //     throw new BadRequest(MESSAGES.NOTE_ERROR);
      //   }
      // }

      const company = await Company.create(
        [
          {
            ...rest,
            // notes: note ? newNote[0]._id : undefined,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      res.status(STATUS_CODE.CREATED).send({ company });
    } catch (error: any) {
      await session.abortTransaction();
      throw new BadRequest(error.message, 400);
    } finally {
      session.endSession();
    }
  },

  update: async (req: Request, res: Response) => {
    const { ...rest } = req.body;

    const CurrData: any = await Company.findOne({ _id: req.params.id });

    if (
      (rest.hostPassword || rest.hostNewPassword) &&
      CurrData.hostPassword &&
      CurrData.hostEmail
    ) {
      if (rest.hostPassword && !rest.hostNewPassword)
        throw new BadRequest("New password cannot be empty");
      if (!rest.hostPassword && rest.hostNewPassword)
        throw new BadRequest(
          "To change your password, the old password is required"
        );

      if (rest.hostPassword !== CurrData.hostPassword)
        throw new BadRequest("Mismatched old password");
    }

    // let newNotes: any;
    // if (note) {
    //   newNotes = await Note.create({
    //     note: note,
    //     author: req?.currentUser!.id,
    //   });
    //   if (!newNotes._id) throw new BadRequest(MESSAGES.NOTE_ERROR);
    // }

    // const updateObject = note
    //   ? { $push: { notes: newNotes._id }, ...rest }
    //   : rest;

    const updateObject = rest;

    if (rest.hostNewPassword) {
      updateObject.hostPassword = rest.hostNewPassword;
    } else {
      delete updateObject.hostPassword;
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      updateObject,
      { new: true }
    );
    res.status(STATUS_CODE.SUCCESS).send({ company });
  },
};

export default CompanyController;
