# 💧 Village Water Accountant

**Know your "Water Bank Balance" before you sow.**

A smart agricultural tool for Maharashtra farmers to check water availability and get crop recommendations based on soil type, location, and real-time weather data.

## Features

✅ **Manual Crop Viability Check**
- Select soil type from 7 Indian soil varieties
- Choose from 35+ crops (Rice, Wheat, Cotton, etc.)
- Get instant viability recommendations

✅ **Location-Based Search**
- 30 Maharashtra cities with autocomplete
- Search by City, Pincode, or GPS coordinates
- Instant suggestions with coordinates

✅ **Real-Time Data**
- Weather data from Open-Meteo API
- Location data from OpenStreetMap
- Water balance calculations

✅ **Beautiful UI**
- Modern purple gradient design
- Glassmorphism effects
- Smooth animations
- Fully responsive

## Tech Stack

**Backend:**
- FastAPI (Python)
- HTTPX for API calls
- Uvicorn server

**Frontend:**
- React 18
- Vite
- Axios
- Modern CSS3

## Installation

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn httpx
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

- `GET /api/crops` - Get all crops
- `GET /api/soils` - Get all soil types
- `GET /api/suggestions?query=<text>` - Location autocomplete
- `POST /api/check-crop` - Check crop viability
- `POST /api/water-balance` - Get water balance report

## Database

**30 Maharashtra Cities:**
Mumbai, Pune, Nagpur, Nashik, Aurangabad, Solapur, Kolhapur, Thane, and 22 more.

**7 Soil Types:**
Black Soil, Red Soil, Alluvial, Laterite, Clay, Sandy, Medium Loam

**35+ Crops:**
Cereals, Pulses, Oilseeds, Cash Crops, Vegetables, Fruits

## Author

Built with ❤️ for Maharashtra farmers
