// db.server.ts

import { PrismaClient } from "@prisma/client";

// 👇 Extend the global type to add `prismaGlobal`
declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const prisma =
  process.env.NODE_ENV === "production"
    ? new PrismaClient()
    : global.prismaGlobal ?? (global.prismaGlobal = new PrismaClient());

export default prisma;
