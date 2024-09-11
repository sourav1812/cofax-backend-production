import mongoose, { Schema, Types } from "mongoose";
import { ServicePriority, ServiceStatus } from "../utils/types/enum/db";
import { IItems } from "./asset.schema";

export interface IServiceCall {
  workOrder: string;
  serviceCall: string;
  description: string;
  equipContact: Types.ObjectId;
  priority: ServicePriority;
  contactPhone: string;
  requestedBy: string;
  serviceTypeId: Types.ObjectId;
  status: ServiceStatus;
  isCompleted: boolean;
  completedAt: Date;
  createdBy: Types.ObjectId;
  technician: Types.ObjectId;
  assetNumber: string;
  assetId: Types.ObjectId;
  notes: Types.ObjectId[];
  items: IItems;
  billingAddress: string;
  shippingAddress: string;
  locationNote: string;
  workPerformed: string;
  callDueBy: Date;
}

// User Schema
const serviceCallSchema = new Schema<IServiceCall>(
  {
    workOrder: {
      type: String,
      unique: true,
      required: [true, "is required"],
    },
    equipContact: {
      type: Schema.ObjectId,
      ref: "EquipContact",
    },
    serviceCall: {
      type: String,
      unique: true,
      required: [true, "is required"],
    },
    createdBy: {
      type: Schema.ObjectId,
      ref: "User",
      required: true,
    },
    callDueBy: Date,
    description: String,
    priority: {
      type: String,
      enum: Object.values(ServicePriority),
      required: true,
    },
    serviceTypeId: {
      type: Schema.ObjectId,
      ref: "ServiceType",
    },
    status: {
      type: String,
      enum: Object.values(ServiceStatus),
      required: true,
      default: ServiceStatus.Created,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
    workPerformed: String,
    assetNumber: {
      type: String,
      required: [true, "is required"],
    },
    assetId: {
      type: Schema.ObjectId,
      ref: "Asset",
      required: [true, "Service must belong to a Asset"],
    },
    technician: {
      type: Schema.ObjectId,
      ref: "User",
    },
    billingAddress: String,
    shippingAddress: String,
    locationNote: String,
    contactPhone: String,
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
      },
    ],
    requestedBy: {
      type: String,
      required: true,
    },
    items: [
      {
        itemId: {
          type: Schema.ObjectId,
          ref: "Item",
          required: [true, "items must belong to a Item"],
        },
        quantity: {
          type: Number,
          required: true,
          min: [0, "Must be at least 0, got {VALUE}"],
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

const ServiceCall = mongoose.model<IServiceCall>(
  "Service_Call",
  serviceCallSchema,
  "Service_Call"
);

export default ServiceCall;
