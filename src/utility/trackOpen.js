import dotenv from "dotenv";
import { fetchBunnyCDNLogs } from "../utility/fetchBunnyLogs.js";
import { db } from "../db/db.js";
dotenv.config();

export const checkEmailOpens = async () => {
    try {
        const logs = await fetchBunnyCDNLogs();
        if (!logs?.length) return;

        const humanLogs = logs.filter(log => {
            return (
                log.statusCode === "200" &&
                log.refererUrl?.includes('mail.google.com') &&
                log.userAgent?.includes('Chrome') &&  // Real browser user agent
                !log.userAgent?.includes('GoogleImageProxy') &&
                !log.userAgent?.includes('ggpht.com') &&
                log.remoteIp?.startsWith('209.85.238') // Gmail server IP pattern
            );
        });

        if (!humanLogs.length) return;
        console.log(`Processing ${humanLogs.length} genuine email opens`);

        for (const log of humanLogs) {
            const trackingId = extractTrackingId(log.url);
            if (!trackingId) continue;

            try {
                // Check if this email is already marked as opened
                const trackingData = await db("email_open_tracking_ids")
                    .where({
                        "tracking_id": trackingId,
                        "is_opened": false
                    })
                    .first();

                if (!trackingData) continue;

                const timestamp = new Date(log.timestamp);

                // Update both tables in a transaction
                await db.transaction(async (trx) => {
                    // Update tracking table
                    await trx("email_open_tracking_ids")
                        .where("tracking_id", trackingId)
                        .update({
                            is_opened: true,
                            opened_at: timestamp
                        });

                    // Update dashboard table
                    await trx("stir_outreach_dashboard")
                        .where("business_email", trackingData.email)
                        .update({
                            email_opened: true,
                            email_open_date: timestamp.toISOString().split('T')[0],
                            email_open_time: timestamp.toTimeString().split(' ')[0]
                        });

                    console.log(`✅ Email open recorded - ${trackingData.email} at ${timestamp.toISOString()}`);
                });

            } catch (error) {
                console.error(`Failed to process tracking ID ${trackingId}:`, error);
            }
        }

    } catch (error) {
        console.error("Error in checkEmailOpens:", error);
    }
};

function extractTrackingId(url) {
    if (!url) return null;
    const match = url.match(/\/([a-f0-9-]{36})\.jpeg$/);
    return match ? match[1] : null;
}

