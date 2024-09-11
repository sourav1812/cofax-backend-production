import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import MPS from "../../controllers/mps.controller";

let mps = express.Router();

mps.use(Protect);
mps.use(IsAuthorize("Admin", "super-admin"));

mps.get("/", MPS.get);
mps.put("/:id", MPS.update);

export default mps;
