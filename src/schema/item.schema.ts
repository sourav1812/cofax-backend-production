import mongoose, { Schema, Types } from "mongoose";
import { ProductCondition } from "../utils/types/enum/db";

// Document interface
export interface IItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
  sku: string;
  model: string;
  isActive: boolean;
  notes: Types.ObjectId[];
  categoryId: Types.ObjectId;
  prodType: ProductCondition;
  partId: string;
  //! remove this technicianId. It will contained inside asset/equipment table
  vendor: string; //For i kept
  deletedAt: Date | null;
}

// User Schema
const inventoryItemSchema = new Schema<IItem>(
  {
    name: { type: String, required: true },
    description: String,
    quantity: {
      type: Number,
      required: true,
      min: [0, "Must be at least 0, got {VALUE}"],
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Must be at least 0, got {VALUE}"],
    },
    isActive: { type: Boolean, default: true },
    vendor: { type: String, required: true },
    model: String,
    partId: { type: String, required: true, unique: true }, // It will unique for each Item in inventory
    sku: { type: String, required: true },
    prodType: {
      type: String,
      enum: Object.values(ProductCondition),
      required: true,
    },
    categoryId: {
      type: Schema.ObjectId,
      ref: "Category",
      required: [true, "Item must belong to a category"],
    },
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
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

const Item = mongoose.model<IItem>("Item", inventoryItemSchema, "Item");

export default Item;
