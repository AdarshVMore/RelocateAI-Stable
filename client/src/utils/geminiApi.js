import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from './envConfig';
// Initialize the Gemini API with your API key
// Note: In production, you should store this key securely and not expose it in client-side code

// Get API key from our environment configuration
const API_KEY = config.geminiApiKey;

// Debug: Check if API key is loaded properly
console.log("Gemini API: API key loaded and ready to use");

// Verify the API key is not undefined before initializing
if (!API_KEY) {
  console.error("ERROR: Gemini API key is not defined in environment variables. Check your .env file.");
  console.error("Make sure you have REACT_APP_GEMINI_API_KEY_NEW defined in your .env file.");
}

console.log("API_KEY is", API_KEY);

// Initialize the API with error handling
let genAI;
try {
  genAI = new GoogleGenerativeAI(API_KEY);
  console.log("Gemini API: Successfully initialized GoogleGenerativeAI client");
} catch (error) {
  console.error("Error initializing Gemini API:", error.message);
}

// Initialize default model
let defaultModel;
try {
  if (genAI) {
    defaultModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Gemini API: Default model initialized");
  }
} catch (error) {
  console.error("Error initializing default model:", error.message);
}

/**
 * Get an available Gemini model
 * @returns {string} The model name
 */
export const getAvailableModel = async () => {
  // Default to gemini-1.5-flash
  return "gemini-1.5-flash";
};

/**
 * Prepare timeline data for analysis
 * @param {string} rawData - The raw timeline data
 * @returns {string} - Formatted data for analysis
 */
const prepareTimelineData = (rawData) => {
  try {
    // Try to parse the JSON
    const jsonData = JSON.parse(rawData);
    
    // Extract relevant information in a text format
    let formattedText = "Timeline Data Summary:\n\n";
    
    // Process locations if available
    if (jsonData.locations && Array.isArray(jsonData.locations)) {
      formattedText += `Total locations: ${jsonData.locations.length}\n\n`;
      
      // Process a sample of locations (max 50)
      const sampleLocations = jsonData.locations.slice(0, 50);
      formattedText += "Sample locations:\n";
      
      sampleLocations.forEach((location, index) => {
        const timestamp = location.timestampMs ? new Date(parseInt(location.timestampMs)).toISOString() : "Unknown time";
        const lat = location.latitudeE7 ? location.latitudeE7 / 10000000 : "Unknown";
        const lng = location.longitudeE7 ? location.longitudeE7 / 10000000 : "Unknown";
        
        formattedText += `Location ${index + 1}: Time: ${timestamp}, Lat: ${lat}, Lng: ${lng}\n`;
      });
    }
    
    // Process timeline objects if available
    if (jsonData.timelineObjects && Array.isArray(jsonData.timelineObjects)) {
      formattedText += `\nTotal timeline objects: ${jsonData.timelineObjects.length}\n\n`;
      
      // Process a sample of timeline objects (max 50)
      const sampleObjects = jsonData.timelineObjects.slice(0, 50);
      formattedText += "Sample timeline objects:\n";
      
      sampleObjects.forEach((obj, index) => {
        if (obj.placeVisit) {
          const place = obj.placeVisit;
          const location = place.location || {};
          const name = location.name || "Unknown place";
          const address = location.address || "Unknown address";
          const startTime = place.duration?.startTimestampMs ? new Date(parseInt(place.duration.startTimestampMs)).toISOString() : "Unknown";
          const endTime = place.duration?.endTimestampMs ? new Date(parseInt(place.duration.endTimestampMs)).toISOString() : "Unknown";
          
          formattedText += `Visit ${index + 1}: Place: ${name}, Address: ${address}, From: ${startTime}, To: ${endTime}\n`;
        } else if (obj.activitySegment) {
          const activity = obj.activitySegment;
          const type = activity.activityType || "Unknown activity";
          const startTime = activity.duration?.startTimestampMs ? new Date(parseInt(activity.duration.startTimestampMs)).toISOString() : "Unknown";
          const endTime = activity.duration?.endTimestampMs ? new Date(parseInt(activity.duration.endTimestampMs)).toISOString() : "Unknown";
          
          formattedText += `Activity ${index + 1}: Type: ${type}, From: ${startTime}, To: ${endTime}\n`;
        }
      });
    }
    
    return formattedText;
  } catch (error) {
    console.error("Error preparing timeline data:", error);
    // If JSON parsing fails, return the raw data (truncated)
    return rawData.substring(0, 5000);
  }
};

