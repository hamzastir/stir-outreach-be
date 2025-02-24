import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
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
import { db } from "./src/db/db.js";
import { checkEmailOpens } from "./src/utility/trackOpen.js";
import { handleEmailReply, handleEmailSent, handleLeadUnsubscribed, setupSmartLeadWebhook } from "./src/utility/webhookEvent.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

console.log({ config });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const execute = async () => {
  try {
    console.log("🚀 Starting SmartLead Campaign Automation");

    // Create new campaign
    const campaignId = await createNewCampaign();

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
    await execute();
    setInterval(checkEmailOpens, 5 * 60 * 1000);

    // await checkEmailOpens();

    console.log(
      "\n✅ Campaign execution completed. Use API endpoints to check statistics."
    );
  } catch (error) {
    console.error("Campaign execution failed:", error.message);
    process.exit(1);
  }
};

app.post('/api/webhook/smartlead', async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('Raw webhook data:', JSON.stringify(webhookData, null, 2));

    // Validate the webhook data structure
    if (!webhookData.to_email) {
      throw new Error('Missing lead_email in webhook data');
    }

    switch (webhookData.event_type) {
      case 'EMAIL_SENT':
        await handleEmailSent(webhookData);
        break;
      case 'EMAIL_REPLY':
        await handleEmailReply(webhookData);
        break;
      case 'LEAD_UNSUBSCRIBED':
        await handleLeadUnsubscribed(webhookData);
        break;
      default:
        console.log(`Unhandled event type: ${webhookData.event_type}`);
    }

    res.status(200).json({
      status: 'success',
      message: `Successfully processed ${webhookData.event_type} event`
    });
  } catch (error) {
    console.error('Webhook processing error:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      status: 'error',
      message: 'Error processing webhook',
      error: error.message
    });
  }
});


// Routes
app.get("/run", async (req, res) => {
  try {
    await setupSmartLeadWebhook();
    console.log('SmartLead webhook setup completed');
    await runCampaign();
    res.status(200).json({ message: "Campaign started successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start campaign", details: error.message });
  }
});

app.post("/api/calendly", async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Update database
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

    // Schedule immediate follow-up
    const api = createAxiosInstance();

    // Add follow-up sequence
    const followUpSequence = {
      sequences: [
        {
          seq_number: 2, // Next sequence number
          seq_delay_details: { delay_in_days: 0 }, // Send immediately
          seq_variants: [
            {
              subject: `Thank you for your interest, ${name}!`,
              email_body: `
                <p>Hi ${name},</p>
                
                <p>Thank you for clicking on our calendar link! We're excited about the opportunity to connect with you.</p>
                
                <p>Please go ahead and choose a time that works best for you, and we'll make sure to have a productive conversation.</p>
                
                <p>Looking forward to speaking with you soon!</p>
                
                <p>Best regards,<br>Yug</p>
              `,
              variant_label: 'Follow_Up_A'
            }
          ]
        }
      ]
    };

    // Add sequence to campaign
    await api.post(
      `campaigns/${config.CAMPAIGN_ID}/sequences`,
      followUpSequence
    );

    // Resume the lead immediately
    await api.post(`campaigns/${config.CAMPAIGN_ID}/leads/${email}/resume`, {
      resume_lead_with_delay_days: 0 // Resume immediately
    });

    // Fetch updated record
    const updatedRecord = await db("stir_outreach_dashboard")
      .select("user_id", "username", "name", "business_email", "calendly_link_clicked", "calendly_click_date", "calendly_click_time")
      .where("business_email", email)
      .first();

    res.status(200).json({
      message: "Follow-up email scheduled",
      data: updatedRecord
    });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
 
    console.log('/run to run the server');
  
  } catch (error) {
    console.error('Server initialization error:', error);
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});