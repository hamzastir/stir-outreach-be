import { uploadTrackingImage } from "./uploadImage.js";
import dotenv from "dotenv";
dotenv.config();

const CALENDLY_BASE_URL = "https://email-outreach-five.vercel.app/calendly";
const ONBOARDING_BASE_URL = "https://createstir.com/onboard";

const generateParameterizedUrls = (recipient) => {
  const params = new URLSearchParams({
    email: recipient.email,
    name: recipient.firstName,
  });

  return {
    calendlyUrl: `${CALENDLY_BASE_URL}?${params.toString()}`,
    onboardingUrl: `${ONBOARDING_BASE_URL}?${params.toString()}`,
  };
};

export const generateEmailBody = async (recipient) => {
  // const { imageUrl, trackingId } = await uploadTrackingImage(recipient.email);
  const { calendlyUrl, onboardingUrl } = generateParameterizedUrls(recipient);

  console.log({ calendlyUrl, onboardingUrl });

  // const stirLogo = `<img src="${imageUrl}" width="40" height="40"/>`;

  return `
        <p>{Hi|Hey|Hello} ${recipient.firstName}, I’m Yug</p>

<p>${recipient.snippet1}</p>

    I wanted to reach out because we’re building something exciting at Stir.  
    It’s an invite-only platform designed specifically for film influencers like you.  
    It gives early access to upcoming releases and direct collaboration opportunities  
    with indie filmmakers and major studios.

    Here’s what makes Stir unique:<br>
    - A flat 10% take rate—no hidden fees or subscriptions.<br>
    - Easy-to-use tools to streamline collaborations with filmmakers.<br>
    - Curated matchmaking to connect you with the right industry partners.

    I’d love to hear your thoughts and see if this is something you’d like to explore.  

    No pressure of course—feel free to reply to this email or set up a quick call here: <a href="${calendlyUrl}">Book a 30-minute meeting</a>

    If you’re ready to dive in, you can also onboard directly here: <a href="${onboardingUrl}">Start Your Onboarding Process</a>

<p>{Looking forward to hearing from you!|Looking forward to connecting with you!}</p>

    PS: ${recipient.snippet2}

<p>Best regards,<br>Yug</p>
`;
};
