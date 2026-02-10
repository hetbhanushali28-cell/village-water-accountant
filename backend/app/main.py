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
    "*", # Allow all origins for simpler deployment (or restrict in production)
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
    lat: Optional[float] = None
    lng: Optional[float] = None

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

async def get_weather_forecast(lat: float, lng: float):
    """Fetch 7-day weather forecast from Open-Meteo (FREE, no API key)."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
                    "timezone": "auto",
                    "forecast_days": 7
                }
            )
            data = resp.json()
            
            if 'daily' in data:
                daily = data['daily']
                forecast = []
                
                # Weather code to description mapping
                weather_codes = {
                    0: ("☀️", "Clear Sky"),
                    1: ("🌤️", "Mainly Clear"),
                    2: ("⛅", "Partly Cloudy"),
                    3: ("☁️", "Overcast"),
                    45: ("🌫️", "Foggy"),
                    48: ("🌫️", "Fog"),
                    51: ("🌧️", "Light Drizzle"),
                    53: ("🌧️", "Drizzle"),
                    55: ("🌧️", "Heavy Drizzle"),
                    61: ("🌧️", "Light Rain"),
                    63: ("🌧️", "Rain"),
                    65: ("🌧️", "Heavy Rain"),
                    71: ("🌨️", "Light Snow"),
                    73: ("🌨️", "Snow"),
                    75: ("🌨️", "Heavy Snow"),
                    80: ("🌦️", "Rain Showers"),
                    81: ("🌦️", "Rain Showers"),
                    82: ("⛈️", "Heavy Showers"),
                    95: ("⛈️", "Thunderstorm"),
                    96: ("⛈️", "Thunderstorm + Hail"),
                    99: ("⛈️", "Severe Storm")
                }
                
                for i in range(len(daily['time'])):
                    code = daily['weather_code'][i] if daily['weather_code'] else 0
                    icon, desc = weather_codes.get(code, ("❓", "Unknown"))
                    
                    forecast.append({
                        "date": daily['time'][i],
                        "day": datetime.datetime.strptime(daily['time'][i], "%Y-%m-%d").strftime("%a"),
                        "icon": icon,
                        "condition": desc,
                        "temp_max": daily['temperature_2m_max'][i] if daily['temperature_2m_max'] else None,
                        "temp_min": daily['temperature_2m_min'][i] if daily['temperature_2m_min'] else None,
                        "rain_mm": daily['precipitation_sum'][i] if daily['precipitation_sum'] else 0,
                        "wind_kmh": daily['wind_speed_10m_max'][i] if daily['wind_speed_10m_max'] else 0
                    })
                
                return forecast
        except Exception as e:
            print(f"Forecast Error: {e}")
    return []

async def get_soil_data(lat: float, lng: float):
    """Fetch Soil Moisture and Temperature from Open-Meteo."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "hourly": "soil_temperature_6cm,soil_moisture_3_to_9cm",
                    "timezone": "auto" # Critical for alignment
                }
            )
            data = resp.json()
            if 'hourly' in data:
                # Take average of first 6 hours (approx current window)
                temps = [t for t in data['hourly']['soil_temperature_6cm'][:6] if t is not None]
                moists = [m for m in data['hourly']['soil_moisture_3_to_9cm'][:6] if m is not None]
                
                avg_temp = sum(temps) / len(temps) if temps else 25.0
                avg_moisture = sum(moists) / len(moists) if moists else 0.3

                return {
                    "temp_c": round(avg_temp, 1),
                    "moisture_percent": round(avg_moisture * 100, 1) # m³/m³ to %
                }
        except Exception as e:
            print(f"Soil Data Error: {e}")
    return None


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

# --- RECOMMENDATION REQUEST MODEL ---
class RecommendationRequest(BaseModel):
    soil_type: str
    season: str
    water_availability: str  # "High", "Medium", "Low" based on water balance

