import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import customerController from "../../controllers/customer.controller";

let customer = express.Router();

// Protect all routes after this point
customer.use(Protect);
customer.use(IsAuthorize("Admin", "super-admin"));

customer.post("/", customerController.create);
customer.get("/get-all-customer", customerController.getAll);
customer.get("/suggestions", customerController.searchSuggestions);
customer.get("/get-customer-by-name", customerController.getCustomerByName);
customer.get("/assets", customerController.fetchAssets);

customer.get("/cool-down", customerController.fetchCoolDownTimer);
customer.get("/mps-customers", customerController.getMpsCustomer);
customer.get("/sync-customers", customerController.syncCustomers);
customer.get("/reports/:id", customerController.getSyncReport);

customer.get("/post-to-quickbook", customerController.postAllQuickbook);
customer.post("/update-to-quickbook/:id", customerController.updateQuickbook);

customer
  .route("/:id")
  .get(customerController.get)
  .put(customerController.update);

export default customer;
