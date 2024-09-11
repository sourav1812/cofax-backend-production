import express from "express";
import { Protect } from "../../middlewares/authenticate.middleware";
import { IsAuthorize } from "../../middlewares/authorize.middleware";
import AssetController from "../../controllers/asset.controller";
import { validateAsset } from "../../utils/bodyValidators/asset";

let asset = express.Router();

// Protect all routes after this point
asset.use(Protect);
asset.use(IsAuthorize("Admin", "super-admin"));

asset.get("/get-all-asset", AssetController.getAll);
asset.post("/", validateAsset, AssetController.create);

asset.route("/:id").get(AssetController.get).put(AssetController.update);

asset.get("/search/suggestions", AssetController.searchSuggestions);

asset.get("/report/:id/:type", AssetController.getSyncReport);

asset.post("/mps-sync", AssetController.getMpsSync);

asset.delete("/:id", AssetController.deleteAssetById);

export default asset;