@app.post("/api/recommend-crops")
async def recommend_crops(request: RecommendationRequest):
    """
    Returns lists of Recommended, Moderate, and Risky crops
    based on Soil, Season, and Water Compatibility
    """
    soil_type = request.soil_type.lower()
    season = request.season
    water_avail = request.water_availability
    
    recommended = []
    
    # Map complex soil names to simple keywords
    soil_key = "medium"
    if "black" in soil_type or "heavy" in soil_type or "clay" in soil_type:
        soil_key = "heavy"
    elif "red" in soil_type or "light" in soil_type or "sandy" in soil_type:
        soil_key = "light"
    elif "medium" in soil_type:
        soil_key = "medium"
        
    for crop in CROP_DATABASE:
        score = 0
        reasons = []
        
        # 1. Season Check (Critical)
        if crop["season"] != "Annual" and season not in crop["season"]:
            continue # Skip wrong season crops for recommendations
            
        # 2. Soil Match
        # We check if our simplified soil_key maps to crop's soil list
        # We need to be liberal here. 
        # If crop needs "Black", and we have "Black Soil", it's a match.
        soil_match = False
        for s in crop["soil"]:
            if s.lower() in soil_type or (soil_key == "heavy" and s in ["Clay", "Black", "Heavy"]) or (soil_key == "light" and s in ["Sandy", "Light", "Red"]):
                soil_match = True
                break
        
        if soil_match:
            score += 40
            reasons.append("Great Soil Match")
        else:
            reasons.append("Soil not ideal but manageable")
            
        # 3. Water Match
        w = crop["water_mm"]
        water_score = 0
        if water_avail == "Critical" and w < 400:
            water_score = 40
            reasons.append("Drought Resistant")
        elif water_avail == "Moderate" and w < 800:
            water_score = 40
            reasons.append("Good Water Fit")
        elif water_avail == "Safe":
            water_score = 40
            reasons.append("Water Available")
        elif water_avail == "Critical" and w > 600:
            water_score = -50
            reasons.append("Requires too much water")
            
        score += water_score
        
        # 4. Recommendation Logic
        if score >= 70:
            recommended.append({
                "name": crop["name"],
                "score": score,
                "reasons": reasons,
                "details": crop # Send full details including environment
            })
            
    # Sort by score
    recommended.sort(key=lambda x: x["score"], reverse=True)
    
    return {"recommendations": recommended[:6]} # Top 6

# --- RECOMMENDATION REQUEST MODEL ---
class RecommendationRequest(BaseModel):
    soil_type: str
    season: str
    water_availability: str  # "High", "Medium", "Low" based on water balance

@app.post("/api/recommend-crops")
async def recommend_crops(request: RecommendationRequest):
    """
    Returns lists of Recommended, Moderate, and Risky crops
    based on Soil, Season, and Water Compatibility
    """
    soil_type = request.soil_type.lower()
    season = request.season
    water_avail = request.water_availability
    
    recommended = []
    
    # Map complex soil names to simple keywords
    soil_key = "medium"
    if "black" in soil_type or "heavy" in soil_type or "clay" in soil_type:
        soil_key = "heavy"
    elif "red" in soil_type or "light" in soil_type or "sandy" in soil_type:
        soil_key = "light"
    elif "medium" in soil_type:
        soil_key = "medium"
        
    for crop in CROP_DATABASE:
        score = 0
        reasons = []
        
        # 1. Season Check (Critical)
        if crop["season"] != "Annual" and season not in crop["season"]:
            continue # Skip wrong season crops for recommendations
            
        # 2. Soil Match
        # We check if our simplified soil_key maps to crop's soil list
        # We need to be liberal here. 
        # If crop needs "Black", and we have "Black Soil", it's a match.
        soil_match = False
        for s in crop["soil"]:
            if s.lower() in soil_type or (soil_key == "heavy" and s in ["Clay", "Black", "Heavy"]) or (soil_key == "light" and s in ["Sandy", "Light", "Red"]):
                soil_match = True
                break
        
        if soil_match:
            score += 40
            reasons.append("Great Soil Match")
        else:
            reasons.append("Soil not ideal but manageable")
            
        # 3. Water Match
        w = crop["water_mm"]
        water_score = 0
        if water_avail == "Critical" and w < 400:
            water_score = 40
            reasons.append("Drought Resistant")
        elif water_avail == "Moderate" and w < 800:
            water_score = 40
            reasons.append("Good Water Fit")
        elif water_avail == "Safe":
            water_score = 40
            reasons.append("Water Available")
        elif water_avail == "Critical" and w > 600:
            water_score = -50
            reasons.append("Requires too much water")
            
        score += water_score
        
        # 4. Recommendation Logic
        if score >= 70:
            recommended.append({
                "name": crop["name"],
                "score": score,
                "reasons": reasons,
                "details": crop # Send full details including environment
            })
            
    # Sort by score
    recommended.sort(key=lambda x: x["score"], reverse=True)
    
    return {"recommendations": recommended[:6]} # Top 6