/**
 * Analyze timeline data using Gemini API
 * @param {string} timelineData - The timeline data to analyze
 * @returns {Promise<Object>} - The analysis results
 */
export const analyzeTimelineData = async (timelineData) => {
  try {
    console.log("Preparing timeline data for analysis...");
    
    // Prepare the data for analysis
    const preparedData = prepareTimelineData(timelineData);
    console.log("Data prepared for analysis:", preparedData.substring(0, 200) + "...");
    
    // Extract frequently visited locations
    const frequentLocations = extractFrequentLocations(timelineData);
    console.log("Extracted frequent locations:", frequentLocations);
    
    // Get the model
    const modelName = await getAvailableModel();
    console.log("Using Gemini model:", modelName);
    
    const model = genAI.getGenerativeModel({ model: modelName });

    // Create the prompt with more detailed instructions
    const prompt = `
    You are an expert data analyst specializing in location data and user behavior patterns. Analyze this user's Google Timeline data to understand their personality, preferences, and lifestyle patterns.
    
    ${preparedData}

    Based on this data, please provide a comprehensive analysis of:

    1. Movement patterns: Is the user active or sedentary? Do they have regular routines or variable patterns? How often do they travel?
    
    2. Preferred areas: What areas do they frequent most? Do they prefer urban centers, suburban areas, or rural locations?
    
    3. Lifestyle preferences: What activities do they engage in? Do they visit restaurants, shops, gyms, parks, etc.? Are they more interested in nightlife, shopping, outdoor activities, cultural events?
    
    4. Common activities: What are their regular activities? Do they have a consistent work schedule? Do they exercise regularly? Do they socialize often?
    
    5. Commute patterns: How do they commute? What's their typical commute distance and time? Do they use public transportation, walk, or drive?

    Even if the data is limited, make reasonable inferences based on the patterns you can observe. If you don't have enough information for a specific category, provide at least 2-3 general observations that might apply to someone with this movement pattern.

    Return the analysis in this exact JSON format:
    {
        "personality_traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
        "area_preferences": ["area1", "area2", "area3"],
        "lifestyle_indicators": ["indicator1", "indicator2", "indicator3", "indicator4"],
        "activity_patterns": ["pattern1", "pattern2", "pattern3"],
        "commute_insights": ["insight1", "insight2", "insight3"],
        "frequent_locations": ["location1", "location2", "location3"]
    }
    
    Each array should contain at least 3-5 detailed insights. Be specific and insightful in your analysis.
    IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text or markdown formatting.
    `;

    // Set generation config with higher temperature for more creative responses
    const generationConfig = {
      temperature: 0.7,  // Increased from 0.2 to 0.7 for more creative responses
      topP: 0.9,         // Increased from 0.8 to 0.9
      topK: 40,
      maxOutputTokens: 2048,
    };

    console.log("Sending request to Gemini API...");
    
    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();
    
    console.log("Received response from Gemini API:", text.substring(0, 200) + "...");

    // Try to parse the response as JSON
    try {
      // Clean up the response if it contains markdown code blocks
      let cleanText = text;
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();
      
      // If the response doesn't look like JSON, create a fallback response
      if (!cleanText.startsWith("{") && !cleanText.startsWith("[")) {
        console.warn("Response doesn't look like JSON, creating fallback response");
        return createFallbackResponse(preparedData, frequentLocations);
      }

      const parsedResponse = JSON.parse(cleanText);
      
      // Check if the response is empty or has empty arrays
      const isEmpty = Object.values(parsedResponse).every(
        arr => !Array.isArray(arr) || arr.length === 0
      );
      
      if (isEmpty) {
        console.warn("Received empty response from Gemini API, using fallback");
        return createFallbackResponse(preparedData, frequentLocations);
      }
      
      // Add frequent locations if not present in the response
      if (!parsedResponse.frequent_locations || parsedResponse.frequent_locations.length === 0) {
        parsedResponse.frequent_locations = frequentLocations;
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      console.log("Raw response:", text);
      
      // Create a fallback response
      return createFallbackResponse(preparedData, frequentLocations);
    }
  } catch (error) {
    console.error("Error analyzing timeline data:", error);
    throw error;
  }
};

/**
 * Extract frequently visited locations from timeline data
 * @param {string} timelineData - The timeline data
 * @returns {Array} - Array of frequent locations
 */
const extractFrequentLocations = (timelineData) => {
  try {
    // Try to parse as JSON first
    let locations = [];
    let locationCounts = {};
    
    try {
      const jsonData = JSON.parse(timelineData);
      
      // Extract from JSON structure
      if (jsonData.timelineObjects && Array.isArray(jsonData.timelineObjects)) {
        jsonData.timelineObjects.forEach(obj => {
          if (obj.placeVisit && obj.placeVisit.location) {
            const location = obj.placeVisit.location;
            const name = location.name || location.address || "Unknown place";
            
            if (name && name !== "Unknown place") {
              locationCounts[name] = (locationCounts[name] || 0) + 1;
            }
          }
        });
      }
    } catch (e) {
      // If not valid JSON, try to extract from text
      const lines = timelineData.split('\n');
      const visitRegex = /Visit \d+: Place: ([^,]+),/;
      
      lines.forEach(line => {
        const match = line.match(visitRegex);
        if (match && match[1]) {
          const name = match[1].trim();
          locationCounts[name] = (locationCounts[name] || 0) + 1;
        }
      });
    }
    
    // Convert to array and sort by frequency
    locations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 5); // Get top 5 locations
    
    return locations.length > 0 ? locations : ["Home", "Office", "Grocery Store"];
  } catch (error) {
    console.error("Error extracting frequent locations:", error);
    return ["Home", "Office", "Grocery Store"];
  }
};

/**
 * Create a fallback response based on the timeline data
 * @param {string} timelineData - The timeline data
 * @param {Array} frequentLocations - Array of frequent locations
 * @returns {Object} - A fallback analysis
 */
const createFallbackResponse = (timelineData, frequentLocations = []) => {
  // Extract some basic information from the timeline data
  const hasGym = timelineData.toLowerCase().includes("gym");
  const hasRestaurant = timelineData.toLowerCase().includes("restaurant");
  const hasCoffeeShop = timelineData.toLowerCase().includes("coffee");
  const hasOffice = timelineData.toLowerCase().includes("office");
  const hasWalking = timelineData.toLowerCase().includes("walking");
  const hasHome = timelineData.toLowerCase().includes("home");
  const hasGrocery = timelineData.toLowerCase().includes("grocery");
  const hasKhed = timelineData.toLowerCase().includes("khed");
  
  // Use provided frequent locations or fallback to defaults
  const locations = frequentLocations.length > 0 ? 
    frequentLocations : 
    [
      hasHome ? "Home" : "Residence",
      hasOffice ? "Office" : "Workplace",
      hasGrocery ? "Grocery Store" : "Shopping Center",
      hasCoffeeShop ? "Coffee Shop" : "Cafe",
      hasRestaurant ? "Restaurant" : "Dining Place"
    ].filter(Boolean).slice(0, 5);
  
  return {
    "personality_traits": [
      "Structured and routine-oriented based on regular daily patterns",
      "Health-conscious" + (hasGym ? " with regular gym visits" : ""),
      "Socially active" + (hasRestaurant ? " with occasional dining out" : ""),
      "Work-focused with consistent schedule",
      "Practical and organized in daily activities"
    ],
    "area_preferences": [
      hasKhed ? "Khed area for daily activities" : "Local neighborhood for daily activities",
      "Residential areas for living",
      "Commercial districts for work and shopping",
      "Mixed-use areas with access to various amenities"
    ],
    "lifestyle_indicators": [
      hasOffice ? "Regular work schedule at office location" : "Regular work schedule",
      hasGym ? "Fitness-oriented with gym visits" : "Values physical activity",
      hasRestaurant ? "Enjoys dining out at restaurants" : "Balanced social life",
      hasCoffeeShop ? "Coffee enthusiast with regular cafe visits" : "Appreciates breaks in routine",
      hasGrocery ? "Practical shopper with regular grocery trips" : "Organized approach to daily needs"
    ],
    "activity_patterns": [
      "Consistent daily routine with regular timing",
      hasWalking ? "Regular walking for transportation" : "Active commuting habits",
      "Weekday work pattern with consistent hours",
      "Evening relaxation at home",
      hasRestaurant ? "Social activities in evenings or weekends" : "Balanced work-life schedule"
    ],
    "commute_insights": [
      hasWalking ? "Prefers walking as primary mode of transportation" : "Regular commuting pattern",
      "Short to moderate commute distances",
      "Consistent commute times suggesting planned schedule",
      "Efficient route selection between frequent locations"
    ],
    "frequent_locations": locations
  };
};

/**
 * Generates social events for a specific location using Gemini API
 * @param {string} city - The city for which to generate events
 * @param {Object} userData - Optional user data for personalization
 * @returns {Promise<Array>} - Array of generated events
 */
export const generateSocialEvents = async (city = 'Pune') => {
  try {
    console.log(`Generating social events for city: ${city}`);
    
    if (!genAI) {
      console.error('Gemini API not initialized');
      throw new Error('Gemini API not initialized');
    }

    // Get the model
    const modelName = await getAvailableModel();
    console.log("Using Gemini model:", modelName);
    
    const model = genAI.getGenerativeModel({ model: modelName });

    // Create a chat session
    const chat = model.startChat({
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    });

    // System prompt for event generation
    const systemPrompt = `You are a local event discovery assistant that provides detailed information about upcoming events in a specified location. Your task is to generate a comprehensive list of events based on the provided location.

For the location "${city}", create a JSON array of 12-15 events covering the next 3 months. Each event should have the following structure:

\`\`\`json
{
  "name": "Event Name",
  "category": "Event Category",
  "date": "YYYY-MM-DD",
  "time": "HH:MM AM/PM",
  "location": "Venue Name, ${city}",
  "description": "A brief description of the event (2-3 sentences)",
  "ticket_details": {
    "price": "Free or cost range",
    "booking_link": "https://example.com/tickets"
  },
  "official_source": "https://example.com/event" 
}
\`\`\`

Important guidelines:
1. Focus on realistic, believable events that could actually happen in ${city}
2. Include a variety of event categories (concerts, workshops, festivals, meetups, food events, etc.)
3. Use real venue names that exist in ${city} when possible
4. Spread events across different dates within the next 3 months
5. Vary the ticket prices from free events to premium events
6. For booking_link and official_source, use realistic URLs (they can be fictional but should look real)
7. Make sure each event has a unique name and description

Output only valid JSON that can be parsed using JSON.parse().`;

    // Send the system prompt
    const result = await chat.sendMessage(systemPrompt);
    const responseText = result.response.text();
    
    // Extract JSON from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse events from Gemini response');
      console.log('Response received:', responseText);
      return [];
    }
    
    try {
      const events = JSON.parse(jsonMatch[0]);
      console.log(`Successfully parsed ${events.length} events`);
      return events;
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini response:', parseError);
      
      // If we have a broken JSON, try some basic cleanup and retry
      const cleanedJson = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      try {
        const events = JSON.parse(cleanedJson);
        console.log(`Successfully parsed ${events.length} events after cleanup`);
        return events;
      } catch (secondError) {
        console.error('Failed to parse JSON even after cleanup:', secondError);
        
        // Last resort: try to match individual event objects and build the array manually
        const eventsArray = [];
        const objectRegex = /\{[\s\S]*?\}/g;
        const matches = responseText.match(objectRegex);
        
        if (matches) {
          for (const match of matches) {
            try {
              const event = JSON.parse(match);
              eventsArray.push(event);
            } catch (e) {
              // Skip invalid objects
              console.warn('Skipping invalid event object');
            }
          }
          
          if (eventsArray.length > 0) {
            console.log(`Recovered ${eventsArray.length} events from partial parsing`);
            return eventsArray;
          }
        }
        
        // If all parsing attempts fail, return an empty array
        return [];
      }
    }
  } catch (error) {
    console.error('Error generating social events:', error);
    return [];
  }
};

