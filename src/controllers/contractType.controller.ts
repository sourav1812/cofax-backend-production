import { STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import ContractType from "../schema/contractType.schema";

const ContractController = {
  get: async (req: Request, res: Response) => {
    const contract = await ContractType.findById(
      req.params.id,
      "name description"
    );
    res.status(STATUS_CODE.SUCCESS).send({ contract });
  },

  getContracts: async (req: Request, res: Response) => {
    const contracts = await ContractType.find({}, "name description isActive");
    res.status(STATUS_CODE.SUCCESS).send({ contracts });
  },

  getAll: async (req: Request, res: Response) => {
    const contracts = await ContractType.find({}, "name description isActive");
    res.status(STATUS_CODE.SUCCESS).send({ contracts });
  },

  create: async (req: Request, res: Response) => {
    const contractType = await ContractType.create(req.body);
    return res.status(STATUS_CODE.CREATED).send({ contract: contractType });
  },

  update: async (req: Request, res: Response) => {
    const contract = await ContractType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).select("name description");
    res.status(STATUS_CODE.SUCCESS).send({ contract });
  },

  updateStatus: async (req: Request, res: Response) => {
    await ContractType.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    );
    res.status(STATUS_CODE.SUCCESS).send({ message: "success" });
  },
};

export default ContractController;
