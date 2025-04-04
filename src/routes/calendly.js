import express from "express";
import { db } from "../db/db.js";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const API_BASE_URL = "https://server.smartlead.ai/api/v1";
const API_KEY = "eaf95559-9524-40ec-bb75-a5bf585ce25b_94ivz0y";

/**
 * Fetches data from the Smartlead API with improved error handling
 */
const fetchFromApi = async (endpoint, method = "GET", body) => {
  try {
    const url = new URL(`${API_BASE_URL}/${endpoint}`);
    url.searchParams.append("api_key", API_KEY);

    console.log(`Making ${method} request to ${url.toString()}`);

    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain",
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(url.toString(), options);
    console.log(`Response Status: ${response.status} - ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const textResponse = await response.text();
      console.log("Text Response:", textResponse);
      return { message: textResponse, ok: response.ok };
    }
  } catch (error) {
    console.error(`API Request Failed at ${endpoint}:`, error);
    throw error;
  }
};

/**
 * Fetches the lead ID from the Smartlead API using the email address.
 */
const fetchLeadId = async (email) => {
  console.log(`Fetching lead ID for ${email} from Smartlead API...`);
  const leadData = await fetchFromApi(`leads?email=${encodeURIComponent(email)}`);
  const leadId = leadData.id;

  if (!leadId) {
    console.warn("Lead not found in Smartlead API for email:", email);
    throw new Error("Lead not found in Smartlead");
  }
  console.log("Lead ID retrieved successfully:", leadId);
  return leadId;
};

/**
 * Fetches the message history for a lead in a specific campaign.
 */
const fetchMessageHistory = async (campaignId, leadId) => {
  console.log(`Fetching message history for lead ${leadId} in campaign ${campaignId}...`);
  const messageHistoryResponse = await fetchFromApi(
    `campaigns/${campaignId}/leads/${leadId}/message-history`
  );

  let messageHistory = [];
  if (
    messageHistoryResponse &&
    messageHistoryResponse.history &&
    Array.isArray(messageHistoryResponse.history)
  ) {
    messageHistory = messageHistoryResponse.history;
  } else if (Array.isArray(messageHistoryResponse)) {
    messageHistory = messageHistoryResponse;
  }

  return messageHistory;
};

/**
 * Finds the latest sent message from the message history.
 */
const findLatestSentMessage = (messageHistory) => {
  const latestMessage = messageHistory
    .filter((msg) => msg.type === "SENT")
    .sort((a, b) => new Date(b.time) - new Date(a.time))[0];

  if (!latestMessage) {
    console.warn("No sent messages found to reply to");
    return null;
  }

  return latestMessage;
};

/**
 * Sends a confirmation email via Smartlead after a calendly booking
 */
const sendCalendlyConfirmationEmail = async (campaignId, email, username, poc, meetingDetails) => {
  try {
    console.log(`Sending Calendly confirmation email to ${email} (${username})...`);
    
    // Format the meeting date and time
    const meetingDate = new Date(meetingDetails.start_time);
    const formattedDate = meetingDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = meetingDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Get lead ID first
    const leadId = await fetchLeadId(email);
    
    // Get message history to find the latest message to reply to
    const messageHistory = await fetchMessageHistory(campaignId, leadId);
    
    // Find the latest sent message
    const latestMessage = findLatestSentMessage(messageHistory);
    
    if (!latestMessage) {
      console.warn(`No sent messages found for ${email}, cannot send confirmation`);
      throw new Error("No sent messages found to reply to");
    }
    
    // Create email body for confirmation
    const emailBody = `
      Hey @${username},<br><br>
      Thank you for scheduling a meeting! I’m looking forward to our chat and learning more about how we can work together. <br><br>
      Let me know if you have any questions before we connect. See you soon!</p>
      Best,<br>${poc}
    `;
    
    // Create the reply request body
    const replyRequestBody = {
      email_stats_id: latestMessage.stats_id || latestMessage.email_stats_id,
      email_body: emailBody,
      reply_message_id: latestMessage.message_id,
      reply_email_time: latestMessage.time || latestMessage.sent_time,
      reply_email_body: latestMessage.email_body,
      add_signature: true,
    };
    
    // Send the email as a reply to the last message in the thread
    const response = await fetchFromApi(
      `campaigns/${campaignId}/reply-email-thread`,
      "POST",
      replyRequestBody
    );
    
    console.log('Confirmation email sent successfully:', response);
    return response;
    
  } catch (error) {
    console.error('Error sending Calendly confirmation email:', error);
    throw error;
  }
};

/**
 * Helper function to get current date and time in IST
 */
const getCurrentISTDateTime = () => {
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
  
  // Parse the formatted date time string
  const [dateStr, timeStr] = istDateTime.split(", ");
  
  // Convert "DD/MM/YYYY" to "YYYY-MM-DD"
  const dateParts = dateStr.split("/");
  const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
  
  return {
    date: formattedDate,  // YYYY-MM-DD format in IST
    time: timeStr         // HH:MM:SS format in IST
  };
};

// Webhook endpoint to handle Calendly events
router.post("/", async (req, res) => {
  try {
    // Log the entire request body to see what Calendly sends
    console.log('Calendly webhook received!');
    console.log(JSON.stringify(req.body, null, 2));
    
    // Check if this is a booking creation event
    if (req.body.event === 'invitee.created') {
      const bookingEmail = req.body.payload.email;
      const bookingName = req.body.payload.name;
      const startTime = req.body.payload.scheduled_event.start_time;
      const endTime = req.body.payload.scheduled_event.end_time;
      
      console.log(`Calendly booking received: ${bookingName} (${bookingEmail})`);
      console.log(`Start Time: ${startTime}`);
      console.log(`End Time: ${endTime}`);
      
      // Find user in the database
      const userRecord = await db("stir_outreach_dashboard")
        .where("business_email", bookingEmail)
        .first();
      
      if (!userRecord) {
        console.warn(`No record found for email: ${bookingEmail}`);
        return res.status(200).send('Webhook received, but no matching user found');
      }
      
      const { username, poc, campaign_id } = userRecord;
      
      // Format the date in YYYY-MM-DD format for database
      const bookingDate = new Date(startTime).toISOString().split('T')[0];
      
      // Update the database FIRST to mark the meeting as scheduled
      // This is critical to ensure we don't miss this step
      const updateResult = await db("stir_outreach_dashboard")
        .where("business_email", bookingEmail)
        .update({
          video_call_status: "scheduled",
          video_call_date: bookingDate,
          calendly_link_clicked: true
        });
      
      console.log(`Database updated for ${bookingEmail}: call scheduled on ${bookingDate}`);
      
      // Send confirmation email if we have a campaign ID
      if (campaign_id) {
        try {
          await sendCalendlyConfirmationEmail(
            campaign_id, 
            bookingEmail, 
            username, 
            poc,
            {
              start_time: startTime,
              end_time: endTime
            }
          );
          console.log(`Confirmation email sent successfully to ${bookingEmail}`);
        } catch (emailError) {
          console.error(`Failed to send confirmation email to ${bookingEmail}:`, emailError);
          // We continue even if email sending fails, as the database was already updated
        }
      } else {
        console.warn(`No campaign ID found for ${bookingEmail}, skipping confirmation email`);
      }
    } else if (req.body.event === 'invitee.canceled') {
      // Handle cancellation if needed
      const bookingEmail = req.body.payload.email;
      console.log(`Calendly booking canceled for: ${bookingEmail}`);
      
      // Update the database to reflect the cancellation
      await db("stir_outreach_dashboard")
        .where("business_email", bookingEmail)
        .update({
          video_call_status: "canceled",
        });
        
      console.log(`Database updated for ${bookingEmail}: call canceled`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).send('Webhook received successfully');
    
  } catch (error) {
    console.error("Error processing Calendly webhook:", error);
    // Still return 200 so Calendly doesn't retry (we'll handle the error on our side)
    res.status(200).send('Webhook received with errors');
  }
});

export default router;