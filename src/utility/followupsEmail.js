// src/cron/followupEmails.js
import cron from 'node-cron';
import { db } from '../db/db.js';
import dotenv from "dotenv";
import fetch from 'node-fetch';
dotenv.config();
const API_BASE_URL = "https://server.smartlead.ai/api/v1";
const API_KEY = "eaf95559-9524-40ec-bb75-a5bf585ce25b_94ivz0y";

// List of specific usernames to send follow-ups to
const ALLOWED_USERNAMES = [
  'axxat18', 
  'create_stir', 
];

// Toggle variable to control whether to use only approved users or all users
const USE_ONLY_APPROVED_USERS = false; // Set to false to target all users, true for only approved users

/**
 * Helper function to calculate dates for follow-ups
 */
const getDaysAgo = (days) => {
  const now = new Date();
  
  // Get IST date
  const istDate = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  // Subtract days
  istDate.setDate(istDate.getDate() - days);
  
  // Format as YYYY-MM-DD
  const dateString = istDate.toISOString().split('T')[0];
  
  console.log(`${days} days ago in IST: ${dateString}`);
  return dateString;
};

/**
 * Fetches data from the Smartlead API with improved error handling.
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
 * Checks if the lead has replied to any email
 */
const hasLeadReplied = (messageHistory) => {
  const replies = messageHistory.filter(msg => msg.type === "RECEIVED");
  return replies.length > 0;
};

/**
 * Sends a follow-up email to the latest message in the thread.
 * @param {number} followUpNumber - Which follow-up this is (1, 2, or 3)
 */
const sendFollowUpEmail = async (campaignId, latestMessage, username, poc, followUpNumber = 1) => {
  console.log(`Sending follow-up #${followUpNumber} to ${username}`);
  
  let emailBody;
  
  // Different email templates for each follow-up
  if (followUpNumber === 1) {
    emailBody = `
      <p>Hey @${username},</p>
      Just a friendly nudge – haven't heard back from you. Figured I'd check in before you get completely lost in your next big movie review. <br><br>
  Seriously though, I think you would love what we're building at Stir. It's all about connecting passionate film lovers like you with filmmakers and studios. Think of early access, collabs, and a straight forward way to streamline your influence.<br><br>
  Why miss out? Let's chat when you have even 15 minutes. <a href="https://createstir.com/calendly">createstir.com/calendly</a><br><br>
  Best,<br>${poc}
    `;
  } 
  else if (followUpNumber === 2) {
    emailBody = `
      <p>Hi @${username},</p>
      I wanted to check in quickly as I know how emails can sometimes get buried in the mix. I'm reaching out about Stir, an invite-only platform connecting influencers like yourself with early access to unreleased films and opportunities to collaborate directly with leading studios.<br><br>
  Would love to connect if you think this might be a good fit for you. Let's chat for 15 minutes. <a href="https://createstir.com/calendly">createstir.com/calendly</a><br><br>
  Best,<br>${poc}
    `;
  }
  else if (followUpNumber === 3) {
    emailBody = `
      <p>Hi @${username},</p>
      Sorry to follow up one more time, but I wanted to reach out about your exclusive access to Stir. Since it's an invite-only platform, we're very intentional about who we work with, and I really think you'd be a great fit.<br><br>
  If this sounds interesting, I'd love to chat more. And if not, no problem at all - just let me know, I won't take it personally.<br><br>
  Best,<br>${poc}
    `;
  }

  const replyRequestBody = {
    email_stats_id: latestMessage.stats_id || latestMessage.email_stats_id,
    email_body: emailBody,
    reply_message_id: latestMessage.message_id,
    reply_email_time: latestMessage.time || latestMessage.sent_time,
    reply_email_body: latestMessage.email_body,
    add_signature: true,
  };

  console.log(`Sending follow-up #${followUpNumber} email to ${username}...`);
  return await fetchFromApi(
    `campaigns/${campaignId}/reply-email-thread`,
    "POST",
    replyRequestBody
  );
};

/**
 * Helper function to get current date and time in IST
 * @returns {Object} Object with date and time properties in IST
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

/**
 * Update the database to record that a follow-up email was sent
 */
