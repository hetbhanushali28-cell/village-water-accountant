import urllib.request
import json
import time

# Wait for server to start
time.sleep(2)

url = "http://127.0.0.1:8001/api/water-balance"
headers = {'Content-Type': 'application/json'}


def test_case(name, payload):
    print(f"\nTesting {name} with payload: {payload}...")
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print("Success!")
            print(f"Season: {result['data'].get('season', 'Unknown')}")
            if 'recommended_crops' in result['data']:
                print(f"Recommended Crops: {result['data']['recommended_crops']}")
                # Assert for Rabi logic
                if result['data'].get('season') == 'Rabi':
                     print("[PASS] VERIFIED: Season is correctly Rabi (Feb).")
                else:
                     print(f"[FAIL] ERROR: Expected Rabi, got {result['data'].get('season')}")
            
            if 'lat' in result['data'] and 'lng' in result['data']:
                print(f"[PASS] VERIFIED: Coordinates returned: ({result['data']['lat']}, {result['data']['lng']})")
            else:
                print("[FAIL] ERROR: Coordinates missing in response.")
    except Exception as e:
        print(f"Error: {e}")

# Test: Check Lat/Lng Sync
test_case("Coord Sync Check", {"query": "Pune", "soil_type": "Black Soil (Kali) - Heavy"})
