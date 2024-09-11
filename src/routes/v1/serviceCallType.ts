import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import ServiceTypeController from "../../controllers/serviceCallType.controller";

let serviceType = express.Router();

serviceType.use(Protect);
serviceType.use(IsAuthorize("Admin", "super-admin"));

serviceType
  .route("/")
  .post(ServiceTypeController.create)
  .get(ServiceTypeController.getAll);
serviceType
  .route("/:id")
  .put(ServiceTypeController.update)
  .get(ServiceTypeController.get);
serviceType.put("/status/:id", ServiceTypeController.updateStatus);

export default serviceType;
