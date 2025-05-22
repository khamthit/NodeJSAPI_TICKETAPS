import cloudinary from "cloudinary";
import Jimp from "jimp";
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

const UploadImageToServer = async (files) => {
  try {
    const imgBuffer = Buffer.from(files, "base64");
    const imgName = "IMG_" + Date.now() + ".png";
    const imgPath = `${__dirname}/../../assets/images/${imgName}`;
    const pngBuffer = await sharp(imgBuffer).toBuffer();
    const image = await Jimp.read(pngBuffer);
    if (!image) {
      return "Error Covert files";
    }
    image.write(imgPath);
    return imgName;
  } catch (error) {
    console.log(error);
    return "";
  }
};
export { UploadImageToCloud,UploadImageToServer };
