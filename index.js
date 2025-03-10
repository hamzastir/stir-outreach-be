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
import { handleCalendlyClick, handleOnboardingClick } from "./src/utility/calendlyController.js";
import { processSmartleadWebhook } from "./src/utility/smartleadWebhookController.js";
import userRoutes from './src/routes/users.js'
import instaUserRoutes from './src/routes/insta-users.js'
import dashboardRoutes from './src/routes/dashboard.js'
dotenv.config();
const app = express();
const router = express.Router(); // Add router definition

app.use(cors());
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

// Update the Calendly handler to use the global campaignId
app.post("/api/calendly", (req, res) => {
  // if (!globalCampaignId) {
  //   return res.status(400).json({ error: "No active campaign found" });
  // }
  console.log("Calendly api call!!")
  return handleCalendlyClick(req, res, globalCampaignId);
});
app.post("/api/onboarding", (req, res) => {
  // if (!globalCampaignId) {
  //   return res.status(400).json({ error: "No active campaign found" });
  // }
  console.log("Onboarding api call!!")

  return handleOnboardingClick(req, res, globalCampaignId);
});
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
      campaignId 
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to start campaign", details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
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