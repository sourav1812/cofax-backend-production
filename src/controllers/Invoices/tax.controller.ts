import { NoteLookUp } from "../../services/common.service";
import Tax from "../../schema/Invoices/tax.schema";
import { Request, Response } from "express";
import { MESSAGES, STATUS_CODE } from "../../constant/status";
import { BadRequest } from "../../errors/bad-request";
import { Note } from "../../schema/note.schema";

const TaxController = {
  get: async (req: Request, res: Response) => {
    const tax = await Tax.aggregate([
      {
        $lookup: NoteLookUp,
      },
    ]);
    res.status(STATUS_CODE.SUCCESS).send({ tax });
  },

  create: async (req: Request, res: Response) => {
    const currTax: any = await Tax.findOne({});
    if (currTax) {
      throw new BadRequest(
        "Tax has already been created. You can update tax with another API"
      );
    }
    const tax = await Tax.create(req.body);
    res.status(STATUS_CODE.CREATED).send({ tax });
  },

  update: async (req: Request, res: Response) => {
    const currTax: any = await Tax.findOne({});

    if (currTax.hstTax == req.body.hstTax)
      throw new BadRequest(
        "The new HST Tax rate is the same as the previous one."
      );

    const note = `The tax percentage has been updated, changing it from ${currTax.tax} to ${req.body.tax}.`;
    let newNotes: any = await Note.create({
      note,
      author: req?.currentUser!.id,
    });
    if (!newNotes?._id) throw new BadRequest(MESSAGES.NOTE_ERROR);

    const tax = await Tax.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: newNotes?._id }, ...req.body },
      { new: true, runValidators: true }
    );

    res.status(STATUS_CODE.SUCCESS).send({ tax });
  },
};

export default TaxController;
