import mongoose, { Schema, Types } from "mongoose";
import { BillingStatus } from "../../utils/types/enum/db";

export interface IPurchaseOrder {
  invoiceNo: string;
  poNo: string;
  status: BillingStatus;
  dueDate: Date;
  assetId: Types.ObjectId;
  customerName: string;
  discount: number;
  beginMeter: number;
  endMeter: number;
  colorBegin: number;
  colorEnd: number;
  quickBookInvoiceId: number;
}

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },
    poNo: {
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
    beginMeter: {
      type: Number,
      default: 0,
    },
    endMeter: {
      type: Number,
      default: 0,
    },
    colorBegin: {
      type: Number,
      default: 0,
    },
    colorEnd: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(BillingStatus),
      default: BillingStatus.Pending,
    },
    dueDate: {
      type: Date,
      default: new Date().setMonth(new Date().getMonth() + 1),
    },
    assetId: {
      type: Schema.ObjectId,
      ref: "Asset",
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    quickBookInvoiceId:{
      type: Number,
    }
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

const PurchaseOrderBilling = mongoose.model<IPurchaseOrder>(
  "Purchase_Order_Invoice",
  purchaseOrderSchema,
  "Purchase_Order_Invoice"
);

export default PurchaseOrderBilling;