# --- SIMULATION REQUEST MODEL ---
class SimulationRequest(BaseModel):
    crop_name: str
    water_balance: int # Current water balance in mm
    month_start: int # 1-12

@app.post("/api/simulate-water")
async def simulate_water(request: SimulationRequest):
    """
    Simulate water depletion using 'Cone of Uncertainty' logic.
    Uses 20th (Worst), 50th (Likely), and 80th (Best) percentile rainfall data.
    """
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    start_idx = request.month_start - 1
    
    # Get crop water need
    crop_info = next((c for c in CROP_DATABASE if c["name"] == request.crop_name), None)
    total_need = crop_info["water_mm"] if crop_info else 500
    monthly_usage = total_need / 5 # Assume 5 month active season
    
    # Mock Historical Rainfall Data (mm) - [Worst(20th), Median(50th), Best(80th)]
    rainfall_stats = {
        0: [0, 0, 5],    1: [0, 0, 5],    2: [0, 5, 10],    # Jan-Mar
        3: [0, 10, 20],  4: [10, 25, 40],                   # Apr-May
        5: [80, 150, 220],                                  # Jun (Monsoon Start)
        6: [150, 250, 350], 7: [120, 200, 300],             # Jul-Aug (Peak)
        8: [50, 120, 180],                                  # Sep (Retreating)
        9: [10, 40, 80], 10: [0, 10, 30], 11: [0, 0, 10]    # Oct-Dec
    }
    
    simulation = []
    # Initialize balances
    b_best = request.water_balance
    b_likely = request.water_balance
    b_worst = request.water_balance
    
    for i in range(6):
        idx = (start_idx + i) % 12
        m_name = months[idx]
        
        # Get historical rain stats for this month
        stats = rainfall_stats.get(idx, [0, 0, 0])
        inc_worst, inc_likely, inc_best = stats
        
        # Calculate Scenarios
        # Worst: Low Rain + High Usage (Neighbor Extraction factor)
        b_worst += inc_worst - (monthly_usage * 1.2)
        
        # Likely: Median Rain + Normal Usage
        b_likely += inc_likely - monthly_usage
        
        # Best: High Rain + Efficient Usage (0.9 factor)
        b_best += inc_best - (monthly_usage * 0.9)
        
        # Clamp to 0 (cannot have negative water)
        simulation.append({
            "month": m_name,
            "best": max(0, int(b_best)),
            "likely": max(0, int(b_likely)),
            "worst": max(0, int(b_worst))
        })
        
    return {"simulation": simulation}

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

@app.get("/api/forecast")
async def get_forecast(lat: float, lng: float):
    """
    Get 7-day weather forecast for a location.
    Uses Open-Meteo API (FREE, no API key required).
    """
    forecast = await get_weather_forecast(lat, lng)
    
    # Generate farming advice based on forecast
    rain_days = sum(1 for day in forecast if day.get('rain_mm', 0) > 5)
    total_rain = sum(day.get('rain_mm', 0) for day in forecast)
    
    farm_advice = ""
    if rain_days >= 3:
        farm_advice = "🌧️ Heavy rain expected. Delay sowing water-sensitive crops."
    elif rain_days >= 1:
        farm_advice = "🌦️ Some rain expected. Good time for transplanting."
    elif total_rain < 10:
        farm_advice = "☀️ Dry week ahead. Plan irrigation for water-hungry crops."
    else:
        farm_advice = "⛅ Mixed conditions. Monitor daily."
    
    return {
        "success": True,
        "forecast": forecast,
        "summary": {
            "rain_days": rain_days,
            "total_rain_mm": round(total_rain, 1),
            "farm_advice": farm_advice
        }
    }



