import dotenv from "dotenv";
import axios from 'axios';
dotenv.config();

export const createAxiosInstance = () => {
  return axios.create({
    baseURL: "https://server.smartlead.ai/api/v1",
    params: { api_key: process.env.SMARTLEAD_API_KEY },
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 30000,
  });
};
