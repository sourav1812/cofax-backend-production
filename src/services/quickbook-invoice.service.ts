import axios from "axios";
import dotenv from "dotenv";
import { getQuickBookTokenOrRefresh } from "./quickbook.service";
import { NORCOM_COMPANY_ID, QUICKBOOK_BASE_URL } from "../constant";
import { getDate } from "../utils/functions";
import QuickBook, { IQuickBook } from "../schema/quickbook.schema";
dotenv.config();

interface LocalInvoice {
  assets: any[];
  customer: {
    quickBookId: string;
    billingAddress: string;
    company: {
      city: string;
      postCode: string;
    };
    billingSchedule: string;
  };
  dueDate: string;
  metaTotal: {
    total: number;
  };
}

interface LineItem {
  DetailType: string;
  Amount: number;
  SalesItemLineDetail: {
    UnitPrice: number;
    Qty: number;
    ServiceDate: string;
  };
  Description: string;
}

function convertToQuickBooksFormat(localInvoice: LocalInvoice | any): any {
  const rentalMultiplier = getDate(localInvoice?.customer?.billingSchedule);

  const lineItems: LineItem[] = localInvoice.assets.flatMap((asset: any) => {
    return asset.meterReading.readings
      .map((reading: any) => {
        let totalQty =
          (typeof reading.EndMeter === "string"
            ? parseInt(reading.EndMeter.replace(/,/g, ""))
            : reading.EndMeter) -
          (typeof reading.BeginMeter === "string"
            ? parseInt(reading.BeginMeter.replace(/,/g, ""))
            : reading.BeginMeter);

        // Fixed the Total Quantity to 2;

        totalQty = +totalQty.toFixed(2);
        const unitPrice = parseFloat(reading.rate).toFixed(2);
        const amount = +(+totalQty * +unitPrice).toFixed(2);
        if (totalQty <= 0 || amount <= 0) {
          console.warn(
            `Skipping line item with non-positive quantity or amount: Qty=${totalQty}, Amount=${amount}`
          );
          return null;
        }
        return {
          DetailType: "SalesItemLineDetail",
          Amount: amount,
          SalesItemLineDetail: {
            UnitPrice: unitPrice,
            Qty: totalQty,
            ServiceDate: localInvoice.dueDate,
          },
          Description: `ID ${asset.asset.assetNumber}, MODEL ${asset.asset.model}, ${reading.meterType} USAGE, TOTAL ${reading.total}`,
        };
      })
      .filter((item: any) => item !== null); // Filter out null items
  });

  if (localInvoice.assets.some((asset: any) => asset.asset.rentalCharge)) {
    localInvoice.assets.forEach((asset: any) => {
      if (asset.asset.rentalCharge) {
        const rentalAmount = +(
          asset.asset.rentalCharge * rentalMultiplier
        ).toFixed(2);
        if (rentalAmount > 0) {
          lineItems.push({
            DetailType: "SalesItemLineDetail",
            Amount: +rentalAmount.toFixed(2),
            SalesItemLineDetail: {
              UnitPrice: +rentalAmount.toFixed(2),
              Qty: 1,
              ServiceDate: localInvoice.dueDate,
            },
            Description: `ID ${asset.asset.assetNumber}, MODEL ${asset.asset.model}, RENTAL CHARGE`,
          });
        } else {
          console.warn(
            `Skipping rental line item with non-positive amount: ${rentalAmount}`
          );
        }
      }
    });
  }

  if (localInvoice.assets.some((asset: any) => asset.asset.contractAmount)) {
    localInvoice.assets.forEach((asset: any) => {
      if (asset.asset.contractAmount) {
        const contractAmount = +asset.asset.contractAmount.toFixed(2);
        if (contractAmount > 0) {
          lineItems.push({
            DetailType: "SalesItemLineDetail",
            Amount: +contractAmount.toFixed(2),
            SalesItemLineDetail: {
              UnitPrice: +contractAmount.toFixed(2),
              Qty: 1,
              ServiceDate: localInvoice.dueDate,
            },
            Description: `ID ${asset.asset.assetNumber}, MODEL ${asset.asset.model}, CONTRACT TYPE: ${asset.asset.contractType.name}`,
          });
        } else {
          console.warn(
            `Skipping contract line item with non-positive amount: ${contractAmount}`
          );
        }
      }
    });
  }

  // Add a line item for totalTax
  const totalTax = parseFloat(
    Number(localInvoice.metaTotal.totalTax).toFixed(2)
  );
  if (totalTax > 0) {
    // const { hst } = localInvoice.metaTotal;
    // lineItems.push({
    //   DetailType: "SalesItemLineDetail",
    //   Amount: +totalTax.toFixed(2),
    //   SalesItemLineDetail: {
    //     UnitPrice: totalTax,
    //     Qty: 1,
    //     ServiceDate: localInvoice.dueDate,
    //   },
    //   Description: `Total Hst: ${+hst}, total tax: ${totalTax}`,
    // });
  }

  return {
    Line: lineItems,
    CustomerRef: {
      value: localInvoice.customer.quickBookId,
    },
    BillAddr: {
      Line1: localInvoice.customer.billingAddress,
      City: localInvoice.customer.company.city,
      CountrySubDivisionCode: "CA",
      PostalCode: localInvoice.customer.company.postCode,
    },
    ShipAddr: {
      Line1: localInvoice.customer.shippingAddress,
      City: localInvoice.customer.company.city,
      CountrySubDivisionCode: "CA",
      PostalCode: localInvoice.customer.company.postCode,
    },
    BillEmail: {
      Address: localInvoice.customer.email,
    },
    DueDate: localInvoice.dueDate,
    CurrencyRef: {
      value: "CAD",
    },
    CustomField: [
      {
        DefinitionId: "1",
        StringValue: localInvoice.customer.email,
        Type: "StringType",
        Name: "Email",
      },
      {
        DefinitionId: "2",
        StringValue: localInvoice.invoiceNo,
        Type: "StringType",
        Name: "Invoice",
      },
      {
        DefinitionId: "3",
        StringValue: localInvoice.customer.billingSchedule,
        Type: "StringType",
        Name: "Billing Schedule",
      },
      {
        DefinitionId: "4",
        StringValue: localInvoice.customer?.secondaryEmail,
        Type: "StringType",
        Name: "Secondary Email",
      },
    ],
  };
}