@app.get("/api/soil-conditions")
async def get_soil_conditions_endpoint(lat: float, lng: float):
    """Get real-time soil moisture and temperature."""
    # Retrieve real-time soil data
    data = await get_soil_data(lat, lng)
    
    if not data:
        return {
            "success": False,
            "message": "Data unavailable"
        }
        
    # Add simple status analysis
    moisture = data['moisture_percent']
    if moisture < 15: status = "Dry - Needs Irrigation 💧"
    elif moisture < 40: status = "Optimal Moisture ✅"
    else: status = "Saturated / Wet ⚠️"
    
    data['status'] = status
    
    return {
        "success": True,
        "data": data
    }

# --- MOCK MARKET DATA (Simulating data.gov.in) ---
MARKET_DATA_MOCK = {
    "Rice": [
        {"market": "Pune APMC", "state": "MH", "min_price": 2800, "max_price": 3500, "modal_price": 3100, "trend": "up", "date": "06-Feb"},
        {"market": "Nashik APMC", "state": "MH", "min_price": 2700, "max_price": 3300, "modal_price": 3000, "trend": "stable", "date": "06-Feb"},
    ],
    "Wheat": [
        {"market": "Mumbai Vashi", "state": "MH", "min_price": 3200, "max_price": 4000, "modal_price": 3600, "trend": "up", "date": "06-Feb"},
        {"market": "Pune APMC", "state": "MH", "min_price": 3000, "max_price": 3800, "modal_price": 3400, "trend": "stable", "date": "06-Feb"},
    ],
    "Jowar": [
         {"market": "Solapur APMC", "state": "MH", "min_price": 3500, "max_price": 4200, "modal_price": 3800, "trend": "up", "date": "06-Feb"},
    ],
    "Bajra": [
         {"market": "Ahmednagar APMC", "state": "MH", "min_price": 2200, "max_price": 2600, "modal_price": 2400, "trend": "down", "date": "06-Feb"},
    ]
}

@app.get("/api/market-prices")
def get_market_prices(commodity: str):
    """Fetch live market prices (Mocked for Demo)."""
    # Normalize: "Rice (Paddy)" -> "Rice"
    comm = commodity.split(" ")[0]
    if "Sorghum" in commodity: comm = "Jowar"
    if "Pearl" in commodity: comm = "Bajra"
    
    data = MARKET_DATA_MOCK.get(comm, [])
    
    # Generic Fallback
    if not data:
        import random
        base = random.randint(3000, 7000)
        data = [
            {"market": "District Mandi", "state": "MH", "min_price": base - 300, "max_price": base + 300, "modal_price": base, "trend": "stable", "date": "06-Feb"},
             {"market": "State Market", "state": "MH", "min_price": base - 200, "max_price": base + 500, "modal_price": base + 200, "trend": "up", "date": "06-Feb"}
        ]
    
    return {"success": True, "data": data, "commodity": comm}

# --- HELPER: SMART CROP ENGINE ---
def get_smart_recommendations(soil_type, season, water_avail_mm):
    """
    Central Logic for Crop Recommendation Engine.
    Returns sorted list of matching crops with environmental insights.
    """
    effective_soil = "medium"
    st = soil_type.lower()
    if "black" in st or "clay" in st or "heavy" in st: effective_soil = "heavy"
    elif "red" in st or "light" in st or "sandy" in st: effective_soil = "light"
    
    # Determine abstract water status for scoring
    water_status = "Safe"
    if water_avail_mm < 300: water_status = "Critical"
    elif water_avail_mm < 600: water_status = "Moderate"

    recommended = []
    
    # Ensure Global DB is accessible (it's defined at module level)
    # We will ensure CROP_DATABASE is defined before usage or python handles it if global.
    
    for crop in CROP_DATABASE:
        score = 0
        reasons = []
        
        # 1. Season Check (Skip if mismatch)
        if crop["season"] != "Annual" and season not in crop["season"]:
            continue 
            
        # 2. Soil Match
        soil_match = False
        for s in crop["soil"]:
            if effective_soil == "heavy" and s in ["Clay", "Black", "Heavy"]: soil_match = True
            elif effective_soil == "light" and s in ["Sandy", "Light", "Red"]: soil_match = True
            elif s.lower() in st: soil_match = True
        
        if soil_match:
            score += 40
            reasons.append("Great Soil Match")
        else:
            reasons.append("Soil Tolerable")
            
        # 3. Water Match
        needed = crop["water_mm"]
        if water_status == "Critical":
            if needed < 400: 
                score += 50; reasons.append("Drought Resistant 🌵")
            else: 
                score -= 50; reasons.append("Requires too much water ⚠️")
        elif water_status == "Moderate":
            if needed < 800: score += 30; reasons.append("Good Water Fit 💧")
        else: # Safe
            score += 20; reasons.append("Ample Water ✅")
            
        # 4. Filter Low Scores
        if score >= 50:
            # Get seed costs (with fallback)
            costs = SEED_COSTS.get(crop["name"], {"seed_per_kg": 100, "input_per_acre": 15000})
            recommended.append({
                "name": crop["name"],
                "score": score,
                "type": crop["type"],
                "water_req": f"{needed}mm",
                "sunlight": crop.get("sunlight", "Full Sun"),
                "temperature": crop.get("temperature", "20-30°C"),
                "climate": crop.get("climate", "Varied"),
                "reasons": reasons,
                "seed_cost_per_kg": costs["seed_per_kg"],
                "input_cost_per_acre": costs["input_per_acre"]
            })
            
    # Sort by score desc
    recommended.sort(key=lambda x: x["score"], reverse=True)
    return recommended[:5]

