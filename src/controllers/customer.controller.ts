import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import { Note } from "../schema/note.schema";
import Customer, { ICustomer } from "../schema/customer.schema";
import { BadRequest } from "../errors/bad-request";
import { getCustomerDetails } from "../utils/aggregates/customer";
import mongoose from "mongoose";
import { convertToSlug } from "../utils/functions";
import DocCount from "../schema/docCount.schema";
import Asset from "../schema/asset.schema";
import Setting from "../schema/setting.schema";
import MPS from "./mps.controller";
import CustomersReport from "../schema/report/customers.schema";
import { SendNotification } from "../services/notification.service";
import { splitAddressAsRequired } from "../services/common.service";
import QuickBook, { IQuickBook } from "../schema/quickbook.schema";
import {
  createCustomerInQuickBook,
  getQuickBookTokenOrRefresh,
  isQuickBookAccessTokenValid,
  restructureCustomerToQuickBook,
  updateCustomerInQuickBook,
} from "../services/quickbook.service";
import Company from "../schema/companyInfo.schema";
import { NORCOM_COMPANY_ID } from "../constant";

const specificFields = new Set(["phoneNumber", "email"]);

const customerController = {
  get: async (req: Request, res: Response) => {
    const [customer, assets, meterReadings, invoices, purchaseOrders, sales] =
      await getCustomerDetails(req);

    if (!customer.length) throw new BadRequest("No customer found", 404);

    res.status(STATUS_CODE.SUCCESS).send({
      customer,
      assets,
      meterReadings,
      invoices,
      purchaseOrders,
      sales,
    });
  },

  getAll: async (req: Request, res: Response) => {
    let {
      page = "1",
      limit = 10,
      by = "",
      value = "",
      sortBy = "createdAt",
      sortType = "-1",
    } = req.query;

    if (by === "all" || by === "unsynced") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};

    if (by === "unsynced") {
      match = {
        companyId: new mongoose.Types.ObjectId(NORCOM_COMPANY_ID),
        quickBookId: { $exists: false },
      };
    } else if (specificFields.has(by as string)) {
      match = {
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    const sort: any = {
      [sortBy as string]: +sortType,
    };

    const pipeline: any = [
      { $match: match },
      { $sort: sort },
      {
        $lookup: {
          from: "Note",
          localField: "notes",
          foreignField: "_id",
          as: "notes",
        },
      },
      {
        $lookup: {
          from: "Company",
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          phoneNumber: 1,
          isActive: 1,
          address: 1,
          username: 1,
          billingAddress: 1,
          customerType: 1,
          id: "$_id",
          _id: 0,
          notes: 1,
          company: {
            name: 1,
            _id: 1,
          },
        },
      },
    ];

    if (by === "norcom") {
      pipeline.push({
        $match: {
          "company.name": "NORCOM BUSINESSES SYSTEMS INC",
        },
      });
    }

    if (by === "cofax") {
      pipeline.push({
        $match: {
          "company.name": "COFAX BUSINESS SYSTEMS INC",
        },
      });
    }

    pipeline.push({ $skip: startIndex }, { $limit: limit });

    const totalCount = await Customer.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "Company",
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },
      ...(by === "norcom"
        ? [{ $match: { "company.name": "NORCOM BUSINESSES SYSTEMS INC" } }]
        : []),
      ...(by === "cofax"
        ? [{ $match: { "company.name": "COFAX BUSINESS SYSTEMS INC" } }]
        : []),
      { $count: "total" },
    ]);

    console.log("totalCount: ", totalCount[0]?.total);

    const total = totalCount[0]?.total ?? 0;

    //https://www.mongodb.com/community/forums/t/new-7-0-6-bug-limit-code-returned-unexpected-value/268796
    const customers = await Customer.aggregate(pipeline).collation({
      locale: "en",
      strength: 2,
    });

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ customers, pages: Math.ceil(total / limit) });
  },

  create: async (req: Request, res: Response) => {
    const { note, assetContact = "", ...rest } = req.body;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const ifCustomerWithNameOrEmailExists = await Customer.findOne({
        $or: [{ name: rest?.name }, { email: rest?.email }],
      });

      if (ifCustomerWithNameOrEmailExists) {
        throw new BadRequest("user with email or name already exist");
      }

      const counts: any = await DocCount.findOneAndUpdate(
        {},
        { $inc: { customer: 1 } },
        { new: true, session }
      );
      const username = convertToSlug(rest.name + counts?.customer);

      // const assetContactId: any = await AssetContact.create(
      //   [{ user: assetContact }],
      //   {
      //     session,
      //   }
      // );

      let newNote: any;
      if (note) {
        newNote = await Note.create([{ note, author: req?.currentUser?.id! }], {
          session,
        });

        if (!newNote[0]._id) throw new BadRequest(MESSAGES.NOTE_ERROR);
      }

      const customer = await Customer.create(
        [
          {
            ...rest,
            username,
            notes: note ? newNote[0]._id : undefined,
            // address: splitAddressAsRequired(rest?.billingAddress),
          },
        ],
        { session }
      );

      const createdCustomer: any = customer[0].toJSON();

      //Client don't want to depend to quickbook while creating.
      //1. First we'll create customer
      //2. sync all customer to quickbook

      // await customerController.syncCustomerToQuickbook(
      //   createdCustomer,
      //   session
      // );

      // await Customer.findByIdAndUpdate(
      //   new mongoose.Types.ObjectId(createdCustomer?.id),
      //   { quickBookId: Number(quickBookCustomer?.Id) },
      //   { new: true }
      // ).session(session)

      await session.commitTransaction();
      res.status(STATUS_CODE.CREATED).send({ customer: createdCustomer });
    } catch (error: any) {
      await session.abortTransaction();
      throw new BadRequest(error?.message ?? error);
    } finally {
      session.endSession();
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { note, assetContact = "", assetContactId, ...rest } = req.body;

      // if (assetContactId) {
      //   await AssetContact.findByIdAndUpdate(assetContactId, {
      //     user: assetContact,
      //   });
      // } else if (assetContact) {
      //   const assetContactId = await AssetContact.create({ user: assetContact });
      //   rest.assetContact = assetContactId;
      // }

      let newNotes: any;
      if (note) {
        newNotes = await Note.create({ note, author: req.currentUser?.id });
        if (!newNotes._id) throw new BadRequest(MESSAGES.NOTE_ERROR);
      }

      const address = splitAddressAsRequired(rest?.billingAddress);

      const updateObject = note
        ? { $push: { notes: newNotes._id }, ...rest, address }
        : { ...rest, address };

      const updatedItem = await Customer.findOneAndUpdate(
        { username: req.params.id },
        updateObject,
        { new: true }
      );

      res.status(STATUS_CODE.SUCCESS).send({ customer: updatedItem });
    } catch (error: any) {
      throw new Error(error);
    }
  },

  searchSuggestions: async (req: Request, res: Response) => {
    let { searchTerm = "" }: any = req.query;

    const customers = await Customer.aggregate([
      {
        $search: {
          index: "auto_complete_customer",
          autocomplete: {
            query: searchTerm,
            path: "name",
            tokenOrder: "sequential",
            fuzzy: { maxEdits: 1, prefixLength: 5 },
          },
        },
      },
      { $limit: 5 },
      {
        $project: {
          name: 1,
          phoneNumber: 1,
          email: 1,
          username: 1,
        },
      },
    ]);

    res.status(STATUS_CODE.SUCCESS).send({ customers });
  },

  getCustomerByName: async (req: Request, res: Response) => {
    const { searchTerm = "" }: any = req.query;

    const customers = await Customer.aggregate([
      {
        $match: {
          name: searchTerm,
        },
      },
      { $limit: 1 },
      {
        $project: {
          name: 1,
          phoneNumber: 1,
          email: 1,
          username: 1,
        },
      },
    ]);

    res.status(STATUS_CODE.SUCCESS).send({ customers });
  },

  fetchAssets: async (req: Request, res: Response) => {
    const assets = await Asset.find(
      { username: req.query.username },
      "assetNumber colorBegin monoBegin model"
    );
    res.status(STATUS_CODE.SUCCESS).send({ assets });
  },

  fetchCoolDownTimer: async (req: Request, res: Response) => {
    const coolDown = await Setting.findOne({}, "billsGeneratedAt").populate(
      "billsGeneratedBy activeBilling"
    );

    res.status(STATUS_CODE.SUCCESS).send(coolDown);
  },

  syncCustomers: async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    try {
      await session.startTransaction();
      const [data, baseUrl] = await MPS.registration();
      const mpsCustomers = await MPS.getCustomers(data.access_token, baseUrl);

      // map of MPS customers for quick lookup
      const mpsCustomerMap = new Map();
      mpsCustomers.data.Result.forEach((customer: any) => {
        mpsCustomerMap.set(customer.Description.toLowerCase(), customer);
      });

      const updates: any = [];
      const listOfCustomersSynced = new Set();
      const listOfCustomersNotSynced = new Set();
      const totalCustomers: any = [];

      const pageSize = 100;
      let page = 0;
      let processed = 0;
      const totalCount = await Customer.countDocuments();
      const totalPages = Math.ceil(totalCount / pageSize);

      while (page < totalPages) {
        const customers = await Customer.find({})
          .skip(page * pageSize)
          .limit(pageSize);

        if (customers.length === 0) break;

        totalCustomers.push(...customers);

        customers.forEach((customer) => {
          if (mpsCustomerMap.has(customer.name.toLowerCase())) {
            const mpsCustomer = mpsCustomerMap.get(customer.name.toLowerCase());
            listOfCustomersSynced.add(customer.id);
            updates.push({
              updateOne: {
                filter: { _id: customer._id },
                update: {
                  mpsCustomerCode: mpsCustomer.Code,
                  mpsCustomerId: mpsCustomer.Id,
                  checked: true,
                },
              },
            });
          } else {
            listOfCustomersNotSynced.add(customer.id);
          }
        });

        processed += customers.length;
        page++;
      }

      if (updates.length > 0) {
        await Customer.bulkWrite(updates, {
          session,
        });
      }

      // Create sync report
      const report: any = await CustomersReport.create(
        {
          success: Array.from(listOfCustomersSynced),
          failed: Array.from(listOfCustomersNotSynced),
          total: processed,
        },
        { session }
      );

      await SendNotification(
        "Customer Sync",
        `Success: ${listOfCustomersSynced.size} and Failed: ${listOfCustomersNotSynced.size}`,
        `/customers/reports/${report[0]._id}`
      );

      await session.commitTransaction();

      res.status(STATUS_CODE.SUCCESS).send(totalCustomers);
    } catch (error: any) {
      await session.abortTransaction();
      res.status(500).send({
        success: false,
        message: "Failed to sync customers",
        error: error.message,
      });
    } finally {
      session.endSession();
    }
  },

  getMpsCustomer: async (req: Request, res: Response) => {
    const [data, baseUrl]: any = await MPS.registration();

    const customers = await MPS.getCustomers(data.access_token, baseUrl);

    res.status(200).send({ customers: customers.data });
  },

  getSyncReport: async (req: Request, res: Response) => {
    const report = await CustomersReport.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      {
        $lookup: {
          from: "Customer",
          localField: "success",
          foreignField: "_id",
          as: "success",
        },
      },
      {
        $lookup: {
          from: "Customer",
          localField: "failed",
          foreignField: "_id",
          as: "failed",
        },
      },
    ]);
    res.status(STATUS_CODE.SUCCESS).send({ report });
  },

  //Add newly added customers in quickbook
  postAllQuickbook: async (req: Request, res: Response) => {
    const PAGE_SIZE = 50;
    let page = 0;

    try {
      const { token, realmId } = await isQuickBookAccessTokenValid();

      let hasMore = true;

      while (hasMore) {
        const customers = await Customer.find({
          companyId: new mongoose.Types.ObjectId(NORCOM_COMPANY_ID),
          quickBookId: { $exists: false },
        })
          .populate("companyId", "name")
          .limit(PAGE_SIZE);

        if (customers.length === 0) {
          hasMore = false;
          console.log("No Customer Found for Quick book syncing");
          if (page == 0) {
            throw new BadRequest("No Customer Found for Quick book syncing");
          }
        } else {
          await Promise.all(
            customers.map(async (customer: any) => {
              const data = restructureCustomerToQuickBook(customer);
              const cust = await createCustomerInQuickBook(
                token,
                realmId,
                data
              );
              return await Customer.findByIdAndUpdate(
                customer._id,
                {
                  $set: {
                    quickBookId: cust.Id,
                  },
                },
                {
                  new: true,
                }
              );
            })
          );
          page++;
        }
      }

      res.status(200).json({
        message: "Synced Succes",
      });
    } catch (error: any) {
      throw new BadRequest(error.message);
    }
  },

  //Add newly added customers in quickbook
  updateQuickbook: async (req: Request, res: Response) => {
    try {
      const { token, realmId } = await isQuickBookAccessTokenValid();

      const customer: any = await Customer.findById(req.params.id);

      console.log(customer?.quickBookId);

      if (!customer.quickBookId)
        throw new BadRequest("No quickBookId found for this customer");

      const data = restructureCustomerToQuickBook(customer);
      console.log("restructureCustomerToQuickBook");

      await updateCustomerInQuickBook(
        token,
        realmId,
        data,
        customer?.quickBookId
      );

      res.status(200).json({
        message: "Synced Succes",
      });
    } catch (error: any) {
      throw new BadRequest(error.message);
    }
  },

  syncCustomerToQuickbook: async (customer: any, session: any) => {
    const companyId = customer.companyId;

    if (companyId.toString() !== NORCOM_COMPANY_ID) return;

    const quickbook: IQuickBook = (await QuickBook.findOne({
      company: new mongoose.Types.ObjectId(companyId),
    })) as IQuickBook;

    const { realmId } = quickbook;

    const token = await getQuickBookTokenOrRefresh(realmId);

    const company = await Company.findById(customer.companyId).select("name");
    customer.companyId = company;

    const data = restructureCustomerToQuickBook(customer);

    const cust = await createCustomerInQuickBook(token, realmId, data);

    return await Customer.findByIdAndUpdate(
      customer._id,
      {
        $set: {
          quickBookId: cust.Id,
        },
      },
      {
        new: true,
      }
    ).session(session);
  },
};

export default customerController;
