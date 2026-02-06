import requests
import json

BASE_URL = "http://127.0.0.1:8001"

print("=== Testing Water Balance API ===")
try:
    resp = requests.post(f"{BASE_URL}/api/water-balance", json={
        "lat": 18.52,
        "lng": 73.86,
        "soil_type": "Medium"
    })
    data = resp.json()
    print(f"Status: {resp.status_code}")
    print(f"Keys in response: {list(data.keys())}")
    
    # Check for expected keys
    expected = ["available_water_mm", "status", "advice", "smart_recommendations", "forecast", "forecast_summary"]
    for key in expected:
        if key in data:
            print(f"  ✅ {key}: Present ({type(data[key]).__name__})")
            if key == "smart_recommendations" and isinstance(data[key], list):
                print(f"      -> {len(data[key])} crops recommended")
            if key == "forecast" and isinstance(data[key], list):
                print(f"      -> {len(data[key])} days forecast")
        else:
            print(f"  ❌ {key}: MISSING!")
            
except Exception as e:
    print(f"Error: {e}")
