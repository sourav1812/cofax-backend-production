import mongoose, { Schema, Types } from "mongoose";

export interface IDeliveryReport {
  partId: Types.ObjectId;
  notes: Types.ObjectId[];
  //status
}

// User Schema
const deliveryReportSchema = new Schema<IDeliveryReport>(
  {
    partId: [],
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

const DeliveryReport = mongoose.model<IDeliveryReport>(
  "Delivery_Report",
  deliveryReportSchema,
  "Delivery_Report"
);

export default DeliveryReport;
