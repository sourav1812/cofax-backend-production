import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import {
  checkDuplicatePartIdsAndQuatity,
  trasnferIntoAsset,
} from "../services/common.service";
import mongoose from "mongoose";
import ServiceCall from "../schema/serviceCall.schema";
import { Note } from "../schema/note.schema";
import { BadRequest } from "../errors/bad-request";
import { ServiceStatus } from "../utils/types/enum/db";
import TechStock from "../schema/techStock.schema";
import {
  generateRandomNumberInRange,
  getCurrentYear,
  getHtml,
  mergeAndRemoveItemData,
} from "../utils/functions";
import EquipContact from "../schema/equipContact.schema";
import AssetContact from "../schema/assetContact.schema";
import {
  aggregateOnServiceCallTicket,
  aggregateServiceCall,
} from "../utils/aggregates/serviceCall";
import Item from "../schema/item.schema";
import puppeteer from "puppeteer";
import { getPDF } from "../utils/getPdf";
import sendEmail from "../services/sendMail.service";
import { SERVICE_CALL, SERVICE_INVOICE } from "../constant/email-template";
import ServiceCallType from "../schema/serviceType.schema";
import { viewPath } from "../constant/view";
import path from "path";
import MeterReading from "../schema/meterReading.schema";

const ServiceCallController = {
  get: async (req: Request, res: Response) => {
    const [resp] = await ServiceCall.aggregate(
      aggregateServiceCall(req)
    ).exec();

    const mergedItems = resp.items.map((item: any) => {
      const matchingData = resp.itemData.find(
        (data: any) => String(data.itemId) === String(item.itemId)
      );

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
      .send({ serviceCall: [{ ...resp, items: mergedItems }] });
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

    const totalCount = await ServiceCall.countDocuments(match);

    const statusOrder = [
      "created",
      "dispatched",
      "hold",
      "completed",
      "failed",
    ];

    const resp = await ServiceCall.aggregate([
      {
        $match: match,
      },
      {
        $addFields: {
          statusOrder: {
            $indexOfArray: [statusOrder, "$status"],
          },
        },
      },
      { $sort: { statusOrder: 1, createdAt: -1 } },
      { $skip: startIndex },
      { $limit: limit },
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "Customer",
                localField: "username",
                foreignField: "username",
                as: "customer",
              },
            },
            {
              $unwind: "$customer",
            },
          ],
          as: "asset",
        },
      },
      {
        $unwind: {
          path: "$asset",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "Item",
          localField: "items.itemId",
          foreignField: "_id",
          as: "itemsData",
        },
      },
      {
        $project: {
          assetNumber: 1,
          workOrder: 1,
          technician: 1,
          itemsData: 1,
          asset: 1,
          id: "$_id",
          status: 1,
          priority: 1,
          _id: 0,
          isCompleted: 1,
          items: 1,
        },
      },
    ]).exec();

    const serviceCalls = resp.map((it) => mergeAndRemoveItemData(it)[0]);

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ serviceCalls, pages: Math.ceil(totalCount / limit) });
  },

  deleteSC: async (req: Request, res: Response) => {
    //use session
    //TODO: Revert all the items before deleting items
    const session = await mongoose.startSession();

    try {
      //find SC and add item into inventory
      await session.withTransaction(async () => {
        const revertItems: any = await ServiceCall.findById(
          req.params.id
        ).session(session);

        const updatePromises = revertItems?.items?.map(async (it: any) => {
          await Item.findByIdAndUpdate(
            it.itemId,
            { $inc: { quantity: it.quantity } },
            { session }
          );
        });

        await Promise.all(updatePromises);

        //Delete SC
        await ServiceCall.findByIdAndDelete(req.params.id).session(session);

        res.status(STATUS_CODE.NO_CONTENT).send({});
      });
    } catch (error: any) {
      await session.abortTransaction();
      console.error("Transaction aborted due to error: ", error);
      throw new BadRequest(error.message, 400);
    } finally {
      session.endSession();
    }
  },

  onServiceCreated: async (req: Request, res: Response) => {
    const { note, assetContactId, equipContact, equipContactId, ...rest } =
      req.body;
    const { status, items, technician } = rest;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await checkDuplicatePartIdsAndQuatity(rest, session);

        if (equipContact) {
          await EquipContact.findByIdAndUpdate(
            equipContactId,
            { user: equipContact },
            { session }
          );
        }

        let newNote: any;
        if (note) {
          newNote = await Note.create(
            [{ note, author: req?.currentUser!.id }],
            {
              session,
            }
          );

          if (!newNote[0]._id) throw new Error("Failed to create note");
        }

        // Handle stock updates based on status
        if (
          status === ServiceStatus.Dispatched ||
          status === ServiceStatus.Completed
        ) {
          const newData = items?.map(async (it: any) => {
            const itemId = new mongoose.Types.ObjectId(it.itemId);
            const technicianId = new mongoose.Types.ObjectId(technician);

            let item: any = await TechStock.findOne({
              technicianId,
              itemId,
            }).session(session);

            if (
              status === ServiceStatus.Dispatched ||
              status === ServiceStatus.Created
            ) {
              if (!item) {
                await TechStock.create(
                  [
                    {
                      technicianId,
                      itemId,
                      quantity: it.quantity,
                    },
                  ],
                  { session }
                );
              } else {
                item.quantity += it.quantity;
                await item.save({ session });
              }
            } else if (status == ServiceStatus.Completed) {
              if (item) {
                item.quantity -= it.quantity;
                await item.save({ session });
              }
            }
          });
          await Promise.all(newData);
        }

        if (status === ServiceStatus.Completed) {
          await trasnferIntoAsset(rest, session);
        }

        const totalDoc = await ServiceCall.countDocuments({}).session(session);
        const serviceCall = await ServiceCall.create(
          [
            {
              ...rest,
              technician: rest?.technician ? rest?.technician : undefined,
              createdBy: req.currentUser?.id,
              equipContact: equipContactId,
              workOrder: `WO${generateRandomNumberInRange()}${totalDoc}${getCurrentYear()}`,
              serviceCall: `SC${totalDoc}${generateRandomNumberInRange()}${getCurrentYear()}`,
              notes: note ? newNote[0]._id : undefined,
            },
          ],
          { session }
        );

        res.status(STATUS_CODE.CREATED).send({ serviceCall });
      });
    } catch (error: any) {
      // for rollback the operations
      await session.abortTransaction();
      // res.status(400).send(error.message);
      throw new BadRequest(error.message, 400);
    } finally {
      session.endSession();
    }
  },

  //TODO: Need Optimisation
  onServiceStatusUpdate: async (req: Request, res: Response) => {
    const { status } = req.body;
    const serviceCallId = req.params.id;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        //1. Check technician assigned or not before updating statuses
        const service: any = await ServiceCall.findById(serviceCallId).session(
          session
        );
        if (!service?.technician) {
          throw new BadRequest("Please assign a technician");
        }
        //3. If status is changed to dispatched then put items into technician's stock DB
        if (
          [ServiceStatus.Dispatched, ServiceStatus.Completed].includes(status)
        ) {
          const items: any = service?.items;
          if (items && items.length) {
            const updatePromises = items.map(async (it: any) => {
              const itemId = new mongoose.Types.ObjectId(it.itemId);
              const technicianId = new mongoose.Types.ObjectId(
                service.technician
              );

              const item: any = await TechStock.findOne({
                itemId,
                technicianId,
              }).session(session);

              if (status === ServiceStatus.Dispatched) {
                if (!item) {
                  await TechStock.create(
                    [
                      {
                        technicianId: service.technician,
                        itemId: it.itemId,
                        quantity: it.quantity,
                      },
                    ],
                    { session }
                  );
                } else {
                  //if stock document in present with partId then update(increase) the quantity
                  item.quantity += it.quantity;
                  await item.save({ session });
                }
              } else if (status === ServiceStatus.Completed && item) {
                //TODO: Need to know what customer has released from asset so, that i can know what to add or remove from technician's stock
                //*Remove from customer's asset

                //*Check if item exist in inventory/warehouse YES: increase quantity, NO: create new item with used and quantity: 0

                //*Add item into technician's stock

                //Removed from technician's stock
                item.quantity -= it.quantity;
                if (item.quantity <= 0) {
                  await TechStock.deleteOne({ _id: item._id }).session(session);
                } else {
                  await item.save({ session });
                }
              }
            });
            await Promise.all(updatePromises);
          }
        }

        //4. If status is changed to completed then put items into customer's asset DB
        if (status === ServiceStatus.Completed) {
          await trasnferIntoAsset(service, session);
        }

        //5. Finally update the status of service call
        const updatedService = await ServiceCall.findByIdAndUpdate(
          serviceCallId,
          { status },
          { new: true, runValidators: true, session }
        );

        res.status(200).send({ service: updatedService });
      });
    } catch (error: any) {
      console.log("error", error);
      // res.status(400).send(error.message);
      throw new BadRequest(error.message, 400);
    } finally {
      session.endSession();
    }
  },

  onServiceUpdate: async (req: Request, res: Response) => {
    const {
      note,
      assetContact,
      assetContactId,
      equipContact,
      equipContactId,
      ...rest
    } = req.body;
    //TODO: currently you can't change status from this API. Use onServiceStatusUpdate API

    rest.technician = rest?.technician ? rest?.technician : undefined;

    if (rest?.technician) {
      const currentServiceCall: any = await ServiceCall.findById(
        req?.params?.id
      );

      const ifSame =
        rest?.technician === currentServiceCall?.technician?.toString();

      if (!ifSame) {
        ServiceCallController.resetTechStock(
          currentServiceCall,
          rest.technician
        );
      }
    }

    if (equipContact) {
      await EquipContact.findByIdAndUpdate(equipContactId, {
        user: equipContact,
      });
    }

    const session = await mongoose.startSession();
    let newNotes: any;

    try {
      session.startTransaction();

      await checkDuplicatePartIdsAndQuatity(rest, session);

      if (note) {
        // Clear existing notes
        await ServiceCall.findByIdAndUpdate(
          req.params.id,
          { $set: { notes: [] } },
          { session }
        );

        newNotes = await Note.create([{ note, author: req?.currentUser!.id }], {
          session,
        });
        if (!newNotes[0]._id) throw new BadRequest(MESSAGES.NOTE_ERROR);

        await ServiceCall.findByIdAndUpdate(
          req.params.id,
          { $push: { notes: newNotes[0]._id } },
          { session }
        );
      }

      const { items, ...restData } = rest;

      const updatedItem = await ServiceCall.findOneAndUpdate(
        { _id: req.params.id },
        { ...restData, $push: { items } },
        { new: true, session }
      );

      await session.commitTransaction();
      res.status(STATUS_CODE.SUCCESS).send({ serviceCall: updatedItem });
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

  resetTechStock: async (serviceCall: any, newTechnician: any) => {
    const { items, technician } = serviceCall;

    // If there are no items, return early
    if (!items || !items.length) return;

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const updatePromises = items.map(async (it: any) => {
          const itemId = new mongoose.Types.ObjectId(it.itemId);
          const currentTechnicianId = new mongoose.Types.ObjectId(technician);
          const newTechnicianId = new mongoose.Types.ObjectId(newTechnician);

          // Find the stock for the current technician
          const previousTechnicianStock = await TechStock.findOne({
            technicianId: currentTechnicianId,
            itemId,
          }).session(session);

          // Find or create the stock for the new technician
          await TechStock.findOneAndUpdate(
            { technicianId: newTechnicianId, itemId },
            { $inc: { quantity: it.quantity } },
            { new: true, upsert: true, session }
          );

          // If the previous technician had stock, reduce it
          if (previousTechnicianStock) {
            previousTechnicianStock.quantity -= it.quantity;
            if (previousTechnicianStock.quantity <= 0) {
              // If quantity is zero or less, remove the document
              await TechStock.deleteOne({
                _id: previousTechnicianStock._id,
              }).session(session);
            } else {
              // Otherwise, save the updated stock
              await previousTechnicianStock.save({ session });
            }
          }
        });

        await Promise.all(updatePromises);
      });
    } catch (error) {
      console.error("Transaction aborted due to error: ", error);
      throw new Error("Failed to reset technician stock");
    } finally {
      session.endSession();
    }
  },

  onServiceCallTicket: async (req: Request, res: Response) => {
    const [resp] = await ServiceCall.aggregate(
      aggregateOnServiceCallTicket(req)
    ).exec();

    const assetId = resp?.asset?._id;

    const meterReading = await MeterReading.findOne({
      assetId: assetId,
    }).sort({
      createdAt: -1,
    });

    const ticket = mergeAndRemoveItemData(resp);

    res.status(STATUS_CODE.SUCCESS).json({ ticket, meterReading });
  },

  getPendingBills: async (req: Request, res: Response) => {
    const customers = await ServiceCall.aggregate([
      {
        $match: {
          status: { $in: ["created"] },
        },
      },
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
          pipeline: [
            {
              $lookup: {
                from: "Customer",
                localField: "customerId",
                foreignField: "_id",
                as: "customer",
              },
            },
            { $unwind: "$customer" },
            {
              $lookup: {
                from: "Item",
                localField: "itemId",
                foreignField: "_id",
                as: "item",
              },
            },
            { $unwind: "$item" },
          ],
        },
      },
      { $unwind: "$asset" },
      {
        $lookup: {
          from: "Service_Type",
          localField: "serviceTypeId",
          foreignField: "_id",
          as: "ServiceType",
        },
      },
      { $unwind: "$ServiceType" },
    ]);

    res.status(STATUS_CODE.SUCCESS).send({ customers });
  },

  sendInvoiceToTechnician: async (req: Request, res: Response) => {
    const serviceTypes = await ServiceCallType.find({ isActive: true }, "name");
    //prepare PDF
    const pdfBuffer = await getPDF(
      {
        ticket: req.body,
        serviceTypes,
      },
      "/service_calls/index.ejs"
    );

    if (!req.body?.technician?.email) {
      throw new BadRequest("Please assign a technician first");
    }
    // Compose email
    await sendEmail(
      {
        email: req.body?.technician?.email,
        subject: "Service invoice",
        message: "Check out the attached PDF!",
        content: SERVICE_CALL(req.body),
        attachments: [
          {
            filename: "service_call.pdf",
            content: pdfBuffer,
            encoding: "base64",
          },
        ],
      },
      req.body?.customer?.company._id
    );
    res
      .status(STATUS_CODE.SUCCESS)
      .json({ message: "PDF sent successfully!", data: req.body });
  },
};

export default ServiceCallController;
