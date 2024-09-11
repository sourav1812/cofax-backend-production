import mongoose from "mongoose";
import { BadRequest } from "../errors/bad-request";
import Asset from "../schema/asset.schema";
import Item from "../schema/item.schema";
import Setting from "../schema/setting.schema";
import { SendNotification } from "./notification.service";
import xlsx from "xlsx";
import path from "path";
import Customer, { ICustomer } from "../schema/customer.schema";
import DocCount from "../schema/docCount.schema";
import { convertToSlug, generateSlug } from "../utils/functions";
import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import EquipContact from "../schema/equipContact.schema";
import ContractType from "../schema/contractType.schema";
// import {
//   QuickBookCustomerData,
//   addLocalCustomerToQuickBook,
//   restructureCustomerToQuickBook,
// } from "./quickbook.service";
const { readFileSync } = require("fs");

// // Only for dev
// const excelFilePath: string = path.join(
//   __dirname,
//   "../../public/data/db/norcom-customers.xlsx"
// );

// Read the Excel file
// const workbook: xlsx.WorkBook = xlsx.readFile(excelFilePath);
// const worksheet: xlsx.WorkSheet = workbook.Sheets["Sheet1"];
// const data: any[] = xlsx.utils.sheet_to_json(worksheet);

const getMinValue = async () => {
  const data: any = await Setting.find({});
  return data[0].notifyOnItem;
};

export const checkItemQuantity = async (request: any) => {
  let item: any = await Item.findOne({
    _id: new mongoose.Types.ObjectId(request.itemId),
  });
  const minVal = await getMinValue();

  let msg = "",
    title = "Low Stock Warning";
  if (!item) {
    throw new BadRequest(`No Item found with ${request.name}`, 400);
  } else if (item && request.quantity > item.quantity) {
    if (request.quantity - item.quantity < minVal) {
      msg = `Only ${request.quantity - item.quantity} ${
        item.name
      } units remaining!`;
      await SendNotification(title, msg);
    }
    throw new BadRequest(msg, 400);
  }
  msg = `Only ${item.quantity - request.quantity} ${
    item.name
  } units remaining!`;
  if (item.quantity - request.quantity < minVal) {
    console.log("item.quantity < minVal");
    await SendNotification(title, msg);
  }
};

export const checkDuplicatePartIdsAndQuatity = async (
  rest: any,
  session: any
) => {
  if (rest?.items?.length) {
    const duplicate = rest.items.filter((it: any) => rest.itemId === it.itemId);

    if (duplicate.length)
      throw new BadRequest(`Duplicate ${rest.itemName} is Detected`, 400);
    const duplicatePartIds = findDuplicatePartIds(rest?.items);
    if (duplicatePartIds.length > 0)
      throw new BadRequest(`Duplicate found: ${duplicatePartIds.join(", ")}`);

    const checkingItems = rest.items.map((it: any) => checkItemQuantity(it));

    await Promise.all(checkingItems);

    //reduce the quantity from inventory item
    const updateItems = rest.items.map((it: any) => {
      return Item.updateOne(
        { _id: new mongoose.Types.ObjectId(it.itemId) },
        { $inc: { quantity: -it.quantity } },
        { session }
      );
    });

    await Promise.all(updateItems);
  }
};

export function findDuplicatePartIds(items: any) {
  const itemIdSet = new Set();
  const duplicatePartIds = new Set();

  for (const item of items) {
    const itemId = item.itemId;

    if (itemIdSet.has(itemId)) {
      duplicatePartIds.add(itemId);
    } else {
      itemIdSet.add(itemId);
    }
  }

  return Array.from(duplicatePartIds);
}

export const trasnferIntoAsset = async (service: any, session: any) => {
  const serviceItems = service.items.map((it: any) => {
    return {
      itemId: it.itemId,
      quantity: it.quantity,
    };
  });

  const asset: any = await Asset.findOne({ assetNumber: service?.assetNumber });
  const assetsItemsMap: any = new Map(
    asset.items.map(({ itemId, quantity }: any) => [
      itemId,
      { itemId, quantity },
    ])
  );

  const newAssetItems = serviceItems.map((serviceItem: any) => {
    const existingAssetItem = assetsItemsMap.get(serviceItem.itemId);

    if (existingAssetItem) {
      const { itemId, quantity } = existingAssetItem;
      const newQuantity = quantity + serviceItem.quantity;
      return { itemId, quantity: newQuantity };
    } else {
      return serviceItem;
    }
  });

  const updatedAssetItems = asset.items.filter((existingItem: any) => {
    const updatedItem = newAssetItems.find(
      (newItem: any) => newItem.itemId === existingItem.itemId
    );
    const { itemId, quantity } = existingItem;
    if (!updatedItem) {
      return { itemId, quantity };
    }
  });

  asset.items = [...updatedAssetItems, ...newAssetItems];
  await asset.save({ session, validateBeforeSave: false });
};

