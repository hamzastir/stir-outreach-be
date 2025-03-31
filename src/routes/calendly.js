import express from "express";
import { db } from "../db/db.js";

const router = express.Router();


router.get((req, res) => {
  // Log the entire request body to see what Calendly sends
  console.log('Webhook received!');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Check if this is a booking creation event
  if (req.body.event === 'invitee.created') {
    console.log('Hi! Someone booked a meeting with you!');
    console.log(`Name: ${req.body.payload.name}`);
    console.log(`Email: ${req.body.payload.email}`);
    // console.log(`Event Type: ${req.body.payload.event_type.name}`);
    console.log(`schedule at Time: ${req.body.payload.scheduled_event.created_at}`);
    console.log(`Start Time: ${req.body.payload.scheduled_event.start_time}`);
    console.log(`End Time: ${req.body.payload.scheduled_event.end_time}`);
  }
  
  // Always respond with 200 to acknowledge receipt
  res.status(200).send('Webhook received successfully');
})






export default router;
