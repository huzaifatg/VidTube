import mongoose from "mongoose";
import { Comment } from "../models/comment.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// add a comment to a video
const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const videoId = req.params.videoId;
  const owner = req.user._id;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  if (!content?.trim()) {
    throw new ApiError(400, "Comment content cannot be empty");
  }

  const comment = await Comment.create({ content, video: videoId, owner });

  res
    .status(201)
    .json(new ApiResponse(201, comment, "Comment added successfully"));
});

//TODO: get all comments for a video
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const comments = await Comment.aggregatePaginate(
    Comment.aggregate([
      { $match: { video: new mongoose.Types.ObjectId(String(videoId)) } },
    ]),
    {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: "owner",
      select: "content owner createdAt",
    }
  );

  res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only update your own comments");
  }

  comment.content = content;
  await comment.save();

  res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only delete your own comments");
  }

  await Comment.findByIdAndDelete(commentId);

  res
    .status(200)
    .json(new ApiResponse(200, null, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };