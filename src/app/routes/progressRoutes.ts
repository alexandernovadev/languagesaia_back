import { Router } from "express";
import { getOverview, getProgress } from "../controllers/progressController";

const router = Router();

router.get("/", getProgress);
router.get("/overview", getOverview);

export default router;
