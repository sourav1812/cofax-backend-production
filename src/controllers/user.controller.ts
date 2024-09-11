import { MESSAGES, STATUS_CODE } from "../constant/status";
import { Request, Response } from "express";
import { BadRequest } from "../errors/bad-request";
import UserService from "../services/user.service";
import User from "../schema/user.schema";
import { NoteLookUp } from "../services/common.service";
import { Note } from "../schema/note.schema";
import { getCurrentYear } from "../utils/functions";
import { Password } from "../services/password.service";

const UserController = {
  add: async (req: Request, res: Response) => {
    const { note, ...rest } = req.body;

    if (req.body.role === "super-admin") {
      throw new BadRequest(MESSAGES.PERMISSION_DENIED, 403);
    }

    if (await UserService.isExist(rest.email)) {
      throw new BadRequest(MESSAGES.EMAIL_ALREADY_EXISTS);
    }

    let newNote: any;
    if (note) {
      newNote = await Note.create({ note, author: req?.currentUser!.id });

      if (!newNote._id) throw new BadRequest(MESSAGES.NOTE_ERROR);
    }

    const userCount = await User.countDocuments({});
    const username = `${rest.firstName}-${rest.lastName}-${
      userCount + 1
    }${getCurrentYear()}`;

    const user = await UserService.createNew({
      ...rest,
      username,
      notes: note ? newNote._id : undefined,
    });
    res.status(STATUS_CODE.CREATED).send({ user });
  },

  getUser: async (req: Request, res: Response) => {
    const user = await User.aggregate([
      { $match: { username: req.params.id } },
      {
        $lookup: {
          from: "Area",
          localField: "area",
          foreignField: "_id",
          as: "areaInfo",
        },
      },
      {
        $lookup: NoteLookUp,
      },
      {
        $lookup: {
          from: "Role",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },
      {
        $project: {
          username: 1,
          notes: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          phoneNumber: 1,
          "role.name": 1,
          "role._id": 1,
          area: 1,
          areaInfo: 1,
          // createdAt: 1,
          id: "$_id",
          _id: 0,
        },
      },
    ]).exec();
    res.status(STATUS_CODE.SUCCESS).send({ user });
  },

  myProfile: async (req: Request, res: Response) => {
    // await UserService.createNew(req.body);
  },

  getAllUser: async (req: Request, res: Response) => {
    let { page = 1, limit = 10, by = "", value = "" } = req.query;
    if (by === "all") value = "";

    limit = Number(limit);
    const startIndex = (Number(page) - 1) * limit;

    let match = {};
    if (by && value) {
      match = {
        ...match,
        [by as string]: { $regex: value, $options: "i" },
      };
    }

    const totalCount = await User.countDocuments(match);

    const users = await User.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: startIndex },
      { $limit: limit },
      {
        $lookup: {
          from: "Role",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      { $match: { "role.name": { $ne: "super-admin" } } },
      { $unwind: "$role" },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          username: 1,
          email: 1,
          role: "$role.name",
          active: 1,
          id: "$_id",
          _id: 0,
        },
      },
    ]).exec();

    res
      .status(STATUS_CODE.SUCCESS)
      .send({ users, pages: Math.ceil(totalCount / limit) });
  },

  update: async (req: Request, res: Response) => {
    try {
      const { note, ...rest } = req.body;

      // if (req.body.password) {
      //   throw new BadRequest(
      //     "This route is not for password updates. Please use /update-password.",
      //     STATUS_CODE.BAD_REQUEST
      //   );
      // }

      let newNotes: any;
      if (note) {
        newNotes = await Note.create({ note, author: req?.currentUser!.id });
        if (!newNotes._id) throw new BadRequest(MESSAGES.NOTE_ERROR);
      }

      const updateObject = note
        ? { $push: { notes: newNotes._id }, ...rest }
        : rest;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        {
          ...updateObject,
          ...(updateObject?.password && {
            password: await Password.toHash(updateObject?.password),
          }),
        },
        {
          new: true,
        }
      );

      res.status(STATUS_CODE.SUCCESS).send({ user });
    } catch (error: any) {
      throw new BadRequest(error.message ?? MESSAGES.USER_NOT_EXIST);
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      await User.findByIdAndDelete(req.params.id);
      res.status(STATUS_CODE.NO_CONTENT).send({});
    } catch (error) {
      throw new BadRequest(MESSAGES.USER_NOT_EXIST);
    }
  },

  getTechnician: async (req: Request, res: Response) => {
    try {
      const technicians = await User.aggregate([
        {
          $lookup: {
            from: "Role",
            localField: "role",
            foreignField: "_id",
            as: "role",
          },
        },
        {
          $unwind: "$role",
        },
        { $match: { "role.name": "technician" } },
        {
          $project: {
            username: 1,
            id: "$_id",
            _id: 0,
          },
        },
      ]);

      res.status(STATUS_CODE.SUCCESS).send({ technicians });
    } catch (error) {
      throw new BadRequest(MESSAGES.USER_NOT_EXIST);
    }
  },
};

export default UserController;
