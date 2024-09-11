import PurchaseOrderBilling from "../../schema/Invoices/purchaseOrder.schema";
import mongoose from "mongoose";
import { addTrailingZeros } from "../functions/invoiceBillCalculations";
import Tax from "../../schema/Invoices/tax.schema";
import { BadRequest } from "../../errors/bad-request";

export const getPOInvoice = async (invoiceId: string) => {
  let [purchaseInvoice, tax]: any = await Promise.all([
    PurchaseOrderBilling.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(invoiceId) } },
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
          as: "asset",
        },
      },
      {
        $unwind: {
          path: "$asset",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          "asset.notes": 0,
          "customer.notes": 0,
        },
      },
    ]),
    Tax.findOne({}),
  ]);

  purchaseInvoice = purchaseInvoice[0];

  if(!purchaseInvoice){
    throw new BadRequest("No Invoice Found");
  }

  const {
    monoPrice = 0,
    colorPrice = 0,
    coveredMono = 0,
    coveredColor = 0,
    assetNumber,
    contractAmount = 0,
  } = purchaseInvoice.asset;

  const monoTotalDiff = purchaseInvoice.endMeter - purchaseInvoice.beginMeter;
  const colorTotalDiff = purchaseInvoice.colorEnd - purchaseInvoice.colorBegin;


  const monoMeter = {
    meterType: "B/W",
    meterGroup: assetNumber,
    BeginMeter: purchaseInvoice.beginMeter,
    EndMeter: purchaseInvoice.endMeter,
    total: monoTotalDiff,
    covered: coveredMono,
    rate: monoPrice,
    billable: 0,
    overage: 0,
  };

  const colorMeter = {
    meterType: "Color",
    meterGroup: assetNumber,
    BeginMeter: purchaseInvoice.colorBegin,
    EndMeter: purchaseInvoice.colorEnd,
    total: colorTotalDiff,
    covered: coveredColor,
    rate: colorPrice,
    billable: 0,
    overage: 0,
  };


  const monobillable = coveredMono <= monoTotalDiff ? monoTotalDiff - coveredMono : 0;
  monoMeter.billable = +monobillable?.toFixed(2);
  monoMeter.overage = Number((+monobillable * +monoPrice).toFixed(2)) as number;


  const colorBillable = coveredColor <= colorTotalDiff ? colorTotalDiff - coveredColor : 0;
  colorMeter.billable = +colorBillable?.toFixed(2);
  colorMeter.overage = Number((+colorBillable * +colorPrice).toFixed(2));
  
  const totalOverage = monoMeter.overage + colorMeter.overage;
  const subTotal = contractAmount + totalOverage;
  const hst = subTotal * (tax?.hstTax / 100);
  const afterDiscount = subTotal * (purchaseInvoice.discount / 100);
  const finalAmount = subTotal - afterDiscount + hst;

  purchaseInvoice.meterReading = {
    readings: [monoMeter, colorMeter],
    totalOverage: totalOverage,
    subTotal: subTotal.toFixed(2),
    discount: purchaseInvoice.discount,
    balanceDue: purchaseInvoice.status === "paid" ? 0 : finalAmount.toFixed(2),
    hst: hst.toFixed(2),
    totalTax: hst.toFixed(2),
    total: finalAmount.toFixed(2),
  };


  purchaseInvoice.assets = [
    {
      asset: purchaseInvoice?.asset,
      meterReading: purchaseInvoice?.meterReading,
    },
  ];

  purchaseInvoice.metaTotal = purchaseInvoice?.meterReading;

  delete purchaseInvoice?.asset;
  delete purchaseInvoice?.meterReading;

  return purchaseInvoice;
};
