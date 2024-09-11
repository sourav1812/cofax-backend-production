import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import ServiceInvoiceController from "../../controllers/Invoices/services.controller";
import PurchaseOrderController from "../../controllers/Invoices/purchaseOrder.controller";
import SalesController from "../../controllers/Invoices/sale.controller";

const invoice = express.Router();

invoice.use(Protect);
invoice.use(IsAuthorize("Admin", "super-admin"));

// -------------------------------------------------------------- SERVICES;
invoice.post(
  "/service/generate-bill-customer/:customerId",
  ServiceInvoiceController.generateInvoiceForCustomer
);

invoice
  .route("/service")
  .get(ServiceInvoiceController.getAll)
  .post(ServiceInvoiceController.create);

invoice.post(
  "/service/generate-bills",
  ServiceInvoiceController.generateBillsV2
);
invoice.get("/meter/:id", ServiceInvoiceController.getByMeter);
invoice.post(
  "/service/send-mail",
  ServiceInvoiceController.sendInvoiceToCustomer
);
invoice.post("/service/print-all", ServiceInvoiceController.printAllInvoices);

invoice
  .route("/service/:id")
  .get(ServiceInvoiceController.get)
  .put(ServiceInvoiceController.update)
  .patch(ServiceInvoiceController.update)
  .delete(ServiceInvoiceController.remove);

invoice.put("/service/status/:id", ServiceInvoiceController.updateStatus);

invoice.get(
  "/service/norcom/post-to-quickbook",
  ServiceInvoiceController.postInvoiceToQuickBook
);

invoice.get(
  "/service/sync-quickbooks/status",
  ServiceInvoiceController.syncQuickBookInvoiceWithLocal
);

// -------------------------------------------------------------- SALES;
// Note: On frontend we have changed naming from sales to purchase order and purchase order, previous purchase order to custom invoice.
invoice.route("/sale").get(SalesController.getAll).post(SalesController.create);

invoice.post("/sale/send-mail", SalesController.sendInvoiceToCustomer);

invoice
  .route("/sale/:id")
  .get(SalesController.getInvoiceData)
  .put(SalesController.update)
  .delete(SalesController.remove);

invoice.get("/min/sale/:id", SalesController.get);
invoice.get("/sales-persons", SalesController.getSalesPersons);

invoice.put("/sale/status/:id", SalesController.updateStatus);

// -------------------------------------------------------------- PURCHASE ORDER;
invoice
  .route("/purchase-order")
  .get(PurchaseOrderController.getAll)
  .post(PurchaseOrderController.create);

invoice.post(
  "/purchase-order/send-mail",
  PurchaseOrderController.sendInvoiceToCustomer
);

invoice
  .route("/purchase-order/:id")
  .get(PurchaseOrderController.get)
  .put(PurchaseOrderController.update)
  .delete(PurchaseOrderController.remove);

invoice.get("/min/purchase-order/:id", PurchaseOrderController.getMinial);

invoice.put("/purchase-order/status/:id", PurchaseOrderController.updateStatus);

export default invoice;
