import mongoose, { Schema, Types } from "mongoose";

export interface IBillingAuditReport {
  monoBegin: number;
  monoEnd: number;
  colorBegin: number;
  colorEnd: number;
  assetId: Types.ObjectId;
  companyId: Types.ObjectId;
  createdAt: Date;
  dueDate: Date;
}

const auditReportSchema = new Schema<IBillingAuditReport>(
  {
    monoBegin: {
      type: Number,
      required: true,
    },
    monoEnd: {
      type: Number,
      required: true,
    },
    colorBegin: {
      type: Number,
      required: true,
    },
    colorEnd: {
      type: Number,
      required: true,
    },
    companyId: {
      type: Schema.ObjectId,
      ref: "Company",
      required: true,
    },
    assetId: {
      type: Schema.ObjectId,
      ref: "Asset",
      required: true,
    },
    createdAt: Date,
    dueDate: Date,
  },
  {
    toJSON: {
      transform(obj, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

const AuditReport = mongoose.model<IBillingAuditReport>(
  "Audit_Report",
  auditReportSchema,
  "Audit_Report"
);

export default AuditReport;
