import express from "express";
import auth from "./auth";
import users from "./user";
import inventory from "./inventory";
import category from "./category";
import asset from "./asset";
import customer from "./customer";
import contract from "./contractType";
import ConstantController from "../../controllers/common.controller";
import service from "./serviceCall";
import proposal from "./proposal";
import techStock from "./techStock";
import notification from "./notification";
import InventoryController from "../../controllers/inventory.controller";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import company from "./company";
import area from "./area";
import role from "./role";
import serviceType from "./serviceCallType";
import vendor from "./vendor";
import setting from "./settings";
import meterReading from "./meterReadings";
import invoice from "./invoices";
import tax from "./tax";
import ServiceInvoiceController from "../../controllers/Invoices/services.controller";
import mps from "./mps";
import audit from "./audit";
import dashboard from "./dashboard";
import DashboardController from "../../controllers/dashboard.controller";
// import { bulkCreateCustomerInQuickbook } from "../../services/common.service";
import quickbook from "./quickbook";
import { deleteAllCollection } from "../../services/common.service";

const routes = express();

routes.use("/auth", auth);
routes.use("/user", users);

routes.use("/dashboard", dashboard);

routes.use("/inventory", inventory);
routes.use("/asset", asset);
routes.use("/technician-stock", techStock);

routes.use("/area", area);

routes.use("/proposal", proposal);
routes.use("/service-call", service);

routes.use("/notification", notification);

routes.use("/category", category);

routes.use("/customer", customer);
routes.use("/contract", contract);

// routes.use("/delete-all-collections", async (req, res) => {
//   try {
//     await deleteAllCollection();
//     res.status(200).send({});
//   } catch (error) {
//     console.log(error);
//   }
// });

routes.use("/company", company);
routes.use("/role", role);
routes.use("/service-call-type", serviceType);

routes.use("/vendor", vendor);

routes.use("/meter-reading", meterReading);
routes.use("/invoice", invoice);

routes.use("/audit", audit);

routes.use("/tax", tax);
routes.use("/mps", mps);

routes.get("/view/invoice-sample", ServiceInvoiceController.viewPage);

routes.use("/constants", ConstantController.getConstants);
routes.use("/update-docs", ConstantController.updateDoc);

routes.use("/test-function", ConstantController.testApi);
// routes.use("/cofax/import", importCofaxData);
// routes.use("/norcom/import", xlsxToJson);
// routes.use("/cofax-address-update", updateCofaxCustomersAddress);
// // routes.use("/norcom-address-update", updateNorcomCustomersAddress);
// routes.use("/customer-create-quickbook", bulkCreateCustomerInQuickbook);

routes.use("/search-suggestions", DashboardController.search);

routes.use("/", setting);

routes.use(Protect);
routes.use(IsAuthorize("Admin", "super-admin"));

routes.use("/items", InventoryController.getAllItems);
routes.use("/quickbook", quickbook);

export default routes;
