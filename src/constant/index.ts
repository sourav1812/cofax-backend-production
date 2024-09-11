import dotenv from "dotenv";
dotenv.config();

export const SEARCH_BY = {
  ASSET: "asset",
  CONTRACT: "contract",
};

export const ENVIRONMENT = process.env.NODE_ENV ?? "production";

export const QUICKBOOK_BASE_URL =
  process.env.QUICKBOOKS_ENVIRONMENT === "sandbox"
    ? process.env.QUICKBOOKS_API_ENDPOINT_SANDBOX!
    : process.env.QUICKBOOKS_API_ENDPOINT_PROD!;

export const NORCOM_COMPANY_ID = "658d458f16eabad417c8bbc3";