export const NoteLookUp: any = {
  from: "Note",
  localField: "notes",
  foreignField: "_id",
  //TODO: Group by month and year and also pagination
  pipeline: [
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "User",
        localField: "author",
        foreignField: "_id",
        as: "author",
      },
    },
    {
      $unwind: "$author",
    },
    {
      $project: {
        "author._id": 1,
        "author.username": 1,
        "author.firstName": 1,
        "author.lastName": 1,
        note: 1,
        createdAt: 1,
      },
    },
  ],
  as: "notes",
};

//!DO NOT
export const deleteAllCollection = async () => {
  const collections = mongoose.connection.collections;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
};

/*

export const xlsxToJson = async (req: Request, res: Response) => {
  // Transform the of Norcom to DB
  const allCustomer: any = [];
  const session = await mongoose.startSession();

  await session.withTransaction(async (session) => {
    for (let entry of data) {
      try {
        const startDate = new Date();
        const endDate = new Date(
          startDate.setFullYear(startDate.getFullYear() + 1)
        );

        //* Important : Duplicates customer because of assets
        const counts: any = await DocCount.findOneAndUpdate(
          {},
          { $inc: { customer: 1, partId: 1 } },
          { new: true, session }
        );

        const username = convertToSlug(
          entry["Customer name"] + counts?.customer
        );

        const customer = {
          username,
          name: entry["Customer name"],
          customerNumber: entry["Customer number"] || "",
          phoneNumber: entry["Phone Number"] || "",
          email: entry["Customer email"] || "",
          billingAddress: entry["Billing Address"] || "",
          shippingAddress: entry["Billing Address"],
          customerType: "65608c1a9c2c0e1849eb0951",
          billingSchedule: "monthly",
          companyId: "658d458f16eabad417c8bbc3",
          isActive: true,
        };

        const escapedSearchTerm = entry["Customer name"].replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        ); // Escape special characters
        const regexPattern = new RegExp(`^${escapedSearchTerm}`, "i");

        const customerDoc = await Customer.findOneAndUpdate(
          {
            name: { $regex: regexPattern },
          },
          {
            $setOnInsert: {
              ...customer,
              notes: undefined,
            },
          },
          { session, upsert: true, new: true, setDefaultsOnInsert: true }
        );

        allCustomer.push(customerDoc);

        //2. Get itemId
        const item = await Item.findOneAndUpdate(
          { name: entry["Item Name"] },
          {
            $setOnInsert: {
              name: entry["Item Name"],
              quantity: 0,
              price: 200,
              prodType: "new",
              categoryId: "655d91a1ab23632f85d0ba5e",
              partId: generateSlug(entry["Item Name"] || "" + counts?.partId),
            },
          },
          { session, upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const equipContact = await EquipContact.findOneAndUpdate(
          {
            user: entry["equipContact"],
          },
          {
            $setOnInsert: {
              user: entry["equipContact"] || "",
            },
          },
          { session, upsert: true, new: true, setDefaultsOnInsert: true }
        );

        let contractType;
        if (entry["Contract Type"])
          contractType = await ContractType.findOneAndUpdate(
            {
              name: entry["Contract Type"],
            },
            {
              $setOnInsert: {
                name: entry["Contract Type"],
              },
            },
            { session, upsert: true, new: true, setDefaultsOnInsert: true }
          );

        //3. Asset
        if (item?._id && entry["Asset Number"]) {
          const assetData = {
            createdBy: req.currentUser?.id || undefined,
            itemId: item?._id,
            items: undefined,
            partId: item?.partId,
            assetNumber: entry["Asset Number"],
            model: entry["Model"],
            equipContact: equipContact?._id,
            monoBegin: entry["mono reading"] || 0,
            monoPrice: entry["mono unit price"] || 0,
            colorBegin: entry["color reading"] || 0,
            colorPrice: entry["color price"] || 0,
            contractType: contractType?._id || "6602b3e77d18296228dff0ac",
            assetContact: entry["Asset Contact"],
            serialNo: entry["Serial Nos"],
            username: customerDoc.username,
            customerId: customerDoc?._id,
            startDate,
            endDate,
            coveredMono: 0,
            coveredColor: 0,
            isActive: true,
          };
          await Asset.findOneAndUpdate(
            { assetNumber: assetData.assetNumber },
            {
              $setOnInsert: assetData,
            },
            { session, upsert: true, new: true, setDefaultsOnInsert: true }
          );
        } else {
          //TODO: remove abort line
          // await session.abortTransaction();
        }
      } catch (error: any) {
        console.log(error);
        throw new BadRequest(error.message);
      }
    }
  });

  res.status(STATUS_CODE.SUCCESS).send({
    message: "success",
    length: allCustomer.length,
    data: allCustomer,
  });
};

export const importCofaxData = async (req: Request, res: Response) => {
  //1. importing customer
  const customerPath: string = path.join(
    __dirname,
    "../../public/data/db/cofax.clients.json"
  );
  let rawData = readFileSync(customerPath);
  rawData = JSON.parse(rawData);

  const customers = await importCofaxCustomer(rawData);

  //2. importing asset
  const assetPath: string = path.join(
    __dirname,
    "../../public/data/db/cofax.copiers.json"
  );
  let rawAssets = readFileSync(assetPath);
  rawAssets = JSON.parse(rawAssets);

  const assets: any = await importCofaxAsset(rawAssets, req.currentUser?.id!);

  res.status(200).send({
    total: customers.length,
    totalAssets: assets.length,
    // customers,
    // assets,
  });
};

export const importCofaxCustomer = async (data: any) => {
  //2. create customer
  const customers: any = [];

  const session = await mongoose.startSession();

  await session.withTransaction(async (session) => {
    for (let it of data) {
      try {
        const counts: any = await DocCount.findOneAndUpdate(
          {},
          { $inc: { customer: 1 } },
          { new: true, session }
        );

        const username = convertToSlug(it.name + counts?.customer);

        const customer = {
          name: it.name,
          username,
          phoneNumber: it.phoneNumber || "9054794222",
          prevDbId: it._id["$oid"],
          email: it.email || "admin@cofax.com",
          billingAddress: `${it.billingAddress.province}, ${it.billingAddress.city}, ${it.billingAddress.address}, ${it.billingAddress.postalCode}`,
          shippingAddress: `${it.billingAddress.province}, ${it.shippingAddress.city},${it.shippingAddress.address}, ${it.billingAddress.postalCode}`,
          customerType: "65608c1a9c2c0e1849eb0951",
          billingSchedule: "monthly",
          companyId: "658d45077bde882afe3b0ba3",
          isActive: true,
        };

        const escapedSearchTerm = it.name.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        ); // Escape special characters
        const regexPattern = new RegExp(`^${escapedSearchTerm}`, "i");

        await Customer.findOneAndUpdate(
          {
            name: { $regex: regexPattern },
          },
          {
            $setOnInsert: {
              ...customer,
              notes: undefined,
            },
          },
          {
            session,
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        customers.push(customer);
      } catch (error: any) {
        console.log(error);
        throw new BadRequest(error.message);
      }
    }
  });

  return customers;
};

export const importCofaxAsset = async (data: any, createdBy: string) => {
  //2. create customer
  const assets: any = [];
  const session = await mongoose.startSession();

  await session.withTransaction(async (session) => {
    for (let it of data) {
      const startDate = new Date();
      const endDate = new Date(
        startDate.setFullYear(startDate.getFullYear() + 1)
      );

      const counts: any = await DocCount.findOneAndUpdate(
        {},
        { $inc: { partId: 1 } },
        { new: true, session }
      );

      console.log("counts?.partId", counts?.partId);

      const item = await Item.findOneAndUpdate(
        { name: it.copierModel },
        {
          $setOnInsert: {
            name: it.copierModel,
            quantity: 0,
            price: 200,
            prodType: "new",
            categoryId: "655d91a1ab23632f85d0ba5e",
            partId: convertToSlug(it.copierModel + counts?.partId),
          },
        },
        { session, upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const customer: any = await Customer.findOne(
        { prevDbId: it?.clientId["$oid"] },
        null,
        {
          session,
        }
      );

      const monoBegin = it?.readings?.length
        ? it?.readings[it?.readings?.length - 1]?.data[0]?.value
        : 0;

      const colorBegin = it?.readings?.length
        ? it?.readings[it?.readings?.length - 1]?.data[1]?.value
        : 0;

      const equipContact = await EquipContact.create(
        [
          {
            user: "",
          },
        ],
        { session }
      );

      const assetData = {
        createdBy,
        itemId: item?._id,
        partId: item?.partId,
        assetNumber: it.id,
        model: it.copierModel,
        items: undefined,
        equipContact: equipContact[0]._id,
        monoBegin,
        monoPrice: it.rates[0]?.value ?? 0,
        colorBegin,
        colorPrice: it.rates[1]?.value ?? 0,
        contractType: "65608c1a9c2c0e1849eb0951",
        serialNo: "unknown",
        username: customer.username,
        customerId: customer?._id,
        startDate,
        endDate,
        rentalCharge: it.rentalPrice,
        coveredMono: 0,
        coveredColor: 0,
        isActive: true,
      };

      await Asset.findOneAndUpdate(
        {
          assetNumber: it.id,
        },
        {
          $setOnInsert: assetData,
        },
        {
          session,
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      assets.push(assetData);
    }
  });

  return assets;
};

export const updateAssetAddress = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  const billingAddressCache: Record<string, string> = {};
  const sameBillAndLocation: string[] = [];
  const diffBillAndLocationAsSame: string[] = [];
  const locationIsNotSame: string[] = [];

  console.log("Processing asset address update...");

  try {
    await session.withTransaction(async (session) => {
      for (const entry of data) {
        let {
          "Customer name": customerName,
          "Asset Number": assetNumber,
          "Equip. Location Address": equipLocationAddress,
          "Billing Address": billingAddress,
        } = entry;

        equipLocationAddress = equipLocationAddress || billingAddress;

        if (!billingAddress || !billingAddress.length) {
          console.log("Billing Address Empty: -> ", entry);
        }

        let locationAddress = "";

        if (
          equipLocationAddress?.toLowerCase() === "same" &&
          billingAddress?.toLowerCase() === "same"
        ) {
          if (!billingAddressCache[customerName]) {
            const anotherAsset = data.find(
              (it: any) =>
                it["Customer name"] === customerName &&
                it["Billing Address"].toLowerCase() !== "same"
            );
            billingAddressCache[customerName] = anotherAsset
              ? anotherAsset["Billing Address"]
              : null;
          }

          locationAddress = billingAddressCache[customerName];

          sameBillAndLocation.push(assetNumber);
        } else if (
          equipLocationAddress.toLowerCase() === "same" &&
          billingAddress.toLowerCase() !== "same"
        ) {
          locationAddress = billingAddress;
          billingAddressCache[customerName] = billingAddress;
          diffBillAndLocationAsSame.push(assetNumber);
        } else if (equipLocationAddress.toLowerCase() !== "same") {
          locationAddress = equipLocationAddress;
          if (assetNumber) locationIsNotSame.push(assetNumber);
        }

        if (assetNumber) {
          await Asset.findOneAndUpdate(
            { assetNumber: assetNumber },
            {
              locationAddress: locationAddress,
            },
            { new: true, session }
          );
        }
      }

      res.send({
        sameBillAndLocation,
        diffBillAndLocationAsSame,
        locationIsNotSame,
        length:
          sameBillAndLocation?.length +
          diffBillAndLocationAsSame?.length +
          locationIsNotSame?.length,
        billingAddressCache,
      });
    });
  } catch (error: any) {
    console.log("error: ", error);
  }
};


export const updateCofaxCustomersAddress = async (
  req: Request,
  res: Response
) => {
  const customerPath: string = path.join(
    __dirname,
    "../../public/data/db/cofax.clients.json"
  );
  let rawData = readFileSync(customerPath);
  const customers = JSON.parse(rawData);

  const cofaxId = new mongoose.Types.ObjectId("658d45077bde882afe3b0ba3");

  try {
    const cofaxCustomerCount = await Customer.countDocuments({
      companyId: cofaxId,
    });
    console.log("Total Cofax Customers: ", cofaxCustomerCount);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const bulkOps = customers.map((customer: any) => ({
        updateOne: {
          filter: {
            name: customer.name,
            companyId: cofaxId,
          },
          update: {
            $set: {
              billingAddress: `${customer.billingAddress.address}, ${customer.billingAddress.city}, ${customer.billingAddress.province}, ${customer.billingAddress.postalCode}`,
              shippingAddress: `${customer.billingAddress.address}, ${customer.billingAddress.city}, ${customer.billingAddress.province}, ${customer.billingAddress.postalCode}`,
            },
            $set: {
              address: {
                address: customer.billingAddress.address,
                city: customer.billingAddress.city,
                province: customer.billingAddress.province,
                postalcode: customer.billingAddress.postalCode
              }
            }
          },
        },
      }));

      const result = await Customer.bulkWrite(bulkOps, { session });
      console.log("Bulk operation result: ", result);

      await session.commitTransaction();
      res
        .status(200)
        .json({ message: "Cofax customer addresses updated successfully." });
    } catch (error) {
      await session.abortTransaction();
      console.error("Transaction aborted due to error: ", error);
      res.status(500).json({ error: "Failed to update customer addresses." });
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error fetching customer count: ", error);
    res.status(500).json({ error: "Failed to count Cofax customers." });
  }
};





export const updateNorcomCustomersAddress = async (
  req: Request,
  res: Response
) => {
  const norcom = new mongoose.Types.ObjectId("658d458f16eabad417c8bbc3");

  const customers = await Customer.find({
    companyId: norcom
  })

  try {
    const norcomCustomerCount = await Customer.countDocuments({
      companyId: norcom,
    });
    console.log("Total Norcom Customers: ", norcomCustomerCount);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const bulkOps:any = customers.map((customer: any) => {
        const address = splitAddressAsRequired(customer?.shippingAddress);
        return {
          updateOne: {
            filter: {
              name: customer?.name,
              companyId: norcom
            },
            update: {
              $set: {
                address: address
              }
            }
          }
        }
      });


      const result = await Customer.bulkWrite(bulkOps, { session });
      console.log("Bulk operation result: ", result);

      await session.commitTransaction();
      res
        .status(200)
        .json({ message: "norcom customer addresses updated successfully." });
    } catch (error) {
      // await session.abortTransaction();
      console.error("Transaction aborted due to error: ", error);
      res.status(500).json({ error: "Failed to update customer addresses." });
    } finally {
      // session.endSession();
    }
  } catch (error) {
    console.error("Error fetching customer count: ", error);
    res.status(500).json({ error: "Failed to count Cofax customers." });
  }
};

*/
export const splitAddressAsRequired = (add_string: string) => {
  if (!add_string) {
    return {
      address: "",
      city: "",
      province: "",
      postalCode: "",
    };
  }
  const splittedArr = add_string.split(",");
  const end: number = splittedArr.length - 1;
  const first: number = 0;
  return {
    address: splittedArr[first],
    city: splittedArr[first + 1],
    province: splittedArr[end - 1],
    postalCode: splittedArr[end],
  };
};

