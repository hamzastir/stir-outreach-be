// Updated src/utility/checkBouncedEmails.js

import axios from 'axios';
import { db } from '../db/db.js';
import dotenv from 'dotenv';

dotenv.config();

// Function to get campaign IDs from the database
const getCampaignIds = async () => {
  try {
    // Get campaign IDs from the database
    const campaigns = await db('stir_outreach_dashboard')
      .distinct('campaign_id')
      .whereNotNull('campaign_id');
    
    return campaigns.map(c => c.campaign_id);
  } catch (error) {
    console.error('Error fetching campaign IDs:', error);
    return [];
  }
};

// Function to check and update bounced emails for a single campaign
const checkBouncedEmailsForCampaign = async (campaignId) => {
  try {
    console.log(`Checking bounced emails for campaign ID: ${campaignId}`);
    
    const apiKey = process.env.SMARTLEAD_API_KEY;
    const url = `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/statistics?api_key=${apiKey}`;
    
    let response;
    try {
      response = await axios.get(url, { timeout: 15000 }); // 15-second timeout
    } catch (apiError) {
      console.error(`API Error for campaign ${campaignId}:`, apiError.message);
      // Check if it's a rate limit issue (429)
      if (apiError.response && apiError.response.status === 429) {
        console.log('Rate limit hit. Will retry in next scheduled run.');
      }
      // Log detailed API error
      if (apiError.response) {
        console.error('API Response Status:', apiError.response.status);
        console.error('API Response Data:', apiError.response.data);
      }
      return { 
        processed: 0, 
        bounced: 0, 
        error: true, 
        message: `API request failed: ${apiError.message}`
      };
    }
    
    // Check if response has the expected structure
    if (!response.data || typeof response.data !== 'object') {
      console.error(`Invalid response format from API for campaign ${campaignId}`);
      return { 
        processed: 0, 
        bounced: 0, 
        error: true, 
        message: 'Invalid API response format' 
      };
    }
    
    const { data } = response.data;
    
    // Handle empty data array
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log(`No data found for campaign ${campaignId} or empty data array returned`);
      return { 
        processed: 0, 
        bounced: 0, 
        error: false, 
        message: 'No data found or empty data array' 
      };
    }
    
    console.log(`Processing ${data.length} leads from campaign ${campaignId}`);
    
    let bounceCount = 0;
    let processedCount = 0;
    let errorCount = 0;
    
    // Process each lead
    for (const lead of data) {
      try {
        processedCount++;
        
        // Check if the lead data has the expected fields
        if (!lead.lead_name || !lead.lead_email) {
          console.warn(`Skipping record with missing name or email in campaign ${campaignId}`);
          continue;
        }
        
        if (lead.is_bounced) {
          // Update the database for bounced emails
          const updated = await db('stir_outreach_dashboard')
            .where('username', lead.lead_name.trim())
            .where('business_email', lead.lead_email.trim())
            .update({ 
              is_bounced: true,
              updated_at: new Date()
            });
          
          if (updated) {
            bounceCount++;
            console.log(`Updated is_bounced for ${lead.lead_name} (${lead.lead_email})`);
          } else {
            console.log(`No matching record found for ${lead.lead_name} (${lead.lead_email})`);
          }
        }
      } catch (dbError) {
        errorCount++;
        console.error(`Error processing lead ${lead.lead_name || 'unknown'}:`, dbError.message);
      }
    }
    
    return { 
      processed: processedCount, 
      bounced: bounceCount, 
      errors: errorCount,
      error: false,
      message: 'Successfully processed campaign data'
    };
  } catch (error) {
    console.error(`Unexpected error checking bounced emails for campaign ${campaignId}:`, error);
    return { 
      processed: 0, 
      bounced: 0, 
      error: true, 
      message: `Unexpected error: ${error.message}` 
    };
  }
};

