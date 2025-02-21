import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { config } from "./src/config/index.js";
import {
  addLeadsToCampaign,
  createCampaignSequence,
  startCampaign,
  updateCampaignSchedule,
  validateCampaignSetup,
} from "./src/utility/startCampaign.js";
import { db } from "./src/db/db.js";
import { checkEmailOpens } from "./src/utility/trackOpen.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

console.log({ config });

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

const 
runCampaign = async () => {
  try {
    await execute();
    setInterval(checkEmailOpens, 5 * 60 * 1000);

    await checkEmailOpens();

    console.log(
      "\n✅ Campaign execution completed. Use API endpoints to check statistics."
    );
  } catch (error) {
    console.error("Campaign execution failed:", error.message);
    process.exit(1);
  }
};

// Routes
app.get("/run", async (req, res) => {
  try {
    await runCampaign();
    res.status(200).json({ message: "Campaign started successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start campaign", details: error.message });
  }
});

app.post("/api/calendly", async (req, res) => {
  try {
    const { name, email, calendly, time } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Update the database
    try {
      const updateResult = await db("stir_outreach_dashboard")
        .where("business_email", email)
        .update({
          calendly_link_clicked: true,
          calendly_click_date: new Date().toISOString().split('T')[0],
          calendly_click_time: new Date().toISOString().split('T')[1].split('.')[0]
        });

      if (updateResult === 0) {
        return res.status(404).json({ 
          error: "No matching record found with the provided email" 
        });
      }

      // Fetch the updated record
      const updatedRecord = await db("stir_outreach_dashboard")
        .select("user_id", "username", "name", "business_email", "calendly_link_clicked", "calendly_click_date", "calendly_click_time")
        .where("business_email", email)
        .first();

      res.status(200).json({
        message: "Data updated successfully",
        data: updatedRecord
      });

    } catch (dbError) {
      console.error("Database error:", dbError);
      return res.status(500).json({ 
        error: "Database error occurred",
        details: dbError.message 
      });
    }

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});