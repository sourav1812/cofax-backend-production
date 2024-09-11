import { Request, Response } from "express";
import { STATUS_CODE } from "../constant/status";
import { getWidgets, getItems, getServiceCall } from "../utils/dashboard";
import Customer from "../schema/customer.schema";
import ServiceCall from "../schema/serviceCall.schema";
import Asset from "../schema/asset.schema";
import SalesInvoice from "../schema/Invoices/sales.schema";
import Item from "../schema/item.schema";

const DashboardController = {
  get: async (req: Request, res: Response) => {
    const [
      customers,
      items,
      services,
      serviceWidget,
      assetWidget,
      saleWidget,
    ]: any = await Promise.all([
      getWidgets(Customer),
      getItems(),
      getServiceCall(),
      getWidgets(ServiceCall),
      getWidgets(Asset),
      getWidgets(SalesInvoice),
    ]);

    let totalCalls: number = 0;
    const status = ["created", "dispatched", "hold", "failed", "completed"].map(
      (it) => {
        const status = services.find((service: any) => service._id === it);

        if (status) {
          totalCalls += status.total;
          return status;
        }
        return {
          _id: it,
          total: 0,
        };
      }
    );

    res.status(STATUS_CODE.SUCCESS).send({
      saleWidget: {
        size: saleWidget?.mergedResult.length,
        total: saleWidget.total,
        dataPerMonth: saleWidget.mergedResult,
      },
      assetWidget: {
        size: assetWidget?.mergedResult.length,
        total: assetWidget.total,
        dataPerMonth: assetWidget.mergedResult,
      },
      serviceWidget: {
        size: serviceWidget?.mergedResult.length,
        total: serviceWidget.total,
        dataPerMonth: serviceWidget.mergedResult,
      },
      services: {
        status,
        totalCalls,
      },
      customers: {
        size: customers?.mergedResult.length,
        total: customers.total,
        dataPerMonth: customers.mergedResult,
      },
      items,
    });
  },

  search: async (req: Request, res: Response) => {
    let { searchTerm = "" }: any = req.query;
    const searchArray = searchTerm.split(",");

    //Search in Customers
    const [customers, assets, inventory] = await Promise.all([
      Customer.aggregate([
        {
          $search: {
            index: "auto_complete_customer",
            autocomplete: {
              query: searchArray,
              path: "name",
              tokenOrder: "sequential",
              fuzzy: {
                maxEdits: 1,
                prefixLength: 3,
              },
            },
          },
        },
        { $limit: 20 },
        {
          $project: {
            name: 1,
            username: 1,
            email: 1,
          },
        },
      ]),

      //Search in Assets
      Asset.aggregate([
        {
          $search: {
            index: "auto_complete_assets",
            compound: {
              should: [
                {
                  autocomplete: {
                    query: searchArray,
                    path: "assetNumber",
                    tokenOrder: "sequential",
                    fuzzy: {
                      maxEdits: 1,
                      prefixLength: 5,
                    },
                  },
                },
                {
                  autocomplete: {
                    query: searchArray,
                    path: "serialNo",
                    tokenOrder: "sequential",
                    fuzzy: {
                      maxEdits: 1,
                      prefixLength: 5,
                    },
                  },
                },
              ],
            },
          },
        },
        {
          $match: {
            deletedAt: {
              $eq: null,
            },
          },
        },
        { $limit: 10 },
        {
          $lookup: {
            from: "Customer",
            localField: "customerId",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $project: {
            assetNumber: 1,
            customer: "$customer.username",
            serialNo: 1,
          },
        },
      ]),
      //Search in Items
      Item.aggregate([
        {
          $search: {
            index: "inventory_Item",
            autocomplete: {
              query: searchTerm,
              path: "name",
              tokenOrder: "any",
              fuzzy: {
                maxEdits: 1,
                prefixLength: 5,
              },
            },
          },
        },
        {
          $match: {
            deletedAt: {
              $eq: null,
            },
          },
        },
        // { $limit: 20 },
        {
          $project: { name: 1, partId: 1, quantity: 1, prodType: 1, price: 1 },
        },
      ]),
    ]);

    res.status(STATUS_CODE.SUCCESS).send({ customers, assets, inventory });
  },
};

export default DashboardController;
