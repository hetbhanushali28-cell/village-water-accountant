from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
import datetime

app = FastAPI(title="Village Water Accountant")

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WaterBalanceRequest(BaseModel):
    pincode: Optional[str] = None
    query: Optional[str] = None
    soil_type: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class CheckCropRequest(BaseModel):
    crop_name: str
    available_water_mm: float
    soil_type: Optional[str] = None

@app.get("/")
def read_root():
    return {"message": "Village Water Accountant Backend is Running (Real API Mode)"}

# --- REAL API HELPERS ---

async def get_coordinates(query: str):
    """Fetch Lat/Lng from Nominatim (OpenStreetMap)."""
    async with httpx.AsyncClient() as client:
        # User-Agent is required by Nominatim
        headers = {'User-Agent': 'WaterAccountantApp/1.0'}
        # Limit to India/Maharashtra if possible, but general query works well
        try:
            resp = await client.get(
                f"https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "in"},
                headers=headers
            )
            data = resp.json()
            if data:
                return {
                    "lat": float(data[0]['lat']),
                    "lng": float(data[0]['lon']),
                    "display_name": data[0]['display_name']
                }
        except Exception as e:
            print(f"Nominatim Error: {e}")
    return None

async def reverse_geocode(lat: float, lng: float):
    """Fetch Address from Nominatim (Reverse Geocoding)."""
    async with httpx.AsyncClient() as client:
        headers = {'User-Agent': 'WaterAccountantApp/1.0'}
        try:
            resp = await client.get(
                f"https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json"},
                headers=headers
            )
            data = resp.json()
            if data:
                address = data.get('address', {})
                region = address.get('city') or address.get('town') or address.get('village') or address.get('county') or data.get('display_name').split(",")[0]
                pincode = address.get('postcode')
                return region, pincode
        except Exception as e:
            print(f"Reverse Geo Error: {e}")
    return None, None

async def get_weather_real(lat: float, lng: float):
    """Fetch Precipitation from Open-Meteo."""
    async with httpx.AsyncClient() as client:
        try:
            # excessive historical data for 'sum' over last 30 days
            end_date = datetime.date.today()
            start_date = end_date - datetime.timedelta(days=30)
            
            resp = await client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "start_date": start_date,
                    "end_date": end_date,
                    "daily": "precipitation_sum",
                    "timezone": "auto"
                }
            )
            data = resp.json()
            if 'daily' in data and 'precipitation_sum' in data['daily']:
                # Sum of last 30 days rain
                total_rain = sum(filter(None, data['daily']['precipitation_sum']))
                return total_rain
        except Exception as e:
            print(f"Open-Meteo Error: {e}")
    return 0.0

async def get_suggestions_real(query: str):
    """Fetch Autocomplete Suggestions from Nominatim."""
    async with httpx.AsyncClient() as client:
        headers = {'User-Agent': 'WaterAccountantApp/1.0'}
        try:
            resp = await client.get(
                f"https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "format": "json",
                    "limit": 5,
                    "countrycodes": "in",
                    "addressdetails": 1
                },
                headers=headers
            )
            results = resp.json()
            suggestions = []
            for item in results:
                # Try to find a pincode in address details
                pincode = item.get('address', {}).get('postcode', '')
                
                # Format label
                label = item['display_name'].split(",")[0]
                if pincode:
                    label += f" - {pincode}"
                else:
                    label += f" ({item['type']})"

                suggestions.append({
                    "label": label,
                    "value": pincode if pincode else item['display_name'],
                    "name": item['display_name'].split(",")[0],
                    "lat": float(item['lat']),
                    "lng": float(item['lon'])
                })
            return suggestions
        except Exception as e:
            print(f"Suggestion Error: {e}")
            return []

