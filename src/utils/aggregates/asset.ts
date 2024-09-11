import { Request } from "express";
import { NoteLookUp } from "../../services/common.service";

export const getOne = (req: Request) => {
  return [
    {
      $match: {
        assetNumber: req.params.id,
        deleteAt: null,
      },
    },
    {
      $lookup: {
        from: "Contract_Type",
        localField: "contractType",
        foreignField: "_id",
        as: "contract",
      },
    },
    {
      $unwind: "$contract",
    },
    {
      $lookup: NoteLookUp,
    },
    {
      $lookup: {
        from: "Customer",
        localField: "customerId",
        foreignField: "_id",
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
        from: "Item",
        localField: "itemId",
        foreignField: "_id",
        as: "item",
      },
    },
    {
      $unwind: {
        path: "$item",
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
      $unwind: "$equipContact",
    },
    {
      $lookup: {
        from: "User",
        localField: "technicianId",
        foreignField: "_id",
        as: "technician",
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
        model: 1,
        contract: 1,
        id: "$_id",
        _id: 0,
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
        notes: 1,
        customer: 1,
        technician: 1,
        contractAmount: 1,
        baseAdj: 1,
        rentalCharge: 1,
        equipContact: 1,
        coveredMono: 1,
        monoPrice: 1,
        coveredColor: 1,
        colorPrice: 1,
        monoBegin: 1,
        colorBegin: 1,
        assetNumber: 1,
        assetContact: 1,
        startDate: 1,
        endDate: 1,
        serialNo: 1,
        partId: 1,
        username: 1,
        item: 1,
        rentDuration: 1,
        isActive: 1,
        locationAddress: 1,
      },
    },
  ];
};

export const assetAggregate = [
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
          },
        },
        { $unwind: "$company" },

        {
          $project: {
            "company.logo": 0,
            "company.notes": 0,
          },
        },
      ],
    },
  },
  { $unwind: "$customer" },
  {
    $match: {
      "customer.isActive": true,
    },
  },
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
    $unwind: "$contractType",
  },
];