@app.post("/api/water-balance")
async def get_water_balance(request: WaterBalanceRequest):
    lat, lng = request.lat, request.lng
    region_name = None
    pincode_found = request.pincode
    
    # 1. Resolve Location
    if not (lat and lng):
        query = request.query or request.pincode
        if query:
            loc_data = await get_coordinates(query)
            if loc_data:
                lat = loc_data['lat']
                lng = loc_data['lng']
                region_name = loc_data['display_name'].split(",")[0]
            else:
                raise HTTPException(status_code=404, detail="Location not found")
    
    if not region_name and lat and lng:
         r_name, r_pin = await reverse_geocode(lat, lng)
         if r_name: region_name = r_name
         if r_pin: pincode_found = r_pin
    
    if not region_name: region_name = f"GPS ({lat:.2f}, {lng:.2f})"

    # 2. Water Data
    real_rain_30d = await get_weather_real(lat, lng)
    base_groundwater = 500 
    evaporation_loss = 150
    water_balance = max(0, base_groundwater + real_rain_30d - evaporation_loss)
    
    # 3. Status
    status = "Safe"
    if water_balance < 300: status = "Critical"
    elif water_balance < 600: status = "Moderate"
        
    # 4. Soil Advice
    soil_advice = "Standard irrigation."
    if request.soil_type:
        st = request.soil_type.lower()
        if "black" in st or "clay" in st: soil_advice = "Retains water well. Delay irrigation."
        elif "sandy" in st or "light" in st: soil_advice = "Drains fast. Frequent light irrigation."

    # 5. Season
    curr_month = datetime.datetime.now().month
    season = "Kharif" if 6 <= curr_month <= 10 else "Rabi" if (curr_month >= 11 or curr_month <= 2) else "Zaid"

    # 6. SMART RECOMMENDATIONS (Using shared logic)
    smart_recs = get_smart_recommendations(request.soil_type or "Medium", season, water_balance)
    
    # Legacy list for old UI support (names only)
    legacy_recs = [r["name"] for r in smart_recs]

    # 7. Get 7-Day Forecast
    forecast = await get_weather_forecast(lat, lng)
    rain_days = sum(1 for day in forecast if day.get('rain_mm', 0) > 5)
    total_rain = sum(day.get('rain_mm', 0) for day in forecast)
    
    forecast_advice = "Dry week ahead. Plan irrigation." if total_rain < 10 else \
                      "Heavy rain expected. Delay sowing." if rain_days >= 3 else \
                      "Some rain expected. Good for transplanting." if rain_days >= 1 else \
                      "Mixed conditions. Monitor daily."

    final_advice = f"Water Balance: {water_balance:.0f}mm. {soil_advice}"

    return {
        "success": True,
        "data": {
            "pincode": pincode_found or "Unknown",
            "available_water_mm": int(water_balance),
            "status": status,
            "region": region_name,
            "message": f"Report for {region_name}",
            "advice": final_advice,
            "season": season,
            "recommended_crops": legacy_recs,
            "smart_recommendations": smart_recs,
            "lat": lat,
            "lng": lng,
            "forecast": forecast,
            "forecast_summary": {
                "rain_days": rain_days,
                "total_rain_mm": round(total_rain, 1),
                "advice": forecast_advice
            }
        }
    }

