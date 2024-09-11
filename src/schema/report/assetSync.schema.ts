import mongoose, { Schema, Types } from "mongoose";
import { ReportType } from "../../utils/types/enum/db";

export interface IAssetSyncReport {
  type: ReportType;
  success: Types.ObjectId[];
  failed: Types.ObjectId[];
  missingInMps: Types.ObjectId[];
  total: number;
}

const assetReportSchema = new Schema<IAssetSyncReport>(
  {
    type: {
      type: String,
      enum: Object.values(ReportType),
      required: true,
    },
    total: Number,
    success: [
      {
        type: Schema.ObjectId,
        ref: "Asset",
        required: true,
      },
    ],
    failed: [
      {
        type: Schema.ObjectId,
        ref: "Asset",
        required: true,
      },
    ],
    missingInMps: [
      {
        type: Schema.ObjectId,
        ref: "Asset",
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

const AssetsReport = mongoose.model<IAssetSyncReport>(
  "Report_Assets",
  assetReportSchema,
  "Report_Assets"
);

export default AssetsReport;
