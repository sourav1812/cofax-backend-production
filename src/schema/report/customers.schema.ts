import mongoose, { Schema, Types } from "mongoose";
import { ReportType } from "../../utils/types/enum/db";

export interface ICustomerReport {
  type: ReportType;
  success: Types.ObjectId[];
  failed: Types.ObjectId[];
  total: number;
}

const customerReportSchema = new Schema<ICustomerReport>(
  {
    type: {
      type: String,
      enum: Object.values(ReportType),
      default: ReportType.Sync,
      required: true,
    },
    total: Number,
    success: [
      {
        type: Schema.ObjectId,
        ref: "Customer",
        required: true,
      },
    ],
    failed: [
      {
        type: Schema.ObjectId,
        ref: "Customer",
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

const CustomersReport = mongoose.model<ICustomerReport>(
  "Report_Customers",
  customerReportSchema,
  "Report_Customers"
);

export default CustomersReport;
