import { Request, Response } from "express";
import { STATUS_CODE } from "../constant/status";
import QuickBook, { IQuickBook } from "../schema/quickbook.schema";
import { BadRequest } from "../errors/bad-request";
import axios from "axios";

const QUICKBOOKS_AUTH_URL = process.env.QUICKBOOKS_AUTH_URL!;
const QUICKBOOKS_TOKEN_URL = process.env.QUICKBOOKS_TOKEN_URL!;

const QuickBookController = {
  getAuthorizeCode: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const realmId = id;

      const quickbook: IQuickBook = (await QuickBook.findOne({
        realmId: realmId.toString(),
      })) as IQuickBook;

      if (!quickbook) {
        throw new BadRequest("quickBook does not exist");
      }

      const { client_id } = quickbook;

      const authUri = `${QUICKBOOKS_AUTH_URL}?client_id=${client_id}&redirect_uri=${encodeURIComponent(
        process.env.QUICKBOOKS_REDIRECT_URI!
      )}&response_type=code&scope=com.intuit.quickbooks.accounting+openid+profile+email+phone+address&state=intuit-test`;

      res.json({
        message: "auth url generated successfully",
        authUri,
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({
        message: "error generating quickbook authorization code: ",
        error: error,
      });
    }
  },

  //Step 12: Exchange the authorization code for access tokens
  callback: async (req: Request, res: Response) => {
    try {
      const { realmId, code }: any = req.query;
      const quickBookRecord = (await QuickBook.findOne({
        realmId: realmId.toString(),
      })) as IQuickBook;

      if (!quickBookRecord) {
        throw new Error("QuickBooks record not found for the given realmId");
      }

      const { client_id, client_secret } = quickBookRecord;

      const { data: authResponse } = await axios.post(
        QUICKBOOKS_TOKEN_URL,
        new URLSearchParams({
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
          client_id: client_id,
          client_secret: client_secret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const tokenData = {
        token_type: authResponse.token_type,
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
        expires_in: authResponse.expires_in,
        x_refresh_token_expires_in: authResponse.x_refresh_token_expires_in,
        updatedAt: new Date(),
      };

      const updatedQuickbook = await QuickBook.findOneAndUpdate(
        { realmId: realmId },
        {
          ...tokenData,
        },
        { new: true }
      );

      res.json({
        message: "Quickbook account updated",
        data: authResponse,
        updatedQuickbook,
      });
    } catch (error: any) {
      console.log(
        "Failed to Exchange the authorization code for access tokens",
        error
      );

      res
        .status(500)
        .json({ message: "error generating token", error: error.message });
    }
  },

  update: async (req: Request, res: Response) => {
    const data = await QuickBook.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(STATUS_CODE.SUCCESS).send({ quickbook: data });
  },

  get: async (req: Request, res: Response) => {
    const data: any = await QuickBook.find().populate("company").limit(2);
    res.status(STATUS_CODE.SUCCESS).send(data);
  },
};

export default QuickBookController;
