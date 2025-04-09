// src/cron/followupEmails.js
import cron from 'node-cron';
import { db } from '../db/db.js';
import dotenv from "dotenv";
import fetch from 'node-fetch';
dotenv.config();
const API_BASE_URL = "https://server.smartlead.ai/api/v1";
const API_KEY = process.env.SMARTLEAD_API_KEY;

// List of specific usernames to send follow-ups to
const ALLOWED_USERNAMES = [
  'axxat18', 
  'create_stir', 
];

// Toggle variable to control whether to use only approved users or all users
const USE_ONLY_APPROVED_USERS = false; // Set to false to target all users, true for only approved users

// Create a lock mechanism to prevent duplicate follow-ups
const followUpLocks = {
  1: new Set(), // Set of email addresses with follow-up 1 in progress
  2: new Set(), // Set of email addresses with follow-up 2 in progress
  3: new Set(), // Set of email addresses with follow-up 3 in progress
};

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
 * Checks if the current time is within the allowed window (7 PM - 11:59 PM IST, Monday-Friday)
 * @returns {boolean} True if within allowed window, false otherwise
 */
const isWithinSendingWindow = () => {
  // Get current date/time in IST
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  // Check if it's weekend (Saturday = 6, Sunday = 0)
  const day = now.getDay();
  if (day === 0 || day === 6) {
    console.log(`Current day is ${day === 0 ? 'Sunday' : 'Saturday'}, outside of sending window`);
    return false;
  }
  
  // Check if time is between 7 PM (19:00) and 11:59 PM (23:59)
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  if (hour < 19 || hour >= 24) {
    console.log(`Current time is ${hour}:${minute}, outside of sending window (7 PM - 11:59 PM IST)`);
    return false;
  }
  
  console.log(`Current time is ${hour}:${minute}, within sending window (7 PM - 11:59 PM IST, Monday-Friday)`);
  return true;
};

/**
 * Returns the next business day, skipping weekends
 * @param {Date} date - The starting date
 * @param {number} daysToAdd - Number of days to add
 * @returns {Date} The next business day
 */
