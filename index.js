const axios = require("axios");
require("dotenv").config();

class SmartLeadCampaign {
  constructor() {
    // Configuration
    this.API_KEY = process.env.SMARTLEAD_API_KEY;
    this.BASE_URL = "https://server.smartlead.ai/api/v1";

    // Campaign and Email Account Details
    this.CAMPAIGN_ID = process.env.CAMPAIGN_ID;
    this.EMAIL_ACCOUNT_ID = process.env.EMAIL_ACCOUNT_ID;

    // Links
    this.CALENDLY_URL = process.env.CALENDLY_URL;
    this.ONBOARDING_URL = process.env.ONBOARDING_URL;

    // Recipients
    this.recipients = [
      { email: "axxatagrawal@gmail.com", firstName: "Akshat" },
      { email: "saif@createstir.com", firstName: "Saif" },
      { email: "yug@createstir.com", firstName: "Yug" },

    ];

    // Retry configuration
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 5000; // 5 seconds
  }

  createAxiosInstance() {
    return axios.create({
      baseURL: this.BASE_URL,
      params: { api_key: this.API_KEY },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000, // 30 seconds timeout
    });
  }

  // Helper method to delay execution
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper method to handle retries
  async withRetry(operation, name) {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.log(`Attempt ${attempt} failed for ${name}`);
        
        if (attempt === this.MAX_RETRIES) {
          throw error;
        }

        const delayTime = this.RETRY_DELAY * attempt;
        console.log(`Retrying in ${delayTime/1000} seconds...`);
        await this.delay(delayTime);
      }
    }
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  prepareLead(recipient) {
    return {
      first_name: recipient.firstName,
      email: recipient.email,
      custom_fields: {
        source: "SmartLead Bulk Campaign",
      },
    };
  }

  async addLeadsToCampaign() {
    const validLeads = this.recipients
      .filter((r) => this.validateEmail(r.email))
      .map((r) => this.prepareLead(r));

    if (validLeads.length === 0) {
      throw new Error("No valid leads to add to campaign");
    }

    return await this.withRetry(async () => {
      const api = this.createAxiosInstance();
      const response = await api.post(`campaigns/${this.CAMPAIGN_ID}/leads`, {
        lead_list: validLeads,
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_duplicate_leads_in_other_campaign: false,
        },
      });
      console.log("✅ Leads Added Successfully:", response.data);
      return response.data;
    }, "addLeadsToCampaign");
  }

  async updateCampaignSchedule() {
    return await this.withRetry(async () => {
      const api = this.createAxiosInstance();
      const now = new Date();
      const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const currentHour = istTime.getHours();
      const currentMinute = istTime.getMinutes();
      
      // Format current time as HH:mm
      const currentTimeFormatted = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
   
      const schedulePayload = {
        timezone: "Asia/Kolkata",
        days_of_the_week: [0, 1, 2, 3, 4, 5, 6], // All days of the week
        start_hour: currentTimeFormatted, // Start from current time
        end_hour: "23:59", // End at midnight
        min_time_btw_emails: 3, // Minimum possible delay (1 minute)
        max_new_leads_per_day: 100 // Increased daily limit
      };

      const response = await api.post(
        `campaigns/${this.CAMPAIGN_ID}/schedule`,
        schedulePayload
      );
      console.log("✅ Campaign Schedule Updated Successfully:", response.data);
      return response.data;
    }, "updateCampaignSchedule");
  }

  async createCampaignSequence() {
    return await this.withRetry(async () => {
      const api = this.createAxiosInstance();
      const sequencePayload = {
        sequences: [
          {
            seq_number: 1,
            seq_delay_details: { delay_in_days: 0 },
            seq_variants: [
              {
                subject: "Hi {{FIRST_NAME}}, Let's Connect!",
                email_body: this.generateEmailBody(),
                variant_label: "A",
              },
            ],
          },
        ],
      };

      const response = await api.post(
        `campaigns/${this.CAMPAIGN_ID}/sequences`,
        sequencePayload
      );
      console.log("✅ Campaign Sequence Created Successfully:", response.data);
      return response.data;
    }, "createCampaignSequence");
  }

  generateEmailBody() {
    return `
      <p>Hey {{FIRST_NAME}},</p>
      <p>I hope you're doing well!</p>
      
      <p>Here are two important links for you:</p>
      
      <ol>
          <li>
              <strong>Schedule a Call:</strong>
              <a href="${this.CALENDLY_URL}">Book a 30-minute meeting</a>
          </li>
          <li>
              <strong>Onboarding Details:</strong>
              <a href="${this.ONBOARDING_URL}">Start Your Onboarding Process</a>
          </li>
      </ol>
      
      <p>Looking forward to connecting with you!</p>
      
      <p>Best regards,<br>Akshat</p>
    `;
  }

  async startCampaign() {
    return await this.withRetry(async () => {
      const api = this.createAxiosInstance();
      const response = await api.post(
        `campaigns/${this.CAMPAIGN_ID}/status`,
        { status: "START" }
      );
      console.log("✅ Campaign Started Successfully:", response.data);
      return response.data;
    }, "startCampaign");
  }

  async validateCampaignSetup() {
    return await this.withRetry(async () => {
      const api = this.createAxiosInstance();
      const response = await api.get(`campaigns/${this.CAMPAIGN_ID}`);
      if (!response.data) {
        throw new Error("Campaign not found");
      }
      console.log("✅ Campaign Validated Successfully");
      return true;
    }, "validateCampaignSetup");
  }

  async execute() {
    try {
      console.log("🚀 Starting SmartLead Campaign Automation");

      // First validate the campaign exists
      await this.validateCampaignSetup();

      // Then execute the campaign setup steps
      const steps = [
        { name: "Update Campaign Schedule", fn: () => this.updateCampaignSchedule() },
        { name: "Add Leads to Campaign", fn: () => this.addLeadsToCampaign() },
        { name: "Create Campaign Sequence", fn: () => this.createCampaignSequence() },
        { name: "Start Campaign", fn: () => this.startCampaign() }
      ];

      for (const step of steps) {
        console.log(`\n📍 Executing: ${step.name}`);
        await step.fn();
        await this.delay(2000); // Add a small delay between steps
      }

      console.log("\n✅ Campaign Setup Complete! Emails will be sent according to schedule.");
    } catch (error) {
      console.error("\n❌ Campaign Setup Failed:", error.message);
      if (error.response) {
        console.error("Error Details:", {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }
}

async function runCampaign() {
  try {
    const campaign = new SmartLeadCampaign();
    await campaign.execute();
  } catch (error) {
    console.error("Campaign execution failed:", error.message);
    process.exit(1);
  }
}

// Run the campaign
runCampaign();