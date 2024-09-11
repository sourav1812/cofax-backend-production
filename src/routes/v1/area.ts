import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import AreaController from "../../controllers/area.controller";

let area = express.Router();

area.use(Protect);
area.use(IsAuthorize("Admin", "super-admin"));

area.route("/").post(AreaController.create).get(AreaController.getAll);
area.route("/:id").put(AreaController.update).get(AreaController.get);
area.put("/status/:id", AreaController.updateStatus);

export default area;
