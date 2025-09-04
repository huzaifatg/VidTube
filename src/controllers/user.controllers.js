import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
   try {
      const user = await User.findById(userId)
      //small check for existing user
      
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();
      
      user.refreshToken = refreshToken;
      await user.save({validateBeforeSave: false})
      return {accessToken, refreshToken}
   } catch (error) {
      throw new ApiError(500,"Failed to generate tokens")
   }
}

const registerUser = asyncHandler(async (req, res) => {
  const {fullname, email, username, password} = req.body

  //validation
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
){
    throw new ApiError(400, "All fields are required");
 }

 const existingUser = await User.findOne({
    $or: [{username}, {email}]
 })

 if (existingUser) {
    throw new ApiError(409, "User already exists");
 }

 console.warn(req.files)
 const avatarLocalPath = req.files?.avatar?.[0]?.path
 const coverLocalPath = req.files?.coverImage?.[0]?.path

 if(!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
 }

//  const avatar = await uploadOnCloudinary(avatarLocalPath)
//  let coverImage = ""
//  if (coverLocalPath) {
//     coverImage = await uploadOnCloudinary(coverLocalPath)
//  }

 let avatar;
 try {
    avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar) {
       throw new ApiError(500, "Failed to upload avatar. Check Cloudinary credentials and file path.");
    }
    console.log("Avatar uploaded successfully:", avatar);
 } catch (error) {
    console.log("Error uploading avatar", error)
    throw new ApiError(500, `Failed to upload avatar: ${error.message}`);
 }

   let coverImage;
 try {
    coverImage = await uploadOnCloudinary(coverLocalPath)
    if (coverLocalPath && !coverImage) {
       throw new ApiError(500, "Failed to upload cover image. Check Cloudinary credentials and file path.");
    }
    console.log("Cover Image uploaded successfully:", coverImage);
 } catch (error) {
    console.log("Error uploading Cover Image", error)
    throw new ApiError(500, `Failed to upload Cover Image: ${error.message}`);
 }

try {
    const user = await User.create({
       fullname,
       avatar: avatar.url,
       coverImage: coverImage?.url || "",
       email,
       password,
       username: username.toLowerCase()
    })
   
    const createdUser = await User.findById(user._id).select(
       "-password -refreshToken"
    )
   
    if(!createdUser) {
       throw new ApiError(500, "Something went wrong");
    }
   
   return res
      .status(201)
      .json(new ApiResponse(201, createdUser, "User registered successfully"))
} catch (error) {
   console.log("User creation failed")

   if(avatar){
      await deleteFromCloudinary(avatar.public_id)
   }
   if(coverImage){
      await deleteFromCloudinary(coverImage.public_id)
   }

   throw new ApiError(500, `Something went wrong while creating a user. All images were deleted. Error: ${error.message}`);
}
})

const loginUser = asyncHandler(async (req, res) => {
   // get data from body
   const {email, username, password} = req.body

   // validation
   if(!email){
      throw new ApiError(400, "Email is required")
   }

   const user = await User.findOne({
      $or: [{username}, {email}]
   })

   if (!user) {
      throw new ApiError(404, "User not found")
   }

   //validate password

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
      throw new ApiError(401, "Invalid password")
   }

   const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

   const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );

   const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
   }

   return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200,
         {user: loggedInUser, accessToken, refreshToken},
         "User logged in successfully"
      ))

})

const logoutUser = asyncHandler( async (req, res) => {
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken: undefined,
         }
      },
      {new: true}
   )

   const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
      }

      return res
         .status(200)
         .clearCookie("accessToken", options)
         .clearCookie("refreshToken", options)
         .json(new ApiResponse(200, {}, "User logged out successfully"));
})

