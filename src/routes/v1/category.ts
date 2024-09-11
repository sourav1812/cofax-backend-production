import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import CategoryController from "../../controllers/category.controller";

let category = express.Router();

// Protect all routes after this middleware
category.get("/all", CategoryController.getAll);
category.get("/:id", CategoryController.get);

category.use(Protect);
category.use(IsAuthorize("Admin", "super-admin"));

//TODO: forgot password, Reset password and update/delete profile
category.post("/create", CategoryController.create);
category.put("/:id", CategoryController.update);

export default category;
