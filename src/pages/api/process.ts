import { processApiCall } from "@/apis/processApiCall";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const response = await processApiCall(req, res);

  // console.log('API response:', response);
  return res.status(200).json(response);
}

export const config = {
  maxDuration: 60,
};
