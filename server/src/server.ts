import "dotenv/config";
import app from "./app";
import { prisma } from "./config/database";

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await prisma.$connect();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`ShopSphere API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed", error);
    process.exit(1);
  }
}

startServer();

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
