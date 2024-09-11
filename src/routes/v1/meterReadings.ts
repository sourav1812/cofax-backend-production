import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import MeterReadingController from "../../controllers/meterReading";

let meterReading = express.Router();

meterReading.use(Protect);
meterReading.use(IsAuthorize("Admin", "super-admin"));

meterReading
  .route("/")
  .post(MeterReadingController.create)
  .get(MeterReadingController.getAll);

meterReading
  .route("/:id")
  .put(MeterReadingController.update)
  .get(MeterReadingController.get)
  .delete(MeterReadingController.remove);

meterReading.put("/status/:id", MeterReadingController.updateStatus);

export default meterReading;
