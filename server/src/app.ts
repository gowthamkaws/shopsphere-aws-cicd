import express from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./config/database";
import { authenticate, AuthRequest } from "./middleware/auth";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*"
  })
);
app.use(express.json());

// ---------------------------------------------------------------
// HEALTH CHECK (the load balancer calls this to see if we are alive)
// ---------------------------------------------------------------
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "healthy",
      database: "connected"
    });
  } catch {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected"
    });
  }
});

// ---------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({
        message: "Valid name, email and password (8+ characters) required"
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    // Never store the real password, only the hash
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch {
    res.status(500).json({ message: "Registration failed" });
  }
});

// ---------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET missing");
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      secret,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

// ---------------------------------------------------------------
// GET PRODUCTS (supports search: /api/products?search=lap)
// ---------------------------------------------------------------
app.get("/api/products", async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const products = await prisma.product.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { createdAt: "desc" }
    });

    res.json(products);
  } catch {
    res.status(500).json({ message: "Unable to fetch products" });
  }
});

// ---------------------------------------------------------------
// CREATE PRODUCT - ADMIN ONLY
// ---------------------------------------------------------------
app.post("/api/products", authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { name, description, price, stock, imageUrl } = req.body;

    if (
      !name ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0 ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0
    ) {
      return res.status(400).json({ message: "Invalid product data" });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: Number(price),
        stock: Number(stock),
        imageUrl
      }
    });

    res.status(201).json(product);
  } catch {
    res.status(500).json({ message: "Product creation failed" });
  }
});

// ---------------------------------------------------------------
// ADD TO CART
// ---------------------------------------------------------------
app.post("/api/cart", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const productId = Number(req.body.productId);
    const quantity = Number(req.body.quantity);

    if (
      !Number.isInteger(productId) ||
      productId < 1 ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({ message: "Invalid product or quantity" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || product.stock < quantity) {
      return res
        .status(400)
        .json({ message: "Product unavailable or insufficient stock" });
    }

    const cart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });

    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      }
    });

    const newQuantity = (existing?.quantity ?? 0) + quantity;

    if (newQuantity > product.stock) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity: newQuantity }
    });

    res.status(201).json({ message: "Added to cart" });
  } catch {
    res.status(500).json({ message: "Cart operation failed" });
  }
});

// ---------------------------------------------------------------
// VIEW CART
// ---------------------------------------------------------------
app.get("/api/cart", authenticate, async (req: AuthRequest, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user!.id },
      include: {
        items: { include: { product: true } }
      }
    });

    res.json(cart ?? { items: [] });
  } catch {
    res.status(500).json({ message: "Unable to retrieve cart" });
  }
});

// ---------------------------------------------------------------
// REMOVE CART ITEM
// ---------------------------------------------------------------
app.delete("/api/cart/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.id);

    // Make sure the item belongs to the logged-in user
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId: req.user!.id }
      }
    });

    if (!item) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    await prisma.cartItem.delete({
      where: { id: itemId }
    });

    res.json({ message: "Item removed" });
  } catch {
    res.status(500).json({ message: "Unable to remove item" });
  }
});

// ---------------------------------------------------------------
// CHECKOUT (create order from cart)
// ---------------------------------------------------------------
app.post("/api/orders", authenticate, async (req: AuthRequest, res) => {
  try {
    // Everything inside runs as ONE transaction: all succeed or all fail
    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId: req.user!.id },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty");
      }

      let total = 0;

      for (const item of cart.items) {
        if (item.product.stock < item.quantity) {
          throw new Error(`Insufficient stock: ${item.product.name}`);
        }

        total += Number(item.product.price) * item.quantity;
      }

      const createdOrder = await tx.order.create({
        data: {
          userId: req.user!.id,
          total,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price
            }))
          }
        },
        include: { items: true }
      });

      // Reduce stock only if enough stock is still there
      for (const item of cart.items) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity }
          },
          data: {
            stock: { decrement: item.quantity }
          }
        });

        if (updated.count !== 1) {
          throw new Error("Stock changed during checkout");
        }
      }

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id }
      });

      return createdOrder;
    });

    res.status(201).json({
      message: "Order placed successfully",
      order
    });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Checkout failed"
    });
  }
});

// ---------------------------------------------------------------
// CUSTOMER ORDER HISTORY
// ---------------------------------------------------------------
app.get("/api/orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(orders);
  } catch {
    res.status(500).json({ message: "Unable to fetch orders" });
  }
});

export default app;
