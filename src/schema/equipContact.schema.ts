import mongoose, { Schema } from "mongoose";

export interface IEquipContact {
  user: string;
}

const equipContactSchema = new Schema<IEquipContact>(
  {
    user: {
      type: String,
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

const EquipContact = mongoose.model<IEquipContact>(
  "Equip_Contact",
  equipContactSchema,
  "Equip_Contact"
);

export default EquipContact;