const convertToQuickBooksInvoice = async (
  invoice: any
  // retryCount = 0
): Promise<any> => {
  try {
    const quickbook = await QuickBook.findOne({
      company: invoice.customer.companyId,
    });

    const { realmId } = quickbook as IQuickBook;

    const accessToken = await getQuickBookTokenOrRefresh(realmId);

    const quickBookInvoice = convertToQuickBooksFormat(invoice);

    const response = await axios.post(
      `${QUICKBOOK_BASE_URL}/${realmId}/invoice`,
      quickBookInvoice,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return response.data?.Invoice;
  } catch (error: any) {
    console.error(
      `Error posting to QuickBooks: ${invoice.invoiceNo}`,
      error?.response?.data?.Fault ?? error?.response?.data ?? error.message
    );
    throw (
      error?.response?.data?.Fault ??
      error?.response?.data ??
      error.message ??
      error
    );
    // if (retryCount < 3) {
    //     console.log(`Retrying... Attempt ${retryCount + 1}`);
    //     return convertToQuickBooksInvoice(invoice, retryCount + 1);
    // } else {
    //     await FailedInvoice.create({
    //         invoiceId: invoice._id,
    //         errorMessage: error?.response?.data?.Fault ?? error?.response?.data ?? error.message,
    //         createdAt: new Date(),
    //     });
    //     throw error;
    // }
  }
};

const createInvoiceToQuickbooks = async (invoice: any) => {
  const quickbook = await QuickBook.findOne({
    company: invoice.customer.companyId,
  });

  const { realmId } = quickbook as IQuickBook;

  const accessToken = await getQuickBookTokenOrRefresh(realmId);
  const quickBookInvoice = await convertToQuickBooksFormat(invoice);

  const response = await axios.post(
    `${QUICKBOOK_BASE_URL}/${realmId}/invoice`,
    quickBookInvoice,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );
  return response.data?.Invoice;
};

const compareLocalInvoiceStatusWithQuickbook = async (
  invoice: any,
  quickbook: any
) => {
  const { quickBookInvoiceId } = invoice;
  if (!quickBookInvoiceId) return;

  const quickBookInvoice = await getInvoiceFromQuickbook(
    quickBookInvoiceId,
    quickbook
  );

  return quickBookInvoice;
};

const getInvoiceFromQuickbook = async (id: any, quickbook: any) => {
  const accessToken = await getQuickBookTokenOrRefresh(quickbook.realmId);

  const url = `${QUICKBOOK_BASE_URL}/${quickbook.realmId}/invoice/${id}`;

  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  return data;
};

export {
  convertToQuickBooksInvoice,
  createInvoiceToQuickbooks,
  getInvoiceFromQuickbook,
  compareLocalInvoiceStatusWithQuickbook,
};
