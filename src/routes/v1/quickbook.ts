import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import QuickBookController from "../../controllers/quickbook.controller";
import { bulkSyncCustomerWithQuickBook } from "../../services/quickbook.service";

let quickbook = express.Router();

quickbook.use(Protect);
quickbook.use(IsAuthorize("Admin", "super-admin"));

quickbook.get("/", QuickBookController.get);
quickbook.put("/:id", QuickBookController.update);
quickbook.get("/oauth/callback", QuickBookController.callback);
quickbook.get("/oauth/:id", QuickBookController.getAuthorizeCode);
// quickbook.get('/create', QuickBookController.addQuickbookAccount)
quickbook.get("/bulk-upload", bulkSyncCustomerWithQuickBook);

export default quickbook;