# --- SEED COSTS & INPUT COSTS DATABASE ---
SEED_COSTS = {
    # Cereals (price per kg of seed, input cost per acre in INR)
    "Rice (Paddy)": {"seed_per_kg": 80, "input_per_acre": 18000},
    "Wheat": {"seed_per_kg": 45, "input_per_acre": 12000},
    "Jowar (Sorghum)": {"seed_per_kg": 60, "input_per_acre": 8000},
    "Bajra (Pearl Millet)": {"seed_per_kg": 50, "input_per_acre": 7000},
    "Maize (Corn)": {"seed_per_kg": 350, "input_per_acre": 15000},
    "Ragi (Finger Millet)": {"seed_per_kg": 70, "input_per_acre": 9000},
    
    # Pulses
    "Tur (Arhar/Pigeon Pea)": {"seed_per_kg": 120, "input_per_acre": 10000},
    "Gram (Chana/Chickpea)": {"seed_per_kg": 80, "input_per_acre": 9000},
    "Moong (Green Gram)": {"seed_per_kg": 150, "input_per_acre": 8000},
    "Urad (Black Gram)": {"seed_per_kg": 140, "input_per_acre": 8500},
    
    # Cash Crops
    "Sugarcane": {"seed_per_kg": 5, "input_per_acre": 45000},  # per cutting
    "Cotton": {"seed_per_kg": 800, "input_per_acre": 25000},
    "Soybean": {"seed_per_kg": 90, "input_per_acre": 12000},
    "Groundnut": {"seed_per_kg": 120, "input_per_acre": 15000},
    "Sunflower": {"seed_per_kg": 200, "input_per_acre": 11000},
    "Mustard": {"seed_per_kg": 100, "input_per_acre": 8000},
    
    # Vegetables
    "Onion": {"seed_per_kg": 1500, "input_per_acre": 35000},
    "Potato": {"seed_per_kg": 35, "input_per_acre": 40000},
    "Tomato": {"seed_per_kg": 2500, "input_per_acre": 50000},
    "Brinjal (Eggplant)": {"seed_per_kg": 3000, "input_per_acre": 45000},
    "Okra (Bhindi)": {"seed_per_kg": 800, "input_per_acre": 25000},
    "Cabbage": {"seed_per_kg": 2000, "input_per_acre": 35000},
    
    # Fruits (per saplings/plants)
    "Mango": {"seed_per_kg": 150, "input_per_acre": 80000},
    "Banana": {"seed_per_kg": 25, "input_per_acre": 60000},
    "Grapes": {"seed_per_kg": 50, "input_per_acre": 150000},
    "Pomegranate": {"seed_per_kg": 100, "input_per_acre": 100000},
    "Orange": {"seed_per_kg": 80, "input_per_acre": 70000},
}

