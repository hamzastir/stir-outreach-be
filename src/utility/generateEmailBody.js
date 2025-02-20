import { uploadTrackingImage } from "./uploadImage.js";
const generateParameterizedUrls = (recipient) => {
  const params = new URLSearchParams({
    email: recipient.email,
    name: recipient.firstName,
  });

  return {
    calendlyUrl: `${process.env.CALENDLY_BASE_URL}?${params.toString()}`,
    onboardingUrl: `${process.env.ONBOARDING_BASE_URL}?${params.toString()}`,
  };
};

export const generateEmailBody = async (recipient) => {
  const { imageUrl, trackingId } = await uploadTrackingImage(recipient.email);
  const { calendlyUrl, onboardingUrl } = generateParameterizedUrls(recipient);
  console.log({ trackingId });
  const stirLogo = `<img src="${imageUrl}"/>`;
  console.log({ stirLogo });
  return `
        <p>Hey ${recipient.firstName},</p>
        <p>I hope you're doing well!</p>
        
        <p style="color: #2c5282; padding: 15px; background-color: #ebf8ff; border-radius: 5px; margin: 20px 0;">
        ${recipient.snippet}
        </p>
        
        <p>Here are two important links for you:</p>
        
        <ol>
            <li>
                <strong>Schedule a Call:</strong>
                <a href="${calendlyUrl}">Book a 30-minute meeting</a>
            </li>
            <li>
                <strong>Onboarding Details:</strong>
                <a href="${onboardingUrl}">Start Your Onboarding Process</a>
            </li>
        </ol>

        <p>During our call, we can discuss:</p>
        <ul>
            <li>Your current projects and interests</li>
            <li>Potential collaboration opportunities</li>
            <li>How we can add value to your work</li>
        </ul>
        
        <p>Looking forward to connecting with you!</p>
        
        <p>{Best regards | Cheers | Thank you},<br>Akshat</p>
        
        ${stirLogo}
    `;
};