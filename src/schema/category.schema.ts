import mongoose, { Schema, Types } from 'mongoose';

export interface IInventory {
    name: string;
    description?: string;
    is_active: boolean;
}

const categorySchema = new Schema<IInventory>({
    name: { type: String, required: true, unique: true },
    description: String,
    is_active:{ type: Boolean, default: true },
},{
    timestamps: true,
  toJSON:{
    transform(obj,ret){
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v
    }
}
});

const Category = mongoose.model<IInventory>("Category",categorySchema,"Category")

export default Category