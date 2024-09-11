import mongoose, { Schema, Types } from "mongoose";

export interface ICompanyInfo {
  name: string;
  address?: string;
  city: string;
  postCode: string;
  phoneNumber: number;
  hstNumber: string;
  logo: string;
  notes: Types.ObjectId[];
  isActive: boolean;
  host: string;
  hostEmail: string;
  hostPort: number;
  hostPassword: string;
  footerNote: string;
}

const CompanyInfo = new Schema<ICompanyInfo>(
  {
    name: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    postCode: { type: String, required: true },
    phoneNumber: { type: Number, required: true },
    hstNumber: {
      type: String,
      required: true,
      match: /^[A-Za-z0-9\s]+$/,
      unique: true,
    },
    logo: String,
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
      },
    ],
    isActive: { type: Boolean, default: true },
    host: String,
    hostPort: Number,
    hostEmail: String,
    hostPassword: String,
    footerNote: String,
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

const Company = mongoose.model<ICompanyInfo>("Company", CompanyInfo, "Company");

export default Company;