// export const bulkCreateCustomerInQuickbook = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     const customers = await Customer.find().populate("companyId", "name");

//     const successCustomerIds: string[] = [];
//     const failedCustomerIds: string[] = [];
//     const results = await Promise.allSettled(
//       customers.map(async (customer) => {
//         try {
//           const quick = await addLocalCustomerToQuickBook(customer);
//           await Customer.findByIdAndUpdate(
//             customer.id,
//             {
//               quickBookId: +quick.Id,
//             },
//             {
//               new: true,
//             }
//           );
//           successCustomerIds.push(customer.id);
//           return quick;
//         } catch (error) {
//           failedCustomerIds.push(customer.id);
//           return { error, customerId: customer.id };
//         }
//       })
//     );

//     const customersCreated = results
//       .filter(
//         (result) =>
//           result.status === "fulfilled" &&
//           !(result as PromiseFulfilledResult<any>).value.error
//       )
//       .map((result) => (result as PromiseFulfilledResult<any>).value);

//     const errors = results
//       .filter(
//         (result) =>
//           result.status === "rejected" ||
//           (result as PromiseFulfilledResult<any>).value.error
//       )
//       .map((result) => (result as PromiseFulfilledResult<any>).value);

//     res.status(201).json({
//       success: true,
//       results: customersCreated.length,
//       successCustomerIds,
//       failedCustomerIds,
//       errors,
//     });
//   } catch (error: any) {
//     console.log(
//       "Error Logging: ",
//       error?.response?.data?.Fault ?? error?.response ?? error
//     );
//     res.status(500).json({ success: false, error: error.message });
//   }
// };
