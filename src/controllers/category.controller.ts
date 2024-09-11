import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import Category from "../schema/category.schema";

const CatetegoryController = {
  get: async (req: Request, res: Response) => {
    const category = await Category.findById(req.params.id, "name description");
    res.status(STATUS_CODE.SUCCESS).send({ category });
  },

  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10 } = req.query;

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;
    const totalCount = await Category.countDocuments({});

    const categories = await Category.aggregate([
      {
        $match: {},
      },
      { $skip: startIndex },
      { $limit: limit },
      { $project: { name: 1, description: 1, id: "$_id", _id: 0 } },
    ]).exec();

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ categories, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: Request, res: Response) => {
    const item = await Category.create(req.body);
    res.status(STATUS_CODE.CREATED).send(item);
  },

  update: async (req: Request, res: Response) => {
    const updatedItem = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );
    res.status(STATUS_CODE.SUCCESS).send(updatedItem);
  },

  remove: async (req: Request, res: Response) => {
    // await inventoryItem.findByIdAndDelete(req.params.id);
    // res.status(STATUS_CODE.NO_CONTENT).send({})
  },
};

export default CatetegoryController;
