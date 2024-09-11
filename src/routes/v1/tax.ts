import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import TaxController from "../../controllers/Invoices/tax.controller";

let tax = express.Router();

tax.use(Protect);
tax.use(IsAuthorize("super-admin"));

tax.route("/").post(TaxController.create).get(TaxController.get);
tax.route("/:id").put(TaxController.update);

export default tax;
