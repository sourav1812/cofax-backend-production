import express from "express";
const multer = require("multer");
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import ProposalController from "../../controllers/proposal.controller";

// Set up storage for uploaded files
type DestinationCallback = (error: Error | null, destination: string) => void;
type FileNameCallback = (error: Error | null, filename: string) => void;

const fileStorage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: DestinationCallback
  ): void => {
    cb(null, "public/data/proposals");
  },

  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: FileNameCallback
  ): void => {
    const fileName = Date.now() + "-" + file.originalname;
    cb(null, fileName);
  },
});

// This is used for memorystorage rather than writing file to filesystem
const fileStorageV2 = multer.memoryStorage();

const upload = multer({ storage: fileStorageV2 });

const proposal = express.Router();

// Protect all routes after this point
proposal.use(Protect);
proposal.use(IsAuthorize("Admin", "super-admin"));

proposal.get("/get-all", ProposalController.getAll);
proposal.post("/", upload.single("file"), ProposalController.create);

proposal
  .route("/:id")
  .get(ProposalController.get)
  .put(ProposalController.update)
  .delete(ProposalController.remove);

export default proposal;
