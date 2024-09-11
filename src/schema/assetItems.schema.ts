import mongoose, { Schema, Types } from "mongoose";
//NOTE: Not in used right now
export interface IAssetItems {
  assetId: Types.ObjectId;
  itemId: Types.ObjectId;
  customerId: Types.ObjectId;
  quantity: number;
}

//You can access item with partId or itemId
const assetsItemsSchema = new Schema<IAssetItems>(
  {
    itemId: {
      type: Schema.ObjectId,
      ref: "Item",
      required: [true, "items must belong to a Item"],
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, "Must be at least 0, got {VALUE}"],
    },
    assetId: {
      type: Schema.ObjectId,
      ref: "Asset",
      required: [true, "items must belong to a asset"],
    },
    customerId: {
      type: Schema.ObjectId,
      ref: "Customer",
      required: [true, "items must belong to a asset"],
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

const AssetItems = mongoose.model<IAssetItems>(
  "Asset_Items",
  assetsItemsSchema,
  "Asset_Items"
);

export default AssetItems;
