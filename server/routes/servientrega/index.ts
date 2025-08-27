import express from "express";
import { productsRouter } from "./products.js";
import { shippingRouter } from "./shipping.js";
import { usersRouter } from "./users.js";
import { balancesRouter } from "./balances.js";
import { informesRouter } from "./informes.js";
import { anulacionesRouter } from "./anulaciones.js";

const router = express.Router();

// Montar las sub-rutas
router.use("/", productsRouter);
router.use("/", shippingRouter);
router.use("/", usersRouter);
router.use("/", balancesRouter);
router.use("/", informesRouter);
router.use("/", anulacionesRouter);

export default router;
