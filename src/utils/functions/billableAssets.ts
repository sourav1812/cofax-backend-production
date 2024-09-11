import {
  calculateRentalBasedOnBillingSchedule,
  generateRandomNumberInRange,
  getHtml,
  isOlderByMonths,
} from ".";
import ServiceBilling from "../../schema/Invoices/service";
import MeterReading from "../../schema/meterReading.schema";
import DocCount from "../../schema/docCount.schema";
import { BadRequest } from "../../errors/bad-request";
import { getMeterInvoice } from "../aggregates/serviceInvoice";
import { SERVICE_INVOICE } from "../../constant/email-template";
import { convertToQuickBooksInvoice } from "../../services/quickbook-invoice.service";
import puppeteer from "puppeteer";

const notBillable = [
  "time and material",
  "time & materials",
  "time & materials - fax",
  "tmmfp",
];

export const billableAssets = async (assets: any) => {
  const cofaxInvoices: any = [],
    norcomInvoices: any = [],
    failedAssets: any = [],
    manualFailed: any = [],
    auditReports: any = [],
    successAssets: any = [];

  const customerInvoiceData = new Map();
  const auditCreatedAt = new Date();

  await Promise.all(
    assets.map(async (asset: any) => {
      const {
        username,
        monoBegin = 0,
        colorBegin = 0,
        coveredMono,
        coveredColor,
        monoPrice,
        colorPrice,
      } = asset;

      const contractType = asset?.contractType?.name?.toLowerCase();

      if (notBillable.includes(contractType)) return;

      // Get the latest meter reading
      let currMeter: any = null;
      try {
        currMeter = await MeterReading.findOne({
          assetId: asset._id,
          username,
          invoiced: false,
        }).sort({ createdAt: -1 });
      } catch (error) {
        console.error("Error fetching current meter: ", error);
        throw error;
      }


      if (!currMeter) {
        manualFailed.push(String(asset?._id));
        return;
      }

      let prevMeter: any = null;
      if (currMeter) {
        try {
          prevMeter = await MeterReading.findOne({
            assetId: asset?._id,
            username,
            createdAt: { $lt: currMeter.createdAt },
            invoiced: true,
          }).sort({ createdAt: -1 });
        } catch (error) {
          console.error("Error fetching previous meter: ", error);
        }
      }

      const mono = prevMeter?.mono
        ? currMeter?.mono - prevMeter?.mono
        : currMeter?.mono - monoBegin;

      const color = prevMeter?.color
        ? currMeter?.color - prevMeter?.color
        : currMeter?.color - colorBegin;

      let billableMono = mono >= coveredMono ? mono - coveredMono : 0;
      let billableColor = color >= coveredMono ? color - coveredColor : 0;

      billableMono = billableMono * monoPrice;
      billableColor = billableColor * colorPrice;

      const overage = billableMono + billableColor;

      const flag = !prevMeter
        ? isOlderByMonths(asset?.createdAt, asset.customer.billingSchedule)
        : isOlderByMonths(prevMeter?.createdAt, asset.customer.billingSchedule);

      if (!flag) return;

      //a. Total bill should be more then $20
      //b. (Current date - Last Service Inv sent date) >= customer billing schedule
      //TODO: Add this in below if condition with "&&" --> isOlderByMonths(prevMeter?.createdAt,asset.customer.billingSchedule)
      //currMeter?.createdAt && overage >= 20

      const rentalChargeWithBillingSchedule =
        calculateRentalBasedOnBillingSchedule(
          +asset?.rentalCharge,
          asset?.customer?.billingSchedule
        );

      const overageWithRentalChargeAndContractAmt =
        overage + rentalChargeWithBillingSchedule + +asset?.contractAmount;

      if (overageWithRentalChargeAndContractAmt >= 3) {
        // earlier we use to call createServiceInvoice with data on each iteration but now we are setting data to map.
        if (!customerInvoiceData.has(username)) {
          customerInvoiceData.set(username, {
            customerName: username,
            assets: [],
          });
        }

        const customerData = customerInvoiceData.get(username);

        successAssets.push(asset?._id);

        customerData.assets.push({
          assetId: asset?._id,
          meterId: currMeter?._id,
          monoBegin: prevMeter?.mono ?? monoBegin,
          colorBegin: prevMeter?.color ?? colorBegin,
          monoEnd: currMeter?.mono ?? monoBegin,
          colorEnd: currMeter?.color ?? colorBegin,
          companyId: asset?.customer?.company._id,
          companyName: asset?.customer?.company.name,
        });
      } else {
        failedAssets.push(String(asset?._id));
      }
    })
  );

  //  data for bulk invoice creation
  const invoiceDataList = Array.from(customerInvoiceData.values());
  const invoices = await CreateServiceInvoiceBulk(invoiceDataList);

  const updatePromises = invoices.map(async (invoice: any) => {
    const assetPromises = invoice.assets.map(async (it: any) => {
      await MeterReading.findByIdAndUpdate(it?.meterId, {
        invoiced: true,
        sent: 1,
      });

      const auditReport = {
        assetId: it?.assetId,
        monoBegin: it?.monoBegin,
        monoEnd: it?.monoEnd,
        colorBegin: it?.colorBegin,
        colorEnd: it?.colorEnd,
        createdAt: auditCreatedAt,
        dueDate: invoice?.dueDate,
        companyId: it?.companyId,
      };

      auditReports.push(auditReport);

      if (it.companyName === "COFAX BUSINESS SYSTEMS INC") {
        cofaxInvoices.push(invoice.id);
      } else {
        norcomInvoices.push(invoice.id);
      }
    });
    await Promise.all(assetPromises);
  });

  await Promise.all(updatePromises);

  return [
    cofaxInvoices,
    norcomInvoices,
    failedAssets,
    auditReports,
    manualFailed,
    successAssets,
  ];
};