# --- MAHARASHTRA LOCATION DATABASE ---
MAHARASHTRA_LOCATIONS = [
    {"city": "Mumbai", "pincode": "400001", "lat": 19.0760, "lng": 72.8777},
    {"city": "Pune", "pincode": "411001", "lat": 18.5204, "lng": 73.8567},
    {"city": "Nagpur", "pincode": "440001", "lat": 21.1458, "lng": 79.0882},
    {"city": "Nashik", "pincode": "422001", "lat": 19.9975, "lng": 73.7898},
    {"city": "Aurangabad", "pincode": "431001", "lat": 19.8762, "lng": 75.3433},
    {"city": "Solapur", "pincode": "413001", "lat": 17.6599, "lng": 75.9064},
    {"city": "Kolhapur", "pincode": "416001", "lat": 16.7050, "lng": 74.2433},
    {"city": "Thane", "pincode": "400601", "lat": 19.2183, "lng": 72.9781},
    {"city": "Navi Mumbai", "pincode": "400614", "lat": 19.0330, "lng": 73.0297},
    {"city": "Kalyan", "pincode": "421301", "lat": 19.2403, "lng": 73.1305},
    {"city": "Vasai", "pincode": "401201", "lat": 19.4612, "lng": 72.7989},
    {"city": "Amravati", "pincode": "444601", "lat": 20.9374, "lng": 77.7796},
    {"city": "Akola", "pincode": "444001", "lat": 20.7002, "lng": 77.0082},
    {"city": "Latur", "pincode": "413512", "lat": 18.4009, "lng": 76.5604},
    {"city": "Sangli", "pincode": "416416", "lat": 16.8524, "lng": 74.5815},
    {"city": "Jalgaon", "pincode": "425001", "lat": 21.0077, "lng": 75.5626},
    {"city": "Ahmednagar", "pincode": "414001", "lat": 19.0948, "lng": 74.7480},
    {"city": "Chandrapur", "pincode": "442401", "lat": 19.9615, "lng": 79.2961},
    {"city": "Parbhani", "pincode": "431401", "lat": 19.2608, "lng": 76.7811},
    {"city": "Ichalkaranji", "pincode": "416115", "lat": 16.6910, "lng": 74.4606},
    {"city": "Jalna", "pincode": "431203", "lat": 19.8449, "lng": 75.8814},
    {"city": "Bhiwandi", "pincode": "421302", "lat": 19.2969, "lng": 73.0583},
    {"city": "Satara", "pincode": "415001", "lat": 17.6805, "lng": 74.0183},
    {"city": "Dhule", "pincode": "424001", "lat": 20.9010, "lng": 74.7772},
    {"city": "Wardha", "pincode": "442001", "lat": 20.7453, "lng": 78.6022},
    {"city": "Nanded", "pincode": "431601", "lat": 19.1383, "lng": 77.3210},
    {"city": "Yavatmal", "pincode": "445001", "lat": 20.3897, "lng": 78.1215},
    {"city": "Ratnagiri", "pincode": "415612", "lat": 16.9902, "lng": 73.3120},
    {"city": "Osmanabad", "pincode": "413501", "lat": 18.1673, "lng": 76.0402},
    {"city": "Beed", "pincode": "431122", "lat": 18.9894, "lng": 75.7585},
]

# --- ENDPOINTS ---

@app.get("/api/suggestions")
async def get_suggestions(query: str):
    """
    Return autocomplete suggestions.
    Priority: Maharashtra local DB > Nominatim API
    """
    suggestions = []
    query_lower = query.lower()
    
    # 1. Check Maharashtra Database First (Instant, No API Calls)
    if len(query) >= 2:
        for loc in MAHARASHTRA_LOCATIONS:
            # Match by city name or pincode
            if (query_lower in loc["city"].lower() or 
                query in loc["pincode"]):
                suggestions.append({
                    "label": f"{loc['city']} - {loc['pincode']}",
                    "value": loc["pincode"],
                    "name": loc["city"],
                    "lat": loc["lat"],
                    "lng": loc["lng"]
                })
        
        # If we have local matches, prioritize them
        if len(suggestions) >= 3:
            return suggestions[:5]  # Return top 5 local matches
    
    # 2. Fall back to Nominatim for non-Maharashtra or no matches
    try:
        nominatim_results = await get_suggestions_real(query)
        # Append Nominatim results if we need more
        suggestions.extend(nominatim_results)
    except:
        pass
    
    return suggestions[:5]  # Limit to 5 total

