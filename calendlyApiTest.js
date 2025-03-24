import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your Calendly API Key
const CALENDLY_API_KEY =
  "eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzQxNzc4NjM3LCJqdGkiOiI3NzQ4MmIyNy0xMzNkLTRjZmEtODZlYi1mZmU3N2ExMDI3N2MiLCJ1c2VyX3V1aWQiOiI1YzhmMTYwMy04OWQ5LTQ1N2MtYmEyNS04ZDZiZmM2ZDhjZDMifQ.LZZe3i3-oW3NnLmRxCz35c29P7MeqFQj_vXjb1p-A0dphRFsWCYEpc9PIZ-3011Aoldy46MNEvaecGrKfAPlMg";

// Function to get scheduled events

const USER_URI =
  "https://api.calendly.com/users/5c8f1603-89d9-457c-ba25-8d6bfc6d8cd3";
// Function to get scheduled events
async function getScheduledEvents() {
  try {
    const response = await axios.get(
      "https://api.calendly.com/scheduled_events",
      {
        headers: { Authorization: `Bearer ${CALENDLY_API_KEY}` },
        params: { user: USER_URI },
      }
    );

    return response.data.collection; // List of events
  } catch (error) {
    console.error(
      "Error fetching events:",
      error.response?.data || error.message
    );
    return [];
  }
}

// Function to get invitee details for an event
async function getInvitees(eventUri) {
  try {
    const response = await axios.get(`${eventUri}/invitees`, {
      headers: { Authorization: `Bearer ${CALENDLY_API_KEY}` },
    });

    return response.data.collection.map((invitee) => ({
      name: invitee.name, // Invitee's name
      email: invitee.email, // Invitee's email
    }));
  } catch (error) {
    console.error(
      "Error fetching invitees:",
      error.response?.data || error.message
    );
    return [];
  }
}

const events = await getScheduledEvents();

  const upcomingMeetings = [];

  for (const event of events) {
    if (event.status === "active") {
      // Only show active (upcoming) events
      const invitees = await getInvitees(event.uri); // Get invitee details

      invitees.forEach((invitee) => {
        upcomingMeetings.push({
          name: invitee.name,
          email: invitee.email,
          start_time: event.start_time,
          end_time: event.end_time,
        });
      });
    }
  }

  console.log(upcomingMeetings);