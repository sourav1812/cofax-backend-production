import mongoose, { Schema, Types } from "mongoose";

export interface ITax {
  hstTax: number;
  notes: Types.ObjectId[];
}

const taxSchema = new Schema<ITax>(
  {
    hstTax: {
      type: Number,
      required: true,
      min: [
        0,
        "The value of path `{PATH}` ({VALUE}) is beneath the limit ({MIN}).",
      ],
      max: [
        100,
        "The value of path `{PATH}` ({VALUE}) exceeds the limit ({MAX}).",
      ],
    },
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
        required: true,
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

const Tax = mongoose.model<ITax>("Tax", taxSchema, "Tax");

export default Tax;
