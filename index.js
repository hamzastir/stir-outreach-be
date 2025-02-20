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
import { db } from "./src/db/db.js";
dotenv.config();
const app = express();

console.log({ config });
app.use(express.json());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const checkEmailOpens = async () => {
  try {
    const logs = await fetchBunnyCDNLogs();

    for (const log of logs) {
      if (log.statusCode === "200") {
        const match = log.url.match(/([a-f0-9-]+)\.jpeg$/);
        if (match) {
          const trackingId = match[1];

          // Get tracking data from email_tracking table
          const trackingData = await db("email_open_tracking_ids")
            .where("tracking_id", trackingId)
            .first();

          if (trackingData && !trackingData.is_opened) {
            // Update email_tracking table
            await db("email_open_tracking_ids")
              .where("tracking_id", trackingId)
              .update({
                is_opened: true,
                opened_at: new Date(log.timestamp),
              });

            // Update main table
            await db("stir_outreach_dashboard")
              .where("business_email", trackingData.email)
              .update({
                email_opened: true,
                email_open_date: new Date().toISOString().split('T')[0],
                email_open_time : new Date().toISOString().split('T')[1].split('.')[0]              });

            console.log(`Email opened: ${trackingData.email}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking email opens:", error);
  }
};
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const runCampaign = async () => {
  try {
    await execute();
    setInterval(checkEmailOpens, 5 * 60 * 1000); // Check every 5 minutes

    await checkEmailOpens();

    console.log(
      "\n✅ Campaign execution completed. Use API endpoints to check statistics."
    );
  } catch (error) {
    console.error("Campaign execution failed:", error.message);
    process.exit(1);
  }
};

runCampaign();