const updateDatabaseForFollowup = async (email, followUpNumber) => {
  console.log(`Updating database for follow-up #${followUpNumber} email sent to ${email}...`);
  
  const updateObj = {};
  const { date, time } = getCurrentISTDateTime();
  
  if (followUpNumber === 1) {
    updateObj.follow_up_1_status = true;
    updateObj.follow_up_1_date = date;
    updateObj.follow_up_1_time = time;
  } 
  else if (followUpNumber === 2) {
    updateObj.follow_up_2_status = true;
    updateObj.follow_up_2_date = date;
    updateObj.follow_up_2_time = time;
  }
  else if (followUpNumber === 3) {
    updateObj.follow_up_3_status = true;
    updateObj.follow_up_3_date = date;
    updateObj.follow_up_3_time = time;
  }

  const updateResult = await db("stir_outreach_dashboard")
    .where("business_email", email)
    .update(updateObj);

  if (updateResult === 0) {
    console.warn(`No matching record found for email: ${email}`);
    throw new Error("No matching record found");
  }
  console.log(`Database updated successfully for follow-up #${followUpNumber}`);
  return updateResult;
};


/**
 * Base query function that applies user filtering based on the setting
 */
const getBaseQuery = (query) => {
  // Apply username filtering only if USE_ONLY_APPROVED_USERS is true
  if (USE_ONLY_APPROVED_USERS) {
    console.log("Using only approved usernames for follow-up emails");
    return query.whereIn("username", ALLOWED_USERNAMES);
  } else {
    console.log("Targeting all users for follow-up emails");
    return query;
  }
};

/**
 * Process leads for first follow-up
 */