@app.post("/api/water-balance")
async def get_water_balance(request: WaterBalanceRequest): # Made async
    
    lat, lng = request.lat, request.lng
    region_name = None
    pincode_found = request.pincode
    
    # 1. Resolve Location if needed
    if not (lat and lng):
        query = request.query or request.pincode
        if query:
            loc_data = await get_coordinates(query)
            if loc_data:
                lat = loc_data['lat']
                lng = loc_data['lng']
                region_name = loc_data['display_name'].split(",")[0]
            else:
                # Fallback if Nominatim fails
                raise HTTPException(status_code=404, detail="Location not found")
    
    
    # Reverse Geocode if we have real coords but no name (e.g. manual coords search)
    if not region_name and lat and lng:
         r_name, r_pin = await reverse_geocode(lat, lng)
         if r_name: region_name = r_name
         if r_pin: pincode_found = r_pin # Sync Pincode too!
    
    if not region_name:
         region_name = f"GPS ({lat:.2f}, {lng:.2f})"

    # 2. Get Real Water Data (Rainfall)
    # Logic: 
    # Base Groundwater (Mock constant for region) + Recent Rainfall (Real) - Evaporation (Constant)
    # Using real 30-day rain to influence the "Balance".
    
    real_rain_30d = await get_weather_real(lat, lng)
    
    # Water Balance Algorithm (Simple Model)
    # Assume base groundwater is ~500mm.
    # Add real rain.
    # Subtract evaporation (~5mm/day * 30 = 150mm).
    
    base_groundwater = 500 
    evaporation_loss = 150
    
    water_balance = base_groundwater + real_rain_30d - evaporation_loss
    water_balance = max(0, water_balance) # No negative water
    
    # Determine Status
    status = "Safe"
    if water_balance < 300:
        status = "Critical"
    elif water_balance < 600:
        status = "Moderate"
        
    # Soil Logic (Same as before)
    soil_advice = ""
    effective_soil = "Medium"
    if request.soil_type:
        st = request.soil_type.lower()
        if "black" in st or "clay" in st or "heavy" in st:
            soil_advice = "Your Soil retains water well. You can delay irrigation by 2-3 days."
            effective_soil = "Heavy"
        elif "sandy" in st or "light" in st or "red" in st:
            soil_advice = "Your Soil drains fast. Frequent light irrigation is recommended."
            effective_soil = "Light"

    # Season Logic
    current_month = datetime.datetime.now().month
    season = "Rabi"
    if 6 <= current_month <= 10:
        season = "Kharif"
    elif current_month >= 11 or current_month <= 2:
        season = "Rabi"
    else:
        season = "Zaid"

    crop_db = {
        "Kharif": {
            "Heavy": ["Cotton", "Sugarcane (Water Intensive)", "Soybean"],
            "Medium": ["Jowar", "Bajra", "Tur"],
            "Light": ["Bajra", "Groundnut", "Sesame"]
        },
        "Rabi": {
            "Heavy": ["Wheat", "Gram", "Sunflowers"],
            "Medium": ["Jowar", "Maize"],
            "Light": ["Mustard", "Barley"]
        },
        "Zaid": {
             "Heavy": ["Rice", "Fodder"],
             "Medium": ["Watermelon", "Cucumber"],
             "Light": ["Melons", "Vegetables"]
        }
    }
    recommended_crops = crop_db.get(season, {}).get(effective_soil, ["Standard Crops"])

    final_advice = f"Water Balance is {water_balance:.0f}mm (incl. {real_rain_30d:.1f}mm rain/30d). {soil_advice}"

    return {
        "success": True,
        "data": {
            "pincode": pincode_found or "Unknown",
            "available_water_mm": int(water_balance),
            "status": status,
            "region": region_name,
            "message": f"Real-time Water Report for {region_name}",
            "advice": final_advice,
            "season": season,
            "recommended_crops": recommended_crops,
            "lat": lat,
            "lng": lng
        }
    }

