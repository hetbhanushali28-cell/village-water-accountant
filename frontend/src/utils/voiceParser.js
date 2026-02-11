/**
 * Parse voice commands into structured data for the app.
 * 
 * Intents:
 * 1. Set Soil: "Black soil", "Red soil", "Sandy"
 * 2. Set Crop: "Cotton", "Soybean", "Wheat", "Sugarcane"
 * 3. Set Location: "Weather in Pune", "Go to Nashik"
 * 4. Navigation: "Check water", "Show results"
 */

// Approximate matching for soil types
const SOIL_KEYWORDS = {
    high: ['black', 'clay', 'heavy', 'deep', 'kali'],
    medium: ['medium', 'loam', 'silt', 'madhyam'],
    low: ['red', 'light', 'sandy', 'halki', 'lal']
};

// Common crop names and variations
const CROP_KEYWORDS = {
    'Cotton (Kapas)': ['cotton', 'kapas', 'kapaas'],
    'Soybean': ['soybean', 'soya', 'soyabean'],
    'Wheat (Gehu)': ['wheat', 'gehu', 'gahu'],
    'Sugarcane (Us)': ['sugarcane', 'cane', 'us', 'oos'],
    'Gram (Chana)': ['gram', 'chana', 'chickpea'],
    'Maize (Makka)': ['maize', 'corn', 'makka', 'maka'],
    'Tur (Arhar)': ['tur', 'arhar', 'pigeon pea'],
    'Bajra': ['bajra', 'pearl millet'],
    'Jowar (Sorghum)': ['jowar', 'sorghum'],
    'Onion': ['onion', 'kanda', 'pyaz'],
    'Groundnut': ['groundnut', 'peanut', 'shenga'],
    'Rice (Paddy)': ['rice', 'paddy', 'dhan', 'bhat']
};

export const parseVoiceCommand = (text) => {
    const lowerText = text.toLowerCase();

    const result = {
        soil: null,
        crop: null,
        location: null,
        action: null
    };

    // 1. Detect Soil Type
    for (const [type, keywords] of Object.entries(SOIL_KEYWORDS)) {
        if (keywords.some(k => lowerText.includes(k))) {
            // Map back to the UI's soil values
            if (type === 'high') result.soil = 'Black Soil (Heavy)';
            if (type === 'medium') result.soil = 'Medium Soil';
            if (type === 'low') result.soil = 'Red/Light Soil';
            break;
        }
    }

    // 2. Detect Crop
    for (const [cropName, keywords] of Object.entries(CROP_KEYWORDS)) {
        if (keywords.some(k => lowerText.includes(k))) {
            result.crop = cropName;
            break;
        }
    }

    // 3. Detect Location (Basic logic: look for "in [City]")
    // This is tricky without a full NLP parser, but we can look for "in [City]" or "at [City]"
    // Or just check if any major city name is present
    const locationMatch = lowerText.match(/(?:in|at|for|to)\s+([a-z\s]+)/);
    if (locationMatch && locationMatch[1]) {
        // Clean up preposition
        let loc = locationMatch[1].trim();
        // Remove common trailing words
        loc = loc.replace(/\s+(weather|forecast|rain|soil|today|tomorrow).*/, '');
        if (loc.length > 3) {
            result.location = loc; // Needs validation against real location list upstream
        }
    }

    // 4. Detect Actions
    if (lowerText.includes('check') || lowerText.includes('calculate') || lowerText.includes('show result')) {
        result.action = 'calculate';
    } else if (lowerText.includes('reset') || lowerText.includes('clear')) {
        result.action = 'reset';
    }

    return result;
};
