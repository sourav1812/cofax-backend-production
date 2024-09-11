import mongoose, { Schema, Types } from "mongoose";

export interface IItems {
  partId: string;
  itemId: Types.ObjectId;
  quantity: number;
}

export interface IAsset {
  orderedQuantity: number;
  notes: Types.ObjectId[];
  contractType: Types.ObjectId;
  equipContact: Types.ObjectId;
  model: string;
  createdBy: Types.ObjectId;
  itemId: Types.ObjectId;
  assetContact: string;
  monoBegin: number;
  colorBegin: number;
  username: string;
  partId: string;
  assetNumber: string;
  serialNo: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  customerId: Types.ObjectId;
  items: IItems[];
  coveredMono: number;
  monoPrice: number;
  coveredColor: number;
  colorPrice: number;
  contractAmount: number;
  baseAdj: number;
  rentalCharge: number;
  mpsId: string;
  locationAddress?: string;
  deletedAt?: Date | null;
}

//You can access item with partId or itemId
const assetSchema = new Schema<IAsset>(
  {
    model: {
      type: String,
      required: true,
    },
    contractAmount: {
      min: 0,
      type: Number,
      default: 0,
    },
    baseAdj: {
      min: 0,
      type: Number,
      default: 0,
    },
    rentalCharge: {
      min: 0,
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.ObjectId,
      ref: "User",
    },
    equipContact: {
      type: Schema.ObjectId,
      ref: "EquipContact",
    },
    assetContact: String,
    serialNo: {
      type: String,
      required: true,
    },

    locationAddress: {
      type: String,
      // required: true,
    },
    assetNumber: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    partId: { type: String, required: true }, // It will unique for each Item in inventory
    coveredMono: {
      min: 0,
      type: Number,
      default: 0,
    },
    monoPrice: {
      type: Number,
      default: 0,
      min: 0,
      message: "Price must be a non-negative number.",
    },
    monoBegin: {
      min: 0,
      type: Number,
      default: 0,
    },
    coveredColor: {
      min: 0,
      type: Number,
      default: 0,
    },
    colorBegin: {
      min: 0,
      type: Number,
      default: 0,
    },
    colorPrice: {
      type: Number,
      default: 0.0,
      min: 0,
      message: "Price must be a non-negative number.",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isActive: { type: Boolean, default: true }, //If customer received order
    contractType: {
      type: Schema.ObjectId,
      ref: "Contract_Type",
      required: [true, "Asset must belong to a Contract_Type"],
    },
    itemId: {
      type: Schema.ObjectId,
      ref: "Item",
      required: [true, "Asset must belong to a Item"],
    },
    items: [
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
      },
    ],
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
    deletedAt: {
      type: Date,
      default: null,
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

const Asset = mongoose.model<IAsset>("Asset", assetSchema, "Asset");

export default Asset;
