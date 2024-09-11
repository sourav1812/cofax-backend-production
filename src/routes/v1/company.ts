import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import CompanyController from "../../controllers/company.controller";

let company = express.Router();

company.use(Protect);
company.use(IsAuthorize("Admin", "super-admin"));

company.route("/").post(CompanyController.create).get(CompanyController.getAll);
company.route("/:id").put(CompanyController.update).get(CompanyController.get);

export default company;
