import mongoose, { Schema, Types } from "mongoose";
// import Address, { IAddress } from "./address.schema";

export interface IAddress {
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface ICustomer {
  id?: string;
  name: string;
  username: string;
  email: string;
  secondaryEmail: string;
  phoneNumber: string;
  billingAddress: string;
  isActive: boolean;
  shippingAddress: string;
  notes: Types.ObjectId[];
  companyId: Types.ObjectId;
  txnId: string;
  customerType: Types.ObjectId;
  accountNumber: string;
  billingSchedule: string;
  contractNumber: string;
  customerNumber: string;
  prevDbId: string;
  mpsCustomerCode: string;
  mpsCustomerId: string;
  quickBookShippingAddress?: IAddress;
  quickBookBillingAddress?: IAddress;
  quickBookId: number;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, unique: true },
    prevDbId: String,
    quickBookId: Number,
    contractNumber: String,
    customerNumber: String,
    isActive: { type: Boolean, default: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, lowercase: true },
    secondaryEmail: { type: String, lowercase: true },
    phoneNumber: { type: String, required: true },
    billingAddress: { type: String, required: true },
    shippingAddress: { type: String, required: true },
    billingSchedule: {
      type: String,
      default: "monthly",
    },
    accountNumber: String,
    companyId: {
      type: Schema.ObjectId,
      ref: "Company",
    },
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
      },
    ],
    customerType: {
      type: Schema.ObjectId,
      ref: "Contract_Type",
    },
    mpsCustomerCode: String,
    mpsCustomerId: String,
    quickBookShippingAddress: {
      address: String,
      city: String,
      province: String,
      postalCode: String,
    },
    quickBookBillingAddress: {
      address: String,
      city: String,
      province: String,
      postalCode: String,
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

const Customer = mongoose.model<ICustomer>(
  "Customer",
  CustomerSchema,
  "Customer"
);

export default Customer;
