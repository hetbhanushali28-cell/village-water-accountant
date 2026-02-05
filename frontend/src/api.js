import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001';

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
