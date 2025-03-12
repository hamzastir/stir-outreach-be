import { db } from "../db/db.js"; 
// Function to process Calendly webhook
export async function calendlyWebhook(req, res) {
    try {
        const eventData = req.body;

        if (eventData.event === "invitee.created") {
            const invitee = eventData.payload.invitee;
            const scheduledTime = eventData.payload.scheduled_event.start_time;

            console.log("📅 New Meeting Scheduled!");
            console.log("Name:", invitee.name);
            console.log("Email:", invitee.email);
            console.log("Meeting Time:", scheduledTime);

            // Update database to set video_call_status to "scheduled"
            await db("stir_outreach_dashboard")
                .where("business_email", invitee.email)
                .update({
                    video_call_status: "scheduled",
                    video_call_date: scheduledTime
                });

            console.log(`✅ Updated database: ${invitee.email} scheduled at ${scheduledTime}`);
        }

        if (eventData.event === "invitee.canceled") {
            const invitee = eventData.payload.invitee;
            const canceledTime = eventData.payload.scheduled_event.start_time;

            console.log("❌ Meeting Canceled!");
            console.log("Name:", invitee.name);
            console.log("Email:", invitee.email);

            // Update database to set video_call_status to "completed"
            await db("stir_outreach_dashboard")
                .where("business_email", invitee.email)
                .update({
                    video_call_status: "canceled",
                    video_call_date: canceledTime
                });

            console.log(`✅ Updated database: ${invitee.email} call marked as completed`);
        }

        res.status(200).send("Webhook received");
    } catch (error) {
        console.error("❌ Error processing webhook:", error);
        res.status(500).send("Internal Server Error");
    }
}
