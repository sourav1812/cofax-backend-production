import puppeteer from "puppeteer";
import ServiceBilling from "../../schema/Invoices/service";
import Tax from "../../schema/Invoices/tax.schema";
import { getHtml } from "../functions";
import { ServiceBillCalculation } from "../functions/invoiceBillCalculations";

export const getPrintAllAggregate = async (match: any, companyName: string) => {
  const [meterReadings, tax]: any = await Promise.all([
    ServiceBilling.aggregate([
      { $match: match },
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
            { $unwind: "$company" },
            { $match: { "company.name": companyName } },
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
      {
        $lookup: {
          from: "Asset",
          localField: "assetId",
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
          as: "asset",
        },
      },
      { $unwind: "$asset" },
      {
        $lookup: {
          from: "Meter_Reading",
          localField: "meterId",
          foreignField: "_id",
          as: "meterReading",
        },
      },
      { $unwind: "$meterReading" },
      {
        $project: {
          "asset.notes": 0,
          "customer.notes": 0,
        },
      },
    ]),
    Tax.findOne({}),
  ]);

  const invoices = await Promise.all(
    meterReadings.map(async (it: any) => {
      const meterReading = it;

      const [prevMeterReading] = await ServiceBilling.aggregate([
        {
          $match: {
            assetId: meterReading.assetId,
            customerName: meterReading.customerName,
          },
        },
        {
          $lookup: {
            from: "Meter_Reading",
            localField: "meterId",
            foreignField: "_id",
            as: "meter",
          },
        },
        { $unwind: "$meter" },
        {
          $match: {
            "meter.createdAt": { $lt: meterReading.meterReading.createdAt },
          },
        },
        {
          $project: {
            prevMono: "$meter.mono",
            prevColor: "$meter.color",
            createdAt: 1,
            status: 1,
          },
        },
      ]);

      const serviceInvoice = ServiceBillCalculation(
        {
          ...meterReading,
          prevMeterReading,
        },
        tax?.hstTax
      );

      const invoicePdf: any = await getHtml(
        "/invoices/service_and_po/index.ejs",
        serviceInvoice
      );

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--disable-dev-shm-usage", "--no-sandbox"],
      });
      //pool: true
      const page = await browser.newPage();
      await page.setContent(invoicePdf);
      const pdfBuffer = await page.pdf({
        format: "letter",
      });
      await browser.close();

      return pdfBuffer;
    })
  );

  return invoices;
};
