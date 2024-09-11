import mongoose, { Schema } from "mongoose";

export interface IDocCount {
  customer: number;
  wo: number;
  invoice: number;
  user: number;
  po: number;
  partId: number;
}

const docCountSchema = new Schema<IDocCount>(
  {
    customer: {
      type: Number,
      default: 0,
    },
    partId: {
      type: Number,
      default: 0,
    },
    wo: {
      type: Number,
      default: 0,
    },
    po: {
      type: Number,
      default: 0,
    },
    invoice: {
      type: Number,
      default: 0,
    },
    user: {
      type: Number,
      default: 0,
    },
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

const DocCount = mongoose.model<IDocCount>(
  "Doc_Count",
  docCountSchema,
  "Doc_Count"
);

export default DocCount;
