import { Router } from "express";
import { getTextAudio } from "../controllers/audioController";

const router = Router();

router.post("/", getTextAudio);

export default router;
