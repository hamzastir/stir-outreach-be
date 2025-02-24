import axios from "axios";
import { db } from "../db/db.js";
import dotenv from "dotenv";
dotenv.config();


const API_KEY = process.env.SMARTLEAD_API_KEY;
const CAMPAIGN_ID = process.env.CAMPAIGN_ID;
const BASE_URL = 'https://server.smartlead.ai/api/v1';

// Function to setup SmartLead webhook
export async function setupSmartLeadWebhook() {
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


export async function handleEmailSent(data) {
  try {
    console.log('Webhook data received for email sent:', JSON.stringify(data, null, 2));

    // Check if we have the required email field
    if (!data.to_email) {
      console.error('lead_email is missing in webhook data');
      return;
    }

    const now = new Date();

// Convert to IST
const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(now);

// Extract date and time separately
const [date, time] = istDateTime.split(", ");

// Format the date to YYYY-MM-DD
const formattedDate = date.split("/").reverse().join("-");

// Update query
const updateQuery = db("stir_outreach_dashboard")
  .where("business_email", data.to_email)
  .update({
    first_email_status: "sent",
    first_email_date: formattedDate, // YYYY-MM-DD
    first_email_time: time // HH:MM:SS (24-hour format)
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

export async function handleEmailReply(data) {
  try {
    // Debug log to see the exact structure of incoming data
    console.log('Email reply webhook data:', JSON.stringify(data, null, 2));

    // Validate incoming data
    const emailToUpdate = data.to_email;
    const replyContent = data.reply_body || data.reply_content || data.content;
    
    if (!emailToUpdate) {
      throw new Error('No valid email found in reply webhook data');
    }

    // Log the email we're trying to update
    console.log('Attempting to update reply for email:', emailToUpdate);

    const now = new Date();

// Convert to IST
const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(now);

// Extract date and time separately
const [date, time] = istDateTime.split(", ");

// Format the date to YYYY-MM-DD
const formattedDate = date.split("/").reverse().join("-");

// Perform the update with additional error checking
const updateQuery = db("stir_outreach_dashboard")
  .where("business_email", emailToUpdate)
  .update({
    replied: true,
    email_reply_date: formattedDate, // YYYY-MM-DD (IST)
    email_reply_time: time, // HH:MM:SS (24-hour IST)
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

export async function handleLeadUnsubscribed(data) {
  try {
    // Debug log to see the exact structure of incoming data
    console.log('Unsubscribe webhook data:', JSON.stringify(data, null, 2));

    // Validate incoming data
    const emailToUpdate = data.to_email;
    const unsubscribeReason = data.unsubscribe_reason || data.reason || '';
    
    if (!emailToUpdate) {
      throw new Error('No valid email found in unsubscribe webhook data');
    }

    // Log the email we're trying to update
    console.log('Attempting to update unsubscribe status for email:', emailToUpdate);

    // Perform the update with additional error checking
    const now = new Date();

    // Convert to IST
    const istDateTime = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    
    // Extract date separately
    const formattedDate = istDateTime.split(", ")[0].split("/").reverse().join("-");
    
    // Perform the update with additional error checking
    const updateQuery = db("stir_outreach_dashboard")
      .where("business_email", emailToUpdate)
      .update({
        unsubscribed: true,
        unsubscribe_date: formattedDate, // YYYY-MM-DD (IST)
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