import ServiceBilling from "../../schema/Invoices/service";
import mongoose from "mongoose";
import {
  ServiceBillCalculation,
  calculateOverallTotal,
  isArrayEffectivelyEmpty,
} from "../functions/invoiceBillCalculations";
import Tax from "../../schema/Invoices/tax.schema";

export const getMeterInvoice = async (invoiceId: string) => {
  if (!invoiceId) return [];
  let [meterReading, tax]: any = await Promise.all([
    ServiceBilling.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(invoiceId) } },
      {
        $lookup: {
          from: "Customer",
          localField: "customerName",
          foreignField: "username",
          pipeline: [
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
                "company.hostPassword": 0,
                "company.host": 0,
                "company.hostEmail": 0,
                "company.hostPort": 0,
                "company.logo": 0,
                "company.notes": 0,
              },
            },
          ],
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      // {
      //   $lookup: {
      //     from: "Asset",
      //     localField: "assetId",
      //     foreignField: "_id",
      //     pipeline: [
      //       {
      //         $lookup: {
      //           from: "Contract_Type",
      //           localField: "contractType",
      //           foreignField: "_id",
      //           as: "contractType",
      //         },
      //       },
      //       { $unwind: "$contractType" },
      //     ],
      //     as: "asset",
      //   },
      // },
      // { $unwind: "$asset" },
      // {
      //   $lookup: {
      //     from: "Meter_Reading",
      //     localField: "meterId",
      //     foreignField: "_id",
      //     as: "meterReading",
      //   },
      // },
      // { $unwind: "$meterReading" },
      {
        $project: {
          "asset.notes": 0,
          "customer.notes": 0,
        },
      },
      {
        $unwind: {
          path: "$assets",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "Asset",
          localField: "assets.assetId",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "Contract_Type",
                localField: "contractType",
                foreignField: "_id",
                as: "contractType",
              },
            },
            { $unwind: "$contractType" },
          ],
          as: "assets.asset",
        },
      },
      {
        $unwind: {
          path: "$assets.asset",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "Meter_Reading",
          localField: "assets.meterId",
          foreignField: "_id",
          as: "assets.meterReading",
        },
      },
      {
        $unwind: {
          path: "$assets.meterReading",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          invoiceNo: { $first: "$invoiceNo" },
          paid: { $first: "$paid" },
          discount: { $first: "$discount" },
          status: { $first: "$status" },
          dueDate: { $first: "$dueDate" },
          assetId: { $first: "$assetId" },
          meterId: { $first: "$meterId" },
          customerName: { $first: "$customerName" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },
          __v: { $first: "$__v" },
          customer: { $first: "$customer" },
          asset: { $first: "$asset" },
          meterReading: { $first: "$meterReading" },
          assets: { $push: "$assets" },
        },
      },
    ]),
    Tax.findOne({}),
  ]);

  meterReading = meterReading[0];
  if (isArrayEffectivelyEmpty(meterReading?.assets ?? [])) {
    meterReading.assets = [];
    return meterReading;
  }

  const serviceInvoice = await ServiceBillCalculation(
    {
      ...meterReading,
      // prevMeterReading,
    },
    tax?.hstTax
  );

  const totals = calculateOverallTotal(serviceInvoice?.assets);

  serviceInvoice.metaTotal = totals;
  return serviceInvoice;
};
