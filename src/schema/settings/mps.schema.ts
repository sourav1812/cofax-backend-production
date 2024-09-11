import mongoose, { Schema, Types } from "mongoose";

export interface IMps {
    baseUrl: string;
    client_id: string;
    client_secret: string;
    grant_type: string;
    username: string;
    password: string;
    scope: string
}

const mpsSchema = new Schema<IMps>(
  {
    baseUrl: String,
    client_id: String,
    client_secret: String,
    grant_type: String,
    username: String,
    password: String,
    scope: String,
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

const Mps = mongoose.model<IMps>("Mps", mpsSchema, "Mps");

export default Mps;
