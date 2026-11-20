import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { name: "Laptop", description: "Professional laptop", price: 55000, stock: 20, imageUrl: "https://placehold.co/400x300?text=Laptop" },
  { name: "Wireless Mouse", description: "Wireless optical mouse", price: 799, stock: 100, imageUrl: "https://placehold.co/400x300?text=Mouse" },
  { name: "Keyboard", description: "Mechanical keyboard", price: 2499, stock: 50, imageUrl: "https://placehold.co/400x300?text=Keyboard" },
  { name: "Headphones", description: "Bluetooth headphones", price: 3999, stock: 30, imageUrl: "https://placehold.co/400x300?text=Headphones" }
];

async function main() {
  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name }
    });

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: product });
    } else {
      await prisma.product.create({ data: product });
    }
  }

  console.log("Products seeded with images");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