const getNextBusinessDay = (date, daysToAdd) => {
  const result = new Date(date);
  let daysAdded = 0;
  
  while (daysAdded < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  return result;
};

/**
 * Calculate the appropriate follow-up date considering weekends
 * @param {string} emailDate - The date of the previous email (YYYY-MM-DD)
 * @param {number} daysToAdd - Normal days to add for follow-up
 * @returns {string} The appropriate follow-up date (YYYY-MM-DD)
 */
const calculateFollowUpDate = (emailDate, daysToAdd) => {
  const date = new Date(emailDate);
  const nextBusinessDay = getNextBusinessDay(date, daysToAdd);
  return nextBusinessDay.toISOString().split('T')[0];
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
  
  // Create the dynamic URL with encoded parameters
  const email = encodeURIComponent(latestMessage.recipient_email || "");
  const name = encodeURIComponent(username || "");
  const id = encodeURIComponent(campaignId || "");
  const dynamicUrl = `https://www.createstir.com/onboard?email=${email}&name=${name}&id=${id}`;
  
  let emailBody;
  
  // Different email templates for each follow-up
  if (followUpNumber === 1) {
    emailBody = `
      <p>Hey @${username},</p>
      Just a friendly nudge – haven't heard back from you. Figured I'd check in before you get completely lost in your next big movie review. <br><br>
  Seriously though, I think you would love what we're building at Stir. It's all about connecting passionate film lovers like you with filmmakers and studios. Think of early access, collabs, and a straight forward way to streamline your influence.<br><br>
  Why miss out? Let's chat when you have even 15 minutes. <a href="${dynamicUrl}">createstir.com/calendly</a><br><br>
  Best,<br>${poc}
    `;
  } 
  else if (followUpNumber === 2) {
    emailBody = `
      <p>Hi @${username},</p>
      I wanted to check in quickly as I know how emails can sometimes get buried in the mix. I'm reaching out about Stir, an invite-only platform connecting influencers like yourself with early access to unreleased films and opportunities to collaborate directly with leading studios.<br><br>
  Would love to connect if you think this might be a good fit for you. Let's chat for 15 minutes. <a href="${dynamicUrl}">createstir.com/calendly</a><br><br>
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
 * Double check if follow-up has been sent already to prevent duplicate sends
 */
const isFollowUpAlreadySent = async (email, followUpNumber) => {
  // Check the database again to be 100% sure
  const record = await db("stir_outreach_dashboard")
    .where("business_email", email)
    .first();
  
  if (!record) {
    console.warn(`Record not found for ${email} in double-check`);
    return true; // Treat as already sent to be safe
  }
  
  if (followUpNumber === 1 && record.follow_up_1_status === true) {
    console.log(`Follow-up #1 already marked as sent for ${email} (double-check)`);
    return true;
  }
  
  if (followUpNumber === 2 && record.follow_up_2_status === true) {
    console.log(`Follow-up #2 already marked as sent for ${email} (double-check)`);
    return true;
  }
  
  if (followUpNumber === 3 && record.follow_up_3_status === true) {
    console.log(`Follow-up #3 already marked as sent for ${email} (double-check)`);
    return true;
  }
  
  return false;
}

/**
 * Check if the email is bounced or blocked
 */
const isEmailBouncedOrBlocked = async (email) => {
  const record = await db("stir_outreach_dashboard")
    .where("business_email", email)
    .first();
  
  if (!record) {
    console.warn(`Record not found for ${email} in bounce/block check`);
    return false; // Default to allowing follow-up if record not found
  }
  
  // Check is_bounced (corrected from is_bounce)
  if (record.is_bounced === true || record.is_blocked === true) {
    console.log(`Email ${email} is ${record.is_bounced ? 'bounced' : ''}${record.is_bounced && record.is_blocked ? ' and ' : ''}${record.is_blocked ? 'blocked' : ''}`);
    return true;
  }
  
  return false;
}

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
  // Check if we're within the sending window (7 PM - 11:59 PM IST, Monday-Friday)
  if (!isWithinSendingWindow()) {
    console.log("Outside of sending window (7 PM - 11:59 PM IST, Monday-Friday). Skipping first follow-up.");
    return;
  }

  console.log("Starting to send first follow-up emails...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  
  try {
    // Calculate date for first follow-up considering business days
    const fourDaysAgo = getDaysAgo(4);
    console.log(`Looking for leads who received first email on or before: ${fourDaysAgo}`);
    
    // Get leads that need first follow-up
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
        // First email must have been sent at least 4 business days ago
        this.where("first_email_date", "<=", fourDaysAgo);
      })
      // Exclude bounced and blocked emails - CORRECTED is_bounced instead of is_bounce
      .andWhere(function() {
        this.where("is_bounced", false)
            .orWhereNull("is_bounced");
      })
      .andWhere(function() {
        this.where("is_blocked", false)
            .orWhereNull("is_blocked");
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
        const email = lead.business_email;
        
        // Skip if already being processed (prevent concurrent processing)
        if (followUpLocks[1].has(email)) {
          console.log(`Skipping ${email} - first follow-up already in progress`);
          continue;
        }

        // Extra check to see if follow-up 1 was already sent
        const alreadySent = await isFollowUpAlreadySent(email, 1);
        if (alreadySent) {
          console.log(`Skipping first follow-up for ${email} - already sent`);
          continue;
        }
        
        // Double-check if email is bounced or blocked
        const isBounceOrBlock = await isEmailBouncedOrBlocked(email);
        if (isBounceOrBlock) {
          console.log(`Skipping first follow-up for ${email} - email is bounced or blocked`);
          continue;
        }
        
        // Check first email date to determine if we should send today based on business days
        const firstEmailDate = lead.first_email_date;
        const appropriateFollowUpDate = calculateFollowUpDate(firstEmailDate, 4);
        const currentDate = getCurrentISTDateTime().date;
        
        if (appropriateFollowUpDate > currentDate) {
          console.log(`Follow-up date (${appropriateFollowUpDate}) is in the future. Skipping for now.`);
          continue;
        }
        
        // Add lock
        followUpLocks[1].add(email);
        
        console.log(`Processing first follow-up for ${lead.username} (${email})`);
        console.log(`First email was sent on: ${lead.first_email_date}`);
        
        // Get the campaign ID
        const campaignId = lead.campaign_id;
        if (!campaignId) {
          console.warn(`No campaign ID found for lead ${email}, skipping`);
          followUpLocks[1].delete(email);
          continue;
        }
        
        // Get the lead ID from Smartlead
        const leadId = await fetchLeadId(email);
        
        // Get message history
        const messageHistory = await fetchMessageHistory(campaignId, leadId);
        
        // Check if the lead has replied
        if (hasLeadReplied(messageHistory)) {
          console.log(`Lead ${lead.username} has already replied, updating database and skipping follow-up`);
          await db("stir_outreach_dashboard")
            .where("business_email", email)
            .update({ replied: true });
          followUpLocks[1].delete(email);
          continue;
        }
        
        const latestMessage = findLatestSentMessage(messageHistory);
        
        if (!latestMessage) {
          console.warn(`No sent messages found for lead ${email}, skipping`);
          followUpLocks[1].delete(email);
          continue;
        }
        
        // Final check before sending
        const finalCheck = await isFollowUpAlreadySent(email, 1);
        if (finalCheck) {
          console.log(`Final check: first follow-up already sent to ${email}, skipping`);
          followUpLocks[1].delete(email);
          continue;
        }
        
        // Final bounce/block check
        const finalBounceCheck = await isEmailBouncedOrBlocked(email);
        if (finalBounceCheck) {
          console.log(`Final check: ${email} is bounced or blocked, skipping follow-up`);
          followUpLocks[1].delete(email);
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
        
        console.log(`First follow-up sent to ${email} (${lead.username})`);
        
        // Update database
        await updateDatabaseForFollowup(email, 1);
        
        // Release lock
        followUpLocks[1].delete(email);
        
        // Add a random delay between 1-5 minutes between processing different leads
        const randomDelay = Math.floor(Math.random() * 4 * 60 * 1000) + 60 * 1000; // 1-5 minutes in milliseconds
        console.log(`Adding random delay of ${Math.round(randomDelay/1000/60)} minutes before next follow-up`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
      } catch (error) {
        console.error(`Error processing first follow-up for ${lead.username} (${lead.business_email}):`, error);
        // Release lock in case of error
        followUpLocks[1].delete(lead.business_email);
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
  // Check if we're within the sending window (7 PM - 11:59 PM IST, Monday-Friday)
  if (!isWithinSendingWindow()) {
    console.log("Outside of sending window (7 PM - 11:59 PM IST, Monday-Friday). Skipping second follow-up.");
    return;
  }

  console.log("Starting to send second follow-up emails...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  
  try {
    // Calculate date for second follow-up considering business days
    const twoDaysAgo = getDaysAgo(2);
    console.log(`Looking for leads who received first follow-up on or before: ${twoDaysAgo}`);
    
    // Get leads that need second follow-up
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
        // First follow-up must have been sent at least 2 business days ago
        this.where("follow_up_1_date", "<=", twoDaysAgo);
      })
      // Exclude bounced and blocked emails - CORRECTED is_bounced instead of is_bounce
      .andWhere(function() {
        this.where("is_bounced", false)
            .orWhereNull("is_bounced");
      })
      .andWhere(function() {
        this.where("is_blocked", false)
            .orWhereNull("is_blocked");
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
        const email = lead.business_email;
        
        // Skip if already being processed (prevent concurrent processing)
        if (followUpLocks[2].has(email)) {
          console.log(`Skipping ${email} - second follow-up already in progress`);
          continue;
        }

        // Extra check to see if follow-up 2 was already sent
        const alreadySent = await isFollowUpAlreadySent(email, 2);
        if (alreadySent) {
          console.log(`Skipping second follow-up for ${email} - already sent`);
          continue;
        }
        
        // Double-check if email is bounced or blocked
        const isBounceOrBlock = await isEmailBouncedOrBlocked(email);
        if (isBounceOrBlock) {
          console.log(`Skipping second follow-up for ${email} - email is bounced or blocked`);
          continue;
        }
        
        // Check first follow-up date to determine if we should send today based on business days
        const followUp1Date = lead.follow_up_1_date;
        const appropriateFollowUpDate = calculateFollowUpDate(followUp1Date, 2);
        const currentDate = getCurrentISTDateTime().date;
        
        if (appropriateFollowUpDate > currentDate) {
          console.log(`Follow-up date (${appropriateFollowUpDate}) is in the future. Skipping for now.`);
          continue;
        }
        
        // Add lock
        followUpLocks[2].add(email);
        
        console.log(`Processing second follow-up for ${lead.username} (${email})`);
        console.log(`First follow-up was sent on: ${lead.follow_up_1_date}`);
        
        // Get the campaign ID
        const campaignId = lead.campaign_id;
        if (!campaignId) {
          console.warn(`No campaign ID found for lead ${email}, skipping`);
          followUpLocks[2].delete(email);
          continue;
        }
        
        // Get the lead ID from Smartlead
        const leadId = await fetchLeadId(email);
        
        // Get message history
        const messageHistory = await fetchMessageHistory(campaignId, leadId);
        
        // Check if the lead has replied
        if (hasLeadReplied(messageHistory)) {
          console.log(`Lead ${lead.username} has already replied, updating database and skipping follow-up`);
          await db("stir_outreach_dashboard")
            .where("business_email", email)
            .update({ replied: true });
          followUpLocks[2].delete(email);
          continue;
        }
        
        const latestMessage = findLatestSentMessage(messageHistory);
        
        if (!latestMessage) {
          console.warn(`No sent messages found for lead ${email}, skipping`);
          followUpLocks[2].delete(email);
          continue;
        }
        
        // Final check before sending
        const finalCheck = await isFollowUpAlreadySent(email, 2);
        if (finalCheck) {
          console.log(`Final check: second follow-up already sent to ${email}, skipping`);
          followUpLocks[2].delete(email);
          continue;
        }
        
        // Final bounce/block check
        const finalBounceCheck = await isEmailBouncedOrBlocked(email);
        if (finalBounceCheck) {
          console.log(`Final check: ${email} is bounced or blocked, skipping follow-up`);
          followUpLocks[2].delete(email);
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
        
        console.log(`Second follow-up sent to ${email} (${lead.username})`);
        
        // Update database
        await updateDatabaseForFollowup(email, 2);
        
        // Release lock
        followUpLocks[2].delete(email);
        
        // Add a random delay between 1-5 minutes between processing different leads
        const randomDelay = Math.floor(Math.random() * 4 * 60 * 1000) + 60 * 1000; // 1-5 minutes in milliseconds
        console.log(`Adding random delay of ${Math.round(randomDelay/1000/60)} minutes before next follow-up`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
      } catch (error) {
        console.error(`Error processing second follow-up for ${lead.username} (${lead.business_email}):`, error);
        // Release lock in case of error
        followUpLocks[2].delete(lead.business_email);
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
  // Check if we're within the sending window (7 PM - 11:59 PM IST, Monday-Friday)
  if (!isWithinSendingWindow()) {
    console.log("Outside of sending window (7 PM - 11:59 PM IST, Monday-Friday). Skipping third follow-up.");
    return;
  }

  console.log("Starting to send third follow-up emails...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  
  try {
    // Calculate date for third follow-up considering business days
    const oneDayAgo = getDaysAgo(1);
    console.log(`Looking for leads who received second follow-up on or before: ${oneDayAgo}`);
    
    // Get leads that need third follow-up
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
        // Second follow-up must have been sent at least 1 business day ago
        this.where("follow_up_2_date", "<=", oneDayAgo);
      })
      // Exclude bounced and blocked emails - CORRECTED is_bounced instead of is_bounce
      .andWhere(function() {
        this.where("is_bounced", false)
            .orWhereNull("is_bounced");
      })
      .andWhere(function() {
        this.where("is_blocked", false)
            .orWhereNull("is_blocked");
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
        const email = lead.business_email;
        
        // Skip if already being processed (prevent concurrent processing)
        if (followUpLocks[3].has(email)) {
          console.log(`Skipping ${email} - third follow-up already in progress`);
          continue;
        }

        // Extra check to see if follow-up 3 was already sent
        const alreadySent = await isFollowUpAlreadySent(email, 3);
        if (alreadySent) {
          console.log(`Skipping third follow-up for ${email} - already sent`);
          continue;
        }
        
        // Double-check if email is bounced or blocked
        const isBounceOrBlock = await isEmailBouncedOrBlocked(email);
        if (isBounceOrBlock) {
          console.log(`Skipping third follow-up for ${email} - email is bounced or blocked`);
          continue;
        }
        
        // Check second follow-up date to determine if we should send today based on business days
        const followUp2Date = lead.follow_up_2_date;
        const appropriateFollowUpDate = calculateFollowUpDate(followUp2Date, 1);
        const currentDate = getCurrentISTDateTime().date;
        
        if (appropriateFollowUpDate > currentDate) {
          console.log(`Follow-up date (${appropriateFollowUpDate}) is in the future. Skipping for now.`);
          continue;
        }
        
        // Add lock
        followUpLocks[3].add(email);
        
        console.log(`Processing third follow-up for ${lead.username} (${email})`);
        console.log(`Second follow-up was sent on: ${lead.follow_up_2_date}`);
        
        // Get the campaign ID
        const campaignId = lead.campaign_id;
        if (!campaignId) {
          console.warn(`No campaign ID found for lead ${email}, skipping`);
          followUpLocks[3].delete(email);
          continue;
        }
        
        // Get the lead ID from Smartlead
        const leadId = await fetchLeadId(email);
        
        // Get message history
        const messageHistory = await fetchMessageHistory(campaignId, leadId);
        
        // Check if the lead has replied
        if (hasLeadReplied(messageHistory)) {
          console.log(`Lead ${lead.username} has already replied, updating database and skipping follow-up`);
          await db("stir_outreach_dashboard")
            .where("business_email", email)
            .update({ replied: true });
          followUpLocks[3].delete(email);
          continue;
        }
        
        const latestMessage = findLatestSentMessage(messageHistory);
        
        if (!latestMessage) {
          console.warn(`No sent messages found for lead ${email}, skipping`);
          followUpLocks[3].delete(email);
          continue;
        }
        
        // Final check before sending
        const finalCheck = await isFollowUpAlreadySent(email, 3);
        if (finalCheck) {
          console.log(`Final check: third follow-up already sent to ${email}, skipping`);
          followUpLocks[3].delete(email);
          continue;
        }
        
        // Final bounce/block check
        const finalBounceCheck = await isEmailBouncedOrBlocked(email);
        if (finalBounceCheck) {
          console.log(`Final check: ${email} is bounced or blocked, skipping follow-up`);
          followUpLocks[3].delete(email);
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
        
        console.log(`Third follow-up sent to ${email} (${lead.username})`);
        
        // Update database
        await updateDatabaseForFollowup(email, 3);
        
        // Release lock
        followUpLocks[3].delete(email);
        
        // Add a random delay between 1-5 minutes between processing different leads
        const randomDelay = Math.floor(Math.random() * 4 * 60 * 1000) + 60 * 1000; // 1-5 minutes in milliseconds
        console.log(`Adding random delay of ${Math.round(randomDelay/1000/60)} minutes before next follow-up`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
      } catch (error) {
        console.error(`Error processing third follow-up for ${lead.username} (${lead.business_email}):`, error);
        // Release lock in case of error
        followUpLocks[3].delete(lead.business_email);
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
 * Running multiple times in the evening with random delays to distribute emails
 */
export const setupFollowupEmailCron = () => {
  // Check if we're within the sending window when the server starts
  const isInWindow = isWithinSendingWindow();
  
  if (isInWindow) {
    console.log("Server started within sending window. Follow-ups will only be sent at scheduled times.");
  } else {
    console.log("Server started outside sending window. No immediate follow-ups will be sent.");
  }

  // Set up multiple cron jobs throughout the evening (IST) on weekdays (1-5)
  // 7:00 PM IST (13:30 UTC)
  cron.schedule('30 13 * * 1-5', async () => {
    console.log('Running follow-up email check (7:00 PM IST)...');
    await sendFollowupEmails();
  });
  
  // 8:00 PM IST (14:30 UTC)
  cron.schedule('30 14 * * 1-5', async () => {
    console.log('Running follow-up email check (8:00 PM IST)...');
    await sendFollowupEmails();
  });
  
  // 9:00 PM IST (15:30 UTC)
  cron.schedule('30 15 * * 1-5', async () => {
    console.log('Running follow-up email check (9:00 PM IST)...');
    await sendFollowupEmails();
  });
  
  // 10:00 PM IST (16:30 UTC)
  cron.schedule('30 16 * * 1-5', async () => {
    console.log('Running follow-up email check (10:00 PM IST)...');
    await sendFollowupEmails();
  });
  
  // 11:00 PM IST (17:30 UTC)
  cron.schedule('30 17 * * 1-5', async () => {
    console.log('Running follow-up email check (11:00 PM IST)...');
    await sendFollowupEmails();
  });
  
  console.log('Follow-up email cron jobs scheduled:');
  console.log('- Follow-up checks: Weekdays (Monday-Friday) at 7 PM, 8 PM, 9 PM, 10 PM, and 11 PM IST');
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
};

/**
 * Simplified function to run all follow-up checks in sequence
 */
export const sendFollowupEmails = async () => {
  // Check if we're within the sending window (7 PM - 11:59 PM IST, Monday-Friday)
  if (!isWithinSendingWindow()) {
    console.log("Outside of sending window (7 PM - 11:59 PM IST, Monday-Friday). Skipping all follow-ups.");
    return;
  }

  console.log("Starting follow-up email checks...");
  console.log(`User targeting mode: ${USE_ONLY_APPROVED_USERS ? 'Approved users only' : 'All users'}`);
  
  await sendFirstFollowup();
  
  // Add a random delay between follow-up types (2-5 minutes)
  const randomDelay1 = Math.floor(Math.random() * 3 * 60 * 1000) + 2 * 60 * 1000;
  console.log(`Adding random delay of ${Math.round(randomDelay1/1000/60)} minutes before second follow-up job`);
  await new Promise(resolve => setTimeout(resolve, randomDelay1));
  
  await sendSecondFollowup();
  
  // Add another random delay between follow-up types (2-5 minutes)
  const randomDelay2 = Math.floor(Math.random() * 3 * 60 * 1000) + 2 * 60 * 1000;
  console.log(`Adding random delay of ${Math.round(randomDelay2/1000/60)} minutes before third follow-up job`);
  await new Promise(resolve => setTimeout(resolve, randomDelay2));
  
  await sendThirdFollowup();
  
  console.log("All follow-up checks completed.");
};