//NotificationController
import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import NotificationController from "../../controllers/notification.controller";

let notification = express.Router();

notification.use(Protect);
notification.use(IsAuthorize("Admin", "super-admin"));

notification.get("/", NotificationController.getAll);
notification.put("/:id", NotificationController.updateReadBy);

export default notification;
