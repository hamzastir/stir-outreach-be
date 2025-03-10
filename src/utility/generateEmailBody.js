// import { uploadTrackingImage } from "./uploadImage.js";
import dotenv from "dotenv";
dotenv.config();

const CALENDLY_BASE_URL = "https://www.createstir.com/calendly";
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
  console.log("inside email body");
  const { calendlyUrl, onboardingUrl } = generateParameterizedUrls(recipient);
  console.log({ calendlyUrl, onboardingUrl });
  console.log("recipient from email : " + recipient);
  return `{Hi|Hey|Hello} @${recipient.firstName}, I’m ${recipient.poc}<br>
${recipient.snippet1}<br>
  We’re building something exciting at Stir—an invite-only marketplace to connect influencers like you with indie filmmakers and major studios, offering early access to upcoming releases. <br>
What makes us unique? Vetted clients. Built-in AI. Fast payments. A flat 10% take rate.<br>
 {I’d love to hear your thoughts and see if this is something you’d like to explore!|I'd love to hear your story and see if Stir is the right fit for you!}<br>
{No pressure|No rush at all|At your convenience}—feel free to reply to this email or set up a quick call here: <a href="${calendlyUrl}">createstir.com/calendly</a>. Or if you’re ready to dive in, you can also onboard here: <a href="${onboardingUrl}">createstir.com/onboard</a>.<br>
 {Best,|Cheers,|Viva cinema,|Regards,}<br>Yug Dave<br>VP of Stellar Beginnings!<br>
PS: ${recipient.snippet2}`;
};
