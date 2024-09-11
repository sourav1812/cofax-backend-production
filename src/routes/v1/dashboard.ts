import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import DashboardController from "../../controllers/dashboard.controller";

let dashboard = express.Router();

// Protect all routes after this point
dashboard.use(Protect);
dashboard.use(IsAuthorize("Admin", "super-admin"));

dashboard.get("/", DashboardController.get);

export default dashboard;
