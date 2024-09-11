import mongoose, { Schema, Types } from "mongoose";

export interface IProposal {
  file: string;
  notes: Types.ObjectId[];
  customerId: Types.ObjectId;
}

// Proposal Schema: To send proposal to customer
const proposalSchema = new Schema<IProposal>(
  {
    file: String,
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
      },
    ],
    customerId: {
      type: Schema.ObjectId,
      ref: "Customer",
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

const Proposal = mongoose.model<IProposal>(
  "Proposal",
  proposalSchema,
  "Proposal"
);

export default Proposal;
