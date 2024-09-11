import mongoose, { Schema, Types } from "mongoose";

export interface IArea {
  address: string;
  description: string;
  isActive: boolean;
  notes: Types.ObjectId[];
}

const areaSchema = new Schema<IArea>(
  {
    address: {
      type: String,
      required: true,
      unique: true,
    },
    description: String,
    isActive: { type: Boolean, default: false },
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

const Area = mongoose.model<IArea>("Area", areaSchema, "Area");

export default Area;