// Function to record the job run result
const recordJobRun = async (result) => {
  try {
    // You could create a job_runs table to log each run
    // Or simply log to console for now
    console.log('Bounced email check job completed:', JSON.stringify(result, null, 2));
    
    // If you want to store this in the database, you could do:
    // await db('job_runs').insert({
    //   job_name: 'check_bounced_emails',
    //   run_at: new Date(),
    //   result: JSON.stringify(result),
    //   success: result.success
    // });
  } catch (error) {
    console.error('Error recording job run:', error);
  }
};

// Main function to check all campaigns
export const checkAllBouncedEmails = async () => {
  try {
    console.log('Starting to check bounced emails for all campaigns...');
    
    // Get all campaign IDs
    const campaignIds = await getCampaignIds();
    
    if (campaignIds.length === 0) {
      const result = { 
        success: false, 
        message: 'No campaign IDs found in the database',
        timestamp: new Date().toISOString()
      };
      await recordJobRun(result);
      return result;
    }
    
    console.log(`Found ${campaignIds.length} campaigns to check for bounced emails`);
    
    // Process each campaign with retry mechanism
    const results = [];
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    for (const campaignId of campaignIds) {
      let result = null;
      let attempts = 0;
      
      // Try up to MAX_RETRIES times for each campaign
      while (attempts < MAX_RETRIES) {
        result = await checkBouncedEmailsForCampaign(campaignId);
        
        // If successful or not a retriable error, break the retry loop
        if (!result.error || attempts >= MAX_RETRIES - 1) {
          break;
        }
        
        // Otherwise, retry after a delay
        attempts++;
        retryCount++;
        console.log(`Retrying campaign ${campaignId} (attempt ${attempts + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 5000 * attempts)); // Exponential backoff
      }
      
      results.push({ campaignId, ...result, attempts: attempts + 1 });
    }
    
    // Summarize results
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalBounced = results.reduce((sum, r) => sum + r.bounced, 0);
    const totalErrors = results.reduce((sum, r) => sum + (r.errors || 0), 0);
    const failedCampaigns = results.filter(r => r.error).length;
    
    const finalResult = { 
      success: failedCampaigns < campaignIds.length, // Consider partial success
      message: `Processed ${totalProcessed} leads, found ${totalBounced} bounced emails, encountered ${totalErrors} errors`,
      retries: retryCount,
      failedCampaigns,
      totalCampaigns: campaignIds.length,
      totalProcessed,
      totalBounced,
      totalErrors,
      timestamp: new Date().toISOString(),
      details: results
    };
    
    await recordJobRun(finalResult);
    
    console.log(`Completed bounce check: ${finalResult.message}`);
    
    return finalResult;
  } catch (error) {
    const failureResult = { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    await recordJobRun(failureResult);
    console.error('Critical error checking bounced emails:', error);
    
    return failureResult;
  }
};

// Add a function to force-add campaign_id and is_bounced columns if they don't exist
export const ensureRequiredColumns = async () => {
  try {
    const hasColumn = async (table, column) => {
      // This approach varies by database, this example is for PostgreSQL
      const exists = await db.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = ? AND column_name = ?
        )`, [table, column]);
      
      // Extract the boolean result (varies by DB client)
      return exists.rows[0].exists || 
             exists[0][0].exists || 
             Object.values(exists[0][0])[0];
    };
    
    // Check and add campaign_id if needed
    const hasCampaignId = await hasColumn('stir_outreach_dashboard', 'campaign_id');
    if (!hasCampaignId) {
      console.log('Adding campaign_id column to stir_outreach_dashboard');
      await db.schema.table('stir_outreach_dashboard', table => {
        table.string('campaign_id').nullable();
      });
    }
    
    // Check and add is_bounced if needed
    const hasBounced = await hasColumn('stir_outreach_dashboard', 'is_bounced');
    if (!hasBounced) {
      console.log('Adding is_bounced column to stir_outreach_dashboard');
      await db.schema.table('stir_outreach_dashboard', table => {
        table.boolean('is_bounced').defaultTo(false);
      });
    }
    
    return { success: true, message: 'Required columns are present or have been added' };
  } catch (error) {
    console.error('Error ensuring required columns:', error);
    return { success: false, error: error.message };
  }
};