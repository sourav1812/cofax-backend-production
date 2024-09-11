import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import Setting from "../schema/setting.schema";
import { Note } from "../schema/note.schema";
import { BadRequest } from "../errors/bad-request";
import mongoose from "mongoose";
import { NoteLookUp } from "../services/common.service";
import Tax from "../schema/Invoices/tax.schema";
import Mps from "../schema/settings/mps.schema";
import QuickBook from "../schema/quickbook.schema";

const SettingController = {
  addNew: async (req: Request, res: Response) => {
    const setting = await Setting.create(req.body);

    res.status(STATUS_CODE.CREATED).send({ setting });
  },

  getAll: async (req: Request, res: Response) => {
    const [settings, tax, mps, quickbook] = await Promise.all([
      Setting.findOne({}, "notifyOnItem"),
      Tax.findOne({}, "hstTax"),
      Mps.findOne({}),
      QuickBook.find().populate("company", "name").limit(2),
    ]);
    res.status(STATUS_CODE.SUCCESS).send({
      settings,
      tax,
      mps,
      quickbook,
    });
  },

  getNotes: async (req: Request, res: Response) => {
    const setting = await Setting.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      { $lookup: NoteLookUp },
      {
        $project: {
          notes: 1,
        },
      },
    ]);
    res.status(STATUS_CODE.SUCCESS).send({
      setting,
    });
  },

  updateSettings: async (req: Request, res: Response) => {
    const { note, ...rest } = req.body;

    const oldSetting: any = await Setting.findById(req.params.id);

    if (!rest.notifyOnItem) throw new BadRequest(`Please provide some number`);

    if (oldSetting.notifyOnItem == rest.notifyOnItem)
      throw new BadRequest(`${oldSetting.notifyOnItem} is already set.`);

    let newNote = await Note.create({
      note: `Changed from ${oldSetting.notifyOnItem} to ${rest.notifyOnItem}`,
      author: req?.currentUser!.id,
    });

    if (!newNote._id) {
      throw new BadRequest(MESSAGES.NOTE_ERROR);
    }

    const setting = await Setting.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: newNote._id }, ...req.body },
      {
        new: true,
      }
    );

    res.status(STATUS_CODE.SUCCESS).send({ setting });
  },
};

export default SettingController;
