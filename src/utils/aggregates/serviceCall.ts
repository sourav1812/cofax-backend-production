import mongoose from "mongoose";
import { NoteLookUp } from "../../services/common.service";
import { Request } from "express";

export const aggregateServiceCall = (req: Request) => {
  return [
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.params.id),
      },
    },
    {
      $lookup: NoteLookUp,
    },
    {
      $lookup: {
        from: "Equip_Contact",
        localField: "equipContact",
        foreignField: "_id",
        as: "equipContact",
      },
    },
    {
      $unwind: "$equipContact",
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
            $lookup: {
              from: "Contract_Type",
              localField: "contractType",
              foreignField: "_id",
              as: "billCode",
            },
          },
          { $unwind: "$billCode" },
          { $unwind: "$customer" },
          {
            $project: {
              notes: 0,
              "customer.notes": 0,
            },
          },
        ],
        as: "asset",
      },
    },
    { $unwind: "$asset" },
    {
      $lookup: {
        from: "User",
        localField: "technician",
        foreignField: "_id",
        as: "technician",
      },
    },
    {
      $unwind: { path: "$technician", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        workOrder: 1,
        assetNumber: 1,
        assetId: 1,
        technician: 1,
        equipContact: 1,
        assetContact: 1,
        techId: 1,
        quantity: 1,
        status: 1,
        contactPhone: 1,
        requestedBy: 1,
        callDueBy: 1,
        shippingAddress: 1,
        createdAt: 1,
        serviceTypeId: 1,
        locationNote: 1,
        workPerformed: 1,
        billingAddress: 1,
        priority: 1,
        description: 1,
        notes: 1,
        asset: 1,
        items: 1,
        itemData: {
          $map: {
            input: "$itemsData",
            as: "item",
            in: {
              name: "$$item.name",
              itemId: "$$item._id",
              partId: "$$item.partId",
            },
          },
        },
      },
    },
  ];
};

export const aggregateOnServiceCallTicket = (req: Request) => {
  return [
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.params.id),
      },
    },
    {
      $lookup: {
        from: "Service_Type",
        localField: "serviceTypeId",
        foreignField: "_id",
        as: "serviceType",
      },
    },
    {
      $unwind: {
        path: "$serviceType",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "Equip_Contact",
        localField: "equipContact",
        foreignField: "_id",
        as: "equipContact",
      },
    },
    {
      $unwind: {
        path: "$equipContact",
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
          {
            $lookup: {
              from: "Contract_Type",
              localField: "contractType",
              foreignField: "_id",
              as: "billCode",
            },
          },
          { $unwind: "$billCode" },
          { $unwind: "$customer" },
          {
            $project: {
              notes: 0,
              "customer.notes": 0,
            },
          },
        ],
        as: "asset",
      },
    },
    { $unwind: "$asset" },
    { $unwind: "$asset" },
    {
      $lookup: {
        from: "User",
        localField: "technician",
        foreignField: "_id",
        as: "technician",
      },
    },
    {
      $unwind: { path: "$technician", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        notes: 0,
      },
    },
  ];
};
