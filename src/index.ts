import dotenv from "dotenv";
dotenv.config();

import express, { Express } from "express";
import cors from "cors";
import productCreatorRoutes from "./routes/creator";
import shippingInfoRoutes from "./routes/shipping";
import { errorHandler } from "./middleware/errorHandler";
import { ACTIONS_CORS_HEADERS_MIDDLEWARE } from "@solana/actions";

const app: Express = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(cors(ACTIONS_CORS_HEADERS_MIDDLEWARE));

app.get("/", (req, res) => {
  res.send("Welcome to ClickCrate Actions API!");
});

app.use("/creator", productCreatorRoutes);
app.use("/shipping", shippingInfoRoutes);

app.use(errorHandler);

const startServer = () => {
  app.listen(port, () => console.log(`Server started on port ${port}`));
};

startServer();
