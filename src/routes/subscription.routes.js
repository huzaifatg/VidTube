import { Router } from "express";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/c").get(getSubscribedChannels);
router.route("/c/:channelId").post(toggleSubscription);
router.route("/u/:channelId").get(getUserChannelSubscribers);

export default router;