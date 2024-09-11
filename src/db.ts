import mongoose, { Connection } from "mongoose";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Create an interface to represent the Mongoose connection
interface IMongoDB {
  connection: Connection | null;
}

const db: IMongoDB = {
  connection: null,
};

export const connectDB = async () => {
  try {
    if (!process.env.MONGO_PROD) {
      throw new Error("MONGO_URL is missing");
    }

    const connection = await mongoose.connect(process.env.MONGO_PROD!);

    // Store the connection in the db object
    db.connection = connection.connection;
    console.log("Connected With: ", process.env.MONGO_PROD);
    console.log("MongoDB connected");
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err}`);
    process.exit(1); // Exit the application if the connection fails
  }
};

export default db;
