import axios from "axios";
import { BadRequest } from "../errors/bad-request";
import { Request, Response } from "express";
import Mps from "../schema/settings/mps.schema";
import { STATUS_CODE } from "../constant/status";

const MPS = {
  update: async (req: Request, res: Response) => {
    const data = await Mps.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.status(STATUS_CODE.SUCCESS).send({ mps: data });
  },

  get: async (req: Request, res: Response) => {
    const data: any = await Mps.findOne({});

    res.status(STATUS_CODE.SUCCESS).send(data.toJSON());
  },

  registration: async () => {
    const config: any = await Mps.findOne({});

    const data = {
      client_id: config.client_id,
      client_secret: config.client_secret,
      grant_type: config.grant_type,
      username: config.username,
      password: config.password,
      scope: config.scope,
    };

    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }

    const rawData: any = await axios.post(`${config.baseUrl}/token`, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!rawData?.data.access_token) {
      throw new BadRequest("Failed to Register with MPS");
    }

    return [rawData?.data, config.baseUrl];
  },

  getReadings: async (token: string, baseUrl: string) => {
    const currentDate = new Date();

    // Set toDate to the current date
    const toDate = new Date(currentDate);

    // Set fromDate to one day before the current day
    const fromDate = new Date(currentDate);
    // fromDate.setDate(currentDate.getDate() - 2);
    fromDate.setMonth(currentDate.getMonth() - 1);
    fromDate.setHours(0, 0, 0, 0);

    const data: any = await axios.post(
      `${baseUrl}/Counter/List`,
      {
        DealerCode: "Q0Y13QXMFY",
        FromDate: fromDate,
        ToDate: toDate,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return data;
  },

  getCustomers: async (token: string, baseUrl: string) => {
    const data = await axios.post(
      `${baseUrl}/Customer/GetCustomers`,
      {
        DealerId: process.env.DEALER_ID,
        DealerCode: process.env.DEALER_CODE,
        Code: process.env.CODE,
        HasHpSds: true,
        HasPrintReleaf: false,
        ActiveCustomerFilter: true,
        CommunicationStatus: "All",
        // "FilterText": "One Heart ",
        PageNumber: 1,
        PageRows: 1000,
        SortColumn: "string",
        SortOrder: "Asc",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return data;
  },
};

export default MPS;
