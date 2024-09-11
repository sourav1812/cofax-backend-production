import ServiceBilling from "../../schema/Invoices/service";
import { STATUS_CODE } from "../../constant/status";
import { Request, Response } from "express";
import { firstAndLastDateOfMonth, getHtml } from "../../utils/functions";
import { CustAndAsset } from "../../utils/aggregates/customer";
import { BadRequest } from "../../errors/bad-request";
import Setting from "../../schema/setting.schema";
import sendEmail, { CreatePool } from "../../services/sendMail.service";
import puppeteer from "puppeteer";
import { SERVICE_INVOICE } from "../../constant/email-template";
import path from "path";
import { dummyData, viewPath } from "../../constant/view";
import { getMeterInvoice } from "../../utils/aggregates/serviceInvoice";
import Asset from "../../schema/asset.schema";
import mongoose from "mongoose";
import {
  CreateServiceInvoice,
  billableAssets,
  sendInvoice,
  syncInvoicesWithQuickBooks,
} from "../../utils/functions/billableAssets";
import AssetsReport from "../../schema/report/assetSync.schema";
import { ReportType } from "../../utils/types/enum/db";
import AuditReport from "../../schema/report/billingAudit.schema";
import { SendNotification } from "../../services/notification.service";
import { CustomerQueue } from "../../schema/customerQueueSchema";
import Customer from "../../schema/customer.schema";
import { BillingStatus } from "../../schema/billingStatus.schema";
import {
  fetchAssets,
  ifNorcomCustomer,
  processCustomerBill,
  processGeneralCustomer,
  processNorcomCustomer,
  processQueue,
} from "../../utils/background/processQueue";
import { compareLocalInvoiceStatusWithQuickbook } from "../../services/quickbook-invoice.service";
import {
  getQuickBookTokenOrRefresh,
  isQuickBookAccessTokenValid,
} from "../../services/quickbook.service";
import QuickBook, { IQuickBook } from "../../schema/quickbook.schema";
import { NORCOM_COMPANY_ID } from "../../constant";

const PAGE_SIZE = 50;
const specifiedFilters = ["invoiceNo", "status"];

