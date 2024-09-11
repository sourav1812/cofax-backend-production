import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import ContractType from "../schema/contractType.schema";
import Category from "../schema/category.schema";
import {
  BILL_SCHEDULES,
  DURATION,
  PRIORITY,
  SHIP_METHOD,
  STATUS,
} from "../constant/data";
import Company from "../schema/companyInfo.schema";
import Area from "../schema/area.schema";
import Role from "../schema/role.schema";
import ServiceCallType from "../schema/serviceType.schema";
import User from "../schema/user.schema";
import Vendor from "../schema/vendor.schema";
import Tax from "../schema/Invoices/tax.schema";
import Setting from "../schema/setting.schema";
import Customer from "../schema/customer.schema";
import { BadRequest } from "../errors/bad-request";
import { isQuickBookAccessTokenValid } from "../services/quickbook.service";

const ConstantController = {
  getConstants: async (req: Request, res: Response) => {
    const [
      contractTypes,
      categories,
      companies,
      areas,
      roles,
      serviceTypes,
      technicians,
      vendors,
      tax,
      lastGeneratedBillsAt,
    ] = await Promise.all([
      ContractType.find({ isActive: true }),
      Category.find(),
      Company.find({}, "name address"),
      Area.find({ isActive: true }, "address"),
      Role.find({ isActive: true, name: { $ne: "super-admin" } }, "name"),
      ServiceCallType.find({ isActive: true }, "name"),
      User.aggregate([
        {
          $lookup: {
            from: "Role",
            localField: "role",
            foreignField: "_id",
            as: "role",
          },
        },
        {
          $unwind: "$role",
        },
        { $match: { "role.name": { $ne: "super-admin" } } },
        {
          $project: {
            username: 1,
            firstName: 1,
            lastName: 1,
            id: "$_id",
            _id: 0,
          },
        },
      ]),
      Vendor.find({ isActive: true }, "name"),
      Tax.findOne({}),
      Setting.findOne({}, "billsGeneratedAt").populate("billsGeneratedBy"),
    ]);

    res.status(STATUS_CODE.SUCCESS).send({
      contractTypes,
      categories,
      status: STATUS,
      priority: PRIORITY,
      duration: DURATION,
      companies,
      areas,
      roles,
      serviceTypes,
      technicians,
      vendors,
      tax,
      billingSchedules: BILL_SCHEDULES,
      lastGeneratedBillsAt,
      shipMethod: SHIP_METHOD,
    });
  },

  updateDoc: async (req: Request, res: Response) => {
    try {
      await Customer.updateMany({}, { $unset: { quickBookId: 1 } });
      res.send({});
    } catch (error: any) {
      console.error("Update failed:", error);
      throw new BadRequest(error.message);
    }
  },

  testApi: async (req: Request, res: Response) => {
    const data = await isQuickBookAccessTokenValid();
    res.send({ data });
  },
};

export default ConstantController;
