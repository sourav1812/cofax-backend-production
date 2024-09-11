import mongoose, { Schema } from "mongoose";

export interface IAddress {
    address: string;
    city: string;
    province: string;
    postalCode: string;
}

const addressSchema = new Schema<IAddress>(
    {
        address: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        province: {
            type: String,
            required: true
        },
        postalCode: {
            type: String,
            required: true
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

const Address = mongoose.model<IAddress>("Address", addressSchema, "Address");

export default Address;
