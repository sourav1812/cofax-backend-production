import { Request, Response } from "express";
import PurchaseOrderBilling from "../../schema/Invoices/purchaseOrder.schema";
import { STATUS_CODE } from "../../constant/status";
import { BadRequest } from "../../errors/bad-request";
import DocCount from "../../schema/docCount.schema";
import { generateRandomNumberInRange, getHtml } from "../../utils/functions";
import Customer from "../../schema/customer.schema";
import puppeteer from "puppeteer";
import sendEmail from "../../services/sendMail.service";
import { SERVICE_INVOICE } from "../../constant/email-template";
import { getPOInvoice } from "../../utils/aggregates/poInvoice";
import mongoose from "mongoose";
import Asset from "../../schema/asset.schema";
import { createInvoiceToQuickbooks } from "../../services/quickbook-invoice.service";

const specifiedFilters = ["invoiceNo", "status"];

const PurchaseOrderController = {
  create: async (req: Request, res: Response) => {
    if (!req.body.customerName && !req.body.assetId) {
      throw new BadRequest("Please provide all required fields.");
    }

    if (req.body.beginMeter > req.body.endMeter)
      throw new BadRequest(
        "Invalid meter readings: End meter is less then begin meter reading"
      );

    const [customerExists, PoExists] = await Promise.all([
      Customer.findOne({
        username: req.body.customerName,
      }),
      PurchaseOrderBilling.findOne({
        assetId: req.body.assetId,
      }),
    ]);

    if (!customerExists)
      throw new BadRequest("No such customer exists in our record");

    if (PoExists)
      throw new BadRequest("Already created a custom invoice for this asset");

    const counts: any = await DocCount.findOneAndUpdate(
      {},
      { $inc: { invoice: 1, po: 1 } },
      { new: true }
    );

    const saveDoc = {
      invoiceNo: `INV${counts?.invoice}-${generateRandomNumberInRange()}`,
      poNo: `PO${counts?.po}-${generateRandomNumberInRange()}`,
      ...req.body,
    };
    const purchaseOrder = await PurchaseOrderBilling.create(saveDoc);

    const customInvoice = await getPOInvoice(purchaseOrder.id);
    // await PurchaseOrderController.syncInvoiceWithRetry(customInvoice);

    res.status(STATUS_CODE.CREATED).send({ purchaseOrder });
  },

  get: async (req: Request, res: Response) => {
    const invoice = await getPOInvoice(req.params.id);
    res.status(STATUS_CODE.SUCCESS).send({ invoice });
  },

  getMinial: async (req: Request, res: Response) => {
    const [invoice] = await PurchaseOrderBilling.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
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
          discount: 1,
          customerName: 1,
          beginMeter: 1,
          endMeter: 1,
          colorBegin: 1,
          colorEnd: 1,
          assetId: 1,
          username: "$customer.name",
          status: 1,
        },
      },
    ]);

    const assets = await Asset.find(
      { username: invoice.customerName },
      "assetNumber colorBegin monoBegin"
    );

    res.status(STATUS_CODE.SUCCESS).send({ invoice, assets });
  },

  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};

    if (by && value && specifiedFilters.includes(by as string)) {
      match = {
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    let pipeline: any[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },
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
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: "$asset" },
      {
        $project: {
          invoiceNo: 1,
          poNo: 1,
          beginMeter: 1,
          endMeter: 1,
          paid: 1,
          discount: 1,
          status: 1,
          dueDate: 1,
          createdAt: 1,
          customerUserName: "$customer.username",
          customerName: "$customer.name",
          assetNumber: "$asset.assetNumber",
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

    const totalCountPipeline = [...pipeline, { $count: "total" }];
    const totalCountResult = await PurchaseOrderBilling.aggregate(
      totalCountPipeline
    );
    const totalCount =
      totalCountResult.length > 0 ? totalCountResult[0].total : 0;

    pipeline.push({ $skip: startIndex }, { $limit: limit });

    const purchaseOrders = await PurchaseOrderBilling.aggregate(pipeline);

    // Return the response
    res.status(STATUS_CODE.SUCCESS).send({
      purchaseOrders,
      pages: Math.ceil(totalCount / limit),
      totalCount,
    });
  },

  update: async (req: Request, res: Response) => {
    const purchaseOrder = await PurchaseOrderBilling.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(STATUS_CODE.SUCCESS).send({ purchaseOrder });
  },

  updateStatus: async (req: Request, res: Response) => {
    const purchaseOrder = await PurchaseOrderBilling.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      { new: true, runValidators: true }
    );

    res.status(STATUS_CODE.CREATED).send({ purchaseOrder });
  },

  sendInvoiceToCustomer: async (req: Request, res: Response) => {
    //TODO: 1.Prepare data to show inside HTML
    const invoicePdf: any = await getHtml(
      "/invoices/service_and_po/index.ejs",
      req.body
    );

    const browser = await puppeteer.launch({
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

    await page.setContent(invoicePdf, { waitUntil: "load", timeout: 60000 });
    
    const pdfBuffer = await page.pdf({
      format: "letter",
    });

    await page.close();

    await browser.close();

    // Compose email
    await sendEmail(
      {
        email: req.body?.customer?.email,
        subject: "Purchase order invoice",
        message: "Check out the attached PDF!",
        content: SERVICE_INVOICE(req.body),
        attachments: [
          {
            filename: "Purchase_Order.pdf",
            content: pdfBuffer,
            encoding: "base64",
          },
        ],
      },
      req.body?.customer?.company._id
    );

    res
      .status(STATUS_CODE.SUCCESS)
      .json({ message: "PDF sent successfully!", data: req.body });
  },

  remove: async (req: Request, res: Response) => {
    await PurchaseOrderBilling.findByIdAndDelete(req.params.id);
    res.status(STATUS_CODE.NO_CONTENT).send({});
  },

  syncInvoiceWithRetry: async (populatedInvoice: any, retryCount = 0) => {
    const maxRetries = 3;
    try {
      const quickbookInvoice = await createInvoiceToQuickbooks(
        populatedInvoice
      );
      if (quickbookInvoice && quickbookInvoice?.Id) {
        await PurchaseOrderBilling.findByIdAndUpdate(populatedInvoice._id, {
          $set: {
            quickBookInvoiceId: +quickbookInvoice.Id,
          },
        });
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(
          `Retrying sync for invoice ${populatedInvoice._id}... Attempt ${
            retryCount + 1
          }`
        );
        await PurchaseOrderController.syncInvoiceWithRetry(
          populatedInvoice,
          retryCount + 1
        );
      } else {
        console.error(
          `Failed to sync invoice ${populatedInvoice._id} with QuickBooks after ${maxRetries} attempts:`,
          error
        );
        // Store the failed invoice for future retries
        // await storeFailedInvoice(invoice.id, error);
      }
    }
  },
};

export default PurchaseOrderController;