export const sendFirstFollowup = async () => {
  console.log("Starting to send first follow-up emails...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  
  try {
    // Calculate date 4 days ago for first follow-up
    const fourDaysAgo = getDaysAgo(4);
    console.log(`Looking for leads who received first email on or before: ${fourDaysAgo}`);
    
    // Get leads that need first follow-up (first email sent 4+ days ago)
    let query = db("stir_outreach_dashboard")
      .where("first_email_status", "sent")
      .andWhere(function() {
        this.where("follow_up_1_status", false)
            .orWhereNull("follow_up_1_status");
      })
      .andWhere(function() {
        // Make sure links haven't been clicked
        this.where("calendly_link_clicked", false)
            .orWhereNull("calendly_link_clicked");
      })
      .andWhere(function() {
        this.where("onboarding_link_clicked", false)
            .orWhereNull("onboarding_link_clicked");
      })
      .andWhere(function() {
        // Make sure the lead hasn't replied
        this.where("replied", false)
            .orWhereNull("replied");
      })
      .andWhere(function() {
        // First email must have been sent at least 4 days ago
        this.where("first_email_date", "<=", fourDaysAgo);
      });
    
    // Apply user filtering if needed
    query = getBaseQuery(query);
    
    const leadsToFollowUp = await query;
    
    console.log(`Found ${leadsToFollowUp.length} leads for first follow-up`);
    
    if (leadsToFollowUp.length === 0) {
      console.log("No leads found for first follow-up. Exiting.");
      return;
    }
    
    // Process each lead for first follow-up
    for (const lead of leadsToFollowUp) {
      try {
        console.log(`Processing first follow-up for ${lead.username} (${lead.business_email})`);
        console.log(`First email was sent on: ${lead.first_email_date}`);
        
        // Get the campaign ID
        const campaignId = lead.campaign_id;
        if (!campaignId) {
          console.warn(`No campaign ID found for lead ${lead.business_email}, skipping`);
          continue;
        }
        
        // Get the lead ID from Smartlead
        const leadId = await fetchLeadId(lead.business_email);
        
        // Get message history
        const messageHistory = await fetchMessageHistory(campaignId, leadId);
        
        // Check if the lead has replied
        if (hasLeadReplied(messageHistory)) {
          console.log(`Lead ${lead.username} has already replied, updating database and skipping follow-up`);
          await db("stir_outreach_dashboard")
            .where("business_email", lead.business_email)
            .update({ replied: true });
          continue;
        }
        
        const latestMessage = findLatestSentMessage(messageHistory);
        
        if (!latestMessage) {
          console.warn(`No sent messages found for lead ${lead.business_email}, skipping`);
          continue;
        }
        
        // Send first follow-up
        const response = await sendFollowUpEmail(
          campaignId,
          latestMessage,
          lead.username,
          lead.poc,
          1
        );
        
        console.log(`First follow-up sent to ${lead.business_email} (${lead.username})`);
        
        // Update database
        await updateDatabaseForFollowup(lead.business_email, 1);
        
        // Add a small delay between processing different leads
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error processing first follow-up for ${lead.username} (${lead.business_email}):`, error);
        // Continue with the next lead
      }
    }
    
    console.log("First follow-up email job completed");
    
  } catch (error) {
    console.error("Error in first follow-up email job:", error);
  }
};

/**
 * Process leads for second follow-up
 */
export const sendSecondFollowup = async () => {
  console.log("Starting to send second follow-up emails...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  
  try {
    // Calculate date 2 days ago for second follow-up
    const twoDaysAgo = getDaysAgo(2);
    console.log(`Looking for leads who received first follow-up on or before: ${twoDaysAgo}`);
    
    // Get leads that need second follow-up (first follow-up sent 2+ days ago)
    let query = db("stir_outreach_dashboard")
      .where("first_email_status", "sent")
      .andWhere("follow_up_1_status", true)
      .andWhere(function() {
        this.where("follow_up_2_status", false)
            .orWhereNull("follow_up_2_status");
      })
      .andWhere(function() {
        // Make sure links haven't been clicked
        this.where("calendly_link_clicked", false)
            .orWhereNull("calendly_link_clicked");
      })
      .andWhere(function() {
        this.where("onboarding_link_clicked", false)
            .orWhereNull("onboarding_link_clicked");
      })
      .andWhere(function() {
        // Make sure the lead hasn't replied
        this.where("replied", false)
            .orWhereNull("replied");
      })
      .andWhere(function() {
        // First follow-up must have been sent at least 2 days ago
        this.where("follow_up_1_date", "<=", twoDaysAgo);
      });
    
    // Apply user filtering if needed
    query = getBaseQuery(query);
    
    const leadsToFollowUp = await query;
    
    console.log(`Found ${leadsToFollowUp.length} leads for second follow-up`);
    
    if (leadsToFollowUp.length === 0) {
      console.log("No leads found for second follow-up. Exiting.");
      return;
    }
    
    // Process each lead for second follow-up
    for (const lead of leadsToFollowUp) {
      try {
        console.log(`Processing second follow-up for ${lead.username} (${lead.business_email})`);
        console.log(`First follow-up was sent on: ${lead.follow_up_1_date}`);
        
        // Get the campaign ID
        const campaignId = lead.campaign_id;
        if (!campaignId) {
          console.warn(`No campaign ID found for lead ${lead.business_email}, skipping`);
          continue;
        }
        
        // Get the lead ID from Smartlead
        const leadId = await fetchLeadId(lead.business_email);
        
        // Get message history
        const messageHistory = await fetchMessageHistory(campaignId, leadId);
        
        // Check if the lead has replied
        if (hasLeadReplied(messageHistory)) {
          console.log(`Lead ${lead.username} has already replied, updating database and skipping follow-up`);
          await db("stir_outreach_dashboard")
            .where("business_email", lead.business_email)
            .update({ replied: true });
          continue;
        }
        
        const latestMessage = findLatestSentMessage(messageHistory);
        
        if (!latestMessage) {
          console.warn(`No sent messages found for lead ${lead.business_email}, skipping`);
          continue;
        }
        
        // Send second follow-up
        const response = await sendFollowUpEmail(
          campaignId,
          latestMessage,
          lead.username,
          lead.poc,
          2
        );
        
        console.log(`Second follow-up sent to ${lead.business_email} (${lead.username})`);
        
        // Update database
        await updateDatabaseForFollowup(lead.business_email, 2);
        
        // Add a small delay between processing different leads
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error processing second follow-up for ${lead.username} (${lead.business_email}):`, error);
        // Continue with the next lead
      }
    }
    
    console.log("Second follow-up email job completed");
    
  } catch (error) {
    console.error("Error in second follow-up email job:", error);
  }
};

/**
 * Process leads for third follow-up
 */