const ServiceInvoiceController = {
  get: async (req: Request, res: Response) => {
    const invoice = await getMeterInvoice(req.params.id);
    res.status(STATUS_CODE.SUCCESS).send({ invoice });
  },

  getByMeter: async (req: Request, res: Response) => {
    try {
      const invoice = await ServiceBilling.findOne({
        assets: {
          $elemMatch: { meterId: req.params.id },
        },
      });

      if (!invoice) {
        return res.status(STATUS_CODE.NOT_FOUND).send({
          message: "Invoice not found for the specified meter ID",
        });
      }

      res.status(STATUS_CODE.SUCCESS).send({ invoice });
    } catch (error) {
      console.error("Error fetching invoice by meterId:", error);
      res.status(STATUS_CODE.SERVER_ERROR).send({
        message: "An error occurred while fetching the invoice",
      });
    }
  },

  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all" || by == "unsynced") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};
    if (by === "unsynced") {
      match = {
        quickBookInvoiceId: { $exists: false },
        status: "pending",
      };
    } else if (specifiedFilters.includes(by as string)) {
      match = {
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    let totalCount = 0;
    let pipeline: any = [];

    const totalCountPipeline: any = [
      { $match: match },
      ...CustAndAsset,
      {
        $project: {
          invoiceNo: 1,
          paid: 1,
          status: 1,
          dueDate: 1,
          createdAt: 1,
          customerUserName: "$customer.username",
          customerName: "$customer.name",
          companyName: "$customer.company.name",
          companyId: "$customer.company._id",
        },
      },
      ...(by === "norcom"
        ? [{ $match: { companyName: "NORCOM BUSINESSES SYSTEMS INC" } }]
        : []),
      ...(by === "cofax"
        ? [{ $match: { companyName: "COFAX BUSINESS SYSTEMS INC" } }]
        : []),
      { $count: "total" },
    ];

    const totalCountResult = await ServiceBilling.aggregate(totalCountPipeline);
    totalCount = totalCountResult.length > 0 ? totalCountResult[0].total : 0;

    if (by === "unsynced") {
      totalCount = await ServiceBilling.countDocuments(match);
      pipeline = [
        { $match: match },
        ...CustAndAsset,
        {
          $project: {
            invoiceNo: 1,
            paid: 1,
            status: 1,
            dueDate: 1,
            createdAt: 1,
            customerUserName: "$customer.username",
            customerName: "$customer.name",
            companyName: "$customer.company.name",
            companyId: "$customer.company._id",
          },
        },
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(NORCOM_COMPANY_ID),
          },
        },
        { $sort: { createdAt: -1 } },
      ];
    } else {
      pipeline = [
        { $match: match },
        { $sort: { createdAt: -1 } },
        ...CustAndAsset,
        {
          $project: {
            invoiceNo: 1,
            paid: 1,
            status: 1,
            dueDate: 1,
            quickBookInvoiceId: 1,
            createdAt: 1,
            customerUserName: "$customer.username",
            customerName: "$customer.name",
            companyName: "$customer.company.name",
          },
        },
        ...(by === "norcom"
          ? [{ $match: { companyName: "NORCOM BUSINESSES SYSTEMS INC" } }]
          : []),
        ...(by === "cofax"
          ? [{ $match: { companyName: "COFAX BUSINESS SYSTEMS INC" } }]
          : []),
      ];
    }

    pipeline.push({ $skip: startIndex }, { $limit: limit });
    const serviceInvoices = await ServiceBilling.aggregate(pipeline);
    res.status(STATUS_CODE.SUCCESS).send({
      pages: Math.ceil(totalCount / limit),
      totalCount,
      serviceInvoices,
    });
  },

  create: async (req: Request, res: Response) => {
    const serviceInvoice = await CreateServiceInvoice(req.body);

    res.status(STATUS_CODE.CREATED).send({ serviceInvoice });
  },

  update: async (req: Request, res: Response) => {
    const serviceInvoice = await ServiceBilling.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(STATUS_CODE.CREATED).send({ serviceInvoice });
  },

  updateStatus: async (req: Request, res: Response) => {
    const serviceInvoice: any = await ServiceBilling.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      { new: true, runValidators: true }
    );

    res.status(STATUS_CODE.CREATED).send({ serviceInvoice });
  },

  sendInvoiceToCustomer: async (req: Request, res: Response) => {
    const invoicePdf: any = await getHtml(
      "/invoices/service_and_po/index.ejs",
      req.body
    );

    let browser;
    let pdfBuffer: unknown;

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        console.info(`Attempt ${attempt + 1}`);
        try {
          browser = await puppeteer.launch({
            headless: "new",
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-gpu",
              "--disable-software-rasterizer",
              "--disable-3d-apis",
              "--disable-accelerated-2d-canvas",
              "--disable-webgl",
              "--disable-accelerated-mjpeg-decode",
              "--disable-accelerated-video-decode",
              "--disable-gpu-compositing",
              "--disable-gl-drawing-for-tests",
              "--disable-vulkan",
            ],
            timeout: 60000,
            protocolTimeout: 240000,
            executablePath: "/usr/bin/chromium-browser",
          });

          const page = await browser.newPage();

          await page.setContent(invoicePdf, {
            waitUntil: "load",
            timeout: 60000,
          });

          pdfBuffer = await page.pdf({
            format: "letter",
          });

          await page.close();

          break;
        } catch (err) {
          console.error(`Attempt ${attempt + 1} failed:`, err);
          if (browser) await browser.close();

          if (attempt === 2) {
            throw new Error("Failed to generate PDF after 3 attempts.");
          }
        }
      }
    } finally {
      if (browser) await browser.close();
    }

    const { email, secondaryEmail, company }: any = req.body
      ?.customer as unknown;

    const sendEmails = async () => {
      const emailPromises = [];
      if (email) {
        emailPromises.push(
          sendEmail(
            {
              email: email,
              subject: "Service invoice",
              message: "Check out the attached PDF!",
              content: SERVICE_INVOICE(req.body),
              attachments: [
                {
                  filename: "Service_Invoice.pdf",
                  content: pdfBuffer,
                  encoding: "base64",
                },
              ],
            },
            company._id
          )
        );
      }

      if (secondaryEmail) {
        emailPromises.push(
          sendEmail(
            {
              email: secondaryEmail,
              subject: "Service invoice",
              message: "Check out the attached PDF!",
              content: SERVICE_INVOICE(req.body),
              attachments: [
                {
                  filename: "Service_Invoice.pdf",
                  content: pdfBuffer,
                  encoding: "base64",
                },
              ],
            },
            company._id
          )
        );
      }

      await Promise.allSettled(emailPromises).then((results) =>
        results.forEach((result, idx) => {
          if (result.status === "rejected") {
            console.error(
              `Failed to send email to ${idx === 0 ? email : secondaryEmail}:`,
              result.reason
            );
          }
        })
      );
    };

    await sendEmails();

    const { assets } = req.body;

    await Promise.all(
      assets?.map(async (it: any) => {
        const { asset, meterReading } = it;
        const { customer, dueDate } = req.body;

        if (!meterReading?.sent) {
          await AuditReport.create({
            monoBegin: meterReading?.readings[0]?.BeginMeter ?? 0,
            colorBegin: meterReading?.readings[1]?.BeginMeter ?? 0,
            assetId: asset._id,
            companyId: customer?.company?._id,
            createdAt: new Date(),
            dueDate: dueDate,
          });
        }
      })
    );

    res
      .status(STATUS_CODE.SUCCESS)
      .json({ message: "PDF sent successfully!", data: req.body });
  },

  viewPage: async (req: Request, res: Response) => {
    res.render(
      path.join(__dirname, viewPath, "/service_calls/index.ejs"),
      dummyData
    );
  },

  generateBills: async (req: Request, res: Response) => {
    //TODO: Need to Mongoose session in case of failure it will abort all changes
    //Avoid inconsistency data

    // 1. Adding cooldown of 24hr
    let coolDown: any;
    coolDown = await Setting.findOne({}, "billsGeneratedAt activeBilling");

    const lastTime =
      new Date(coolDown?.billsGeneratedAt).getTime() + 24 * 60 * 60 * 1000;
    const currTime = new Date().getTime();

    if (lastTime >= currTime) {
      throw new BadRequest(
        `Cool down time: Next Generate Bill will be available on ${new Date(
          lastTime
        ).toLocaleString()}.`
      );
    }

    if (coolDown.activeBilling) {
      throw new BadRequest("Already in progress");
    }

    await Setting.findByIdAndUpdate(coolDown._id, {
      activeBilling: true,
    });

    try {
      //2. Select all the customer who has(customer array will come from frontend)
      //*a. NOTE: Make sure on backend you will get only active customers.

      let assets = [];
      const assetAggregate = [
        {
          $match: {
            deletedAt: null,
          },
        },
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
      ];
      if (req.body?.customers?.length) {
        const customerIds: string[] = req.body.customers.map(
          (customer: any) => new mongoose.Types.ObjectId(customer.id)
        );

        assets = await Asset.aggregate([
          {
            $match: {
              customerId: { $in: customerIds },
            },
          },
          ...assetAggregate,
        ]);
      } else {
        //select all active customers
        assets = await Asset.aggregate(assetAggregate);
      }

      const successAssets: any = [];

      //3. Get customer's assets
      const [
        cofaxInvoices,
        norcomInvoices,
        failedAssets,
        auditReports,
        missingInMps,
      ]: any = await billableAssets(assets);

      //4. Finally, send mail to all customer
      //*4.1 Sending to cofax customers
      const pool1 = await CreatePool();

      const chunkSize = 10; // Set the size of each chunk
      if (cofaxInvoices.length > 0) {
        for (let i = 0; i < cofaxInvoices.length; i += chunkSize) {
          const chunk = cofaxInvoices.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (invoice: any) => {
              await sendInvoice(invoice, successAssets, pool1);
            })
          );
        }
        pool1.transporter.close();
      }

      //*4.2 Sending to norcom customers
      const pool2 = await CreatePool("NORCOM BUSINESSES SYSTEMS INC");

      if (norcomInvoices.length > 0) {
        for (let i = 0; i < norcomInvoices.length; i += chunkSize) {
          const chunk = norcomInvoices.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (invoice: any) => {
              await sendInvoice(invoice, successAssets, pool2);
            })
          );
        }
        pool2.transporter.close();
      }

      coolDown = await Setting.findByIdAndUpdate(
        coolDown._id,
        {
          billsGeneratedAt: new Date(),
          billsGeneratedBy: req.currentUser?.id,
          activeBilling: false,
        },
        {
          new: true,
        }
      );

      const report = await AssetsReport.create({
        type: ReportType.Bill,
        success: successAssets,
        failed: failedAssets,
        missingInMps,
        total: successAssets.length + failedAssets.length + missingInMps.length,
      });

      SendNotification(
        "Billing Report",
        `Success: ${successAssets.length} and Failed: ${failedAssets.length} and Manual: ${missingInMps?.length} `,
        `/assets/reports/${report._id}`
      );

      AuditReport.insertMany(auditReports);

      res.status(STATUS_CODE.SUCCESS).send({ successAssets, failedAssets });
    } catch (error: any) {
      throw new BadRequest(error.message);
    }
  },

  generateBillsV2: async (req: Request, res: Response) => {
    try {
      //1. Adding cooldown of 24hr
      const coolDown: any = await Setting.findOne(
        {},
        "billsGeneratedAt activeBilling"
      );

      const lastTime =
        new Date(coolDown?.billsGeneratedAt).getTime() + 24 * 60 * 60 * 1000;
      const currTime = new Date().getTime();

      if (lastTime >= currTime) {
        throw new BadRequest(
          `Cool down time: Next Generate Bill will be available on ${new Date(
            lastTime
          ).toLocaleString()}.`
        );
      }

      if (coolDown.activeBilling) {
        throw new BadRequest("Already in progress");
      }

      await Setting.findByIdAndUpdate(coolDown._id, {
        activeBilling: true,
      });

      const customersFromUi = req.body.customers?.map((customer: any) => ({
        customerId: customer?.id,
        company: customer.company,
      }));

      let customerList: any[] = [];

      if (!customersFromUi || customersFromUi.length === 0) {
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const customers = await Customer.find()
            .skip(page * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .select("id companyId");

          if (customers.length === 0) {
            hasMore = false;
          } else {
            customerList.push(
              ...customers.map((customer: any) => customer._id)
            );
            page++;
          }
        }
      } else {
        customerList = customersFromUi.map(
          (customer: any) => customer.customerId
        );
      }

      await Setting.findByIdAndUpdate(coolDown._id, { activeBilling: true });

      const successAssets: any[] = [];
      const failedAssets: any[] = [];
      const missingInMps: any[] = [];
      const auditReports: any[] = [];

      for (const customerId of customerList) {
        const result = await processCustomerBill(customerId);
        if (result) {
          successAssets.push(...result.successAssets);
          failedAssets.push(...result.failedAssets);
          missingInMps.push(...result.missingInMps);
          auditReports.push(...result.auditReports);
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

      await Setting.findByIdAndUpdate(coolDown._id, {
        activeBilling: false,
        billsGeneratedAt: new Date(),
      });

      await AuditReport.insertMany(auditReports);

      res
        .status(STATUS_CODE.SUCCESS)
        .send("Billing process initiated successfully");
    } catch (error: any) {
      console.log("Error: ", error);
      throw new BadRequest(error.message);
    }
  },

  generateInvoiceForCustomer: async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    const { customerId } = req.params;

    const { successAssets, failedAssets, missingInMps, auditReports } =
      (await processCustomerBill(customerId)) as any;

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

    await AuditReport.insertMany(auditReports);

    res.status(STATUS_CODE.SUCCESS).send("Billing generated successfully");
  },

  remove: async (req: Request, res: Response) => {
    await ServiceBilling.findByIdAndDelete(req.params.id);
    res.status(STATUS_CODE.NO_CONTENT).send({});
  },

  printAllInvoices: async (req: Request, res: Response) => {
    //1.Make start date and end date of the month
    const [startOfMonth, endOfMonth] = firstAndLastDateOfMonth(req.body.date);

    // let match = {
    //   createdAt: {
    //     $gte: startOfMonth,
    //     $lte: endOfMonth,
    //   },
    // };

    //2.Use startDate and endDate to fetch all the invoices
    // const invoices: any = await getPrintAllAggregate(match, req.body.company);

    //2.1 use promise all on invoice inside which we will use await getMeterInvoice(req.params.id);
    //*return the all invoices data client will handle(like showing data inside PDF on UI)

    // res.status(STATUS_CODE.SUCCESS).download(invoices);
    res.download(
      path.join(
        __dirname,
        "../../../public",
        "/data/proposals/1704793222191-dummy.pdf"
      )
    );
  },

  postInvoiceToQuickBook: async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query as any;

      await isQuickBookAccessTokenValid();

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const invoices = await ServiceBilling.aggregate([
          {
            $skip: page * PAGE_SIZE,
          },
          {
            $limit: PAGE_SIZE,
          },
          {
            $match: {
              quickBookInvoiceId: { $exists: false },
              createdAt: {
                $gte: start,
                $lte: end,
              },
            },
          },
          ...CustAndAsset,
          {
            $project: {
              id: "$_id",
              _id: 0,
              invoiceNo: 1,
              companyId: "$customer.company._id",
            },
          },
          {
            $match: {
              companyId: new mongoose.Types.ObjectId(NORCOM_COMPANY_ID),
            },
          },
        ]);
        console.log(
          `Batch Processing of Invoice Syncing Starts for Page:  ${page}, PAGE_SIZE: ${PAGE_SIZE}`
        );

        if (invoices.length === 0) {
          console.log("No Invoices Left for syncing");
          hasMore = false;
        } else {
          //Pass access token from here instead check for each invoice
          await syncInvoicesWithQuickBooks(invoices);
          page++;
        }
      }

      res.status(200).json({
        message: "success",
      });
    } catch (error: any) {
      console.error(
        "Error in main: ",
        error.message ??
          error?.response?.data?.fault ??
          error?.response?.data?.Fault?.Error
      );
      // res.json({ error: error.message });
      throw new BadRequest(error.message);
    }
  },

  syncQuickBookInvoiceWithLocal: async (req: Request, res: Response) => {
    try {
      let page = 0;
      let hasMore = true;

      const quickBookInvoices: any = [];

      const quickbookConfig: any = await QuickBook.findOne({
        company: NORCOM_COMPANY_ID,
      });

      while (hasMore) {
        const invoices = await ServiceBilling.aggregate([
          {
            $skip: page * PAGE_SIZE,
          },
          {
            $limit: PAGE_SIZE,
          },
          {
            $lookup: {
              from: "customers",
              let: { customerName: "$customerName" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$username", "$$customerName"] },
                        {
                          $eq: [
                            "$companyId",
                            new mongoose.Types.ObjectId(NORCOM_COMPANY_ID),
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
              as: "customer",
            },
          },
          {
            $unwind: {
              path: "$customer",
              preserveNullAndEmptyArrays: true,
            },
          },
        ]);

        console.log(
          `Batch Processing of Invoice Syncing Starts for Page:  ${page}, PAGE_SIZE: ${PAGE_SIZE}`
        );

        if (invoices.length === 0) {
          console.log("No Invoices Left for syncing");
          hasMore = false;
        } else {
          await Promise.all(
            invoices.map(async (invoice) => {
              const quickBookInvoice =
                await compareLocalInvoiceStatusWithQuickbook(
                  invoice,
                  quickbookConfig
                );

              if (
                quickBookInvoice &&
                quickBookInvoice?.Invoice?.Balance === 0
              ) {
                await ServiceBilling.findByIdAndUpdate(invoice._id, {
                  status: "paid",
                });
              }
            })
          );
          page++;
        }
      }

      res.status(200).json({
        message: "success",
        quickBookInvoices,
      });
    } catch (error: any) {
      console.error(
        "Error in main: ",
        error.message ??
          error?.response?.data?.fault ??
          error?.response?.data?.Fault?.Error
      );
      res.json(error);
    }
  },
};

export default ServiceInvoiceController;
