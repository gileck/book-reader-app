type PricePer128K = { up_to_128k_tokens: number; over_128k_tokens: number }
type PricingModel = {
  model_name: string;
  model_id: string;
  input_cost_per_1k_tokens: number | PricePer128K;
  output_cost_per_1k_tokens: number | PricePer128K;
}

export const pricing: PricingModel[] = [
      {
        "model_name": "GPT-4o",
        "model_id": "gpt-4o",
        "input_cost_per_1k_tokens": 0.0025,
        "output_cost_per_1k_tokens": 0.01
      },
      {
        "model_name": "GPT-4o Mini",
        "model_id": "gpt-4o-mini",
        "input_cost_per_1k_tokens": 0.00015,
        "output_cost_per_1k_tokens": 0.0006
      },
      {
        "model_name": "GPT-4.5",
        "model_id": "gpt-4.5",
        "input_cost_per_1k_tokens": 0.075,
        "output_cost_per_1k_tokens": 0.15
      },
      {
        "model_name": "OpenAI o1",
        "model_id": "o1",
        "input_cost_per_1k_tokens": 0.015,
        "output_cost_per_1k_tokens": 0.06
      },
      {
        "model_name": "OpenAI o3-mini",
        "model_id": "o3-mini",
        "input_cost_per_1k_tokens": 0.0011,
        "output_cost_per_1k_tokens": 0.0044
      },
      {
        "model_name": "Claude 3.5 Sonnet",
        "model_id": "claude-3.5-sonnet",
        "input_cost_per_1k_tokens": 0.003,
        "output_cost_per_1k_tokens": 0.015
      },
      {
        "model_name": "Gemini 1.5 Pro",
        "model_id": "gemini-1.5-pro",
        
        "input_cost_per_1k_tokens": {
          "up_to_128k_tokens": 0.00125,
          "over_128k_tokens": 0.0025
        },
        "output_cost_per_1k_tokens": {
          "up_to_128k_tokens": 0.005,
          "over_128k_tokens": 0.01
        }
      },
      {
        "model_name": "Gemini 1.5 Flash-8B",
        "model_id": "gemini-1.5-flash-8b",
        "input_cost_per_1k_tokens": {
          "up_to_128k_tokens": 0.0000375,
          "over_128k_tokens": 0.000075
        },
        "output_cost_per_1k_tokens": {
          "up_to_128k_tokens": 0.00015,
          "over_128k_tokens": 0.0003
        }
      },
      {
        "model_name": "DeepSeek-V2",
        "model_id": "deepseek-v2",
        "input_cost_per_1k_tokens": 0.0003,
        "output_cost_per_1k_tokens": 0.0003
      }
    ]
  
  
  export const getPricePer1K = (modelId: string, tokens: number): {
    inputCost: number;
    outputCost: number;
  } => {
    const model = pricing.find(model => model.model_id === modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (typeof model.input_cost_per_1k_tokens === 'number') {
      return {
        inputCost: model.input_cost_per_1k_tokens,
        outputCost: model.output_cost_per_1k_tokens as number
      }
    } else {
      if (tokens <= 128000) {
        return {
          inputCost: (model.input_cost_per_1k_tokens as PricePer128K).up_to_128k_tokens,
          outputCost: (model.output_cost_per_1k_tokens as PricePer128K).up_to_128k_tokens
        }
      } else {
        return {
          inputCost: (model.input_cost_per_1k_tokens as PricePer128K).over_128k_tokens,
          outputCost: (model.output_cost_per_1k_tokens as PricePer128K).over_128k_tokens
        }
      }
    }
    
    
    

  }