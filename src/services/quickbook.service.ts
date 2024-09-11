import axios from "axios";
import dotenv from "dotenv";
import QuickBook, { IQuickBook } from "../schema/quickbook.schema";
import mongoose, { Mongoose } from "mongoose";
import Customer, { ICustomer } from "../schema/customer.schema";
import qs from "qs";
import { NORCOM_COMPANY_ID, QUICKBOOK_BASE_URL } from "../constant";
import { Request, Response } from "express";
import { BadRequest } from "../errors/bad-request";
import Company from "../schema/companyInfo.schema";
dotenv.config();

const PAGE_SIZE = 50;

export interface QuickBookCustomerData {
  domain: string;
  PrimaryEmailAddr: {
    Address: string;
  };
  DisplayName: string;
  CurrencyRef: {
    name: string;
    value: "USD";
  };
  DefaultTaxCodeRef: {
    value: string;
  };
  PreferredDeliveryMethod: "Print";
  GivenName: string;
  FullyQualifiedName: string;
  BillWithParent: boolean;
  Title: string;
  Job: boolean;
  BalanceWithJobs: number;
  PrimaryPhone: {
    FreeFormNumber: string;
  };
  Taxable: boolean;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
  BillAddr: {
    City: string;
    Country: string;
    Line1: string;
    PostalCode: string;
    CountrySubDivisionCode: string;
    Id: string;
  };
  MiddleName: string;
  Notes: string;
  Active: boolean;
  Balance: number;
  SyncToken: string;
  Suffix: string;
  CompanyName: string;
  FamilyName: string;
  PrintOnCheckName: string;
  sparse: boolean;
  Id: string;
}

const QUICKBOOKS_OAUTH_URL = process.env.QUICKBOOKS_TOKEN_URL!;

const apiBaseUrl = QUICKBOOK_BASE_URL;

function getAuthorizationHeader(
  clientId: string,
  clientSecret: string
): string {
  const base64Credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );
  return `Basic ${base64Credentials}`;
}

