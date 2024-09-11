import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import TechnicianStockController from "../../controllers/techStock.controller";

let techStock = express.Router();

techStock.use(Protect);
techStock.use(IsAuthorize("Admin", "super-admin"));

techStock
  .route("/")
  .get(TechnicianStockController.getAll)
  .post(TechnicianStockController.create);

techStock
  .route("/:id")
  .get(TechnicianStockController.get)
  .put(TechnicianStockController.update);

export default techStock;
