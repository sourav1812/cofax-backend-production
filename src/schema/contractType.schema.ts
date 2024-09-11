import mongoose, { Schema, Types } from 'mongoose';

export interface IContractType {
    name: string;
    description?: string;
    isActive: boolean;
}

const ContractTypeSchema = new Schema<IContractType>({
    name: { type: String, required: true, unique: true },
    description: String,
    isActive:{ type: Boolean, default: true },
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

const ContractType = mongoose.model<IContractType>("Contract_Type",ContractTypeSchema,"Contract_Type")

export default ContractType