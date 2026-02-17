// routes/reviewRoutes.js
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    createReview,
    getReview,
} from "../controllers/reviewController.js";

const router = express.Router();


// POST /api/reviews - Creates reivew
router.post("/", verifyToken, createReview);

// GET /api/reviews - Get and list review
router.get("/", verifyToken, getReview);


export default router;