import express from "express";
import "express-async-errors";
import cookieSession from "cookie-session";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import routes from "./routes/v1/routes";
import { connectDB } from "./db";
import { NotFound } from "./errors/not-found";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
// import cron from "node-cron";
// import { processQueue } from "./utils/background/processQueue";

dotenv.config();

// db connection
connectDB();
const PORT = process.env.PORT || 4000;
const JWT_COOKIE_EXPIRES_IN = Number(process.env.JWT_COOKIE_EXPIRES_IN);

const app = express();

//To run on ngrok
app.enable("trust proxy");
app.set("view engine", "ejs");
app.use("/public", express.static("public"));
app.set("trust proxy", 1);

app.use(helmet());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});

app.use(limiter);

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://cofax.geeky.dev",
      "http://99.79.182.68",
      "https://portal.cofax.ca",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(morgan("tiny"));
app.use(
  cookieSession({
    signed: false,
    secure: false,
    // sameSite: "none",
    maxAge: JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
  })
);

// root route
app.use(routes);

app.all("*", () => {
  throw new NotFound();
});

app.use(errorHandler);

// listen on default port
app.listen(String(PORT), () => {
  // cron.schedule("*/1 * * * *", async () => {
  //   console.log("Cron running");
  //   await processQueue();
  // });
  return console.log(`Express is listening at http://localhost:${PORT}`);
});
