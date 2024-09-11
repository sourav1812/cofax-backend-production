import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import AuditController from "../../controllers/reports/audit.controller";

let audit = express.Router();

audit.use(Protect);
audit.use(IsAuthorize("Admin", "super-admin"));

audit.route("/").get(AuditController.getAll).post(AuditController.getByDate);

export default audit;
