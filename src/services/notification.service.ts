import Notification from "../schema/notification.schema";

export const SendNotification = async (title: string, msg: string,link?: string) => {
  await Notification.create({ title: title ?? "Low Stock Warning", message: msg,link });
};