# --- CUSTOM CROP DATABASE (Source of Truth) ---
CROP_DATABASE = [
    # Cereals & Millets
    {"name": "Rice (Paddy)", "water_mm": 1200, "season": "Kharif", "type": "Cereal", "soil": ["Clay", "Heavy"]},
    {"name": "Wheat", "water_mm": 450, "season": "Rabi", "type": "Cereal", "soil": ["Medium", "Heavy"]},
    {"name": "Jowar (Sorghum)", "water_mm": 400, "season": "Kharif/Rabi", "type": "Millet", "soil": ["Medium", "Light", "Black"]},
    {"name": "Bajra (Pearl Millet)", "water_mm": 350, "season": "Kharif", "type": "Millet", "soil": ["Light", "Sandy"]},
    {"name": "Maize (Corn)", "water_mm": 500, "season": "Kharif/Rabi", "type": "Cereal", "soil": ["Medium", "Red"]},
    {"name": "Ragi (Finger Millet)", "water_mm": 350, "season": "Kharif", "type": "Millet", "soil": ["Red", "Light"]},
    
    # Pulses (Dal)
    {"name": "Tur (Arhar/Pigeon Pea)", "water_mm": 500, "season": "Kharif", "type": "Pulse", "soil": ["Medium", "Black"]},
    {"name": "Gram (Chana/Chickpea)", "water_mm": 300, "season": "Rabi", "type": "Pulse", "soil": ["Medium", "Black"]},
    {"name": "Moong (Green Gram)", "water_mm": 300, "season": "Kharif/Zaid", "type": "Pulse", "soil": ["Medium"]},
    {"name": "Urad (Black Gram)", "water_mm": 350, "season": "Kharif", "type": "Pulse", "soil": ["Medium", "Heavy"]},
    
    # Oilseeds & Cash Crops
    {"name": "Sugarcane", "water_mm": 1800, "season": "Annual", "type": "Cash Crop", "soil": ["Heavy", "Black"]},
    {"name": "Cotton", "water_mm": 700, "season": "Kharif", "type": "Cash Crop", "soil": ["Black", "Medium"]},
    {"name": "Soybean", "water_mm": 500, "season": "Kharif", "type": "Oilseed", "soil": ["Medium", "Black"]},
    {"name": "Groundnut", "water_mm": 500, "season": "Kharif", "type": "Oilseed", "soil": ["Light", "Sandy"]},
    {"name": "Sunflower", "water_mm": 450, "season": "Kharif/Rabi", "type": "Oilseed", "soil": ["Medium"]},
    {"name": "Mustard", "water_mm": 300, "season": "Rabi", "type": "Oilseed", "soil": ["Medium", "Light"]},
    
    # Vegetables
    {"name": "Onion", "water_mm": 500, "season": "Rabi/Kharif", "type": "Vegetable", "soil": ["Medium", "Light"]},
    {"name": "Potato", "water_mm": 500, "season": "Rabi", "type": "Vegetable", "soil": ["Medium"]},
    {"name": "Tomato", "water_mm": 600, "season": "Annual", "type": "Vegetable", "soil": ["Medium", "Red"]},
    {"name": "Brinjal (Eggplant)", "water_mm": 600, "season": "Annual", "type": "Vegetable", "soil": ["Medium"]},
    {"name": "Okra (Bhindi)", "water_mm": 400, "season": "Kharif/Zaid", "type": "Vegetable", "soil": ["Medium"]},
    {"name": "Cabbage", "water_mm": 400, "season": "Rabi", "type": "Vegetable", "soil": ["Medium"]},
    
    # Fruits
    {"name": "Banana", "water_mm": 1500, "season": "Annual", "type": "Fruit", "soil": ["Medium", "Heavy"]},
    {"name": "Mango", "water_mm": 1000, "season": "Annual", "type": "Fruit", "soil": ["Medium", "Red"]},
    {"name": "Grapes", "water_mm": 700, "season": "Annual", "type": "Fruit", "soil": ["Medium"]},
    {"name": "Pomegranate", "water_mm": 600, "season": "Annual", "type": "Fruit", "soil": ["Light", "Red"]},
    {"name": "Papaya", "water_mm": 1000, "season": "Annual", "type": "Fruit", "soil": ["Medium"]}
]

