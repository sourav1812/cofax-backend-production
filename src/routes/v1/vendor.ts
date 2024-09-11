import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import vendorController from "../../controllers/vendor.controller";

let vendor = express.Router();

vendor.use(Protect);
vendor.use(IsAuthorize("Admin", "super-admin"));

vendor.route("/").post(vendorController.create).get(vendorController.getAll);
vendor.route("/:id").put(vendorController.update).get(vendorController.get);
vendor.put("/status/:id", vendorController.updateStatus);

export default vendor;
