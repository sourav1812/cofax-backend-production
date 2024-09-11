import mongoose, { Schema, Types } from "mongoose";
import { BillingStatus, ShipMethod } from "../../utils/types/enum/db";

interface IItems {
  name: string;
  itemId: string;
  quantity: number;
  price: number;
}

export interface ISales {
  invoiceNo: string;
  price: number;
  status: BillingStatus;
  dueDate: Date;
  customerName: string;
  items: IItems[];
  discount: number;
  shipMethod: ShipMethod;
  salesPerson: string;
  billTo: object;
  remarks: string;
  poNumber: string;
}

const salesSchema = new Schema<ISales>(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: [
        0,
        "The value of path `{PATH}` ({VALUE}) is beneath the limit ({MIN}).",
      ],
      max: [
        100,
        "The value of path `{PATH}` ({VALUE}) exceeds the limit ({MAX}).",
      ],
    },
    status: {
      type: String,
      enum: Object.values(BillingStatus),
      default: BillingStatus.Pending,
    },
    shipMethod: {
      type: String,
      enum: Object.values(ShipMethod),
      default: ShipMethod.DLTECH,
    },
    salesPerson: String,
    dueDate: {
      type: Date,
      default: new Date().setMonth(new Date().getMonth() + 1),
    },
    billTo: {
      type: Object,
      required: true,
    },
    remarks: {
      type: String,
    },
    poNumber: {
      type: String,
    },
    customerName: {
      type: String,
      required: true,
    },
    items: [
      {
        name: {
          type: String,
          required: true,
        },
        itemId: String,
        price: {
          type: Number,
          min: [0, "Must be at least 0, got {VALUE}"],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, "Must be at least 1, got {VALUE}"],
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(obj, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

const SalesInvoice = mongoose.model<ISales>(
  "Sale_Invoice",
  salesSchema,
  "Sale_Invoice"
);

export default SalesInvoice;
