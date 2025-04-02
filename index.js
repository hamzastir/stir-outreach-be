import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { config } from "./src/config/index.js";
import axios from "axios";
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
import { createWebhook } from "./src/utility/calendlywebhook.js";
import { db } from "./src/db/db.js";
import cron from "node-cron";
import moment from "moment-timezone";

import { processSmartleadWebhook } from "./src/utility/smartleadWebhookController.js";
import userRoutes from "./src/routes/users.js";
import instaUserRoutes from "./src/routes/insta-users.js";
import dashboardRoutes from "./src/routes/dashboard.js";
import calendlyRoutes from "./src/routes/calendly.js";
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

// Flag to track if campaign has been created for the day
let campaignCreatedToday = false;

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

// Function to fetch influencers and prepare them for outreach
const prepareInfluencersForOutreach = async () => {
  try {
    console.log("Starting to prepare influencers for outreach...");
    
    // Reset the flag at the start of a new job
    campaignCreatedToday = false;
    
    // Fetch 40 influencers where category is Yellow and status is null or not 'scheduled'
    const influencers = await db("influencer_outreach_verified_email")
      .select("user_id", "username", "business_email")
      .where("category", "Yellow")
      .where(function() {
        this.whereNull("status").orWhere("status", "!=", "scheduled");
      })
      .limit(40);
    
    if (influencers.length === 0) {
      console.log("No eligible influencers found for outreach.");
      return;
    }
    
    console.log(`Found ${influencers.length} influencers to prepare for outreach.`);
    
    // Prepare data with alternating POC assignments
    const preparedData = influencers.map((influencer, index) => {
      // Alternate between Yug and Akshat
      const poc = index % 2 === 0 ? "Yug" : "Akshat";
      const poc_email_address = index % 2 === 0 ? "yug@createstir.com" : "akshat@createstir.com";
      
      return {
        user_id: influencer.user_id,
        username: influencer.username,
        business_email: influencer.business_email,
        poc: poc,
        poc_email_address: poc_email_address,
        first_email_status: "yet_to_schedule",
        created_at: new Date(),
        // updated_at: new Date()
      };
    });
    
    // Insert data into stir_outreach_dashboard
    await db("stir_outreach_dashboard").insert(preparedData);
    
    // Update status to 'scheduled' in the source table
    const userIds = influencers.map(inf => inf.user_id);
    await db("influencer_outreach_verified_email")
      .whereIn("user_id", userIds)
      .update({
        status: "scheduled",
        // updated_at: new Date()
      });
    
    console.log("Successfully prepared influencers for outreach and updated status.");
    
    // Run the campaign by POC
    if (!campaignCreatedToday) {
      console.log("Creating campaigns by POC...");
      const campaignResults = await createCampaignsByPoc();
      
      // Set up webhooks for each campaign
      for (const campaign of campaignResults) {
        await setupSmartLeadWebhook(campaign.campaignId);
        console.log(`SmartLead webhook setup completed for ${campaign.poc} campaign`);
      }
      
      campaignCreatedToday = true;
      console.log("Campaigns created successfully for today.");
    } else {
      console.log("Campaigns already created for today. Skipping creation.");
    }
    
    return { success: true, message: "Influencers prepared for outreach and campaigns created." };
  } catch (error) {
    console.error("Error preparing influencers for outreach:", error);
    return { success: false, error: error.message };
  }
};

// Set up cron job to run Monday to Friday at 14:00 IST
const setupDailyOutreachCron = () => {
  // '0 14 * * 1-5' - runs at 14:00 on Monday through Friday
  // For IST, we need to adjust based on server timezone
  cron.schedule('0 14 * * 1-5', async () => {
    console.log('Running Daily Outreach Cron Job at 14:00 IST');
    await prepareInfluencersForOutreach();
  }, {
    timezone: "Asia/Kolkata" // Set timezone to IST
  });
  
  console.log("Daily outreach cron job scheduled to run Monday-Friday at 14:00 IST");
};

app.post("/api/webhook/smartlead", processSmartleadWebhook);
app.use("/api/outreach", userRoutes);
app.use("/api/insta-users", instaUserRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/calendly-webhook", calendlyRoutes);

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

// Route to test the daily outreach function
app.get("/test-prepare-influencers", async (req, res) => {
  try {
    const result = await prepareInfluencersForOutreach();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to prepare influencers for outreach", 
      details: error.message 
    });
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
    console.log("Visit /test-prepare-influencers to test the daily outreach preparation");
    console.log("For testing: /run-followup-1, /run-followup-2, /run-followup-3 for specific stages");
    
    // Set up the cron jobs when the server starts
    setupFollowupEmailCron();
    setupDailyOutreachCron();
    
    console.log("Cron jobs set up for follow-up emails and daily outreach (14:00 IST, Mon-Fri)");
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