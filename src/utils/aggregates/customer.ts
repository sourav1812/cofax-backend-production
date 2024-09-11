import { Request } from "express";
import Customer from "../../schema/customer.schema";
import { NoteLookUp } from "../../services/common.service";
import Asset from "../../schema/asset.schema";
import ServiceBilling from "../../schema/Invoices/service";
import MeterReading from "../../schema/meterReading.schema";
import PurchaseOrderBilling from "../../schema/Invoices/purchaseOrder.schema";
import SalesInvoice from "../../schema/Invoices/sales.schema";

export const getCustomerDetails = async (req: Request) => {
  return await Promise.all([
    Customer.aggregate([
      { $match: { username: req.params.id } },
      {
        $lookup: NoteLookUp,
      },
      {
        $project: {
          name: 1,
          email: 1,
          companyId: 1,
          billingSchedule: 1,
          contractNumber: 1,
          customerNumber: 1,
          mpsCustomerCode: 1,
          mpsCustomerId: 1,
          phoneNumber: 1,
          accountNumber: 1,
          address: 1,
          assetContact: 1,
          username: 1,
          quickBookShippingAddress: 1,
          shippingAddress: 1,
          quickBookBillingAddress: 1,
          billingAddress: 1,
          secondaryEmail:1,
          customerType: 1,
          id: "$_id",
          _id: 0,
          notes: 1,
        },
      },
    ]),
    Asset.aggregate([
      { $match: { username: req.params.id, deletedAt: null } },
      { $sort: { createdAt: -1 } },
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
    ]),
    MeterReading.aggregate([
      { $match: { username: req.params.id } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$assetId",
          data: {
            $push: {
              id: "$_id",
              color: "$color",
              sent: 1,
              mono: "$mono",
              createdAt: "$createdAt",
              invoiced: "$invoiced",
            },
          },
        },
      },
    ]),
    ServiceBilling.aggregate([
      { $match: { customerName: req.params.id } },
      { $sort: { createdAt: -1 } },
      ...CustAndAsset,
      {
        $group: {
          _id: "$assetId",
          data: {
            $push: {
              invoiceNo: "$invoiceNo",
              totalBilled: "$totalBilled",
              paid: "$paid",
              status: "$status",
              meter: "$meter",
              dueDate: "$dueDate",
              createdAt: "$createdAt",
              customerUserName: "$customer.username",
              customerName: "$customer.name",
              assetNumber: "$asset.assetNumber",
              assetId: "$asset._id",
              id: "$_id",
            },
          },
        },
      },
    ]),
    PurchaseOrderBilling.aggregate([
      { $match: { customerName: req.params.id } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "Customer",
          localField: "customerName",
          foreignField: "username",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
          foreignField: "_id",
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
        $group: {
          _id: "$assetId",
          data: {
            $push: {
              invoiceNo: "$invoiceNo",
              paid: "$paid",
              status: "$status",
              dueDate: "$dueDate",
              createdAt: "$createdAt",
              customerUserName: "$customer.username",
              customerName: "$customer.name",
              assetNumber: "$asset.assetNumber",
              assetId: "$asset._id",
              id: "$_id",
            },
          },
        },
      },
    ]),
    SalesInvoice.aggregate([
      { $match: { customerName: req.params.id } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "Customer",
          localField: "customerName",
          foreignField: "username",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          invoiceNo: "$invoiceNo",
          paid: "$paid",
          status: "$status",
          items: 1,
          dueDate: "$dueDate",
          createdAt: "$createdAt",
          customerUserName: "$customer.username",
          customerName: "$customer.name",
          id: "$_id",
        },
      },
    ]),
  ]);
};

export const CustAndAsset = [
  {
    $lookup: {
      from: "Customer",
      localField: "customerName",
      foreignField: "username",
      as: "customer",
      pipeline: [
        {
          $lookup: {
            from: "Company",
            localField: "companyId",
            foreignField: "_id",
            as: "company",
          },
        },
        { $unwind: "$company" },
      ],
    },
  },
  { $unwind: "$customer" },
  // {
  //   $lookup: {
  //     from: "Asset",
  //     localField: "assetId",
  //     foreignField: "_id",
  //     as: "asset",
  //   },
  // },
  // { $unwind: "$asset" },
  // {
  //   $lookup: {
  //     from: "Meter_Reading",
  //     localField: "meterId",
  //     foreignField: "_id",
  //     as: "meter",
  //   },
  // },
  // { $unwind: "$meter" },
];
