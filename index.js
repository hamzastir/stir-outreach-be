import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { config } from "./src/config/index.js";
import {
  addEmailAccountToCampaign,
  addLeadsToCampaign,
  createCampaignSequence,
  createNewCampaign,
  startCampaign,
  updateCampaignSchedule,
  updateCampaignSettings,
  validateCampaignSetup,
  createCampaignsByPoc,
} from "./src/utility/startCampaign.js";
import { setupSmartLeadWebhook } from "./src/utility/webhookEvent.js";
import { processSmartleadWebhook } from "./src/utility/smartleadWebhookController.js";
import userRoutes from "./src/routes/users.js";
import instaUserRoutes from "./src/routes/insta-users.js";
import dashboardRoutes from "./src/routes/dashboard.js";
import { 
  setupFollowupEmailCron, 
  sendFollowupEmails,
  sendFirstFollowup,
  sendSecondFollowup,
  sendThirdFollowup 
} from "./src/utility/followupsEmail.js"; // Import all follow-up functions

dotenv.config();
const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
console.log({ config });

// Store campaignId globally so it can be accessed by different routes
let globalCampaignId = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const execute = async () => {
  try {
    console.log("🚀 Starting SmartLead Campaign Automation");

    // Create new campaign
    const campaignId = await createNewCampaign();

    // Store campaignId globally
    globalCampaignId = campaignId;
    console.log(`Campaign created with ID: ${globalCampaignId}`);

    const steps = [
      {
        name: "Add Email Account to Campaign",
        fn: () => addEmailAccountToCampaign(campaignId),
      },
      {
        name: "Update Campaign Settings",
        fn: () => updateCampaignSettings(campaignId),
      },
      {
        name: "Validate Campaign Setup",
        fn: () => validateCampaignSetup(campaignId),
      },
      {
        name: "Update Campaign Schedule",
        fn: () => updateCampaignSchedule(campaignId),
      },
      {
        name: "Add Leads to Campaign",
        fn: () => addLeadsToCampaign(campaignId),
      },
      {
        name: "Create Campaign Sequence",
        fn: () => createCampaignSequence(campaignId),
      },
      {
        name: "Start Campaign",
        fn: () => startCampaign(campaignId),
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

    return campaignId;
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

const runCampaign = async () => {
  try {
    const campaignId = await execute();

    console.log(
      "\n✅ Campaign execution completed. Use API endpoints to check statistics."
    );

    return campaignId;
  } catch (error) {
    console.error("Campaign execution failed:", error.message);
    throw error;
  }
};

app.post("/api/webhook/smartlead", processSmartleadWebhook);
app.use("/api/outreach", userRoutes);
app.use("/api/insta-users", instaUserRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Routes
app.get("/run", async (req, res) => {
  try {
    const campaignId = await runCampaign();
    await setupSmartLeadWebhook(campaignId);
    console.log("SmartLead webhook setup completed");

    res.status(200).json({
      message: "Campaign started successfully",
      campaignId,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to start campaign", details: error.message });
  }
});

// New route to run campaigns by POC
app.get("/run-by-poc", async (req, res) => {
  try {
    console.log("🚀 Starting SmartLead Campaign Automation by POC");
    
    const campaignResults = await createCampaignsByPoc();
    
    // Set up webhooks for each campaign
    for (const campaign of campaignResults) {
      await setupSmartLeadWebhook(campaign.campaignId);
      console.log(`SmartLead webhook setup completed for ${campaign.poc} campaign`);
    }

    res.status(200).json({
      message: "Campaigns by POC started successfully",
      campaigns: campaignResults,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to start campaigns by POC", details: error.message });
  }
});

// Main follow-up route - initiates the sequence by sending first follow-ups
app.get("/run-followup", async (req, res) => {
  try {
    await sendFollowupEmails();
    res.status(200).json({
      message: "Follow-up email sequence initiated successfully",
      details: "First follow-ups sent, second and third will be handled by scheduled jobs"
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to run follow-up emails", details: error.message });
  }
});

// Separate routes for each follow-up stage (useful for testing)
app.get("/run-followup-1", async (req, res) => {
  try {
    await sendFirstFollowup();
    res.status(200).json({
      message: "First follow-up emails sent successfully"
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to run first follow-up emails", details: error.message });
  }
});

app.get("/run-followup-2", async (req, res) => {
  try {
    await sendSecondFollowup();
    res.status(200).json({
      message: "Second follow-up emails sent successfully"
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to run second follow-up emails", details: error.message });
  }
});

app.get("/run-followup-3", async (req, res) => {
  try {
    await sendThirdFollowup();
    res.status(200).json({
      message: "Third follow-up emails sent successfully"
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to run third follow-up emails", details: error.message });
  }
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    console.log("Visit /run to run the server");
    console.log("Visit /run-by-poc to run campaigns separated by POC");
    console.log("Visit /run-followup to start the follow-up email sequence");
    console.log("For testing: /run-followup-1, /run-followup-2, /run-followup-3 for specific stages");
    
    // Set up the cron job when the server starts
    setupFollowupEmailCron();
    console.log("Cron jobs for follow-up emails have been set up (9:00, 9:01, 9:02 AM and 5:00, 5:01, 5:02 PM)");
  } catch (error) {
    console.error("Server initialization error:", error);
  }
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});