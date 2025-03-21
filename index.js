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
} from "./src/utility/startCampaign.js";
import { setupSmartLeadWebhook } from "./src/utility/webhookEvent.js";
import { processSmartleadWebhook } from "./src/utility/smartleadWebhookController.js";
import userRoutes from "./src/routes/users.js";
import instaUserRoutes from "./src/routes/insta-users.js";
import dashboardRoutes from "./src/routes/dashboard.js";
// import {createCalendlyWebhook, handleCalendlyWebhook } from "./src/utility/calendlywebhook.js";
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
// app.post("/api/webhook/calendly", handleCalendlyWebhook);
// app.use("/api/webhooks", createCalendlyWebhook);
app.use("/api/outreach", userRoutes);
app.use("/api/insta-users", instaUserRoutes);
app.use("/api/dashboard", dashboardRoutes);
// await createCalendlyWebhook();
// console.log("Calendly webhook setup completed");
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

const PORT = process.env.PORT || 3007;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    console.log("Visit /run to run the server");
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
