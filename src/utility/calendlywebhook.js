import { db } from "../db/db.js"; 
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CALENDLY_API_URL = "https://api.calendly.com/webhook_subscriptions";
const AUTH_TOKEN = `Bearer eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzQxNzc4NjM3LCJqdGkiOiI3NzQ4MmIyNy0xMzNkLTRjZmEtODZlYi1mZmU3N2ExMDI3N2MiLCJ1c2VyX3V1aWQiOiI1YzhmMTYwMy04OWQ5LTQ1N2MtYmEyNS04ZDZiZmM2ZDhjZDMifQ.LZZe3i3-oW3NnLmRxCz35c29P7MeqFQj_vXjb1p-A0dphRFsWCYEpc9PIZ-3011Aoldy46MNEvaecGrKfAPlMg`;
const WEBHOOK_URL = 'https://stir-email-outreach.onrender.com/api/webhook/calendly';
const ORGANIZATION_URI = 'https://api.calendly.com/users/5c8f1603-89d9-457c-ba25-8d6bfc6d8cd3';

// 🎯 Create Webhook Subscription
export const createCalendlyWebhook = async (req, res) => {
  try {
    const payload = {
      url: WEBHOOK_URL,
      events: ["invitee.created", "invitee.canceled"],
      organization: ORGANIZATION_URI,
      scope: "organization",
    };

    const response = await axios.post(CALENDLY_API_URL, payload, {
      headers: {
        Authorization: AUTH_TOKEN,
        "Content-Type": "application/json",
      },
    });

    res.status(201).json(response.data);
  } catch (error) {
    console.error("❌ Error creating webhook:", error.response?.data || error);
    res.status(500).json({ error: "Failed to create webhook" });
  }
};

// 🎯 Handle Incoming Webhook Events
export const handleCalendlyWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (!payload?.invitee?.email || !event) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const inviteeEmail = payload.invitee.email;
    const scheduledTime = payload.event?.scheduled_at || null;

    if (event === "invitee.created") {
      await db("stir_outreach_dashboard")
        .where("business_email", inviteeEmail)
        .update({
          video_call_status: "scheduled",
          video_call_date: scheduledTime,
        });

      console.log(`✅ Video call scheduled for ${inviteeEmail}`);
    } else if (event === "invitee.canceled") {
      await db("stir_outreach_dashboard")
        .where("business_email", inviteeEmail)
        .update({
          video_call_status: "canceled",
          video_call_date: null,
        });

      console.log(`❌ Video call canceled for ${inviteeEmail}`);
    } else {
      return res.status(400).json({ error: "Unhandled event type" });
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("❌ Error handling webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
};