# --- CUSTOM CROP DATABASE (Source of Truth) ---
CROP_DATABASE = [
    # Cereals & Millets
    {
        "name": "Rice (Paddy)", "water_mm": 1200, "season": "Kharif", "type": "Cereal", "soil": ["Clay", "Heavy"],
        "sunlight": "Full Sun", "temperature": "20-35°C", "climate": "Humid & Tropical"
    },
    {
        "name": "Wheat", "water_mm": 450, "season": "Rabi", "type": "Cereal", "soil": ["Medium", "Heavy"],
        "sunlight": "Full Sun", "temperature": "10-25°C", "climate": "Cool & Dry"
    },
    {
        "name": "Jowar (Sorghum)", "water_mm": 400, "season": "Kharif/Rabi", "type": "Millet", "soil": ["Medium", "Light", "Black"],
        "sunlight": "Full Sun", "temperature": "25-35°C", "climate": "Hot & Dry"
    },
    {
        "name": "Bajra (Pearl Millet)", "water_mm": 350, "season": "Kharif", "type": "Millet", "soil": ["Light", "Sandy"],
        "sunlight": "Full Sun", "temperature": "25-35°C", "climate": "Hot & Arid"
    },
    {
        "name": "Maize (Corn)", "water_mm": 500, "season": "Kharif/Rabi", "type": "Cereal", "soil": ["Medium", "Red"],
        "sunlight": "Full Sun", "temperature": "18-27°C", "climate": "Warm"
    },
    {
        "name": "Ragi (Finger Millet)", "water_mm": 350, "season": "Kharif", "type": "Millet", "soil": ["Red", "Light"],
        "sunlight": "Full Sun", "temperature": "20-30°C", "climate": "Tropical/Subtropical"
    },
    
    # Pulses (Dal)
    {
        "name": "Tur (Arhar/Pigeon Pea)", "water_mm": 500, "season": "Kharif", "type": "Pulse", "soil": ["Medium", "Black"],
        "sunlight": "Full Sun", "temperature": "25-30°C", "climate": "Semi-Arid"
    },
    {
        "name": "Gram (Chana/Chickpea)", "water_mm": 300, "season": "Rabi", "type": "Pulse", "soil": ["Medium", "Black"],
        "sunlight": "Full Sun", "temperature": "15-25°C", "climate": "Cool & Dry"
    },
    {
        "name": "Moong (Green Gram)", "water_mm": 300, "season": "Kharif/Zaid", "type": "Pulse", "soil": ["Medium"],
        "sunlight": "Full Sun", "temperature": "25-35°C", "climate": "Warm"
    },
    {
        "name": "Urad (Black Gram)", "water_mm": 350, "season": "Kharif", "type": "Pulse", "soil": ["Medium", "Heavy"],
        "sunlight": "Full Sun", "temperature": "25-35°C", "climate": "Warm & Humid"
    },
    
    # Oilseeds & Cash Crops
    {
        "name": "Sugarcane", "water_mm": 1800, "season": "Annual", "type": "Cash Crop", "soil": ["Heavy", "Black"],
        "sunlight": "Full Sun", "temperature": "20-35°C", "climate": "Tropical & Humid"
    },
    {
        "name": "Cotton", "water_mm": 700, "season": "Kharif", "type": "Cash Crop", "soil": ["Black", "Medium"],
        "sunlight": "Full Sun", "temperature": "21-30°C", "climate": "Warm & Semi-Arid"
    },
    {
        "name": "Soybean", "water_mm": 500, "season": "Kharif", "type": "Oilseed", "soil": ["Medium", "Black"],
        "sunlight": "Full Sun", "temperature": "20-30°C", "climate": "Warm & Moist"
    },
    {
        "name": "Groundnut", "water_mm": 500, "season": "Kharif", "type": "Oilseed", "soil": ["Light", "Sandy"],
        "sunlight": "Full Sun", "temperature": "25-30°C", "climate": "Tropics"
    },
    {
        "name": "Sunflower", "water_mm": 450, "season": "Kharif/Rabi", "type": "Oilseed", "soil": ["Medium"],
        "sunlight": "Full Sun", "temperature": "20-25°C", "climate": "Adaptable"
    },
    {
        "name": "Mustard", "water_mm": 300, "season": "Rabi", "type": "Oilseed", "soil": ["Medium", "Light"],
        "sunlight": "Full Sun", "temperature": "10-25°C", "climate": "Cool"
    },
    
    # Vegetables (Updated with specifics)
    {
        "name": "Onion", "water_mm": 500, "season": "Rabi/Kharif", "type": "Vegetable", "soil": ["Medium", "Light"],
        "sunlight": "Full Sun", "temperature": "15-25°C", "climate": "Mild"
    },
    {
        "name": "Potato", "water_mm": 500, "season": "Rabi", "type": "Vegetable", "soil": ["Medium"],
        "sunlight": "Full Sun", "temperature": "15-20°C", "climate": "Cool"
    },
    {
        "name": "Tomato", "water_mm": 600, "season": "Annual", "type": "Vegetable", "soil": ["Medium", "Red"],
        "sunlight": "Full Sun", "temperature": "20-30°C", "climate": "Warm"
    },
    {
        "name": "Brinjal (Eggplant)", "water_mm": 600, "season": "Annual", "type": "Vegetable", "soil": ["Medium"],
        "sunlight": "Full Sun", "temperature": "25-30°C", "climate": "Warm"
    },
    {
        "name": "Okra (Bhindi)", "water_mm": 400, "season": "Kharif/Zaid", "type": "Vegetable", "soil": ["Medium"],
        "sunlight": "Full Sun", "temperature": "22-35°C", "climate": "Warm"
    },
    {
        "name": "Cabbage", "water_mm": 400, "season": "Rabi", "type": "Vegetable", "soil": ["Medium"],
        "sunlight": "Part Sun", "temperature": "15-20°C", "climate": "Cool & Moist"
    },
    
    # Fruits
    {
        "name": "Banana", "water_mm": 1500, "season": "Annual", "type": "Fruit", "soil": ["Medium", "Heavy"],
        "sunlight": "Full Sun", "temperature": "25-30°C", "climate": "Tropical Humid"
    },
    {
        "name": "Mango", "water_mm": 1000, "season": "Annual", "type": "Fruit", "soil": ["Medium", "Red"],
        "sunlight": "Full Sun", "temperature": "24-30°C", "climate": "Tropical"
    },
    {
        "name": "Grapes", "water_mm": 700, "season": "Annual", "type": "Fruit", "soil": ["Medium"],
        "sunlight": "Full Sun", "temperature": "15-35°C", "climate": "Dry/Mediterranean"
    },
    {
        "name": "Pomegranate", "water_mm": 600, "season": "Annual", "type": "Fruit", "soil": ["Light", "Red"],
        "sunlight": "Full Sun", "temperature": "25-35°C", "climate": "Semi-Arid"
    },
    {
        "name": "Papaya", "water_mm": 1000, "season": "Annual", "type": "Fruit", "soil": ["Medium"],
        "sunlight": "Full Sun", "temperature": "25-30°C", "climate": "Tropical"
    }
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
async def check_crop_viability(request: CheckCropRequest):
    # Find Crop in Database
    crop_data = next((c for c in CROP_DATABASE if c["name"] == request.crop_name), None)
    
    if not crop_data:
        # Fallback for manually typed or unknown crops
        needed = 500
        crop_type = "Unknown"
        ideal_soils = []
        season_rec = "Annual"
    else:
        needed = crop_data["water_mm"]
        crop_type = crop_data["type"]
        ideal_soils = [s.lower() for s in crop_data.get("soil", [])]
        season_rec = crop_data["season"]

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
    
    # --- SMART ADVICE (Weather + Season) ---
    smart_advice = []
    
    # 1. Season Check
    current_month = datetime.datetime.now().month
    current_season = "Kharif" if 6 <= current_month <= 10 else "Rabi" if (current_month >= 11 or current_month <= 2) else "Zaid"
    
    if season_rec != "Annual" and current_season not in season_rec:
        smart_advice.append(f"⚠️ {request.crop_name} is a {season_rec} crop, but currently it's {current_season}. Yield may be low.")
    
    # 2. Weather Check (if location provided)
    if request.lat and request.lng:
        forecast = await get_weather_forecast(request.lat, request.lng)
        rain_days = sum(1 for day in forecast if day.get('rain_mm', 0) > 5)
        total_rain = sum(day.get('rain_mm', 0) for day in forecast)
        
        if rain_days >= 3:
            smart_advice.append("🌧️ Heavy rain alert! Delay sowing/spraying.")
        elif total_rain < 5 and available < needed:
            smart_advice.append("☀️ Dry week ahead. Ensure irrigation is planned.")
        elif total_rain > 20 and crop_type == "Pulse":
             smart_advice.append("💧 Excess rain warning for Pulses. Ensure drainage.")

    extra_msg = " ".join(smart_advice)
    
    if is_feasible:
        msg = f"✅ Success! You have {int(available)}mm. {request.crop_name} needs approx {needed}mm."
        type = "safe"
    else:
        type = "critical"
        if not soil_ok:
            msg = f"⚠️ Soil Warning: {soil_warning}"
        else:
             msg = f"❌ Not Viable. {request.crop_name} ({needed}mm) exceeds your water ({int(available)}mm) by {int(shortfall)}mm."
    
    if extra_msg:
        msg += f" {extra_msg}"

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
