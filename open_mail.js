const express = require("express");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
app.use(express.json());
const PORT = 3000;

// BunnyCDN configuration
const REGION = "";
const BASE_HOSTNAME = "storage.bunnycdn.com";
const HOSTNAME = REGION ? `${REGION}.${BASE_HOSTNAME}` : BASE_HOSTNAME;
const STORAGE_ZONE_NAME = "email-automation";
const ACCESS_KEY =
  "7c835bd0-333a-44b3-af05-fa57d0edc06a83270720-7110-4d92-81ab-ccc0bc1c5e80";

// // Nodemailer configuration
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// // Tracking data storage
// const TRACKING_FILE = "email_tracking.json";

// // Load tracking data
// let trackingData = {};
// if (fs.existsSync(TRACKING_FILE)) {
//   trackingData = JSON.parse(fs.readFileSync(TRACKING_FILE));
// }

// // Save tracking data
// const saveTrackingData = () => {
//   fs.writeFileSync(TRACKING_FILE, JSON.stringify(trackingData, null, 2));
// };
// ;

// const fs = require('fs').promises; // Import the promises version of fs
// OR const { readFile } = require('fs').promises;

async function uploadToBunnyCDN(localFilePath, remoteFilePath, storageZoneName, apiKey) {
    try {
        // Read the file from local storage using the promises version
        const fileData = await fs.readFile(localFilePath);
console.log({fileData})
        // Rest of your code remains the same
        const uploadUrl = `https://storage.bunnycdn.com/${storageZoneName}/${remoteFilePath}`;
console.log({uploadUrl})
        const response = await axios.put(uploadUrl, fileData, {
            headers: {
                'AccessKey': apiKey,
                'Content-Type': 'application/octet-stream'
            }
        });
console.log({response})
        if (response.status === 201) {
            return {
                success: true,
                message: 'File uploaded successfully',
                cdnUrl: `https://${storageZoneName}.b-cdn.net/${remoteFilePath}`
            };
        }

        throw new Error(`Unexpected response status: ${response.status}`);

    } catch (error) {
        return {
            success: false,
            message: `Upload failed: ${error.message}`
        };
    }
}
// Example usage
(async () => {
    const result = await uploadToBunnyCDN(
        './spiderman.jpeg', // Local file path
        'images/logo.jpg', // Remote path in Bunny CDN
        '46c02649-0a36-4414-8b1118620991-7afc-4087', // Storage Zone Name
        '822fe295-79f4-4917-bde7-ef34e5611efd' // API Key
    );

    console.log(result);
})();
// // Send email with tracked image
// async function sendTrackedEmail(toEmail) {
//   try {
//     const trackingId = uuidv4();

//     // Create tracking URL that points to our server
//     const trackingUrl = `http://localhost:${PORT}/track/${trackingId}`;

//     trackingData[trackingId] = {
//       email: toEmail,
//       sentAt: new Date().toISOString(),
//       opened: false,
//       openCount: 0,
//       lastOpened: null,
//       imageUrl: null,
//     };

//     // Upload image to BunnyCDN
//     const bunnyUrl = await uploadImageToBunny(trackingId);
//     trackingData[trackingId].imageUrl = bunnyUrl;
//     saveTrackingData();

//     const htmlContent = `
//             <h1>Hello!</h1>
//             <p>Here's your tracked image:</p>
//             <img src="${trackingUrl}" alt="Tracked Image" style="max-width: 100%;" />
//         `;

//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to: toEmail,
//       subject: "Image Tracking Test",
//       html: htmlContent,
//     });

//     console.log(`Email sent to ${toEmail} with tracking ID: ${trackingId}`);
//     return { success: true, trackingId, imageUrl: bunnyUrl };
//   } catch (error) {
//     console.error("Error sending email:", error);
//     return { success: false, error: error.message };
//   }
// }

// // Tracking endpoint
// app.get("/track/:trackingId", async (req, res) => {
//   const { trackingId } = req.params;

//   if (trackingData[trackingId]) {
//     // Update tracking data
//     trackingData[trackingId].opened = true;
//     trackingData[trackingId].openCount += 1;
//     trackingData[trackingId].lastOpened = new Date().toISOString();
//     saveTrackingData();

//     console.log(`Email opened by: ${trackingData[trackingId].email}`);
//     console.log(`Open count: ${trackingData[trackingId].openCount}`);
//     console.log(`Last opened: ${trackingData[trackingId].lastOpened}`);
//   }

//   // Redirect to the BunnyCDN image URL stored in tracking data
//   if (trackingData[trackingId] && trackingData[trackingId].imageUrl) {
//     res.redirect(trackingData[trackingId].imageUrl);
//   } else {
//     res.status(404).send("Image not found");
//   }
// });

// // Endpoint to send tracked email
// app.get("/send", async (req, res) => {
//   const { email } = req.query;

//   if (!email) {
//     return res.status(400).json({ error: "Email parameter is required" });
//   }

//   try {
//     const result = await sendTrackedEmail(email);
//     res.json(result);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Endpoint to check tracking status
// app.get("/check/:trackingId", (req, res) => {
//   const { trackingId } = req.params;
//   const tracking = trackingData[trackingId];

//   if (!tracking) {
//     return res.status(404).json({ error: "Tracking ID not found" });
//   }

//   res.json(tracking);
// });

// // Endpoint to list all tracked emails
// app.get("/list-all", (req, res) => {
//   res.json(trackingData);
// });

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Send test email: http://localhost:${PORT}/send?email=test@example.com`
  );
  console.log(`Check status: http://localhost:${PORT}/check/<trackingId>`);
  console.log(`List all tracked emails: http://localhost:${PORT}/list-all`);
});