async function createCustomerInQuickBook(
  token: string,
  realmId: string,
  customer: any
) {
  try {
    const { data } = await axios.post(
      `${apiBaseUrl}/${realmId}/customer?minorversion=70`,
      {
        ...customer,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    return data?.Customer;
  } catch (error: any) {
    throw new BadRequest(error.message);
  }
}

async function updateCustomerInQuickBook(
  token: string,
  realmId: string,
  customer: any,
  quickBookId: number
) {
  try {
    const { data: version }: any = await axios.get(
      `${apiBaseUrl}/${realmId}/customer/${quickBookId}?minorversion=70`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!version?.Customer?.SyncToken) {
      throw new BadRequest("Failed to get SyncToken");
    }

    const { data } = await axios.post(
      `${apiBaseUrl}/${realmId}/customer?minorversion=70`,
      {
        ...customer,
        SyncToken: version?.Customer?.SyncToken,
        Id: quickBookId,
        sparse: true,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    return data?.Customer;
  } catch (error: any) {
    console.log(
      error?.response?.data?.error ??
        error?.response?.data?.Fault ??
        error?.response?.data?.fault ??
        error
    );
    throw new BadRequest(error?.message);
  }
}

function restructureCustomerToQuickBook(customer: any) {
  if (!customer) return;

  return {
    FullyQualifiedName: customer?.name,
    PrimaryEmailAddr: {
      Address: customer?.email,
    },
    DisplayName: customer?.name,
    Suffix: "",
    Title: "",
    MiddleName: "",
    Notes: "",
    FamilyName: "",
    PrimaryPhone: {
      FreeFormNumber: customer?.phoneNumber ?? "9054794222",
    },
    CompanyName: customer?.name ?? "",
    BillAddr: {
      CountrySubDivisionCode: "CA",
      City: customer.quickBookBillingAddress?.city ?? "NA",
      PostalCode: customer.quickBookBillingAddress?.postalCode ?? "NA",
      Line1: customer?.quickBookBillingAddress?.address ?? "NA",
      Country: "",
    },
    ShipAddr: {
      CountrySubDivisionCode: "CA",
      City: customer.quickBookShippingAddress?.city ?? "NA",
      PostalCode: customer.quickBookShippingAddress?.postalCode ?? "NA",
      Line1: customer?.quickBookShippingAddress?.address ?? "NA",
      Country: "",
    },
    GivenName: "",
    // ...(customer?.quickBookId && {
    //   Id: customer?.quickBookId
    // })
  };
}

function isTokenExpired(quickbook: any, currentTime: number) {
  const tokenExpiryTime =
    Math.floor(new Date(quickbook.updatedAt).getTime() / 1000) +
    quickbook.expires_in;
  return currentTime >= tokenExpiryTime;
}

function isRefreshTokenExpired(quickbook: any, currentTime: number) {
  const refreshTokenExpiryTime =
    Math.floor(new Date(quickbook.updatedAt).getTime() / 1000) +
    quickbook?.x_refresh_token_expires_in;
  return currentTime >= refreshTokenExpiryTime;
}

async function getQuickBookTokenOrRefresh(realmId: string) {
  const quickbook: any = await QuickBook.findOne({
    realmId: realmId,
  });

  if (!quickbook) {
    throw new Error("No token found for this company");
  }

  const currentTime = Math.floor(Date.now() / 1000);

  if (!isTokenExpired(quickbook, currentTime)) {
    return quickbook.access_token;
  }

  if (isRefreshTokenExpired(quickbook, currentTime)) {
    throw new Error("Refresh token has expired, re-authentication is required");
  }

  console.log("Token is expired, trying to refresh");
  return await refreshQuickBookToken(quickbook);
}

async function refreshQuickBookToken(quickbook: IQuickBook) {
  try {
    const authorizationHeader = getAuthorizationHeader(
      quickbook.client_id,
      quickbook.client_secret
    );

    const response = await axios.post(
      QUICKBOOKS_OAUTH_URL,
      qs.stringify({
        grant_type: "refresh_token",
        refresh_token: quickbook.refresh_token,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: authorizationHeader,
        },
      }
    );

    const newToken = response.data;

    await QuickBook.findOneAndUpdate(
      { realmId: quickbook.realmId },
      {
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token,
        expires_in: newToken.expires_in,
        x_refresh_token_expires_in: newToken.x_refresh_token_expires_in,
        updatedAt: new Date(),
      }
    );

    console.log("Successfully Refreshed Tokens");
    return newToken.access_token;
  } catch (error: any) {
    console.error(
      "Error refreshing token",
      error?.response?.data?.error ??
        error?.response?.data?.Fault ??
        error?.response?.data?.fault ??
        error
    );
    throw new Error("Please connect to quick book from setting");
  }
}

export const isQuickBookAccessTokenValid = async () => {
  const company: any = await Company.findOne(
    {
      $or: [
        { name: "NORCOM BUSINESSES SYSTEMS INC" },
        { _id: new mongoose.Types.ObjectId(NORCOM_COMPANY_ID) },
      ],
    },
    "name _id"
  );

  if (!company) throw new BadRequest(`Company not found`);

  try {
    const quickbook = await QuickBook.findOne({
      company: company._id,
    });

    const { realmId } = quickbook as IQuickBook;
    const token = await getQuickBookTokenOrRefresh(realmId);
    return { token, realmId };
  } catch (error: any) {
    throw new BadRequest(`${company.name}: ${error.message}`);
  }
};

async function bulkSyncCustomerWithQuickBook(req: Request, res: Response) {
  try {
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const customers = await Customer.find({
        companyId: new mongoose.Types.ObjectId(NORCOM_COMPANY_ID),
      })
        .populate("companyId", "name")
        .sort({ createdAt: 1 })
        .skip(page * PAGE_SIZE)
        .limit(PAGE_SIZE);

      if (customers.length === 0) {
        console.log("No Customer Found for Quick book syncing");
        hasMore = false;
      } else {
        await Promise.all(
          customers.map(async (customer: any) => {
            const companyId = customer.companyId._id;
            const quickbook: IQuickBook = (await QuickBook.findOne({
              company: new mongoose.Types.ObjectId(companyId),
            })) as IQuickBook;

            const { realmId } = quickbook;

            const token = await getQuickBookTokenOrRefresh(realmId);

            const data = restructureCustomerToQuickBook(customer);
            const cust = await createCustomerInQuickBook(token, realmId, data);

            return await Customer.findByIdAndUpdate(
              customer._id,
              {
                $set: {
                  quickBookId: cust.Id,
                },
              },
              {
                new: true,
              }
            );
          })
        );
        page++;
      }
    }

    res.status(200).json({
      message: "Synced Succes",
    });
  } catch (error: any) {
    // console.log(error);

    res.status(500).json({
      message: "Failed",
      error: error.message,
    });
  }
}

export {
  getQuickBookTokenOrRefresh,
  updateCustomerInQuickBook,
  restructureCustomerToQuickBook,
  createCustomerInQuickBook,
  bulkSyncCustomerWithQuickBook,
};
