import { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = "createdAt" } = req.query;
  const { sortType = "desc", userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  // example input: page=2 limit=5 query=tech sortBy=views sortType=desc
  // means 2nd page with 5 videos sorted by views in descending order
  const filter = {};

  // filter videos with query in title or description
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }
  // ensure it belongs to the given user
  if (userId) {
    filter.owner = userId;
  }

  const videos = await Video.find(filter)
    .sort({ [sortBy]: sortType === "asc" ? 1 : -1 })
    .skip((page - 1) * limit) // skip first 5 videos
    .limit(Number(limit))
    .populate("owner", "username profile");

  res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {

  console.log("Files received:", req.files);
  console.log("Body received:", req.body);

  const { title, description } = req.body;
  const file = req.files?.file?.[0];
  const thumbnail = req.files?.thumbnail?.[0];
  if (!file || !thumbnail) {
    throw new ApiError(400, "Video file and thumbnail are required");
  }

  let videoUpload, thumbnailUpload;
  try {
    videoUpload = await uploadOnCloudinary(file?.path);
    thumbnailUpload = await uploadOnCloudinary(thumbnail?.path);
  } catch (error) {
    throw new ApiError(500, "Error uploading files to Cloudinary");
  }

  if (!videoUpload?.secure_url || !thumbnailUpload?.secure_url) {
    throw new ApiError(500, "Failed to upload video or thumbnail to Cloudinary");
  }

  const video = await Video.create({
    title,
    description,
    videoFile: videoUpload.secure_url,
    thumbnail: thumbnailUpload.secure_url,
    duration: videoUpload.duration, // Cloudinary includes this for videos
    owner: req.user._id,
  });

  res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId).populate("owner", "username");
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

// update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const thumbnail = req.file;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (title) video.title = title;
  if (description) video.description = description;
  if (thumbnail) video.thumbnail = thumbnail;
  await video.save();
  console.log(video);

  const updatedVideo = await Video.findById(videoId);

  res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findByIdAndDelete(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  video.isPublished = !video.isPublished; //toggle
  await video.save();
  res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video publish status toggled successfully")
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};