const refreshAccessToken = asyncHandler (async (req, res) => {

   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

   if (!incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is required")
   }

   try {
      const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
      const user = await User.findById(decodedToken?._id)

      if (!user) {
         throw new ApiError(401, "Invalid refresh token")
      }

      if (incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh token expired")
      }

      const options = {
         httpOnly: true,
         secure: process.env.NODE_ENV === "production"
      }

      const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id)

      return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(new ApiResponse(
         200, {accessToken, refreshToken: newRefreshToken},
         "Access token refreshed successfully"
      ));

   } catch (error) {
      throw new ApiError(500, "Something went wrong while refreshing access token");
   }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {

   const {oldPassword, newPassword} = req.body

   const user = await User.findById(req.user?._id);

   if (!user) {
      throw new ApiError(404, "User not found");
   }

   const isPasswordValid = await user.isPasswordCorrect(oldPassword);

   if (!isPasswordValid) {
      throw new ApiError(401, "Old password is incorrect");
   }

   user.password = newPassword;
   await user.save({ validateBeforeSave: false });

   return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
})

const getCurrentUser = asyncHandler(async (req, res) => {

   return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"));
})

const updateAccountDetails = asyncHandler(async (req, res) => {
   console.log("DEBUG updateAccountDetails req.body:", req.body);

   if (!req.body || Object.keys(req.body).length === 0) {
      throw new ApiError(400, "Request body is empty. Make sure to send JSON.");
   }

   const { fullname, email } = req.body;

   if (!fullname?.trim()) {
      throw new ApiError(400, "Fullname is required");
   }

   if (!email?.trim()) {
      throw new ApiError(400, "Email is required");
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: { fullname, email } },
      { new: true }
   ).select("-password -refreshToken");

   if (!user) {
      throw new ApiError(404, "User not found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {

   const avatarLocalPath = req.file?.path

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar image is required");
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);

   if (!avatar.url) {
      throw new ApiError(500, "Failed to upload avatar image");
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {avatar: avatar.url}
      },
      {new: true}
   ).select("-password -refreshToken");

   return res.status(200).json(new ApiResponse(200, user, "User avatar updated successfully"));
})

const updateUserCoverImage = asyncHandler(async (req, res) => {

   const coverImageLocalPath = req.file?.path

   if (!coverImageLocalPath) {
      throw new ApiError(400, "Cover image is required");
   }

   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if (!coverImage.url) {
      throw new ApiError(500, "Failed to upload cover image");
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {coverImage: coverImage.url}
      },
      {new: true}
   ).select("-password -refreshToken").lean();

   return res.status(200).json(new ApiResponse(200, user, "User Cover Image updated successfully"));
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
   const {username} = req.params

   if (!username?.trim()) {
      throw new ApiError(400, "Username is required");
   }

   const channel = await User.aggregate(
      [
         {
            $match: {
               username: username?.toLowerCase()
            }
         },
         {
            $lookup: {
               from: "subscriptions",
               localField: "_id",
               foreignField: "channel",
               as: "subscribers"
            }
         },
         {
            $lookup: {
               from: "subscriptions",
               localField: "_id",
               foreignField: "subscriber",
               as: "subscribedTo"
            }
         },
         {
            $addFields: {
               subscribersCount: { $size: "$subscribers" },
               subscribedToCount: { $size: "$subscribedTo" },
               isSubscribed: {$cond: {
                  if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                  then: true,
                  else: false
               }
              }
            }
         },
         {
            // Project only the necessary data
            $project: {
               fullname: 1,
               username: 1,
               avatar: 1,
               subscribersCount: 1,
               subscribedToCount: 1,
               isSubscribed: 1,
               coverImage: 1,
               email: 1
            }
         }
      ]
   )

   if (!channel?.length){
      throw new ApiError(404, "Channel not found");
   }

   return res.status(200).json(new ApiResponse(200, channel[0], "Channel Profile fetched successfully"))
})

const getWatchHistory = asyncHandler(async (req, res) => {

   const user = await User.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(req.user?._id)
         }
      },
      {
         $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline: [
               {
                  $lookup: {
                     from: "users",
                     localField: "owner",
                     foreignField: "_id",
                     as: "owner",
                     pipeline: [
                        {
                           $project: {
                              fullname: 1,
                              username: 1,
                              avatar: 1
                           }
                        }
                     ]
                  }
               },
               {
                  $addFields: {
                     owner: {
                        $first: "$owner"
                     }
                  }
               }
            ]
         }
      }
   ])

   return res.status(200).json(new ApiResponse(200, user[0]?.watchHistory, "Watch history fetched successfully"));
})

export {registerUser, loginUser, refreshAccessToken, logoutUser, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory};