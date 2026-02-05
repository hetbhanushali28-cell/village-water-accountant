import { useState, useEffect } from 'react'
import { getWaterBalance, fetchSuggestions, checkCropViability, fetchCrops, fetchSoils } from './api';
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('pincode');
  const [pincodeQuery, setPincodeQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [latQuery, setLatQuery] = useState('');
  const [lngQuery, setLngQuery] = useState('');

  const [soilType, setSoilType] = useState('Medium Soil');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [activeSearch, setActiveSearch] = useState(null); // 'name' or 'pincode'

  // Manual Check State
  const [selectedCrop, setSelectedCrop] = useState('');
  const [viabilityResult, setViabilityResult] = useState(null);
  const [cropList, setCropList] = useState([]); // Dynamic List
  const [soilList, setSoilList] = useState([]); // Dynamic Soil List

  // Suggestion States for Soil/Crop
  const [soilSuggestions, setSoilSuggestions] = useState([]);
  const [cropSuggestions, setCropSuggestions] = useState([]);

  // Fetch References on Mount
  // Fetch References on Mount
  useEffect(() => {
    async function loadData() {
      // Fetch independently (fail-safe)
      try {
        const cList = await fetchCrops();
        if (cList && cList.length > 0) setCropList(cList);
      } catch (e) { console.error("Crop fetch error", e); }

      try {
        const sList = await fetchSoils();
        if (sList && sList.length > 0) setSoilList(sList);
      } catch (e) { console.error("Soil fetch error", e); }
    }
    loadData();
  }, []);

  const handleInputChange = async (e, type) => {
    const val = e.target.value;
    if (type === 'name') setNameQuery(val);
    if (type === 'pincode') setPincodeQuery(val);

    setActiveSearch(type);

    if (val.length > 1) {
      const results = await fetchSuggestions(val);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }

  const selectSuggestion = (s) => {
    setSuggestions([]);
    setPincodeQuery(s.value);
    setNameQuery(s.name);
    if (s.lat) setLatQuery(s.lat);
    if (s.lng) setLngQuery(s.lng);
    // Optional: Auto Trigger Search? Let's leave it manual for now.
  }

  const handleSoilInput = (e) => {
    const val = e.target.value;
    setSoilType(val);

    if (val) {
      const filtered = soilList.filter(s =>
        s.name.toLowerCase().includes(val.toLowerCase())
      );
      setSoilSuggestions(filtered);
    } else {
      setSoilSuggestions(soilList); // Show all when cleared
    }
  }

  const handleCropInput = (e) => {
    const val = e.target.value;
    setSelectedCrop(val);

    if (val) {
      const filtered = cropList.filter(c =>
        c.name.toLowerCase().includes(val.toLowerCase())
      );
      setCropSuggestions(filtered);
    } else {
      setCropSuggestions(cropList); // Show all when cleared
    }
  }

  const selectSoil = (soilName) => {
    setSoilType(soilName);
    setSoilSuggestions([]); // Hide after selection
  }

  const selectCrop = (cropName) => {
    setSelectedCrop(cropName);
    setCropSuggestions([]); // Hide after selection
  }

  // --- Actions ---
  const handleSearch = async (type) => {
    let query = '';
    let lat = null;
    let lng = null;

    if (type === 'pincode') query = pincodeQuery;
    else if (type === 'name') query = nameQuery;
    else if (type === 'coords') {
      if (!latQuery || !lngQuery) {
        setError("Please enter both Latitude and Longitude");
        return;
      }
      lat = parseFloat(latQuery);
      lng = parseFloat(lngQuery);
    }

    if (!query && type !== 'coords') {
      setError(`Please enter a ${type === 'pincode' ? 'Pincode' : 'Area Name'}`)
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await getWaterBalance(query, lat, lng, soilType)
      if (data.success) {
        setResult(data.data)
        // Auto-fill inputs based on result
        if (data.data.pincode) setPincodeQuery(data.data.pincode);
        if (data.data.region) setNameQuery(data.data.region.split(" (")[0]);
        if (data.data.lat) setLatQuery(data.data.lat);
        if (data.data.lng) setLngQuery(data.data.lng);
      } else {
        setError('Failed to fetch data')
      }
    } catch (err) {
      setError('Error connecting to backend')
    } finally {
      setLoading(false)
    }
  }

  const handleLocation = () => {
    console.log("Attempting to access location...");
    if (navigator.geolocation) {
      setLoading(true)
      setError('')
      setResult(null)
      navigator.geolocation.getCurrentPosition(async (position) => {
        console.log("Location access granted:", position.coords);
        try {
          const { latitude, longitude } = position.coords
          const data = await getWaterBalance(null, latitude, longitude, soilType)
          if (data.success) {
            setResult(data.data)
            if (data.data.pincode) setPincodeQuery(data.data.pincode);
            if (data.data.region) setNameQuery(data.data.region.split(" (")[0]);

            // Should also fill the lat/lng inputs with what we found
            setLatQuery(latitude);
            setLngQuery(longitude);
          }
        } catch (err) {
          console.error("Backend error with coordinates:", err);
          setError('Error fetching location data')
        } finally {
          setLoading(false)
        }
      }, (err) => {
        console.error("Location access denied or failed:", err);
        setError(`Location failed: ${err.message}. Ensure Location is enabled in browser site settings.`)
        setLoading(false)
      })
    } else {
      setError('Geolocation is not supported by this browser.')
    }
  }

  const handleManualCheck = async () => {
    if (!selectedCrop || !result) return;

    const res = await checkCropViability({
      crop_name: selectedCrop,
      available_water_mm: result.available_water_mm,
      soil_type: soilType
    });

    if (res.success) {
      setViabilityResult(res);
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>💧 Village Water Accountant</h1>
        <p>Know your "Water Bank Balance" before you sow.</p>
      </header>

      <main className="main-content">
        <div className="search-section">
          {/* Configuration Panel (Soil & Seed - Requested "Before Location") */}
          <div className="filter-card" style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '5px' }}>⚙️ Step 1: Configure Soil & Crop</h3>

            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {/* 1. Soil Selector - SEARCHABLE INPUT */}
              <div style={{ flex: '1 1 200px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600', color: '#555' }}>
                  Soil Type:
                </label>
                <input
                  value={soilType}
                  onChange={handleSoilInput}
                  onFocus={() => setSoilSuggestions(soilList)}
                  onBlur={() => setTimeout(() => setSoilSuggestions([]), 200)}
                  placeholder="Click to see all soil types..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
                {soilSuggestions.length > 0 && (
                  <ul className="suggestions-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                    {soilSuggestions.map(s => (
                      <li key={s.name} onMouseDown={(e) => { e.preventDefault(); selectSoil(s.name); }}>
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. Crop Selector - SEARCHABLE INPUT */}
              <div style={{ flex: '1 1 200px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600', color: '#555' }}>
                  Target Crop:
                </label>
                <input
                  value={selectedCrop}
                  onChange={handleCropInput}
                  onFocus={() => setCropSuggestions(cropList)}
                  onBlur={() => setTimeout(() => setCropSuggestions([]), 200)}
                  placeholder="Click to see all crops..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
                {cropSuggestions.length > 0 && (
                  <ul className="suggestions-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                    {cropSuggestions.map(crop => (
                      <li key={crop.name} onMouseDown={(e) => { e.preventDefault(); selectCrop(crop.name); }}>
                        {crop.name} <span style={{ color: '#666', fontSize: '0.85em' }}>({crop.type})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Inline Result for Manual Check */}
            {viabilityResult && (
              <div style={{
                padding: '1rem', borderRadius: '8px',
                background: viabilityResult.type === 'safe' ? '#E8F5E9' : '#FFEBEE',
                border: `1px solid ${viabilityResult.type === 'safe' ? 'green' : 'red'}`,
                color: viabilityResult.type === 'safe' ? 'green' : '#C62828',
                fontWeight: '600', textAlign: 'center'
              }}>
                {viabilityResult.message}
              </div>
            )}
          </div>

          <div className="break"></div>

          <div className="search-card" style={{ position: 'relative', zIndex: activeSearch === 'pincode' ? 100 : 1 }}>
            <h3>🔢 Find by Pincode</h3>
            <div className="input-group">
              <input
                type="text"
                placeholder="e.g., 411001"
                value={pincodeQuery}
                onChange={(e) => handleInputChange(e, 'pincode')}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
              />
              <button onClick={() => handleSearch('pincode')} disabled={loading}>
                Search Pin
              </button>
            </div>
            {activeSearch === 'pincode' && suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((s) => (
                  <li key={s.value} onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}>
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="divider-vertical">OR</div>

          <div className="search-card" style={{ position: 'relative', zIndex: activeSearch === 'name' ? 100 : 1 }}>
            <h3>🏙️ Find by Name</h3>
            <div className="input-group">
              <input
                type="text"
                placeholder="e.g., Pune"
                value={nameQuery}
                onChange={(e) => handleInputChange(e, 'name')}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
              />
              <button onClick={() => handleSearch('name')} disabled={loading} className="secondary-btn">
                Search Name
              </button>
            </div>
            {activeSearch === 'name' && suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((s) => (
                  <li key={s.value} onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}>
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="divider-vertical">OR</div>

          <div className="search-card">
            <h3>🌍 Find by Coords</h3>
            <div className="input-group">
              <input
                type="text"
                placeholder="Lat (18.52)"
                value={latQuery}
                onChange={(e) => setLatQuery(e.target.value)}
              />
              <input
                type="text"
                placeholder="Lng (73.85)"
                value={lngQuery}
                onChange={(e) => setLngQuery(e.target.value)}
              />
              <button onClick={() => handleSearch('coords')} disabled={loading} style={{ background: '#795548' }}>
                Search
              </button>
            </div>
          </div>
        </div>

        <div className="location-section">
          <button className="location-btn" onClick={handleLocation} disabled={loading}>
            📍 Use My Current Location
          </button>
        </div>

        {/* Global Action Button (Requested at Bottom) */}
        <div style={{ maxWidth: '800px', margin: '20px auto' }}>
          <button
            onClick={result ? handleManualCheck : () => setError("Please SEARCH for a Location above (Step 2) before checking.")}
            disabled={!selectedCrop}
            style={{
              background: selectedCrop && result ? 'var(--primary-dark)' : '#CFD8DC',
              color: 'white',
              padding: '16px',
              width: '100%',
              borderRadius: '12px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: (selectedCrop && result) ? 'pointer' : 'not-allowed',
              border: 'none'
            }}
          >
            {selectedCrop
              ? (result ? "🧪 Check Viability Now" : "🔍 Search Location Above First")
              : "👆 Select a Crop First"}
          </button>

          {/* Inline Result for Manual Check */}
          {viabilityResult && (
            <div style={{
              marginTop: '15px',
              padding: '1rem', borderRadius: '12px',
              background: viabilityResult.type === 'safe' ? '#E8F5E9' : '#FFEBEE',
              border: `1px solid ${viabilityResult.type === 'safe' ? 'green' : 'red'}`,
              color: viabilityResult.type === 'safe' ? 'green' : '#C62828',
              fontWeight: '600', textAlign: 'center',
              fontSize: '1.1rem'
            }}>
              {viabilityResult.message}
            </div>
          )}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {result && (
          <div className={`result-card ${result.status.toLowerCase().replace(" ", "-")}`}>
            <h2>{result.region} <span className="pincode-badge">#{result.pincode}</span></h2>

            <div className="balance-display">
              <span className="label">Available Water:</span>
              <span className="value">{result.available_water_mm} mm</span>
            </div>

            {/* Water Meter Visual */}
            <div className="water-meter-container">
              {/* Logic: distinct width based on safe(>800)/moderate(>400)/critical(<400) or just logic */}
              <div
                className="water-meter-fill"
                style={{ width: `${Math.min(100, Math.max(10, (result.available_water_mm / 1500) * 100))}%` }}
              ></div>
            </div>

            <div className="status-badge">
              Status: <strong>{result.status}</strong>
            </div>

            <div className="advice-section">
              <h3>🚜 Advisory</h3>
              <p>{result.advice}</p>
            </div>

            {result.recommended_crops && (
              <div className="advice-section" style={{ marginTop: '1rem', background: 'transparent', border: 'none', padding: 0 }}>
                <h3 style={{ color: '#1b5e20', marginBottom: '0.5rem' }}>🌾 Recommended Crops ({result.season})</h3>
                <div className="crop-chips-container">
                  {result.recommended_crops.map(crop => (
                    <span key={crop} className="crop-chip">
                      {crop}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Check moved to top as per user request */}

          </div>
        )}
      </main>
    </div>
  )
}

export default App
