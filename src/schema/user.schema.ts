import mongoose, { Schema, Types } from "mongoose";
import { Password } from "../services/password.service";
import crypto from "crypto";

// Document interface
export interface IUser {
  active: boolean;
  username: string;
  firstName: string;
  lastName: string;
  notes: Types.ObjectId[];
  email: string;
  password: string;
  passwordResetToken: string;
  passwordResetExpires: string;
  role: Types.ObjectId;
  phoneNumber: number;
  area: Types.ObjectId;
  createPasswordResetToken: () => {};
}

// User Schema
const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    active: { type: Boolean, default: true },
    phoneNumber: Number,
    area: {
      type: Schema.ObjectId,
      ref: "Area",
      required: [true, "Address is missing"],
    },
    notes: [
      {
        type: Schema.ObjectId,
        ref: "Note",
      },
    ],
    role: {
      type: Schema.ObjectId,
      ref: "Role",
      required: true,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(obj, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
        delete ret.__v;
        delete ret.passwordResetExpires;
        delete ret.passwordResetToken;
        delete ret.active;
      },
    },
  }
);

//"save" --> This will work for both User.create() and user_instance.save()
userSchema.pre("save", async function (done) {
  if (this.isModified("password")) {
    const hashed = await Password.toHash(this.get("password"));
    this.set("password", hashed);
  }
  done();
});

//Added metod can be accessed by the instance
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model<IUser>("User", userSchema, "User");

export default User;
