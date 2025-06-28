// Gemini API utility functions
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "AIzaSyDeLlIMZw_J-UqBwCL6OXQQxlUE9fkb9o8"
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"

export interface GeminiResponse {
  success: boolean
  message: string
  error?: string
}

export async function callGeminiAPI(prompt: string, context: string = ""): Promise<GeminiResponse> {
  try {
    // Check if API key is available
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "AIzaSyB_CzhJN0M0VtoSpnR-vJOstB8by49T4IU") {
      throw new Error('Gemini API key not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY environment variable.')
    }

    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error Response:', errorText)
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const message = data.candidates[0].content.parts[0].text
      return {
        success: true,
        message: message.trim()
      }
    } else {
      console.error('Invalid Gemini API response format:', data)
      throw new Error('Invalid response format from Gemini API')
    }
  } catch (error) {
    console.error('Gemini API Error:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key not configured')) {
        return {
          success: false,
          message: "AI service is not configured. Please contact your healthcare provider for assistance.",
          error: error.message
        }
      } else if (error.message.includes('401') || error.message.includes('403')) {
        return {
          success: false,
          message: "AI service authentication failed. Please try again later or contact support.",
          error: error.message
        }
      } else if (error.message.includes('429')) {
        return {
          success: false,
          message: "AI service is temporarily busy. Please try again in a few moments.",
          error: error.message
        }
      }
    }
    
    return {
      success: false,
      message: "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again later or consult your healthcare provider for immediate assistance.",
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Doctor-specific prompt with full diagnostic capabilities
export const DOCTOR_PROMPT_CONTEXT = `You are an AI diagnostic assistant for healthcare professionals. You can provide:
- Differential diagnoses for symptoms
- Treatment recommendations based on evidence-based medicine
- Clinical decision support
- Risk assessment and stratification
- Medical literature references when appropriate

Always maintain professional medical standards and remind users that final clinical decisions remain their responsibility. Be thorough but concise in your responses.`

// Patient-specific prompt with limited scope
export const PATIENT_PROMPT_CONTEXT = `You are an AI health assistant for patients. You can ONLY provide information about:
- Medicine side effects and interactions
- Dosage timing and instructions
- Generic alternatives and cost information
- Basic health education and preventive care
- Storage and handling of medications

IMPORTANT LIMITATIONS:
- Do NOT provide diagnoses
- Do NOT suggest treatments
- Do NOT interpret lab results
- Do NOT give medical advice beyond basic medication information
- Always recommend consulting a doctor for medical concerns

If asked about anything beyond these topics, politely redirect to their healthcare provider.` 