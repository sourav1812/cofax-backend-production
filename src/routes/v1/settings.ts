import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import SettingController from "../../controllers/setting.controller";

let setting = express.Router();

setting.use(Protect);
setting.use(IsAuthorize("Admin", "super-admin"));

setting
  .route("/setting")
  .post(SettingController.addNew)
  .get(SettingController.getAll);
setting
  .route("/setting/:id")
  .get(SettingController.getNotes)
  .put(SettingController.updateSettings);

export default setting;
