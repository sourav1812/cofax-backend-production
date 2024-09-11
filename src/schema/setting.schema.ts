import mongoose, { Schema, Types } from "mongoose";

export interface ISetting {
  notifyOnItem: number;
  notes: Types.ObjectId[];
  billsGeneratedAt: Date;
  billsGeneratedBy: Types.ObjectId;
  activeBilling: boolean;
}

const settingSchema = new Schema<ISetting>(
  {
    notifyOnItem: {
      type: Number,
      default: 5,
    },
    billsGeneratedAt: Date,
    billsGeneratedBy: {
      type: Schema.ObjectId,
      ref: "User",
      autopopulate: true,
    },
    activeBilling: {
      type: Boolean,
      default: false,
    },
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

const Setting = mongoose.model<ISetting>("Setting", settingSchema, "Setting");

export default Setting;