export const sendThirdFollowup = async () => {
  console.log("Starting to send third follow-up emails...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  
  try {
    // Calculate date 1 day ago for third follow-up
    const oneDayAgo = getDaysAgo(1);
    console.log(`Looking for leads who received second follow-up on or before: ${oneDayAgo}`);
    
    // Get leads that need third follow-up (second follow-up sent 1+ day ago)
    let query = db("stir_outreach_dashboard")
      .where("first_email_status", "sent")
      .andWhere("follow_up_1_status", true)
      .andWhere("follow_up_2_status", true)
      .andWhere(function() {
        this.where("follow_up_3_status", false)
            .orWhereNull("follow_up_3_status");
      })
      .andWhere(function() {
        // Make sure links haven't been clicked
        this.where("calendly_link_clicked", false)
            .orWhereNull("calendly_link_clicked");
      })
      .andWhere(function() {
        this.where("onboarding_link_clicked", false)
            .orWhereNull("onboarding_link_clicked");
      })
      .andWhere(function() {
        // Make sure the lead hasn't replied
        this.where("replied", false)
            .orWhereNull("replied");
      })
      .andWhere(function() {
        // Second follow-up must have been sent at least 1 day ago
        this.where("follow_up_2_date", "<=", oneDayAgo);
      });
    
    // Apply user filtering if needed
    query = getBaseQuery(query);
    
    const leadsToFollowUp = await query;
    
    console.log(`Found ${leadsToFollowUp.length} leads for third follow-up`);
    
    if (leadsToFollowUp.length === 0) {
      console.log("No leads found for third follow-up. Exiting.");
      return;
    }
    
    // Process each lead for third follow-up
    for (const lead of leadsToFollowUp) {
      try {
        console.log(`Processing third follow-up for ${lead.username} (${lead.business_email})`);
        console.log(`Second follow-up was sent on: ${lead.follow_up_2_date}`);
        
        // Get the campaign ID
        const campaignId = lead.campaign_id;
        if (!campaignId) {
          console.warn(`No campaign ID found for lead ${lead.business_email}, skipping`);
          continue;
        }
        
        // Get the lead ID from Smartlead
        const leadId = await fetchLeadId(lead.business_email);
        
        // Get message history
        const messageHistory = await fetchMessageHistory(campaignId, leadId);
        
        // Check if the lead has replied
        if (hasLeadReplied(messageHistory)) {
          console.log(`Lead ${lead.username} has already replied, updating database and skipping follow-up`);
          await db("stir_outreach_dashboard")
            .where("business_email", lead.business_email)
            .update({ replied: true });
          continue;
        }
        
        const latestMessage = findLatestSentMessage(messageHistory);
        
        if (!latestMessage) {
          console.warn(`No sent messages found for lead ${lead.business_email}, skipping`);
          continue;
        }
        
        // Send third follow-up
        const response = await sendFollowUpEmail(
          campaignId,
          latestMessage,
          lead.username,
          lead.poc,
          3
        );
        
        console.log(`Third follow-up sent to ${lead.business_email} (${lead.username})`);
        
        // Update database
        await updateDatabaseForFollowup(lead.business_email, 3);
        
        // Add a small delay between processing different leads
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error processing third follow-up for ${lead.username} (${lead.business_email}):`, error);
        // Continue with the next lead
      }
    }
    
    console.log("Third follow-up email job completed");
    
  } catch (error) {
    console.error("Error in third follow-up email job:", error);
  }
};

/**
 * Set up cron jobs for follow-up emails
 * All three follow-up jobs run every hour to check for eligible leads
 */
export const setupFollowupEmailCron = () => {
    // First follow-up at 10:00 PM IST (16:30 UTC)
    cron.schedule('30 16 * * *', async () => {
      console.log('Running the first follow-up email check (10:00 PM IST)...');
      await sendFirstFollowup();
    });
    
    // Second follow-up at 10:30 PM IST (17:00 UTC)
    cron.schedule('0 17 * * *', async () => {
      console.log('Running the second follow-up email check (10:30 PM IST)...');
      await sendSecondFollowup();
    });
    
    // Third follow-up at 11:00 PM IST (17:30 UTC)
    cron.schedule('30 17 * * *', async () => {
      console.log('Running the third follow-up email check (11:00 PM IST)...');
      await sendThirdFollowup();
    });
    
    console.log('Follow-up email cron jobs scheduled:');
    console.log('- First follow-up check: Daily at 10:00 PM IST');
    console.log('- Second follow-up check: Daily at 10:30 PM IST');
    console.log('- Third follow-up check: Daily at 11:00 PM IST');
    console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  };

/**
 * Simplified function to run all follow-up checks in sequence
 */
export const sendFollowupEmails = async () => {
  console.log("Starting follow-up email checks...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  await sendFirstFollowup();
  await sendSecondFollowup();
  await sendThirdFollowup();
  console.log("All follow-up checks completed.");
};