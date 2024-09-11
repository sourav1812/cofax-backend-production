import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import RoleController from "../../controllers/role.controller";

let role = express.Router();

role.use(Protect);
role.use(IsAuthorize("Admin", "super-admin"));

role.route("/").post(RoleController.create).get(RoleController.getAll);
role.route("/:id").put(RoleController.update).get(RoleController.get);
role.put("/status/:id", RoleController.updateStatus);

export default role;
