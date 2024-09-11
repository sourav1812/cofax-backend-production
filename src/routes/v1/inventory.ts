import express, { Router } from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import InventoryController from "../../controllers/inventory.controller";
import { IsAuthorize } from "../../middlewares/authorize.middleware";

let inventory = express.Router();

// Protect all routes after this point
inventory.use(Protect);
inventory.use(IsAuthorize("Admin", "super-admin"));

inventory.get("/get-all-items", InventoryController.getAll);
inventory.post("/create-item", InventoryController.create);

inventory
  .route("/item/:id")
  .get(InventoryController.get)
  .put(InventoryController.update)
  .delete(InventoryController.deleteItem);

inventory.get("/search/suggestions", InventoryController.searchSuggestions);

inventory.get("/search/local/suggestions", InventoryController.searchLocalSuggestions);
// inventory.get("/import-items", InventoryController.importItems);

export default inventory;
