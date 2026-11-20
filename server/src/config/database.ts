import { PrismaClient } from "@prisma/client";

// One shared connection object for the whole app
export const prisma = new PrismaClient({
  log: ["error"]
});