/**
 * Generate place recommendations based on a prompt
 * @param {string} prompt - The prompt for generating place recommendations
 * @returns {Promise<Array>} - Array of place recommendations
 */
export const generatePlaceRecommendations = async (prompt) => {
  console.log("Generating place recommendations using Gemini API...");
  
  try {
    console.log("Prompt:", prompt);
    console.log("Generating place recommendations using Gemini API...");
    console.log("Prompt:", prompt);
    
    // Get the model
    const modelName = await getAvailableModel();
    console.log("Using Gemini model:", modelName);
    
    const model = genAI.getGenerativeModel({ model: modelName });

    // Set generation config
    const generationConfig = {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 4096,
    };

    // Generate content
    console.log("Sending request to Gemini API for place recommendations...");
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
  console.log("Received response from Gemini API");
  
  try {
    // Get the text response
    const responseText = response.text();
    console.log("Raw response text:", responseText.substring(0, 200) + "...");
    
    // Extract JSON from markdown code blocks if present
    let jsonString = responseText;
    
    // Check if the response is wrapped in markdown code blocks
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/;
    const match = responseText.match(jsonRegex);
    
    if (match && match[1]) {
      // Extract the content between the code block markers
      jsonString = match[1].trim();
      console.log("Extracted JSON from markdown code block");
    }
    
    // Parse the JSON response
    const jsonResponse = JSON.parse(jsonString);
    console.log("Successfully parsed JSON response for places");
    
    console.log(`Received ${jsonResponse.length} places from API`);
    
    // Validate and clean up the data
    const validatedPlaces = jsonResponse.map((place, index) => {
      // Ensure all required fields exist
      return {
        id: place.id || `place-${index + 1}`,
        name: place.name || `Place ${index + 1}`,
        category: place.category || 'other',
        description: place.description || 'No description available',
        address: place.address || 'No address available',
        coordinates: place.coordinates || { lat: 0, lng: 0 },
        priceLevel: typeof place.priceLevel === 'number' ? place.priceLevel : 1,
        rating: typeof place.rating === 'number' ? place.rating : 4.0,
        distance: typeof place.distance === 'number' ? place.distance : 1.0,
        imageUrl: place.imageUrl || null,
        website: place.website || '',
        priorityRank: place.priorityRank || index + 1
      };
    });

    console.log('Validated places are:', validatedPlaces);
    
    return validatedPlaces;
      
    } catch (parseError) {
      console.error("Error parsing JSON response for places:", parseError);
      console.log("Raw response:", response.text());
    }
  } catch (error) {
    console.error("Error generating place recommendations:", error);
  }
};

// Create a named export object
const geminiApi = {
  analyzeTimelineData,
  getAvailableModel,
  generateSocialEvents,
  generatePlaceRecommendations,
};

export default geminiApi; 