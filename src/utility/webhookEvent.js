import axios from "axios";
import { db } from "../db/db.js";
import dotenv from "dotenv";
dotenv.config();


const API_KEY = process.env.SMARTLEAD_API_KEY;
// const CAMPAIGN_ID = process.env.CAMPAIGN_ID;
const BASE_URL = 'https://server.smartlead.ai/api/v1';

// Function to setup SmartLead webhook
export async function setupSmartLeadWebhook(campaignId) {
  try {
    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}/campaigns/${campaignId}/webhooks`,
      params: { api_key: API_KEY },
      data: {
        id: null,
        name: "Email Activity Tracking Webhook",
        webhook_url: `http://104.131.101.181:3007/api/webhook/smartlead`,
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
        first_email_time: time, // HH:MM:SS (24-hour format)
      });

    console.log('Query to be executed:', updateQuery.toString());

    // Execute the update
    const result = await updateQuery;
    console.log('Update result:', result);

    // Schedule a follow-up email after 2 days (or any desired delay)
    if (result > 0 && data.campaign_id && data.email_stats_id) {
      console.log('Scheduling follow-up email...');

      // Schedule the follow-up email after 2 days
      setTimeout(async () => {
        try {
          const followUpResponse = await sendSmartleadFollowUp1({
            campaign_id: data.campaign_id,
            email_stats_id: data.email_stats_id,
            reply_message_id: data.message_id,
            reply_email_time: data.reply_timestamp,
            reply_email_body: data.content,
            recipient_email: data.to_email,
          });

          console.log('Follow-up email sent successfully:', followUpResponse);
        } catch (error) {
          console.error('Failed to send follow-up email:', {
            error: error.message,
            recipient: data.to_email,
            campaign: data.campaign_id,
          });
        }
      }, 10000); 
    }

  } catch (error) {
    console.error('Error handling email sent event:', {
      error: error.message,
      data: data,
      stack: error.stack,
    });
  }
}

async function sendSmartleadFollowUp1({
  campaign_id,
  email_stats_id,
  reply_message_id,
  reply_email_time,
  reply_email_body,
  recipient_email,
}) {
  try {
    const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY; // Ensure this is set in your environment
    const followUpMessage = `
      <p>Hi there,</p>
      <p>I wanted to follow up on my previous email. Did you get a chance to review it?</p>
      <p>If you have any questions or need further information, please let me know. I'd be happy to assist!</p>
      <p>Looking forward to hearing from you.</p>
      <p>Best regards,<br/>The Support Team</p>
    `;

    const response = await axios.post(
      `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/reply-email-thread?api_key=${SMARTLEAD_API_KEY}`,
      {
        email_stats_id: email_stats_id,
        email_body: followUpMessage,
        reply_message_id: reply_message_id,
        reply_email_time: reply_email_time,
        reply_email_body: reply_email_body,
        add_signature: true,
      }
    );

    // Log additional tracking information
    console.log(`Follow-up sent to ${recipient_email} in campaign ${campaign_id}`);
    console.log('Smartlead API response:', response.data);

    return response.data;
  } catch (error) {
    console.error('Failed to send follow-up email:', {
      error: error.response?.data || error.message,
      recipient: recipient_email,
      campaign: campaign_id,
    });
    throw new Error('Failed to send follow-up email');
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

    // Database update logic
    const now = new Date();
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

    const [date, time] = istDateTime.split(", ");
    const formattedDate = date.split("/").reverse().join("-");

    const updateResult = await db("stir_outreach_dashboard")
      .where("business_email", emailToUpdate)
      .update({
        replied: true,
        email_reply_date: formattedDate,
        email_reply_time: time,
        reply_content: replyContent || null
      });

    console.log(`Database update result: ${updateResult} rows affected`);

    // Send follow-up email using Smartlead API
    if (updateResult > 0 && data.campaign_id && data.email_stats_id) {
      console.log('Sending follow-up email...');
      
      const followUpResponse = await sendSmartleadFollowUp({
        campaign_id: data.campaign_id,
        email_stats_id: data.email_stats_id,
        reply_message_id: data.message_id,
        reply_email_time: data.reply_timestamp,
        reply_email_body: data.content,
        recipient_email: emailToUpdate
      });

      console.log('Follow-up email sent successfully:', followUpResponse);
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

async function sendSmartleadFollowUp({
  campaign_id,
  email_stats_id,
  reply_message_id,
  reply_email_time,
  reply_email_body,
  recipient_email
}) {
  try {
    const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY; // Ensure this is set in your environment
    const followUpMessage = `
      <p>Thank you for your response!</p>
      <p>We appreciate you taking the time to reply. Could you please share more details about your requirements? 
      We'll make sure to address them promptly.</p>
      <p>Looking forward to assisting you further.</p>
      <p>Best regards,<br/>The Support Team</p>
    `;

    const response = await axios.post(
      `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/reply-email-thread?api_key=${SMARTLEAD_API_KEY}`,
      {
        email_stats_id: email_stats_id,
        email_body: followUpMessage,
        reply_message_id: reply_message_id,
        reply_email_time: reply_email_time,
        reply_email_body: reply_email_body,
        add_signature: true
      }
    );

    // Log additional tracking information
    console.log(`Follow-up sent to ${recipient_email} in campaign ${campaign_id}`);
    console.log('Smartlead API response:', response.data);

    return response.data;
  } catch (error) {
    console.error('Failed to send follow-up email:', {
      error: error.response?.data || error.message,
      recipient: recipient_email,
      campaign: campaign_id
    });
    throw new Error('Failed to send follow-up email');
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