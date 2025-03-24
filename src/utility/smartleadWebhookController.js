import { handleEmailReply, handleEmailSent, handleLeadUnsubscribed } from "./webhookEvent.js";


export const processSmartleadWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    console.log("Raw webhook data:", JSON.stringify(webhookData, null, 2));

    // Validate the webhook data structure
    if (!webhookData.to_email) {
      throw new Error("Missing lead_email in webhook data");
    }

    switch (webhookData.event_type) {
      case "EMAIL_SENT":
        await handleEmailSent(webhookData);
        break;
      case "EMAIL_REPLY":
        await handleEmailReply(webhookData);
        break;
      case "LEAD_UNSUBSCRIBED":
        await handleLeadUnsubscribed(webhookData);
        break;
      default:
        console.log(`Unhandled event type: ${webhookData.event_type}`);
    }

    res.status(200).json({
      status: "success",
      message: `Successfully processed ${webhookData.event_type} event`,
    });
  } catch (error) {
    console.error("Webhook processing error:", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      status: "error",
      message: "Error processing webhook",
      error: error.message,
    });
  }
};

