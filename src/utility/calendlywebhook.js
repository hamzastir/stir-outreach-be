import { db } from "../db/db.js"; 
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CALENDLY_API_TOKEN = 'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzQxNzc4NjM3LCJqdGkiOiI3NzQ4MmIyNy0xMzNkLTRjZmEtODZlYi1mZmU3N2ExMDI3N2MiLCJ1c2VyX3V1aWQiOiI1YzhmMTYwMy04OWQ5LTQ1N2MtYmEyNS04ZDZiZmM2ZDhjZDMifQ.LZZe3i3-oW3NnLmRxCz35c29P7MeqFQj_vXjb1p-A0dphRFsWCYEpc9PIZ-3011Aoldy46MNEvaecGrKfAPlMg';

// Your ngrok URL + endpoint
const WEBHOOK_URL = 'http://104.131.101.181:3007/api/calendly-webhook';

// Your organization URI - get this from your Calendly account
// Typically looks like: https://api.calendly.com/organizations/YOURORGANIZATIONID
const ORGANIZATION_URI = 'https://api.calendly.com/organizations/d18f6dd1-3eb5-4e67-8add-914c9ec7f857';
// 🎯 Create Webhook Subscription
export async function createWebhook() {
  try {
    const response = await axios.post(
      'https://api.calendly.com/webhook_subscriptions',
      {
        url: WEBHOOK_URL,
        events: ['invitee.created'], // This event occurs when someone books
        organization: ORGANIZATION_URI,
        scope: 'organization'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CALENDLY_API_TOKEN}`
        }
      }
    );
    
    console.log('Webhook created successfully:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error creating webhook:');
    console.error(error.response ? error.response.data : error.message);
  }
}