import { Router } from "express";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import {
  createDictionaryWord,
  deleteDictionaryWord,
  draftDictionaryWord,
  getDictionaryWord,
  hideDictionaryWord,
  listDictionary,
  updateDictionaryWord,
} from "../controllers/dictionaryController";

const router = Router();
router.param("id", validateObjectId);

router.get("/", listDictionary);
router.post("/", createDictionaryWord);
router.post("/draft", aiLimiter, draftDictionaryWord);
router.get("/:id", getDictionaryWord);
router.put("/:id", updateDictionaryWord);
router.put("/:id/hidden", hideDictionaryWord);
router.delete("/:id", deleteDictionaryWord);

export default router;
