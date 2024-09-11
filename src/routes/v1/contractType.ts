import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import ContractController from "../../controllers/contractType.controller";

let contract = express.Router();

// Protect all routes after this middleware
contract.get("/all", ContractController.getContracts);
contract.get("/", ContractController.getAll);
contract.get("/:id", ContractController.get);

contract.use(Protect);
contract.use(IsAuthorize("Admin", "super-admin"));

//TODO: forgot password, Reset password and update/delete profile
contract.post("/create", ContractController.create);
contract.put("/:id", ContractController.update);
contract.put("/status/:id", ContractController.updateStatus);

export default contract;
