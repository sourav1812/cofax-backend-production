import mongoose, { Schema, Types } from "mongoose";

export interface IRole {
  name: string;
  description: string;
  isActive: boolean;
  notes: Types.ObjectId[];
}

const roleSchema = new Schema<IRole>(
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

const Role = mongoose.model<IRole>("Role", roleSchema, "Role");

export default Role;
