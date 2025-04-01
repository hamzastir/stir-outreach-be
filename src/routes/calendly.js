import express from "express";
import { db } from "../db/db.js";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const API_BASE_URL = "https://server.smartlead.ai/api/v1";
const API_KEY = "eaf95559-9524-40ec-bb75-a5bf585ce25b_94ivz0y";

/**
 * Fetches data from the Smartlead API
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
    
    // Prepare email content
    const emailBody = {
      email: email,
      email_body: `
        Hey @${username},<br><br>
       Thank you for scheduling a meeting! I’m looking forward to our chat and learning more about how we can work together.
Let me know if you have any questions before we connect. See you soon!<br><br>
Best,<br>${poc}</p>
      `,
      campaign_id: campaignId
    };
    
    // Send the email
    const response = await fetchFromApi('campaigns/send-email', 'POST', emailBody);
    console.log('Confirmation email sent successfully:', response);
    
    return response;
    
  } catch (error) {
    console.error('Error sending Calendly confirmation email:', error);
    throw error;
  }
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
      
      // Send confirmation email
      if (campaign_id) {
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
      } else {
        console.warn(`No campaign ID found for ${bookingEmail}, skipping confirmation email`);
      }
      
      // Update the database
      const bookingDate = new Date(startTime).toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      await db("stir_outreach_dashboard")
        .where("business_email", bookingEmail)
        .update({
          video_call_status: "scheduled",
          video_call_date: bookingDate,
          calendly_link_clicked: true // Ensure this is marked as true
        });
      
      console.log(`Database updated for ${bookingEmail}: call scheduled on ${bookingDate}`);
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