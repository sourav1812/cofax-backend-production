import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import InventoryItem from "../schema/item.schema";
import { Note } from "../schema/note.schema";
import { NoteLookUp } from "../services/common.service";
import { BadRequest } from "../errors/bad-request";
import Asset from "../schema/asset.schema";
import TechStock from "../schema/techStock.schema";
import path from "path";
import xlsx from "xlsx";
import mongoose, { Types } from "mongoose";
import DocCount from "../schema/docCount.schema";
import Vendor from "../schema/vendor.schema";
import Category from "../schema/category.schema";
import Item from "../schema/item.schema";
import {
  convertToSlug,
  generateRandomNumberInRange,
  generateSlug,
} from "../utils/functions";

// const excelFilePath: string = path.join(
//   __dirname,
//   "../../public/data/db/inventory.xlsx"
// );

// // Read the Excel file
// const workbook: xlsx.WorkBook = xlsx.readFile(excelFilePath);
// const worksheet: xlsx.WorkSheet = workbook.Sheets["Sheet1"];
// const data: any[] = xlsx.utils.sheet_to_json(worksheet);

const InventoryController = {
  get: async (req: Request, res: Response) => {
    //vendorId and technicianId are missing in aggregation
    const item = await InventoryItem.aggregate([
      { $match: { partId: req.params.id } },
      {
        $lookup: {
          from: "Category",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $lookup: NoteLookUp,
      },
      { $sort: { "notes.createdAt": -1 } },
      {
        $project: {
          name: 1,
          description: 1,
          quantity: 1,
          price: 1,
          sku: 1,
          category: 1,
          vendor: 1,
          prodType: 1,
          id: "$_id",
          _id: 0,
          notes: 1,
          partId: 1,
        },
      },
    ]).exec();
    res.status(STATUS_CODE.SUCCESS).send({
      item,
    });
  },

  //items from inventorys
  getAll: async (req: Request, res: Response) => {
    let {
      page = 1,
      limit = 10,
      by = "",
      value = "",
      sortBy = "createdAt",
      sortType = "-1",
    } = req.query;

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};
    if (by && value && by !== "_id") {
      match = {
        [by as string]: { $regex: value, $options: "i" },
      };
    } else if (by == "_id" && value) {
      match = {
        [by as string]: new Types.ObjectId(value as string),
      };
    }

    const sort: any = {
      [sortBy as string]: +sortType,
    };

    const totalCount = await InventoryItem.countDocuments({
      ...match,
      deletedAt: null,
    });

    const items = await InventoryItem.aggregate([
      {
        $match: {
          ...match,
          deletedAt: null,
        },
      },
      { $sort: sort },
      { $skip: startIndex },
      { $limit: limit },
      {
        $lookup: {
          from: "Category",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: { path: "$category", preserveNullAndEmptyArrays: true }, // If there's a one-to-one relationship between orders and products
      },
      {
        $set: {
          mainId: "$_id"
        }
      },
      {
        $project: {
          name: 1,
          quantity: 1,
          price: 1,
          category: 1,
          prodType: 1,
          partId: 1,
          mainId: 1,
        },
      },
      {
        $group: {
          _id: "$name",
          totalItems: { $sum: "$quantity" },
          mainId: { $first: "$mainId" },
          categories: {
            $push: {
              partId: "$partId",
              price: "$price",
              quantity: "$quantity",
              prodType: "$prodType",
              category: "$category",
              id: "$_id",
            },
          },
        },
      },
    ]).collation({ locale: "en", strength: 2 });

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ items, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: Request, res: Response) => {
    const { note, ...rest } = req.body;

    const ifWithSameUnderSameCategoryExist = await InventoryItem.findOne({
      name: rest?.name,
      categoryId: new Types.ObjectId(rest?.categoryId),
    });

    if (ifWithSameUnderSameCategoryExist) {
      throw new BadRequest(
        "Item with same name under same category already exist."
      );
    }

    let newNote: any;
    if (note)
      newNote = await Note.create({ note, author: req?.currentUser!.id });

    const item = await InventoryItem.create({
      ...rest,
      partId: generateSlug(rest.name + generateRandomNumberInRange()),
      notes: note ? newNote._id : undefined,
    });
    res.status(STATUS_CODE.CREATED).send({ item });
  },

  update: async (req: Request, res: Response) => {
    const { note, ...rest } = req.body;

    let newNotes: any;
    if (note) {
      newNotes = await Note.create({ note, author: req?.currentUser!.id });
    }

    const updateObject = note
      ? { $push: { notes: newNotes._id }, ...rest }
      : rest;

    const updatedItem = await InventoryItem.findByIdAndUpdate(
      req.params.id,
      updateObject,
      { new: true }
    );

    res.status(STATUS_CODE.SUCCESS).send({ item: updatedItem });
  },

  //*get item from everywhere by partId
  getAllItems: async (req: Request, res: Response) => {
    const { partId = "" } = req.query;
    if (!partId) {
      throw new BadRequest("partId is missing");
    }
    //Inventory
    const inventory = await InventoryItem.find({ name: partId });

    //Asset
    //* Find inside Asset and Asset's items
    const asset = await Asset.find({
      $or: [{ partId: partId }, { "items.partId": partId }],
    });

    //Technician stock
    const techStock = await TechStock.find({ partId: partId });

    res.status(STATUS_CODE.SUCCESS).send({
      inventory,
      asset,
      techStock,
    });
  },

  searchSuggestions: async (req: Request, res: Response) => {
    let { searchTerm = "" }: any = req.query;

    const items = await InventoryItem.aggregate([
      {
        $search: {
          index: "inventory_Item",
          autocomplete: {
            query: searchTerm,
            path: "name",
            tokenOrder: "sequential",
            fuzzy: {
              maxEdits: 1,
              prefixLength: 5,
            },
          },
        },
      },
      {
        $match: {
          deletedAt: null,
        },
      },
      { $limit: 10 },
      { $project: { name: 1, partId: 1, quantity: 1, prodType: 1, price: 1 } },
    ]).exec();

    res.status(STATUS_CODE.SUCCESS).send({ items });
  },

  searchLocalSuggestions: async (req: Request, res: Response) => {
    let { searchTerm = "" }: any = req.query;

    const items = await InventoryItem.aggregate([
      // {
      //   $search: {
      //     index: "inventory_Item",
      //     autocomplete: {
      //       query: searchTerm,
      //       path: "name",
      //       tokenOrder: "sequential",
      //       fuzzy: {
      //         maxEdits: 1,
      //         prefixLength: 5,
      //       },
      //     },
      //   },
      // },
      {
        $match: {
          deletedAt: null,
          name: {
            $regex: searchTerm,
            $options: "i",
          },
        },
      },
      { $limit: 10 },
      { $project: { name: 1, partId: 1, quantity: 1, prodType: 1, price: 1 } },
    ]).exec();

    res.status(STATUS_CODE.SUCCESS).send({ items });
  },

  deleteItem: async (req: Request, res: Response) => {
    const { id } = req.params;
    const item = await Item.findByIdAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
      },
      {
        $set: {
          deletedAt: new Date(),
        },
      },
      {
        new: true,
      }
    );

    res.status(STATUS_CODE.SUCCESS).json({
      message: "Inventory Item deleted successfully",
      item,
    });
  },

  // importItems: async (req: Request, res: Response) => {
  //   // Transform the data
  //   const session = await mongoose.startSession();

  //   const inventoryItems: any = [];

  //   await session.withTransaction(async (session) => {
  //     const inventoryItems: any = [];

  //     await Promise.all(
  //       data.map(async (entry) => {
  //         {
  //           const vendor = {
  //             name: entry["Make"],
  //             description: entry["Make"],
  //             isActive: true,
  //           };

  //           const category = {
  //             name: entry["Category"],
  //             description: entry["Category"],
  //             isActive: true,
  //           };

  //           //1. check if vendor name already exists
  //           const vendorId = await Vendor.findOneAndUpdate(
  //             { name: vendor.name },
  //             { $setOnInsert: vendor },
  //             {
  //               upsert: true,
  //               new: true,
  //               session: session,
  //             }
  //           );

  //           //2. check if category is already exists
  //           const categoryId = await Category.findOneAndUpdate(
  //             { name: category.name },
  //             { $setOnInsert: category },
  //             {
  //               upsert: true,
  //               new: true,
  //               session: session,
  //             }
  //           );

  //           if (!vendorId || !categoryId) {
  //             throw new Error(
  //               "Failed to create or find the vendor or category"
  //             );
  //           }

  //           const counts = await DocCount.findOneAndUpdate(
  //             {},
  //             { $inc: { partId: 1 } },
  //             { new: true, session: session }
  //           );
  //           const partId = convertToSlug(entry["Item"]);

  //           console.log("partId", partId);

  //           const quantity = entry["Qty. available"] || 0;

  //           const item = {
  //             partId,
  //             price: 0,
  //             prodType: "new",
  //             name: entry["Item"],
  //             description: entry["Description"],
  //             quantity: quantity < 0 ? 0 : quantity,
  //             categoryId: categoryId._id,
  //             vendor: vendorId._id,
  //             sku: "unknown",
  //             model: entry["Model"] || "",
  //             isActive: entry["Active"],
  //           };

  //           inventoryItems.push(item);
  //         }
  //       })
  //     );

  //     //3. Creating inventory items
  //     await Item.insertMany(inventoryItems, { session });
  //   });

  //   res.status(STATUS_CODE.SUCCESS).send({
  //     message: "success",
  //     inventoryItems,
  //   });
  // },
};

export default InventoryController;
