import mongoose from "mongoose";
import { Video } from "../models/video.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// Get channel stats (total views, subscribers, videos, likes)
const getChannelStats = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!mongoose.isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const totalVideos = await Video.countDocuments({ owner: channelId });

  // sum of views of all channel videos
  const totalViews = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(String(channelId)),
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$views" },
      },
    },
  ]);

  const totalSubscribers = await Subscription.countDocuments({
    channel: channelId,
  });
  const totalLikes = await Like.countDocuments({
    video: {
      $in: await Video.find({ owner: channelId }).distinct("_id"),
    },
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalVideos,
        totalViews: totalViews.length > 0 ? totalViews[0].total : 0,
        totalSubscribers,
        totalLikes,
      },
      "Channel stats fetched successfully"
    )
  );
});

// Get all videos uploaded by the channel
const getChannelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!mongoose.isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const videos = await Video.find({ owner: channelId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res
    .status(200)
    .json(new ApiResponse(200, videos, "Channel videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };