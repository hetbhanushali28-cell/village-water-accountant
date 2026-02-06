"""
API Verification Script for Village Water Accountant
Tests all endpoints and verifies smart recommendations logic
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8001"

def test_root():
    print("\n=== TEST: Root Endpoint ===")
    r = requests.get(f"{BASE_URL}/")
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    return r.status_code == 200

def test_crops():
    print("\n=== TEST: /api/crops ===")
    r = requests.get(f"{BASE_URL}/api/crops")
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"Total Crops: {len(data.get('data', []))}")
    if data.get('data'):
        crop = data['data'][0]
        print(f"Sample Crop: {crop.get('name')}")
        print(f"  - Sunlight: {crop.get('sunlight')}")
        print(f"  - Temperature: {crop.get('temperature')}")
        print(f"  - Climate: {crop.get('climate')}")
    return r.status_code == 200 and 'sunlight' in str(data)

def test_soils():
    print("\n=== TEST: /api/soils ===")
    r = requests.get(f"{BASE_URL}/api/soils")
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"Total Soils: {len(data.get('data', []))}")
    return r.status_code == 200

def test_suggestions():
    print("\n=== TEST: /api/suggestions?query=Pune ===")
    r = requests.get(f"{BASE_URL}/api/suggestions", params={"query": "Pune"})
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"Suggestions: {len(data)}")
    if data:
        print(f"First: {data[0]}")
    return r.status_code == 200

def test_water_balance():
    print("\n=== TEST: /api/water-balance (WITH Smart Recommendations) ===")
    payload = {
        "query": "Pune",
        "soil_type": "Black Soil"
    }
    r = requests.post(f"{BASE_URL}/api/water-balance", json=payload)
    data = r.json()
    print(f"Status: {r.status_code}")
    
    if data.get('success') and data.get('data'):
        d = data['data']
        print(f"Region: {d.get('region')}")
        print(f"Water Balance: {d.get('available_water_mm')} mm")
        print(f"Status: {d.get('status')}")
        print(f"Season: {d.get('season')}")
        print(f"Advice: {d.get('advice')}")
        
        # Check Smart Recommendations
        smart = d.get('smart_recommendations', [])
        print(f"\n--- Smart Recommendations ({len(smart)}) ---")
        for rec in smart[:3]:
            print(f"  {rec.get('name')} (Score: {rec.get('score')})")
            print(f"    Sunlight: {rec.get('sunlight')}")
            print(f"    Temperature: {rec.get('temperature')}")
            print(f"    Climate: {rec.get('climate')}")
            print(f"    Reasons: {', '.join(rec.get('reasons', []))}")
        
        return len(smart) > 0 and 'sunlight' in str(smart)
    return False

def test_check_crop():
    print("\n=== TEST: /api/check-crop ===")
    payload = {
        "crop_name": "Wheat",
        "available_water_mm": 500,
        "soil_type": "Medium Soil"
    }
    r = requests.post(f"{BASE_URL}/api/check-crop", json=payload)
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"Response: {json.dumps(data, indent=2)}")
    return r.status_code == 200

def main():
    print("=" * 60)
    print("VILLAGE WATER ACCOUNTANT - API VERIFICATION")
    print("=" * 60)
    
    results = {
        "Root": test_root(),
        "Crops": test_crops(),
        "Soils": test_soils(),
        "Suggestions": test_suggestions(),
        "Water Balance + Smart Recs": test_water_balance(),
        "Check Crop": test_check_crop(),
    }
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{name}: {status}")
    
    all_passed = all(results.values())
    print(f"\nOverall: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    return all_passed

if __name__ == "__main__":
    main()
