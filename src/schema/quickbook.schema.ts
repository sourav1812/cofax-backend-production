import mongoose, { Document, Schema, Types } from "mongoose";

export interface IQuickBook extends Document {
  baseUrl: string;
  client_id: string;
  client_secret: string;
  grant_type: string;
  username: string;
  password: string;
  scope: string;
  company: Types.ObjectId;
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  redirect_uri: string;
  realmId: string;
  createdAt: Date;
  updatedAt: Date;
}

const quickBookSchema = new Schema<IQuickBook>(
  {
    baseUrl: String,
    client_id: String,
    client_secret: String,
    grant_type: String,
    username: String,
    password: String,
    scope: String,
    company: {
      type: Schema.ObjectId,
      ref: "Company",
    },
    token_type: { type: String, required: true, default: "bearer" },
    access_token: { type: String, required: true },
    refresh_token: { type: String, required: true },
    expires_in: { type: Number, required: true },
    x_refresh_token_expires_in: { type: Number, required: true },
    realmId: { type: String, required: true, unique: true },
    redirect_uri: { type: String, required: true },
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

const QuickBook = mongoose.model<IQuickBook>(
  "QuickBook",
  quickBookSchema,
  "QuickBook"
);

export default QuickBook;
