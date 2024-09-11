import mongoose, { Schema, Types } from "mongoose";

export interface INote {
  author: Types.ObjectId;
  note: string;
}

const noteSchema = new Schema<INote>(
  {
    author: {
      type: Schema.ObjectId,
      ref: "User",
      required: [true, "Note must have an author"],
    },
    note: {
      type: String,
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

export const Note = mongoose.model<INote>("Note", noteSchema, "Note");
