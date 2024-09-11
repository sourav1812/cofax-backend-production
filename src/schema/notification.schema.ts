import mongoose, { Schema, Types } from "mongoose";

export interface INotification {
  title: string;
  message: string;
  link: string;
  readBy: Types.ObjectId[];
}

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: String,
    readBy: [
      {
        type: Schema.ObjectId,
        ref: "User",
      },
    ],
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

const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema,
  "Notification"
);

export default Notification;
