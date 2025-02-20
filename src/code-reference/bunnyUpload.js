const https = require('https');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// BunnyCDN Configuration
const STORAGE_ZONE_NAME = 'saifstir';
const ACCESS_KEY = '60a9f44b-a46f-41aa-8733e86293c6-bb02-4b40';
const PULL_ZONE_URL = `${STORAGE_ZONE_NAME}.b-cdn.net`;
const PULL_ZONE_ID = '3354347';
const LOGGING_API_KEY = '10732da5-de6d-4847-a173-3be74130e4cb';


// Store tracking information
let emailTracking = {};

// Load existing tracking data if available
try {
    if (fs.existsSync('email-tracking.json')) {
        emailTracking = JSON.parse(fs.readFileSync('email-tracking.json', 'utf8'));
    }
} catch (error) {
    console.error('Error loading tracking data:', error);
}

// Function to get current date in required format (MM-DD-YY)
function getCurrentDate() {
    const date = new Date();
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getFullYear()).slice(-2)}`;
}

// Function to fetch BunnyCDN logs
async function fetchBunnyCDNLogs() {
    const currentDate = getCurrentDate();
    const url = `https://logging.bunnycdn.com/${currentDate}/${PULL_ZONE_ID}.log`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'AccessKey': LOGGING_API_KEY,
                'Accept-Encoding': 'gzip',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.text();
        
        if (!data.trim()) {
            return [];
        }

        return data.split('\n')
            .filter(line => line.trim() !== '')
            .map(entry => {
                const [
                    cacheStatus,
                    statusCode,
                    timestamp,
                    bytesSent,
                    pullZoneId,
                    remoteIp,
                    refererUrl,
                    url,
                    edgeLocation,
                    userAgent,
                    uniqueRequestId,
                    countryCode
                ] = entry.split('|');

                return {
                    cacheStatus,
                    statusCode,
                    timestamp: new Date(parseInt(timestamp)),
                    bytesSent: parseInt(bytesSent),
                    pullZoneId,
                    remoteIp,
                    refererUrl,
                    url,
                    edgeLocation,
                    userAgent,
                    uniqueRequestId,
                    countryCode
                };
            });

    } catch (error) {
        console.error('Error fetching logs:', error);
        throw error;
    }
}


const uploadImageToBunny = async (filePath, uniqueId) => {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(filePath);
        const fileName = `${uniqueId}.jpeg`;

        const options = {
            method: 'PUT',
            hostname: 'storage.bunnycdn.com',
            path: `/${STORAGE_ZONE_NAME}/${fileName}`,
            headers: {
                'AccessKey': ACCESS_KEY,
                'Content-Type': 'image/jpeg',
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode === 201 || res.statusCode === 200) {
                const imageUrl = `https://${PULL_ZONE_URL}/${fileName}`;
                console.log('✅ Image uploaded successfully:', imageUrl);
                resolve(imageUrl);
            } else {
                reject(new Error(`Upload failed with status ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        readStream.pipe(req);
    });
};

// Function to send tracked email
const sendTrackedEmail = async (to) => {
    try {
        const uniqueId = uuidv4();
        const imageUrl = await uploadImageToBunny('./spiderman.jpeg', uniqueId);

        // Add tracking pixel
        const trackingPixel = `<img src="https://${PULL_ZONE_URL}/track/${uniqueId}" style="display:none" />`;

        const htmlContent = `
            <h1>Here's your image</h1>
            <img src="${imageUrl}" alt="Tracked Image" style="max-width: 100%;" />
            <p>This is a tracked email.</p>
            ${trackingPixel}
        `;

        await transporter.sendMail({
            from: 'akshat.a@createstir.com',
            to,
            subject: 'Tracked Image Email',
            html: htmlContent
        });

        emailTracking[uniqueId] = {
            email: to,
            sentAt: new Date().toISOString(),
            lastOpened: null,
            openCount: 0,
            imageUrl,
            opens: [],
            accessStats: []
        };

        fs.writeFileSync('email-tracking.json', JSON.stringify(emailTracking, null, 2));

        console.log('✅ Email sent successfully to:', to);
        console.log('🔍 Tracking ID:', uniqueId);
        
        return {
            success: true,
            trackingId: uniqueId,
            imageUrl
        };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        throw error;
    }
};

// API Endpoints

// Send email endpoint
app.post('/send-email', async (req, res) => {
    try {
        const { to } = req.body;
        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Email address is required'
            });
        }
        const result = await sendTrackedEmail(to);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Track opens endpoint
app.get('/track-opens/:trackingId', async (req, res) => {
    const { trackingId } = req.params;
    
    try {
        const logs = await fetchBunnyCDNLogs();
        const trackingData = emailTracking[trackingId];
        
        if (!trackingData) {
            return res.status(404).json({
                success: false,
                error: 'Tracking ID not found'
            });
        }

        const imageFileName = `${trackingId}.jpeg`;
        const relevantLogs = logs.filter(log => 
            log.url.includes(imageFileName) &&
            log.statusCode === '200'
        );

        trackingData.openCount = relevantLogs.length;
        trackingData.lastOpened = relevantLogs.length > 0 
            ? new Date(Math.max(...relevantLogs.map(log => log.timestamp)))
            : trackingData.lastOpened;
        
        trackingData.opens = relevantLogs.map(log => ({
            timestamp: log.timestamp,
            userAgent: log.userAgent,
            ipAddress: log.remoteIp,
            location: `${log.edgeLocation}, ${log.countryCode}`
        }));

        fs.writeFileSync('email-tracking.json', JSON.stringify(emailTracking, null, 2));

        res.json({
            success: true,
            trackingData
        });

    } catch (error) {
        console.error('Error tracking opens:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get tracking statistics endpoint
app.get('/tracking-stats/:trackingId', async (req, res) => {
    const { trackingId } = req.params;
    
    try {
        const trackingData = emailTracking[trackingId];
        
        if (!trackingData) {
            return res.status(404).json({
                success: false,
                error: 'Tracking ID not found'
            });
        }

        // Update tracking data with fresh logs
        await fetchBunnyCDNLogs();
        
        res.json({
            success: true,
            stats: {
                email: trackingData.email,
                sentAt: trackingData.sentAt,
                lastOpened: trackingData.lastOpened,
                openCount: trackingData.openCount,
                opens: trackingData.opens
            }
        });

    } catch (error) {
        console.error('Error getting tracking stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all tracking data endpoint
app.get('/all-tracking-data', (req, res) => {
    res.json({
        success: true,
        data: emailTracking
    });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📧 Email tracking system initialized`);
});