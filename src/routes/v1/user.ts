import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import UserController from "../../controllers/user.controller";

let users = express();

// Protect all routes after this middleware and only admin can access these APIs
users.use(Protect);
users.use(IsAuthorize("super-admin", "Admin"));

users.post("/", UserController.add);

users.get("/", UserController.getAllUser);
users.get("/technicians", UserController.getTechnician);
users.get("/:id", UserController.getUser);
users.put("/update/:id", UserController.update);
users.delete("/remove/:id", UserController.remove);

export default users;
