import {v2 as cloudinary} from "cloudinary";
import { log } from "console";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

//configure cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath, {resource_type: "auto"})
        console.log("Uploaded to Cloudinary, File src: " +  response.url)
        // once uploaded to cloudinary, delete from localstorage
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        console.log("Error on Cloudinary: ", error)
        // Clean up all files in temp folder if upload fails
        const tempDir = './public/temp';
        fs.readdir(tempDir, (err, files) => {
            if (!err) {
                for (const file of files) {
                    fs.unlink(path.join(tempDir, file), () => {});
                }
            }
        });
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null
    }
}

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId)
        console.log("Deleted from Cloudinary")
    } catch (error) {
        console.log("Error deleting from Cloudinary: ", error)
        return null
    }
}

export {uploadOnCloudinary, deleteFromCloudinary}