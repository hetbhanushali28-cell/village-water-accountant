import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const fetchMessage = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/`);
        return response.data;
    } catch (error) {
        console.error("Error fetching message:", error);
        throw error;
    }
};

export const fetchSuggestions = async (query) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/suggestions?query=${query}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching suggestions:", error);
        return [];
    }
};

export const fetchCrops = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/crops`);
        if (response.data.success) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        console.error("Error fetching crops:", error);
        return [];
    }
};

export const fetchSoils = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/soils`);
        if (response.data.success) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        console.error("Error fetching soils:", error);
        return [];
    }
};

export const checkCropViability = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/check-crop`, payload);
        return response.data;
    } catch (error) {
        console.error("Error checking crop:", error);
        return { success: false, message: "Server Error" };
    }
};

export const getWaterBalance = async (query = null, lat = null, lng = null, soil_type = null) => {
    try {
        const payload = {};
        if (query) payload.query = query;
        if (soil_type) payload.soil_type = soil_type;
        if (lat && lng) {
            payload.lat = lat;
            payload.lng = lng;
        }

        const response = await axios.post(`${API_BASE_URL}/api/water-balance`, payload);
        return response.data;
    } catch (error) {
        console.error("Error fetching water balance:", error);
        throw error;
    }
};

export const fetchSoilConditions = async (lat, lng) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/soil-conditions?lat=${lat}&lng=${lng}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching soil conditions:", error);
        return { success: false, message: "Server Error" };
    }
};

export const fetchMarketPrices = async (commodity) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/market-prices?commodity=${commodity}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching market prices:", error);
        return { success: false, message: "Server Error" };
    }
};

export const simulateWaterDepletion = async (cropName, currentBalance) => {
    try {
        const monthStart = new Date().getMonth() + 1;
        const response = await axios.post(`${API_BASE_URL}/api/simulate-water`, {
            crop_name: cropName,
            water_balance: currentBalance,
            month_start: monthStart
        });
        return response.data;
    } catch (error) {
        console.error("Error simulating water:", error);
        return { simulation: [] };
    }
};
