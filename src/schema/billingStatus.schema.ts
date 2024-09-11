import mongoose from "mongoose";

const BillingStatusSchema = new mongoose.Schema({
  customerId: mongoose.Schema.Types.ObjectId,
  company: mongoose.Schema.Types.ObjectId,
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

BillingStatusSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const BillingStatus = mongoose.model(
  "BillingStatus",
  BillingStatusSchema,
  "BillingStatus"
);
