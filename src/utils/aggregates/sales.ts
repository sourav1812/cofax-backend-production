import mongoose from "mongoose";
import { addTrailingZeros } from "../functions/invoiceBillCalculations";
import Tax from "../../schema/Invoices/tax.schema";
import SalesInvoice from "../../schema/Invoices/sales.schema";

export const getSaleInvoice = async (invoiceId: string) => {
  let [sale, tax]: any = await Promise.all([
    SalesInvoice.aggregate([
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
            {
              $unwind: {
                path: "$company",
                preserveNullAndEmptyArrays: true,
              },
            },
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
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "User",
          localField: "salesPerson",
          foreignField: "username",
          as: "salesMan",
        },
      },
      {
        $unwind: {
          path: "$salesMan",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          "customer.notes": 0,
        },
      },
    ]),
    Tax.findOne({}),
  ]);

  sale = sale[0];

  const subTotal = sale?.items.reduce(
    (accumulator: number, currentItem: any) => {
      return accumulator + currentItem.price;
    },
    0
  );

  const afterDiscount = subTotal * (sale?.discount / 100);

  const hst = addTrailingZeros(subTotal * (tax?.hstTax / 100));

  const finalAmount = addTrailingZeros(
    subTotal - afterDiscount + Number(subTotal * (tax?.hstTax / 100))
  );

  sale.meterReading = {
    subTotal: addTrailingZeros(subTotal),
    balanceDue: sale.status === "paid" ? 0 : finalAmount,
    discount: sale.discount,
    hst,
    totalTax: hst,
    total: finalAmount,
  };

  return sale;
};
