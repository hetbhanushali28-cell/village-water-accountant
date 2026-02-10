import { supabase } from './supabaseClient';

/**
 * Save user's GPS location to Supabase database
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} region - Region name (optional)
 * @param {string} pincode - Pincode (optional)
 */
export const saveUserLocation = async (lat, lng, region = null, pincode = null) => {
    if (!supabase) {
        console.warn('Supabase not configured. Location not saved.');
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'User not logged in' };
        }

        const { data, error } = await supabase
            .from('user_locations')
            .upsert({
                user_id: user.id,
                latitude: lat,
                longitude: lng,
                region,
                pincode,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) throw error;

        console.log('Location saved to database:', data);
        return { success: true, data };
    } catch (error) {
        console.error('Error saving location:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get user's saved location from Supabase database
 */
export const getUserLocation = async () => {
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'User not logged in' };
        }

        const { data, error } = await supabase
            .from('user_locations')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            // No location saved yet is not an error
            if (error.code === 'PGRST116') {
                return { success: true, data: null };
            }
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error fetching location:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Clear user's saved location from database
 */
export const clearUserLocation = async () => {
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'User not logged in' };
        }

        const { error } = await supabase
            .from('user_locations')
            .delete()
            .eq('user_id', user.id);

        if (error) throw error;

        console.log('Location cleared from database');
        return { success: true };
    } catch (error) {
        console.error('Error clearing location:', error);
        return { success: false, error: error.message };
    }
};
