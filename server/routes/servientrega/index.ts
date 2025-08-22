import express from "express";
import { productsRouter } from "./products.js";
import { shippingRouter } from "./shipping.js";
import { usersRouter } from "./users.js";
import { balancesRouter } from "./balances.js";

const router = express.Router();

// Montar las sub-rutas
router.use("/", productsRouter);
router.use("/", shippingRouter);
router.use("/", usersRouter);
router.use("/", balancesRouter);

export default router;