import { Request, Response } from "express";
import { BadRequest } from "../../errors/bad-request";
import DocCount from "../../schema/docCount.schema";
import { generateRandomNumberInRange, getHtml } from "../../utils/functions";
import { STATUS_CODE } from "../../constant/status";
import SalesInvoice from "../../schema/Invoices/sales.schema";
import { getSaleInvoice } from "../../utils/aggregates/sales";
import puppeteer from "puppeteer";
import sendEmail from "../../services/sendMail.service";
import { SERVICE_INVOICE } from "../../constant/email-template";
import mongoose from "mongoose";
import User from "../../schema/user.schema";
import Item from "../../schema/item.schema";

const specifiedFilters = ["invoiceNo", "status"];

const SalesController = {
  get: async (req: Request, res: Response) => {
    const [invoice]: any = await SalesInvoice.aggregate([
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
          shipMethod: 1,
          items: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                name: "$$item.name",
                price: "$$item.price",
                quantity: "$$item.quantity",
              },
            },
          },
          username: "$customer.name",
          poNumber: 1,
          salesPerson: 1,
          status: 1,
          remarks: 1,
          billTo: 1,
        },
      },
    ]);

    res.status(STATUS_CODE.SUCCESS).send({ invoice });
  },

  getInvoiceData: async (req: Request, res: Response) => {
    const invoice = await getSaleInvoice(req.params.id);
    res.status(STATUS_CODE.SUCCESS).send({ invoice });
  },

  getAll: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};

    if (
      by &&
      value &&
      specifiedFilters.includes(by as string) &&
      by !== "companyName"
    ) {
      match = {
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    const totalCount = await SalesInvoice.countDocuments(match);

    const sales = await SalesInvoice.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: startIndex },
      { $limit: limit },
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
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
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
        },
      },
      {
        $match:
          by === "companyName"
            ? { companyName: { $regex: value, $options: "i" } }
            : {},
      },
    ]);

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ sales, pages: Math.ceil(totalCount / limit) });
  },

  create: async (req: Request, res: Response) => {
    const { customerName, items } = req.body;

    if (!customerName) {
      throw new BadRequest("Please provide all required fields.");
    }

    items.map(async (it: any) => {
      if (it.itemId) {
        const item: any = await Item.findById(it.itemId);

        if (item && item?.quantity < it.quantity) {
          throw new BadRequest(`We don't have ${it.quantity} for ${it.name}`);
        } else {
          await Item.findByIdAndUpdate(
            it.itemId,
            {
              $inc: { quantity: -it.quantity },
            },
            { runValidators: true }
          );
        }
      }
    });

    const counts: any = await DocCount.findOneAndUpdate(
      {},
      { $inc: { invoice: 1 } },
      { new: true }
    );

    const saveDoc = {
      invoiceNo: `INV${counts?.invoice}-${generateRandomNumberInRange()}`,
      ...req.body,
    };
    const saleInvoice = await SalesInvoice.create(saveDoc);

    res.status(STATUS_CODE.CREATED).send({ saleInvoice });
  },

  update: async (req: Request, res: Response) => {
    const saleInvoice = await SalesInvoice.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(STATUS_CODE.SUCCESS).send({ saleInvoice });
  },

  updateStatus: async (req: Request, res: Response) => {
    const sale = await SalesInvoice.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      { new: true, runValidators: true }
    );

    res.status(STATUS_CODE.SUCCESS).send({ sale });
  },

  sendInvoiceToCustomer: async (req: Request, res: Response) => {
    //TODO: 1.Prepare data to show inside HTML
    const invoicePdf: any = await getHtml("/invoices/sale/index.ejs", req.body);

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
    
    await page.setContent(invoicePdf);

    const pdfBuffer = await page.pdf({
      format: "letter",
    });

    await page.close();

    await browser.close();

    // Compose email
    await sendEmail(
      {
        email: req.body?.customer?.email,
        subject: "Sales invoice",
        message: "Check out the attached PDF!",
        content: SERVICE_INVOICE(req.body),
        attachments: [
          {
            filename: "Invoice.pdf",
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

  getSalesPersons: async (req: Request, res: Response) => {
    const users = await User.find(
      { username: { $ne: "super admin" } },
      "username firstName lastName"
    );
    res.status(STATUS_CODE.SUCCESS).send(users);
  },

  remove: async (req: Request, res: Response) => {
    await SalesInvoice.findByIdAndDelete(req.params.id);
    res.status(STATUS_CODE.NO_CONTENT).send({});
  },
};

export default SalesController;
