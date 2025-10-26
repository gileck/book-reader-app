import { processApiCall } from "@/apis/processApiCall";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await processApiCall(req, res);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      data: { error: error instanceof Error ? error.message : "Unknown error" }
    });
  }
}

export const config = { maxDuration: 60 };
