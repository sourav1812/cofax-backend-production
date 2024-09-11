import mongoose, { Types } from "mongoose";

export interface ICustomerQueueSchema {
  // customerIds: [Types.ObjectId];
  status: string;
  createdAt: any;
  user: Types.ObjectId;
  coolDown: Types.ObjectId;
}

const CustomerQueueSchema = new mongoose.Schema({
  // customerIds: [mongoose.Schema.Types.ObjectId],
  status: {
    type: String,
    enum: ["pending", "processing", "completed"],
    default: "pending",
  },
  user: mongoose.Schema.Types.ObjectId,
  coolDown: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
});

export const CustomerQueue = mongoose.model<ICustomerQueueSchema>(
  "CustomerQueue",
  CustomerQueueSchema,
  "CustomerQueue"
);
