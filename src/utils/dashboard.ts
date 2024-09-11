import SalesInvoice from "../schema/Invoices/sales.schema";
import Asset from "../schema/asset.schema";
import Customer from "../schema/customer.schema";
import Item from "../schema/item.schema";
import ServiceCall from "../schema/serviceCall.schema";
import TechStock from "../schema/techStock.schema";

export const getItems = async () => {
  //Inventory Item
  const [inventoryItems, itemInsideAssets, techsItems, sales] =
    await Promise.all([
      Item.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$quantity" }, // Calculate the sum of all totalItems
          },
        },
      ]),
      Asset.aggregate([
        {
          $addFields: {
            totalItems: {
              $add: [
                { $sum: "$items.quantity" }, // Sum of quantities in the items array
                1, // Add 1 for the array itself
              ],
            },
          },
        },
        {
          $project: {
            _id: 0, // Exclude _id field from output
            id: 1, // Include id field in output
            totalItems: 1, // Include totalItems field in output
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalItems" }, // Calculate the sum of all totalItems
          },
        },
      ]),
      TechStock.aggregate([
        {
          $group: {
            _id: null,
            quantity: { $sum: "$quantity" }, // Calculate the sum of all totalItems
          },
        },
      ]),
      SalesInvoice.aggregate([
        {
          $addFields: {
            totalItems: {
              $sum: {
                $map: {
                  input: "$items",
                  in: {
                    $cond: {
                      if: {
                        $ne: ["$$this.itemId", ""],
                      },
                      then: "$$this.quantity",
                      else: 0,
                    },
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalItems" }, // Calculate the sum of all totalItems
          },
        },
      ]),
    ]);

  return {
    inventory: inventoryItems,
    assets: itemInsideAssets,
    technicians: techsItems,
    sales,
  };
};

export const getWidgets = async (Modal: any) => {
  const currentDate = new Date();
  const twelveMonthsAgo = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 11,
    currentDate.getDate()
  );

  const total = await Modal.countDocuments({});

  const result = await Modal.aggregate([
    {
      $match: {
        createdAt: { $gte: twelveMonthsAgo, $lte: currentDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
    },
  ]);

  const monthSequence = [];

  let currentMonth = new Date(twelveMonthsAgo); // Start with 12 months ago
  for (let i = 0; i < 12; i++) {
    monthSequence.push({
      _id: {
        year: currentMonth.getFullYear(),
        month: currentMonth.getMonth() + 1, // Month is 0-indexed, so add 1
      },
      count: 0, // Initialize count to zero
    });
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  // Left join the sequence with the query result
  const mergedResult = [];
  let resultIndex = 0;
  let sequenceIndex = 0;
  while (sequenceIndex < monthSequence.length) {
    if (
      resultIndex >= result.length ||
      result[resultIndex]._id.year !== monthSequence[sequenceIndex]._id.year ||
      result[resultIndex]._id.month !== monthSequence[sequenceIndex]._id.month
    ) {
      // If no match found, push the sequence entry with zero count
      mergedResult.push(monthSequence[sequenceIndex]);
      sequenceIndex++;
    } else {
      // If match found, push the query result
      mergedResult.push(result[resultIndex]);
      resultIndex++;
      sequenceIndex++;
    }
  }

  return { mergedResult, total };
};

export const getServiceCall = async () => {
  const serviceCalls = await ServiceCall.aggregate([
    {
      $group: {
        _id: "$status",
        total: { $sum: 1 },
      },
    },
  ]);

  return serviceCalls;
};

export const getServiceWidget = async () => {
  const currentDate = new Date();
  const twelveMonthsAgo = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 11,
    currentDate.getDate()
  );

  const totalCalls = await ServiceCall.countDocuments({});

  const result = await ServiceCall.aggregate([
    {
      $match: {
        createdAt: { $gte: twelveMonthsAgo, $lte: currentDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
    },
  ]);

  const monthSequence = [];

  let currentMonth = new Date(twelveMonthsAgo); // Start with 12 months ago
  for (let i = 0; i < 12; i++) {
    monthSequence.push({
      _id: {
        year: currentMonth.getFullYear(),
        month: currentMonth.getMonth() + 1, // Month is 0-indexed, so add 1
      },
      count: 0, // Initialize count to zero
    });
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  // Left join the sequence with the query result
  const mergedResult = [];
  let resultIndex = 0;
  let sequenceIndex = 0;
  while (sequenceIndex < monthSequence.length) {
    if (
      resultIndex >= result.length ||
      result[resultIndex]._id.year !== monthSequence[sequenceIndex]._id.year ||
      result[resultIndex]._id.month !== monthSequence[sequenceIndex]._id.month
    ) {
      // If no match found, push the sequence entry with zero count
      mergedResult.push(monthSequence[sequenceIndex]);
      sequenceIndex++;
    } else {
      // If match found, push the query result
      mergedResult.push(result[resultIndex]);
      resultIndex++;
      sequenceIndex++;
    }
  }

  return { mergedResult, totalCalls };
};
