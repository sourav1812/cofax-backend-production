import mongoose, { Schema, Types } from "mongoose";

export interface ITechStock {
  itemId: Types.ObjectId;
  quantity: number;
  notes: Types.ObjectId[];
  technicianId: Types.ObjectId;
}

// Technician's stock Schema: Technician can store some items.
const techStockSchema = new Schema<ITechStock>(
  {
    itemId: {
      type: Schema.ObjectId,
      ref: "Item",
      required: [true, "Stock item must belong to an item"],
    },
    technicianId: {
      type: Schema.ObjectId,
      ref: "User",
      required: [true, "Technician is missing"],
    },
    quantity: { type: Number, required: true },
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

const TechStock = mongoose.model<ITechStock>(
  "Surplus_Items",
  techStockSchema,
  "Surplus_Items"
);

export default TechStock;
