import {config} from '../config/index.js';
import axios from 'axios';
export const createAxiosInstance = () => {
  return axios.create({
    baseURL: "https://server.smartlead.ai/api/v1",
    params: { api_key: config.API_KEY },
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 30000,
  });
};
