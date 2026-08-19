import { Router } from "express";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import {
  createLecture,
  getLectureById,
  updateLecture,
  deleteLecture,
  getAllLectures,
  updateImageLecureById,
  exportLecturesToJSON,
  importLecturesFromFile,
  updateImageLecture,
  generateTextStream,
  generateTopicStream,
  generateAudioForLecture,
} from "../controllers/LectureController";
import { createJsonUploadMiddleware } from "../middlewares/uploadMiddleware";

const router = Router();
router.param("id", validateObjectId);
router.param("idlecture", validateObjectId);

// AI Generation routes
router.post("/generate-text", aiLimiter, generateTextStream);
router.post("/generate-topic-stream", aiLimiter, generateTopicStream);
router.post("/generate-image/:idlecture", aiLimiter, updateImageLecture);
router.post("/:id/generate-audio", aiLimiter, generateAudioForLecture);

// Export/Import routes
router.get("/export-file", exportLecturesToJSON);
router.get("/", getAllLectures);
router.get("/:id", getLectureById);

router.post("/", createLecture);

router.put("/:id", updateLecture);
router.put("/image/:id", updateImageLecureById);

router.delete("/:id", deleteLecture);

router.post(
  "/import-file",
  ...createJsonUploadMiddleware(),
  importLecturesFromFile
);

export default router;
