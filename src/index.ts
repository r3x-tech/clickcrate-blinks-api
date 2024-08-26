import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import productCreatorRoutes from "./routes/creator";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use("/api/creator", productCreatorRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
