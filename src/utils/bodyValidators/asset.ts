import { check, validationResult } from "express-validator";

const validateAsset = [
  check("model").trim().notEmpty().withMessage("Model is required"),
  check("assetNumber")
    .trim()
    .notEmpty()
    .withMessage("Asset number is required"),
  check("username").trim().notEmpty().withMessage("Username is required"),
  check("locationAddress")
    .trim()
    .notEmpty()
    .withMessage("Location address is required"),
  check("monoBegin").isNumeric().withMessage("Mono Begin must be a number"),
  check("colorBegin").isNumeric().withMessage("Color Begin must be a number"),
  check("coveredMono").isNumeric().withMessage("Covered Mono must be a number"),
  check("coveredColor")
    .isNumeric()
    .withMessage("Covered Color must be a number"),
  check("monoPrice").isNumeric().withMessage("Mono Price must be a number"),
  check("colorPrice").isNumeric().withMessage("Color Price must be a number"),
  check("contractAmount")
    .isNumeric()
    .withMessage("Contract Amount must be a number"),
  check("baseAdj").isNumeric().withMessage("Base Adjustment must be a number"),
  check("startDate")
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  check("endDate")
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  check("equipContact")
    .trim()
    .notEmpty()
    .withMessage("Equipment contact is required"),
  check("contractType")
    .trim()
    .notEmpty()
    .withMessage("Contract type is required"),
  check("serialNo").trim().notEmpty().withMessage("Serial number is required"),
  check("rentalCharge")
    .isNumeric()
    .withMessage("Rental Charge must be a number"),
  check("note").trim().optional({ checkFalsy: true }),
  check("itemName").trim().notEmpty().withMessage("Item name is required"),
  check("partId").trim().notEmpty().withMessage("Part ID is required"),
  check("itemId").trim().notEmpty().withMessage("Item ID is required"),
  check("customerId").trim().notEmpty().withMessage("Customer ID is required"),

  (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

export { validateAsset };
