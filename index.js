// index.js
import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import { config } from "./src/config/index.js";
import { fetchBunnyCDNLogs } from "./src/utility/fetchBunnyLogs.js";
import {
  addLeadsToCampaign,
  createCampaignSequence,
  startCampaign,
  updateCampaignSchedule,
  validateCampaignSetup,
} from "./src/utility/startCampaign.js";
dotenv.config();
const app = express();

console.log({ config });
app.use(express.json());

let emailTracking = {};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadTrackingData = () => {
  try {
    if (fs.existsSync("email-tracking.json")) {
      emailTracking = JSON.parse(
        fs.readFileSync("email-tracking.json", "utf8")
      );
    }
  } catch (error) {
    console.error("Error loading tracking data:", error);
  }
};

const saveTrackingData = () => {
  fs.writeFileSync(
    "email-tracking.json",
    JSON.stringify(emailTracking, null, 2)
  );
};

const getTrackingStats = async (trackingId) => {
  try {
    const logs = await fetchBunnyCDNLogs();
    const trackingData = emailTracking[trackingId];

    if (!trackingData) return null;

    const imageFileName = `${trackingId}.jpeg`;
    const relevantLogs = logs.filter(
      (log) => log.url.includes(imageFileName) && log.statusCode === "200"
    );

    trackingData.openCount = relevantLogs.length;
    trackingData.lastOpened =
      relevantLogs.length > 0
        ? new Date(Math.max(...relevantLogs.map((log) => log.timestamp)))
        : trackingData.lastOpened;

    trackingData.opens = relevantLogs.map((log) => ({
      timestamp: log.timestamp,
      userAgent: log.userAgent,
      ipAddress: log.remoteIp,
      location: `${log.edgeLocation}, ${log.countryCode}`,
    }));

    saveTrackingData();
    return trackingData;
  } catch (error) {
    console.error("Error getting tracking stats:", error);
    return null;
  }
};

const execute = async () => {
  try {
    console.log("🚀 Starting SmartLead Campaign Automation");

   
    await validateCampaignSetup();

    const steps = [
      {
        name: "Update Campaign Schedule",
        fn: () => updateCampaignSchedule(),
      },
      {
        name: "Add Leads to Campaign",
        fn: () => addLeadsToCampaign(),
      },
      {
        name: "Create Campaign Sequence",
        fn: () => createCampaignSequence(),
      },
      {
        name: "Start Campaign",
        fn: () => startCampaign(),
      },
    ];

    for (const step of steps) {
      console.log(`\n📍 Executing: ${step.name}`);
      await step.fn();
      await delay(2000);
    }

    console.log(
      "\n✅ Campaign Setup Complete! Emails will be sent according to schedule."
    );
  } catch (error) {
    console.error("\n❌ Campaign Setup Failed:", error.message);
    if (error.response) {
      console.error("Error Details:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
    throw error;
  }
};

// Route to get all email tracking stats
app.get("/api/stats", async (req, res) => {
  try {
    const stats = [];

    for (const trackingId in emailTracking) {
      const trackingData = await getTrackingStats(trackingId);
      if (trackingData) {
        stats.push({
          email: trackingData.email,
          sentAt: trackingData.sentAt,
          lastOpened: trackingData.lastOpened,
          openCount: trackingData.openCount,
          opens: trackingData.opens,
        });
      }
    }

    res.json({
      success: true,
      totalEmails: stats.length,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Route to get stats for a specific email
app.get("/api/stats/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const emailStats = [];

    for (const trackingId in emailTracking) {
      const trackingData = emailTracking[trackingId];
      if (trackingData.email === email) {
        const stats = await getTrackingStats(trackingId);
        if (stats) {
          emailStats.push({
            sentAt: stats.sentAt,
            lastOpened: stats.lastOpened,
            openCount: stats.openCount,
            opens: stats.opens,
          });
        }
      }
    }

    if (emailStats.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No tracking data found for this email",
      });
    }

    res.json({
      success: true,
      email,
      stats: emailStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Route to get a summary of all tracking data
app.get("/api/summary", async (req, res) => {
  try {
    const summary = {
      totalEmails: 0,
      totalOpens: 0,
      emailsWithOpens: 0,
      recentOpens: [],
    };

    for (const trackingId in emailTracking) {
      const stats = await getTrackingStats(trackingId);
      if (stats) {
        summary.totalEmails++;
        summary.totalOpens += stats.openCount;
        if (stats.openCount > 0) {
          summary.emailsWithOpens++;
        }

        // Add recent opens to the summary
        stats.opens.forEach((open) => {
          summary.recentOpens.push({
            email: stats.email,
            timestamp: open.timestamp,
            location: open.location,
            userAgent: open.userAgent,
          });
        });
      }
    }

    // Sort recent opens by timestamp and get the latest 10
    summary.recentOpens.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    summary.recentOpens = summary.recentOpens.slice(0, 10);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const runCampaign = async () => {
  try {
    loadTrackingData();
    await execute();
    console.log(
      "\n✅ Campaign execution completed. Use API endpoints to check statistics."
    );
  } catch (error) {
    console.error("Campaign execution failed:", error.message);
    process.exit(1);
  }
};

runCampaign();