export const CreateServiceInvoiceBulk = async (customers: any) => {
  return Promise.all(
    customers?.map(async (customer: any) => {
      const counts: any = await DocCount.findOneAndUpdate(
        {},
        { $inc: { invoice: 1 } },
        { new: true }
      );

      const saveDoc = {
        invoiceNo: `INV${counts?.invoice}-${generateRandomNumberInRange()}`,
        customerName: customer?.customerName,
        assets: customer?.assets?.map((it: any) => ({
          assetId: it?.assetId,
          meterId: it?.meterId,
        })),
      };

      const newInvoice = await ServiceBilling.create(saveDoc);
      // We need colorMono and beginMono readings for audit report so passing that here
      return {
        ...newInvoice.toJSON(),
        assets: customer.assets,
      };
    })
  );
};

export const CreateServiceInvoice = async (payload: any) => {
  if (!payload.customerName && !payload.assetId && !payload.meterId) {
    throw new BadRequest("Please provide all required fields.");
  }

  const counts: any = await DocCount.findOneAndUpdate(
    {},
    { $inc: { invoice: 1 } },
    { new: true }
  );
  const saveDoc = {
    invoiceNo: `INV${counts?.invoice}-${generateRandomNumberInRange()}`,
    customerName: payload.customerName,
    assets: [
      {
        assetId: payload.assetId,
        meterId: payload.meterId,
      },
    ],
  };
  const newInvoice = await ServiceBilling.create(saveDoc);
  return newInvoice;
};

export const syncInvoicesWithQuickBooks = async (invoices: any[]) => {
  await Promise.all(
    invoices.map(async (invoice) => {
      try {
        const populatedInvoice = await getMeterInvoice(invoice.id);
        await syncInvoiceWithRetry(populatedInvoice);
        console.log(`Synced: ${invoice.id}`);
      } catch (error: any) {
        console.error(
          `Failed to sync invoice ${invoice.id} with QuickBooks:`,
          error.message
        );
      }
    })
  );
};

const syncInvoiceWithRetry = async (populatedInvoice: any, retryCount = 0) => {
  const maxRetries = 3;
  try {
    const quickbookInvoice = await convertToQuickBooksInvoice(populatedInvoice);
    if (quickbookInvoice && quickbookInvoice?.Id) {
      await ServiceBilling.findByIdAndUpdate(populatedInvoice._id, {
        $set: {
          quickBookInvoiceId: +quickbookInvoice.Id,
        },
      });
    }
  } catch (error: any) {
    if (retryCount < maxRetries) {
      console.log(
        `Retrying sync for invoice ${populatedInvoice._id}... Attempt ${
          retryCount + 1
        }`
      );
      await syncInvoiceWithRetry(populatedInvoice, retryCount + 1);
    } else {
      throw new BadRequest(error.message);
      // Store the failed invoice for future retries
      // await storeFailedInvoice(invoice.id, error);
    }
  }
};

// const storeFailedInvoice = async (invoiceId: string, error: any) => {
//   await FailedInvoice.create({
//     invoiceId,
//     errorMessage: error.message,
//     createdAt: new Date(),
//   });
// };

export const sendInvoice = async (
  invoiceId: string,
  successAssets: any,
  pool: any
) => {
  try {
    if (!invoiceId) {
      console.log("No invoice id passed in sendInvoice");
      return;
    }

    const invoiceData = await getMeterInvoice(invoiceId);

    const invoicePdf: any = await getHtml(
      "/invoices/service_and_po/index.ejs",
      invoiceData
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

    const { transporter, hostEmail, companyName } = pool;

    // Define the email options
    const mailOptions: any = {
      from: `"${companyName}" ${hostEmail}`,
      // to: options.email,//!Don't send mails to real customer while testing
      to: "souravsingh18121999@gmail.com",
      subject: "Service invoice",
      text: "Check out the attached PDF!",
      html: SERVICE_INVOICE(invoiceData),
      attachments: [
        {
          filename: "Service_Invoice.pdf",
          content: pdfBuffer,
          encoding: "base64",
        },
      ],
    };

    // await transporter.sendMail(mailOptions);

    invoiceData?.assets?.map((assetAndMeterReading: any) =>
      successAssets.push(assetAndMeterReading?.asset?._id)
    );
  } catch (error: any) {
    console.log(error);
    throw new BadRequest(error.message);
  }

  //TODO: Put inside try
};
