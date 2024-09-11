import mongoose, { Schema, Types } from "mongoose";
import { BillingStatus } from "../../utils/types/enum/db";

//*We might not this as requirement changed from 1Meter can have multiple service to 1Meter will have 1Service
//* We can adjust from the service data inside meter: It will esier to make query

export interface IServiceInvoice {
  invoiceNo: string;
  paid: number;
  status: BillingStatus;
  quickBook: string;
  quickBookInvoiceId: number;
  dueDate: Date;
  assets: {
    assetId: Types.ObjectId;
    meterId: Types.ObjectId;
  }[];
  customerName: string;
  discount: number;
}

const serviceInvoiceSchema = new Schema<IServiceInvoice>(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },
    paid: {
      type: Number,
      default: 0,
    },
    quickBookInvoiceId: {
      type: Number,
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
    quickBook: String,
    dueDate: {
      type: Date,
      default: new Date().setMonth(new Date().getMonth() + 1),
    },
    assets: [
      {
        assetId: {
          type: Schema.ObjectId,
          ref: "Asset",
          required: true,
        },
        meterId: {
          type: Schema.ObjectId,
          ref: "Meter_Reading",
          required: true,
        },
      },
    ],
    customerName: {
      type: String,
      required: true,
    },
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

serviceInvoiceSchema.index({ customerName: 1 });

const ServiceBilling = mongoose.model<IServiceInvoice>(
  "Service_Invoice",
  serviceInvoiceSchema,
  "Service_Invoice"
);

ServiceBilling.collection.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 15778800 } //6month
);

export default ServiceBilling;
