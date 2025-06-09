import cloudinary from "cloudinary";
// import * as Jimp from 'jimp';
import fs from "fs"; // Ensure fs is imported
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
cloudinary.config({
  cloud_name: "dvp8eh8cx",
  api_key: "228474629168451",
  api_secret: "lyrfSk_zQzgieYsan4xLTQEkjlQ", // Click 'View API Keys' above to copy your API secret
});

const UploadImageToCloud = async (files, oldImage) => {
  try {
    if (oldImage) {
      const splitUrl = oldImage.split("/");
      const image_id = splitUrl[splitUrl.length - 1].split(".")[0];
      await cloudinary.v2.uploader.destroy(image_id);
    }
    const base64 = files.toString("base64");
    const imagePath = "data:image/png;base64," + base64;
    const url = await cloudinary.v2.uploader.upload(imagePath, {
      public_id: "IMG_" + Date.now(),
      resource_type: "auto",
    });
    return url.url;
  } catch (error) {
    console.log(error);
    return "";
  }
};

/**
 * Saves an uploaded file (image, PDF, Excel, etc.) to a local server directory.
 * @param {object} fileObject - The file object from req.files (e.g., req.files.fileattach).
 *                               Expected to have `data` (Buffer), `name` (string),
 *                               and optionally `mimetype` (string).
 * @returns {string} The name of the saved file, or an empty string on error.
 */
const UploadImageToServer = async (fileObject) => {
  try {
    if (!fileObject || !fileObject.data || !fileObject.name) {
      console.error("Invalid file object received in UploadImageToServer.");
      return "";
    }

    const fileBuffer = fileObject.data; // The raw file buffer
    const originalName = fileObject.name;
    const fileExtension = path.extname(originalName).toLowerCase();

    // Generate a unique filename to prevent overwrites and use original extension
    const uniqueFileName = `FILE_${Date.now()}${fileExtension}`;

    // Use a more generic upload directory
    const uploadDir = path.join(__dirname, '..', '..', 'assets', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, uniqueFileName);

    const mimetype = fileObject.mimetype ? fileObject.mimetype.toLowerCase() : '';

    if (mimetype.startsWith('image/')) {
      // For images, use sharp to process and save.
      // This can also help ensure the image is valid and optimize it.
      await sharp(fileBuffer).toFile(filePath);
      console.log(`Image processed and saved: ${filePath}`);
    } else if (
      mimetype === 'application/pdf' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
      mimetype === 'application/vnd.ms-excel' || // .xls
      fileExtension === '.pdf' || fileExtension === '.xlsx' || fileExtension === '.xls'
    ) {
      // For PDF and Excel, write the buffer directly
      fs.writeFileSync(filePath, fileBuffer);
      console.log(`Document saved: ${filePath}`);
    } else {
      // For other/unknown file types, save the raw buffer.
      // Consider security implications for unknown executable types if served directly.
      console.warn(`Unknown or unhandled file type: ${originalName} (MIME: ${mimetype}). Saving raw.`);
      fs.writeFileSync(filePath, fileBuffer);
      console.log(`Raw file saved: ${filePath}`);
    }
    return uniqueFileName; // Return just the filename
  } catch (error) {
    console.error("Error in UploadImageToServer:", error);
    return "";
  }
};

export { UploadImageToCloud, UploadImageToServer };
