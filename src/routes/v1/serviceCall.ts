import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import ServiceCallController from "../../controllers/serviceCall.controller";

let service = express.Router();

// Protect all routes after this point
service.use(Protect);
service.use(IsAuthorize("Admin", "super-admin"));

service.route("/uncompleted").get(ServiceCallController.getPendingBills);

service
  .route("/")
  .get(ServiceCallController.getAll)
  .post(ServiceCallController.onServiceCreated);

service
  .route("/:id")
  .get(ServiceCallController.get)
  .put(ServiceCallController.onServiceUpdate)
  .delete(ServiceCallController.deleteSC);

service.route("/status/:id").put(ServiceCallController.onServiceStatusUpdate);
service.route("/ticket/:id").get(ServiceCallController.onServiceCallTicket);
service
  .route("/send-to-technician")
  .post(ServiceCallController.sendInvoiceToTechnician);

export default service;
