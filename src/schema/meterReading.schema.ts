import mongoose, { Schema, Types } from "mongoose";
import ServiceBilling from "./Invoices/service";

export interface IMeterReading {
  mono: number;
  color: number;
  invoiced: boolean;
  username: string;
  assetId: Types.ObjectId;
  sent: number;
}

const MeterReadingSchema = new Schema<IMeterReading>(
  {
    mono: {
      type: Number,
      required: true,
    },
    color: {
      type: Number,
      required: true,
    },
    sent: {
      type: Number,
      default: 0,
    },
    invoiced: { type: Boolean, default: false },
    username: String,
    assetId: {
      type: Schema.ObjectId,
      ref: "Asset",
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

MeterReadingSchema.pre(
  "findOneAndDelete",
  { document: false, query: true },
  async function () {
    const doc = await this.model.findOne(this.getFilter());

    await ServiceBilling.deleteOne({ meterId: doc._id });
  }
);

const MeterReading = mongoose.model<IMeterReading>(
  "Meter_Reading",
  MeterReadingSchema,
  "Meter_Reading"
);

export default MeterReading;
