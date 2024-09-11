import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import { Note } from "../schema/note.schema";
import Asset from "../schema/asset.schema";
import { BadRequest } from "../errors/bad-request";
import Item from "../schema/item.schema";
import mongoose from "mongoose";
import {
  checkDuplicatePartIdsAndQuatity,
  checkItemQuantity,
} from "../services/common.service";
import EquipContact from "../schema/equipContact.schema";
import { getOne } from "../utils/aggregates/asset";
import MPS from "./mps.controller";
import MeterReading from "../schema/meterReading.schema";
import { createHashSet, isOlderByMonths } from "../utils/functions";
import AssetsReport from "../schema/report/assetSync.schema";
import { ReportType } from "../utils/types/enum/db";
import { SendNotification } from "../services/notification.service";

const AssetController = {
  get: async (req: Request, res: Response) => {
    const [resp]: any = await Asset.aggregate(getOne(req));

    if (!resp) {
      console.error("No asset found for the given ID.");
      return res.status(404).send({ error: "Asset not found" });
    }

    if (!resp.items || !resp.itemData) {
      console.error("Missing items or itemData in the response.");
      return res.status(500).send({ error: "Data inconsistency error" });
    }

    const mergedItems = resp?.items?.map((item: any) => {
      const matchingData = resp.itemData.find(
        (data: any) => String(data.itemId) === String(item.itemId)
      );

      if (!matchingData) {
        console.error(`No matching data found for item ID: ${item.itemId}`);
        return {
          itemId: item.itemId,
          name: "Unknown",
          partId: "Unknown",
          quantity: item.quantity,
        };
      }

      return {
        itemId: matchingData.itemId,
        name: matchingData.name,
        partId: matchingData._id,
        quantity: item.quantity,
      };
    });

    delete resp.itemData;

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ item: [{ ...resp, items: mergedItems }] });
  },

  getAll: async (req: Request, res: Response) => {
    let {
      page = 1,
      limit = 10,
      by = "",
      value = "",
      sortBy = "createdAt",
      sortType = "-1",
    } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};
    if (by && value) {
      match = {
        [by as string]: { $regex: value, $options: "i" },
      };
    }
    const sort: any = {
      [sortBy as string]: +sortType,
    };

    const totalCount = await Asset.countDocuments(match);

    const assets = await Asset.aggregate([
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
          from: "Contract_Type",
          localField: "contractType",
          foreignField: "_id",
          as: "contractType",
        },
      },
      { $unwind: "$contractType" },
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
        $project: {
          assetNumber: 1,
          model: 1,
          startDate: 1,
          endDate: 1,
          username: 1,
          customerName: "$customer.name",
          id: "$_id",
          quantity: 1,
          leasedDate: 1,
          _id: 0,
          isActive: 1,
          contractType: 1,
        },
      },
    ]).exec();

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ assets, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: Request, res: Response) => {
    const { note, equipContact = "", ...rest } = req.body;

    //check if parts are not duplicate and also checks for the quantity for each partId
    await checkItemQuantity(rest);

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Item.updateOne(
        { partId: rest.partId },
        { $inc: { quantity: -1 } },
        { session }
      );

      await checkDuplicatePartIdsAndQuatity(rest, session);

      let equipContactId;
      if (equipContact) {
        equipContactId = await EquipContact.create([{ user: equipContact }], {
          session,
        });

        if (!equipContactId[0]._id) {
          await session.abortTransaction();
          throw new BadRequest(MESSAGES.NOTE_ERROR);
        }
      } else {
        throw new BadRequest("Equip contact is required");
      }

      let newNote: any;
      if (note) {
        newNote = await Note.create([{ note, author: req?.currentUser!.id }], {
          session,
        });

        if (!newNote[0]._id) {
          await session.abortTransaction();
          throw new BadRequest(MESSAGES.NOTE_ERROR);
        }
      }

      const asset = await Asset.create(
        [
          {
            ...rest,
            equipContact: equipContact ? equipContactId[0]._id : undefined,
            createdBy: req?.currentUser!.id,
            notes: note ? [newNote[0]._id] : undefined,
          },
        ],
        { session }
      );

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

  update: async (req: Request, res: Response) => {
    //TODO: add transaction
    const { note, equipContact = "", equipContactId, ...rest } = req.body;

    if (equipContact) {
      await EquipContact.findByIdAndUpdate(equipContactId, {
        user: equipContact,
      });
    }

    //quatity logic is left
    // if(rest.quantity) throw new BadRequest("Quantity update is not allowed. for now!");

    //*Need to make technician flow: deducted item go into technician's stock

    //check if quantity of rest.partId and rest.items.partIds
    const session = await mongoose.startSession();

    let newNotes: any;
    try {
      session.startTransaction();

      await checkDuplicatePartIdsAndQuatity(rest, session);

      if (note) {
        //Clear Exisiting
        await Asset.findOneAndUpdate(
          { assetNumber: req.params.id },
          { $set: { notes: [] } },
          { session }
        );

        newNotes = await Note.create([{ note, author: req?.currentUser!.id }], {
          session,
        });

        if (!newNotes[0]._id) throw new BadRequest(MESSAGES.NOTE_ERROR);

        await Asset.findOneAndUpdate(
          { assetNumber: req.params.id },
          { $push: { notes: newNotes[0]._id } },
          { session }
        );
      }

      const { items, ...restData } = rest;

      const updatedItem = await Asset.findOneAndUpdate(
        { assetNumber: req.params.id },
        {
          ...restData,
          $push: { items },
        },
        { new: true, session }
      );

      await session.commitTransaction();
      res.status(STATUS_CODE.SUCCESS).send({ item: updatedItem });
    } catch (error: any) {
      console.log("error", error);
      // for rollback the operations
      await session.abortTransaction();
      // res.status(400).send(error.message);
      throw new BadRequest(error.message, 400);
    } finally {
      session.endSession();
    }
  },

  searchSuggestions: async (req: Request, res: Response) => {
    let { searchTerm = "" }: any = req.query;

    const assets = await Asset.aggregate([
      {
        $search: {
          index: "auto_complete_assets",
          autocomplete: {
            query: searchTerm,
            path: "assetNumber",
            tokenOrder: "sequential",
          },
        },
      },
      {
        $match: {
          deletedAt: null,
        },
      },
      { $limit: 10 },
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
        $project: {
          assetNumber: 1,
          model: 1,
          serialNo: 1,
          customer: "$customer.name",
        },
      },
    ]).exec();

    res.status(STATUS_CODE.SUCCESS).send({ assets });
  },

  getMpsSync: async (req: Request, res: Response) => {
    //register on mps
    const [data, baseUrl]: any = await MPS.registration();

    // take lastest reading from mps
    const [readings, assets]: any = await Promise.all([
      MPS.getReadings(data.access_token, baseUrl),
      Asset.aggregate([
        {
          $match: {
            deletedAt: null,
          },
        },
        {
          $lookup: {
            from: "Customer",
            localField: "customerId",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
      ]),
    ]);

    const assetReports: any = [];
    const failedSyncs: any = [];
    const missingInMps: any = [];

    // To avoid 2 loops to compare assetNumber created hashMap
    const hashReadings = await createHashSet(readings);

    //compare assetNumber and save reading
    await Promise.all(
      assets.map(async (asset: any) => {
        if (hashReadings.has(asset.assetNumber)) {
          const hashValue = hashReadings.get(asset.assetNumber);

          const lastMeterReading: any = await MeterReading.findOne({
            assetId: asset._id,
            username: asset.username,
          })
            .sort({ createdAt: -1 })
            .exec();

          // If no meter reading found, create a new entry
          if (!lastMeterReading) {
            assetReports.push(asset._id);
            await MeterReading.create({
              username: asset.username,
              assetId: asset._id,
              mono: hashValue.mono,
              color: hashValue.color,
            });
          } else if (lastMeterReading.invoiced) {
            // If the last meter reading is invoiced, create a new entry
            //  isOlderByMonths(
            //   lastMeterReading.createdAt,
            //   asset.customer.billingSchedule
            // )
            if (1) {
              assetReports.push(asset._id);
              await MeterReading.create({
                username: asset.username,
                assetId: asset._id,
                mono: hashValue.mono,
                color: hashValue.color,
              });
            } else {
              failedSyncs.push(String(asset._id));
            }
          } else {
            // Update the existing entry if the last meter reading is not invoiced
            assetReports.push(asset._id);
            lastMeterReading.mono = hashValue.mono;
            lastMeterReading.color = hashValue.color;
            await lastMeterReading.save();
          }
        } else {
          missingInMps.push(String(asset._id));
        }
      })
    );

    const report: any = await AssetsReport.create({
      type: ReportType.Sync,
      success: assetReports,
      failed: failedSyncs,
      missingInMps,
      total: assetReports.length + failedSyncs.length + missingInMps.length,
    });

    SendNotification(
      "Assets Sync",
      `Success: ${assetReports.length}, Manual: ${missingInMps.length} and Failed: ${failedSyncs.length}`,
      `/assets/reports/${report._id}`
    );

    res.status(200).send({
      message: "success",
      total: assetReports.length,
      success: assetReports,
      failedSyncs,
      missingInMps,
      hashReadings: [...hashReadings].length,
    });
  },

  getSyncReport: async (req: Request, res: Response) => {
    const { id, type = "success" } = req.params;
    const report = await AssetsReport.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "Asset",
          localField: type,
          foreignField: "_id",
          as: type,
          pipeline: [
            {
              $lookup: {
                from: "Contract_Type",
                localField: "contractType",
                foreignField: "_id",
                as: "contractType",
                pipeline: [
                  {
                    $project: {
                      name: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$contractType",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "Customer",
                localField: "customerId",
                foreignField: "_id",
                as: "customer",
                pipeline: [
                  {
                    $lookup: {
                      from: "Company",
                      localField: "companyId",
                      foreignField: "_id",
                      as: "company",
                      pipeline: [
                        {
                          $project: {
                            name: 1,
                          },
                        },
                      ],
                    },
                  },
                  { $unwind: "$company" },
                ],
              },
            },
            { $unwind: "$customer" },
          ],
        },
      },
    ]);

    res.status(STATUS_CODE.SUCCESS).send({ report });
  },

  deleteAssetById: async (req: Request, res: Response) => {
    const id = req.params.id;

    if (!id) {
      throw new BadRequest("Asset id is cannot be empty");
    }

    const curr_asset = await Asset.findOne({
      assetNumber: id,
    });

    if (curr_asset?.isActive) {
      throw new BadRequest("cannot delete if asset is active");
    }

    const deletedAsset = await Asset.updateOne(
      {
        assetNumber: id,
      },
      {
        $set: {
          deletedAt: new Date(),
        },
      }
    );

    res.status(STATUS_CODE.SUCCESS).json({
      message: "Asset deleted successfully",
      asset: deletedAsset,
    });
  },
};

export default AssetController;
