import mongoose, { Schema, Types } from "mongoose";

export interface IAssetContact {
  user: string;
}

const assetContactSchema = new Schema<IAssetContact>(
  {
    user: {
      type: String,
      required: true,
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

const AssetContact = mongoose.model<IAssetContact>(
  "Asset_Contact",
  assetContactSchema,
  "Asset_Contact"
);

export default AssetContact;
