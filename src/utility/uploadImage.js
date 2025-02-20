

import https from 'https';
import {config} from '../config/index.js';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export const uploadTrackingImage = async (email) => {
  const uniqueId = uuidv4();

  try {
    const filePath = "./stir.jpg";
    const imageUrl = await uploadImageToBunny(filePath, uniqueId);

    // emailTracking[uniqueId] = {
    //   email,
    //   sentAt: new Date().toISOString(),
    //   lastOpened: null,
    //   openCount: 0,
    //   imageUrl,
    //   opens: [],
    //   accessStats: [],
    // };

    // saveTrackingData();
console.log({imageUrl})
    return { imageUrl, trackingId: uniqueId };
  } catch (error) {
    console.error("Error uploading tracking image:", error);
    throw error;
  }
};

export const uploadImageToBunny = async (filePath, uniqueId) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);
    const fileName = `${uniqueId}.jpeg`;

    const options = {
      method: "PUT",
      hostname: "storage.bunnycdn.com",
      path: `/${process.env.STORAGE_ZONE_NAME}/${fileName}`,
      headers: {
        AccessKey: process.env.STORAGE_ACCESS_KEY,
        "Content-Type": "image/jpeg",
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 201 || res.statusCode === 200) {
        const imageUrl = `https://${config.PULL_ZONE_URL}/${fileName}`;
        console.log("✅ Image uploaded successfully:", imageUrl);
        resolve(imageUrl);
      } else {
        reject(new Error(`Upload failed with status ${res.statusCode}`));
      }
    });

    req.on("error", reject);
    readStream.pipe(req);
  });
};