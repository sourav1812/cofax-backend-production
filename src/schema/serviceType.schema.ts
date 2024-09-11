import mongoose, { Schema, Types } from "mongoose";

export interface IServiceCallType {
  name: string;
  description: string;
  isActive: boolean;
  notes: Types.ObjectId[];
}

const serviceCallTypeSchema = new Schema<IServiceCallType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: String,
    isActive: { type: Boolean, default: true },
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
      transform(obj, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

const ServiceCallType = mongoose.model<IServiceCallType>(
  "Service_Type",
  serviceCallTypeSchema,
  "Service_Type"
);

export default ServiceCallType;