# --- CUSTOM SOIL DATABASE (Source of Truth) ---
SOIL_DATABASE = [
    {
        "name": "Black Soil (Regur/Kali) - Heavy",
        "type": "heavy", 
        "retention": "high",
        "desc": "High water retention. Good for Cotton, Sugarcane."
    },
    {
        "name": "Red Soil (Lal) - Light",
        "type": "light", 
        "retention": "low",
        "desc": "Porous, low retention. Good for Groundnut, Millets."
    },
    {
        "name": "Medium Soil (Loam/Domat) - Balanced",
        "type": "medium", 
        "retention": "medium",
        "desc": "Balanced moisture. Good for Vegetables, Wheat, Pulses."
    },
    {
        "name": "Alluvial Soil (Zalod) - Fertile",
        "type": "medium", 
        "retention": "medium",
        "desc": "Very fertile river soil. Great for Rice, Wheat."
    },
    {
        "name": "Laterite Soil (Jambhi) - Acidic",
        "type": "light", 
        "retention": "low",
        "desc": "Iron-rich, rocky. Good for Cashew, Mango."
    },
    {
        "name": "Clay Soil (Chikani) - Very Heavy",
        "type": "heavy", 
        "retention": "very_high",
        "desc": "Holds water too long. Risk of root rot if not drained."
    },
    {
        "name": "Sandy Soil (Retili) - Very Light",
        "type": "light", 
        "retention": "very_low",
        "desc": "Drains instantly. Needs frequent irrigation. Good for Melons."
    }
]

@app.get("/api/crops")
def get_all_crops():
    """Return the full list of supported crops."""
    return {"success": True, "data": CROP_DATABASE}

@app.get("/api/soils")
def get_all_soils():
    """Return the list of supported soil types."""
    return {"success": True, "data": SOIL_DATABASE}

@app.post("/api/check-crop")
def check_crop_viability(request: CheckCropRequest):
    # Find Crop in Database
    crop_data = next((c for c in CROP_DATABASE if c["name"] == request.crop_name), None)
    
    if not crop_data:
        # Fallback for manually typed or unknown crops
        needed = 500
        crop_type = "Unknown"
        ideal_soils = []
    else:
        needed = crop_data["water_mm"]
        crop_type = crop_data["type"]
        ideal_soils = [s.lower() for s in crop_data.get("soil", [])]

    available = request.available_water_mm
    
    # Soil Check
    soil_ok = True
    soil_warning = ""
    if request.soil_type:
        user_soil = request.soil_type.lower()
        
        # Simple Logic: If crop has specific soil needs, check against them
        if ideal_soils:
            # Check for strong mismatches
            if "clay" in ideal_soils and ("sandy" in user_soil or "light" in user_soil):
                soil_ok = False
                soil_warning = f"{request.crop_name} needs Heavy/Clay soil, but you have Light soil."
            elif "sandy" in ideal_soils and ("clay" in user_soil or "heavy" in user_soil):
                 soil_ok = False
                 soil_warning = f"{request.crop_name} needs Light/Sandy soil, avoiding waterlogging."

    is_feasible = available >= needed and soil_ok
    shortfall = needed - available
    
    if is_feasible:
        msg = f"✅ Success! You have {int(available)}mm. {request.crop_name} needs approx {needed}mm."
        type = "safe"
    else:
        type = "critical"
        if not soil_ok:
            msg = f"⚠️ Soil Warning: {soil_warning}"
        else:
             msg = f"❌ Not Viable. {request.crop_name} ({needed}mm) exceeds your water ({int(available)}mm) by {int(shortfall)}mm."

    return {
        "success": True,
        "feasible": is_feasible,
        "type": type,
        "message": msg,
        "data": {
            "needed": needed,
            "available": available,
            "crop_details": crop_data
        }
    }
