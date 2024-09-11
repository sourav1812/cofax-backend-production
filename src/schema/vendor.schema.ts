import mongoose, { Schema, Types } from "mongoose";

export interface IVendor {
  name: string;
  description: string;
  notes: Types.ObjectId[];
  isActive: boolean;
}

// Technician's stock Schema: Technician can store some items.
const vendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, unique: true },
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
      transform(_, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

const Vendor = mongoose.model<IVendor>("Vendor", vendorSchema, "Vendor");

export default Vendor;
