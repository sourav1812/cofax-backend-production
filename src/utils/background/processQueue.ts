import { CustomerQueue } from "../../schema/customerQueueSchema";
import Customer from "../../schema/customer.schema";
import { BillingStatus } from "../../schema/billingStatus.schema";
import Asset from "../../schema/asset.schema";
import { assetAggregate } from "../aggregates/asset";
import { billableAssets } from "../functions/billableAssets";
import mongoose, { ObjectId } from "mongoose";
import AssetsReport from "../../schema/report/assetSync.schema";
import { ReportType } from "../types/enum/db";
import { SendNotification } from "../../services/notification.service";
import AuditReport from "../../schema/report/billingAudit.schema";
import Setting from "../../schema/setting.schema";

const PAGE_SIZE = 50;
const NORCOM_COMPANY_ID = "658d458f16eabad417c8bbc3";

export const ifNorcomCustomer = async (
  customerId: string
): Promise<boolean> => {
  const currentCustomer = await Customer.findById(customerId);
  return currentCustomer?.companyId.toString() === NORCOM_COMPANY_ID;
};

const updateBillingStatus = async (
  customerId: string,
  status: string,
  errorMessage = ""
) => {
  await BillingStatus.updateOne(
    { customerId },
    { status, errorMessage, updatedAt: new Date() },
    { upsert: true }
  );
};

export const fetchAssets = async (customerId: string) => {
  return await Asset.aggregate([
    {
      $match: {
        customerId: new mongoose.Types.ObjectId(customerId),
        deletedAt: null,
      },
    },
    ...assetAggregate,
  ]);
};

export const processQueue = async () => {
  const successAssets: any[] = [];
  const failedAssets: any[] = [];
  const missingInMps: any[] = [];
  const auditReports: any[] = [];

  const queue: any = await CustomerQueue.findOneAndUpdate(
    { status: "pending" },
    { status: "processing" },
    { sort: { createdAt: 1 }, new: true }
  );

  if (!queue) {
    console.log("No queue found");
    return;
  }
  try {
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const billingStatuses = await BillingStatus.find({
        status: { $in: ["pending"] },
        createdAt: { $gte: queue.createdAt },
      })
        .sort({ createdAt: 1 })
        .skip(page * PAGE_SIZE)
        .limit(PAGE_SIZE);

      // console.log(`Batch Processing Starts for Page:  ${page}`);

      if (billingStatuses.length === 0) {
        console.log("No Customer Found for Invoices");
        hasMore = false;
      } else {
        for (const status of billingStatuses) {
          const result = await processCustomerBill(status.customerId);
          if (result) {
            successAssets.push(...result.successAssets);
            failedAssets.push(...result.failedAssets);
            missingInMps.push(...result.missingInMps);
            auditReports.push(...result.auditReports);
          }
        }
        page++;
      }
    }

    const report = await AssetsReport.create({
      type: ReportType.Bill,
      success: successAssets,
      failed: failedAssets,
      missingInMps,
      total: successAssets.length + failedAssets.length + missingInMps.length,
    });

    SendNotification(
      "Billing Report",
      `Success: ${successAssets.length}, Manual ${missingInMps.length} and Failed: ${failedAssets.length}`,
      `/assets/reports/${report._id}`
    );

    await Setting.findByIdAndUpdate(
      queue?.coolDown,
      {
        billsGeneratedAt: new Date(),
        billsGeneratedBy: queue?.user,
        activeBilling: false,
      },
      {
        new: true,
      }
    );

    await AuditReport.insertMany(auditReports);

    await CustomerQueue.findByIdAndUpdate(queue._id, { status: "completed" });

    console.log("Process of Generate Bill Ended");
  } catch (error: any) {
    await Setting.findByIdAndUpdate(queue?.coolDown, {
      activeBilling: false,
    });
    console.log("Error in Process queue: ", error);
  }
};

export const processCustomerBill = async (
  customerId: string | ObjectId | any
) => {
  // await updateBillingStatus(customerId, "processing");
  try {
    const assets = await fetchAssets(customerId);

    if (!assets?.length) {
      return;
    }

    if (await ifNorcomCustomer(customerId)) {
      return await processNorcomCustomer(customerId, assets);
    } else {
      return await processGeneralCustomer(customerId, assets);
    }
  } catch (error: any) {
    console.error(
      `Failed to process bill for customer ${customerId}: ${error.message}`
    );
    // await updateBillingStatus(customerId, "failed", error.message);
  }
};

export const processNorcomCustomer = async (
  customerId: string,
  assets: any[]
) => {
  const cofaxInvoices: any[] = [];
  const norcomInvoices: any = [];
  const failedAssets: any[] = [];
  const auditReports: any[] = [];
  const missingInMps: any[] = [];
  const successAssets: any[] = [];

  await Promise.all(
    assets.map(async (asset) => {
      const [
        assetCofaxInvoices,
        assetNorcomInvoices,
        assetFailedAssets,
        assetAuditReports,
        assetMissingInMps,
        assetsSuccess,
      ]: any = await billableAssets([asset]);

      cofaxInvoices.push(...assetCofaxInvoices);
      norcomInvoices.push(...assetNorcomInvoices);
      failedAssets.push(...assetFailedAssets);
      auditReports.push(...assetAuditReports);
      missingInMps.push(...assetMissingInMps);
      successAssets.push(...assetsSuccess);
    })
  );

  // await updateBillingStatus(customerId, "completed");

  return {
    successAssets,
    failedAssets,
    missingInMps,
    auditReports,
  };
};

export const processGeneralCustomer = async (
  customerId: string,
  assets: any[]
) => {
  const [
    cofaxInvoices,
    norcomInvoices,
    failedAssets,
    auditReports,
    missingInMps,
    successAssets,
  ]: any = await billableAssets(assets);

  // const successAssets: any = [];

  // await sendInvoicesInChunks(
  //   cofaxInvoices,
  //   successAssets,
  //   "COFAX BUSINESS SYSTEMS INC"
  // );
  // await sendInvoicesInChunks(
  //   norcomInvoices,
  //   successAssets,
  //   "NORCOM BUSINESSES SYSTEMS INC"
  // );

  // cofaxInvoices?.map((id: any) => successAssets.push(id));

  // await updateBillingStatus(customerId, "completed");

  return {
    successAssets,
    failedAssets,
    missingInMps,
    auditReports,
  };
};

// const sendInvoicesInChunks = async (
//   invoices: any[],
//   successAssets: any[],
//   poolName: string
// ) => {
//   const pool = await CreatePool(poolName);
//   const chunkSize = 5;
//   for (let i = 0; i < invoices.length; i += chunkSize) {
//     const chunk = invoices.slice(i, i + chunkSize);
//     await Promise.all(
//       chunk.map(async (invoice: any) => {
//         await sendInvoice(invoice, successAssets, pool);
//       })
//     );
//   }
//   pool.transporter.close();
// };
