import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
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

// SmartLead Webhook Configuration
const API_KEY = process.env.SMARTLEAD_API_KEY;
const CAMPAIGN_ID = process.env.CAMPAIGN_ID;
const BASE_URL = 'https://server.smartlead.ai/api/v1';

// Function to setup SmartLead webhook
async function setupSmartLeadWebhook() {
  try {
    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}/campaigns/${CAMPAIGN_ID}/webhooks`,
      params: { api_key: API_KEY },
      data: {
        id: null,
        name: "Email Activity Tracking Webhook",
        webhook_url: `https://stir-email-outreach.onrender.com/api/webhook/smartlead`,
        event_types: ['EMAIL_SENT', 'EMAIL_REPLY', 'LEAD_UNSUBSCRIBED'],
        categories: [ "Interested"]
      },
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Webhook setup successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error setting up webhook:', error.response?.data || error.message);
    throw error;
  }
}


async function handleEmailSent(data) {
  try {
    console.log('Webhook data received for email sent:', JSON.stringify(data, null, 2));

    // Check if we have the required email field
    if (!data.lead_email) {
      console.error('lead_email is missing in webhook data');
      return;
    }

    // Log the query we're about to execute
    const updateQuery = db("stir_outreach_dashboard")
      .where("business_email", data.lead_email)
      .update({
        first_email_status: true,
        first_email_date: new Date().toISOString().split('T')[0],
        first_email_time: new Date().toISOString().split('T')[1].split('.')[0]
      });

    console.log('Query to be executed:', updateQuery.toString());

    // Execute the update
    const result = await updateQuery;
    
    console.log('Update result:', result);

  } catch (error) {
    console.error('Error handling email sent event:', {
      error: error.message,
      data: data,
      stack: error.stack
    });
  }
}

async function handleEmailReply(data) {
  try {
    // Debug log to see the exact structure of incoming data
    console.log('Email reply webhook data:', JSON.stringify(data, null, 2));

    // Validate incoming data
    const emailToUpdate = data.lead_email || data.email || data.business_email;
    const replyContent = data.reply_body || data.reply_content || data.content;
    
    if (!emailToUpdate) {
      throw new Error('No valid email found in reply webhook data');
    }

    // Log the email we're trying to update
    console.log('Attempting to update reply for email:', emailToUpdate);

    // Perform the update with additional error checking
    const updateQuery = db("stir_outreach_dashboard")
      .where("business_email", emailToUpdate)
      .update({
        replied: true,
        email_reply_date: new Date().toISOString().split('T')[0],
        email_reply_time: new Date().toISOString().split('T')[1].split('.')[0],
        reply_content: replyContent || null
      });

    // Log the query for debugging
    console.log('Reply update query:', updateQuery.toString());

    const updateResult = await updateQuery;

    if (updateResult === 0) {
      console.log(`No record found for email reply: ${emailToUpdate}`);
    } else {
      console.log(`Successfully updated reply for email: ${emailToUpdate}`);
    }

    return updateResult;

  } catch (error) {
    console.error('Error in handleEmailReply:', {
      error: error.message,
      data: data,
      stack: error.stack
    });
    throw error;
  }
}

async function handleLeadUnsubscribed(data) {
  try {
    // Debug log to see the exact structure of incoming data
    console.log('Unsubscribe webhook data:', JSON.stringify(data, null, 2));

    // Validate incoming data
    const emailToUpdate = data.lead_email || data.email || data.business_email;
    const unsubscribeReason = data.unsubscribe_reason || data.reason || '';
    
    if (!emailToUpdate) {
      throw new Error('No valid email found in unsubscribe webhook data');
    }

    // Log the email we're trying to update
    console.log('Attempting to update unsubscribe status for email:', emailToUpdate);

    // Perform the update with additional error checking
    const updateQuery = db("stir_outreach_dashboard")
      .where("business_email", emailToUpdate)
      .update({
        unsubscribed: true,
        unsubscribe_date: new Date().toISOString().split('T')[0],
        unsubscribe_reason: unsubscribeReason
      });

    // Log the query for debugging
    console.log('Unsubscribe update query:', updateQuery.toString());

    const updateResult = await updateQuery;

    if (updateResult === 0) {
      console.log(`No record found for unsubscribe: ${emailToUpdate}`);
    } else {
      console.log(`Successfully updated unsubscribe status for email: ${emailToUpdate}`);
    }

    return updateResult;

  } catch (error) {
    console.error('Error in handleLeadUnsubscribed:', {
      error: error.message,
      data: data,
      stack: error.stack
    });
    throw error;
  }
}
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

const runCampaign = async () => {
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

app.post('/api/webhook/smartlead', async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('Raw webhook data:', JSON.stringify(webhookData, null, 2));

    // Validate the webhook data structure
    if (!webhookData.lead_email) {
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

// Start server with webhook setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await setupSmartLeadWebhook();
    console.log('SmartLead webhook setup completed');
    await runCampaign();
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