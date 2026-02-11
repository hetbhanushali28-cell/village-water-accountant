import { useState, useEffect } from 'react'
import { getWaterBalance, fetchSuggestions, checkCropViability, fetchCrops, fetchSoils, fetchSoilConditions, fetchMarketPrices, simulateWaterDepletion } from './api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import { saveUserLocation, getUserLocation, clearUserLocation } from './locationService';
import './App.css'

// --- CROP SWAP CARD COMPONENT (DYNAMIC) ---
const CropSwapCard = ({ recommendedCrop, allRecommendations }) => {
  const [baselineName, setBaselineName] = useState("Sugarcane (Default)");

  if (!recommendedCrop) return null;

  // Default high-water crops for comparison
  const defaultBaselines = [
    { name: "Sugarcane (Default)", water: 2000, risk: "High" },
    { name: "Rice (Paddy)", water: 1200, risk: "High" },
    { name: "Banana", water: 1800, risk: "Medium" }
  ];

  // Combine defaults with other recommendations (excluding current crop)
  const availableBaselines = [
    ...defaultBaselines,
    ...(allRecommendations || [])
      .filter(c => c.name !== recommendedCrop.name)
      .map(c => ({
        name: c.name,
        water: parseInt(c.water_req?.replace('mm', '')) || 500,
        risk: c.score > 70 ? "Low" : "Medium"
      }))
  ];

  // Get selected baseline
  const baseline = availableBaselines.find(b => b.name === baselineName) || defaultBaselines[0];
  const recWater = parseInt(recommendedCrop.water_req?.replace('mm', '')) || 500;
  const savedWater = baseline.water - recWater;
  const litersSaved = Math.abs(savedWater * 4046).toLocaleString('en-IN');
  const isBetter = savedWater > 0;

  return (
    <div className="swap-card">
      <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#1565c0' }}>⚖️ Crop Swap Impact Visualizer</h3>

      {/* Dropdown to select comparison crop */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '0.9rem', color: '#666' }}>Compare against: </label>
        <select
          value={baselineName}
          onChange={(e) => setBaselineName(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.95rem', marginLeft: '8px' }}
        >
          {availableBaselines.map((crop, idx) => (
            <option key={idx} value={crop.name}>{crop.name} ({crop.water}mm)</option>
          ))}
        </select>
      </div>

      <div className="comparison-grid">
        {/* LEFT: BASELINE CROP */}
        <div className="cmp-side bad">
          <h4 style={{ color: '#c62828', marginBottom: '10px', textAlign: 'center' }}>
            🚫 {baseline.name.split(' (')[0]}
          </h4>
          <div className="visual-box dry">
            <span style={{ fontSize: '2rem' }}>🥀</span>
            <span className="cmp-stats">{baseline.water}mm Needed</span>
          </div>
          <div className="cmp-stats" style={{ textAlign: 'center' }}>
            <div style={{ color: '#d32f2f' }}>⚠️ Risk: {baseline.risk}</div>
          </div>
        </div>

        {/* VS BADGE */}
        <div className="vs-badge">VS</div>

        {/* RIGHT: RECOMMENDED CROP */}
        <div className="cmp-side good">
          <h4 style={{ color: '#2e7d32', marginBottom: '10px', textAlign: 'center' }}>✅ {recommendedCrop.name}</h4>
          <div className="visual-box green">
            <span style={{ fontSize: '2rem' }}>💧</span>
            <span className="cmp-stats">{recWater}mm Needed</span>
          </div>
          <div className="cmp-stats" style={{ textAlign: 'center' }}>
            <div style={{ color: '#2e7d32' }}>🛡️ Risk: Low</div>
          </div>
        </div>
      </div>

      <div className="impact-banner" style={{ background: isBetter ? '#e0f2f1' : '#ffebee' }}>
        {isBetter ? (
          <>By swapping 1 acre, you <strong style={{ color: '#00695c' }}>SAVE {litersSaved} Liters!</strong> 🌊</>
        ) : (
          <>This crop uses <strong style={{ color: '#c62828' }}>{litersSaved} Liters MORE</strong> than {baseline.name.split(' (')[0]} ⚠️</>
        )}

      </div>
    </div>
  )
}

// --- WATER SAVINGS BANK ACCOUNT (Phase 11) ---
const WaterSavingsCard = ({ recommendedCrop, landAcres = 1 }) => {
  const [lifetimeSavings, setLifetimeSavings] = useState(0);
  const [showCertificate, setShowCertificate] = useState(false);

  // Load lifetime savings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('waterSavingsTotal');
    if (saved) setLifetimeSavings(parseInt(saved));
  }, []);

  if (!recommendedCrop) return null;

  // Calculate water saved (baseline: Sugarcane @ 2000mm)
  const SUGARCANE_BASELINE = 2000; // mm per acre
  const cropWater = parseInt(recommendedCrop.water_req?.replace('mm', '')) || 500;
  const waterSavedMM = SUGARCANE_BASELINE - cropWater;

  // Convert mm to liters (1mm on 1 acre = 4046 liters)
  const litersSaved = waterSavedMM * 4046 * landAcres;
  const litersSavedFormatted = litersSaved.toLocaleString('en-IN');

  // Tangible conversions
  const DRINKING_WATER_PER_DAY = 100; // liters/day for a family
  const POND_CAPACITY = 300000; // liters (typical farm pond)
  const WATER_PER_EXTRA_ACRE = 4046 * 500; // liters for a low-water crop

  const drinkingDays = Math.round(litersSaved / DRINKING_WATER_PER_DAY);
  const pondFills = (litersSaved / POND_CAPACITY).toFixed(1);
  const extraAcres = (litersSaved / WATER_PER_EXTRA_ACRE).toFixed(1);

  // Add to lifetime savings
  const addToLifetime = () => {
    const newTotal = lifetimeSavings + litersSaved;
    setLifetimeSavings(newTotal);
    localStorage.setItem('waterSavingsTotal', newTotal.toString());
    setShowCertificate(true);
  };

  if (waterSavedMM <= 0) return null; // Don't show if crop uses more water

  return (
    <div className="savings-bank-card">
      <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#0277bd' }}>
        🏦 Water Savings Bank Account
      </h3>

      <div className="savings-hero">
        <div className="savings-amount">
          <span className="savings-number">{litersSavedFormatted}</span>
          <span className="savings-unit">Liters Saved</span>
        </div>
        <div className="savings-context">
          vs growing Sugarcane on {landAcres} acre{landAcres > 1 ? 's' : ''}
        </div>
      </div>

      <div className="tangible-conversions">
        <h4 style={{ textAlign: 'center', color: '#555', marginBottom: '1rem' }}>
          💡 What This Means For You:
        </h4>
        <div className="conversion-grid">
          <div className="conversion-item">
            <span className="conv-icon">👨‍👩‍👧‍👦</span>
            <span className="conv-value">{drinkingDays.toLocaleString('en-IN')}</span>
            <span className="conv-label">Days of drinking water for your family</span>
          </div>
          <div className="conversion-item">
            <span className="conv-icon">🌊</span>
            <span className="conv-value">{pondFills}</span>
            <span className="conv-label">Times you can fill your farm pond</span>
          </div>
          <div className="conversion-item">
            <span className="conv-icon">🌾</span>
            <span className="conv-value">{extraAcres}</span>
            <span className="conv-label">Extra acres you can irrigate next season</span>
          </div>
        </div>
      </div>

      <div className="lifetime-tracker">
        <div className="lifetime-total">
          <span>🏆 Your Lifetime Savings:</span>
          <strong>{lifetimeSavings.toLocaleString('en-IN')} Liters</strong>
        </div>
        <button className="claim-btn" onClick={addToLifetime}>
          ✅ Claim This Savings!
        </button>
      </div>

      {/* Certificate Modal */}
      {showCertificate && (
        <div className="certificate-overlay" onClick={() => setShowCertificate(false)}>
          <div className="certificate" onClick={e => e.stopPropagation()}>
            <div className="cert-header">🎉 Water Savings Certificate 🎉</div>
            <div className="cert-body">
              <p>Congratulations!</p>
              <p>By choosing <strong>{recommendedCrop.name}</strong> instead of Sugarcane:</p>
              <div className="cert-stat">
                <span className="cert-value">{litersSavedFormatted}</span>
                <span>Liters Saved This Season</span>
              </div>
              <div className="cert-divider">🌿</div>
              <div className="cert-stat lifetime">
                <span className="cert-value">{lifetimeSavings.toLocaleString('en-IN')}</span>
                <span>Total Lifetime Savings 💧</span>
              </div>
            </div>
            <button className="cert-close" onClick={() => setShowCertificate(false)}>
              🙏 Thank You!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- WEATHER-SMART SOWING WINDOW (Phase 12) ---
const SowingWindowCard = ({ crop, forecast }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

  // Calculate optimal sowing window from forecast
  const calculateSowingWindow = () => {
    if (!forecast || forecast.length < 5) return null;

    // Find the best sowing window: light rain followed by dry period
    let bestWindow = null;
    let bestScore = 0;

    for (let i = 0; i < forecast.length - 2; i++) {
      const day = forecast[i];
      const nextDays = forecast.slice(i + 1, i + 4);

      // Score: prefer light rain (5-15mm) followed by dry days
      let score = 0;
      const rain = day.rain_mm || 0;

      if (rain >= 5 && rain <= 15) score += 30; // Light pre-sowing rain
      else if (rain > 0 && rain < 5) score += 15;

      // Check for dry period after
      const dryDays = nextDays.filter(d => (d.rain_mm || 0) < 3).length;
      score += dryDays * 20;

      // Prefer moderate temperatures (20-30°C)
      const avgTemp = (day.temp_max + day.temp_min) / 2;
      if (avgTemp >= 20 && avgTemp <= 30) score += 15;

      if (score > bestScore) {
        bestScore = score;
        bestWindow = {
          startDay: day.day || `Day ${i + 1}`,
          startDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
          daysFromNow: i,
          preRain: rain,
          dryDays: dryDays,
          score: score,
          reasons: []
        };

        // Build reasons
        if (rain >= 5 && rain <= 15) bestWindow.reasons.push(`Light rain (${rain}mm) for soil moisture`);
        if (dryDays >= 2) bestWindow.reasons.push(`${dryDays} dry days following (good germination)`);
        if (avgTemp >= 20 && avgTemp <= 30) bestWindow.reasons.push(`Optimal temperature (~${Math.round(avgTemp)}°C)`);
      }
    }

    return bestWindow;
  };

  const sowingWindow = calculateSowingWindow();

  // Countdown timer effect
  useEffect(() => {
    if (!sowingWindow) return;

    const targetDate = sowingWindow.startDate;
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0 });
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [sowingWindow]);

  // Handle SMS subscription (mock)
  const handleSmsSubscribe = () => {
    if (phoneNumber.length >= 10) {
      setSmsEnabled(true);
      // In production, this would call a backend API
      localStorage.setItem('smsAlertPhone', phoneNumber);
    }
  };

  // Check for heavy rain alerts
  const heavyRainAlert = forecast?.find(d => (d.rain_mm || 0) > 30);

  // Post-sowing care tips
  const careTips = [
    { day: 7, tip: "Check seedling emergence. Thin if overcrowded.", icon: "🌱" },
    { day: 14, tip: "First weeding. Apply light fertilizer if needed.", icon: "🌿" },
    { day: 21, tip: "Check for pests. Ensure proper irrigation.", icon: "🔍" }
  ];

  if (!crop || !forecast) return null;

  return (
    <div className="sowing-window-card">
      <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#2e7d32' }}>
        🌱 Weather-Smart Sowing Window
      </h3>

      {/* Heavy Rain Alert Banner */}
      {heavyRainAlert && (
        <div className="rain-alert-banner">
          ⚠️ Heavy Rain Alert: {heavyRainAlert.rain_mm}mm expected on {heavyRainAlert.day}
          <span className="alert-action">Consider postponing irrigation</span>
        </div>
      )}

      {/* Countdown Timer */}
      {sowingWindow && (
        <div className="sowing-countdown">
          <div className="countdown-label">⏰ Optimal Sowing Window In:</div>
          <div className="countdown-timer">
            <div className="countdown-unit">
              <span className="countdown-value">{countdown.days}</span>
              <span className="countdown-text">Days</span>
            </div>
            <div className="countdown-separator">:</div>
            <div className="countdown-unit">
              <span className="countdown-value">{countdown.hours}</span>
              <span className="countdown-text">Hours</span>
            </div>
            <div className="countdown-separator">:</div>
            <div className="countdown-unit">
              <span className="countdown-value">{countdown.minutes}</span>
              <span className="countdown-text">Mins</span>
            </div>
          </div>
          <div className="window-date">
            Best Window: <strong>{sowingWindow.startDay}</strong> ({sowingWindow.daysFromNow === 0 ? 'Today!' : `${sowingWindow.daysFromNow} days from now`})
          </div>
        </div>
      )}

      {/* Sowing Reasons */}
      {sowingWindow?.reasons.length > 0 && (
        <div className="sowing-reasons">
          <h4>📋 Why This Window?</h4>
          <ul>
            {sowingWindow.reasons.map((reason, idx) => (
              <li key={idx}>✓ {reason}</li>
            ))}
          </ul>
          <div className="prep-reminder">
            🎒 <strong>Prep Now:</strong> Get seeds ready!
          </div>
        </div>
      )}

      {/* SMS Alert Subscription */}
      <div className="sms-alert-section">
        <h4>📲 Get SMS Alerts</h4>
        {!smsEnabled ? (
          <div className="sms-form">
            <input
              type="tel"
              placeholder="Enter mobile number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="phone-input"
            />
            <button
              className="sms-subscribe-btn"
              onClick={handleSmsSubscribe}
              disabled={phoneNumber.length < 10}
            >
              🔔 Subscribe
            </button>
          </div>
        ) : (
          <div className="sms-enabled">
            ✅ Alerts enabled for <strong>+91 {phoneNumber}</strong>
            <div className="alert-types">
              <span className="alert-tag">3-day sowing reminder</span>
              <span className="alert-tag">Post-sowing care (Day 7, 14, 21)</span>
              <span className="alert-tag">Heavy rain warnings</span>
            </div>
          </div>
        )}
      </div>

      {/* Post-Sowing Care Tips */}
      <div className="care-tips-section">
        <h4>📅 Post-Sowing Care Schedule</h4>
        <div className="care-tips-grid">
          {careTips.map((tip, idx) => (
            <div key={idx} className="care-tip-item">
              <div className="tip-day">
                <span className="tip-icon">{tip.icon}</span>
                <span>Day {tip.day}</span>
              </div>
              <div className="tip-text">{tip.tip}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('pincode');
  const [pincodeQuery, setPincodeQuery] = useState('');
  const [session, setSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    // Only set up auth if Supabase is configured
    if (!supabase) {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setShowAuth(false); // Close modal on login
    });

    return () => subscription.unsubscribe();
  }, []);
  const [nameQuery, setNameQuery] = useState('');
  const [latQuery, setLatQuery] = useState('');
  const [lngQuery, setLngQuery] = useState('');

  const [soilType, setSoilType] = useState('Medium Soil');
  const [result, setResult] = useState(null);

  const [soilData, setSoilData] = useState(null);
  const [priceData, setPriceData] = useState([]);
  const [landAcres, setLandAcres] = useState(1);  // Farm size in acres
  const [simulationData, setSimulationData] = useState(null);
  const [simulatingCrop, setSimulatingCrop] = useState(null);
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


  // --- INTERVENTION STATE & LOGIC (Moved here to avoid TDZ) ---
  const [interventions, setInterventions] = useState({
    drip: false,
    mulch: false
  });

  const toggleIntervention = (type) => {
    setInterventions(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const calculateROI = () => {
    let cost = 0;
    let savings = 0;
    const revenue = 80000;
    if (interventions.drip) { cost += 20000; savings += 0.4; }
    if (interventions.mulch) { cost += 5000; savings += 0.2; }
    const profit = revenue - cost;
    return { cost, profit, savings };
  };

  const getSimulatedData = () => {
    if (!simulationData) return [];

    const { savings } = calculateROI();
    return simulationData.map(d => {
      const improvement = (200 * savings);
      return {
        ...d,
        worst: Math.min(d.best, d.worst + (improvement * (d.month === "Jun" ? 1 : d.month === "Jul" ? 2 : 3))),
        likely: Math.min(d.best, d.likely + (improvement * 0.8))
      };
    });
  };

  const activeSimData = getSimulatedData();

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

  // Auto-load saved location: DB for logged-in users, localStorage for guests
  useEffect(() => {
    if (session) {
      getUserLocation().then(({ success, data }) => {
        if (success && data) {
          setLatQuery(data.latitude);
          setLngQuery(data.longitude);
          if (data.pincode) setPincodeQuery(data.pincode);
          if (data.region) setNameQuery(data.region);
          console.log("Auto-loaded saved location from database:", data);
        }
      });
    } else {
      // Load from localStorage for guest users
      try {
        const saved = localStorage.getItem('water_accountant_location');
        if (saved) {
          const loc = JSON.parse(saved);
          if (loc.lat) setLatQuery(loc.lat);
          if (loc.lng) setLngQuery(loc.lng);
          if (loc.pincode) setPincodeQuery(loc.pincode);
          if (loc.region) setNameQuery(loc.region);
          console.log("Auto-loaded location from localStorage:", loc);
        }
      } catch (e) { console.error("Error loading saved location", e); }
    }
  }, [session]);

  // Fetch Soil Data automatically when result changes
  useEffect(() => {
    if (result && result.lat && result.lng) {
      setSoilData(null);
      fetchSoilConditions(result.lat, result.lng).then(res => {
        if (res.success) setSoilData(res.data);
      });
    } else {
      setSoilData(null);
    }
  }, [result]);

  // Fetch Market Prices automatically when result changes
  useEffect(() => {
    if (result && result.smart_recommendations && result.smart_recommendations.length > 0) {
      // Fetch prices for top 3 crops
      const topCrops = result.smart_recommendations.slice(0, 3).map(r => r.name);

      const fetchAll = async () => {
        setPriceData([]);
        const newPrices = [];
        for (const crop of topCrops) {
          const res = await fetchMarketPrices(crop);
          if (res.success && res.data && res.data.length > 0) {
            // Just take the first market (mocked best match)
            newPrices.push({ crop, ...res.data[0] });
          }
        }
        setPriceData(newPrices);
      };
      fetchAll();
    } else {
      setPriceData([]);
    }
  }, [result]);

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

  const selectSuggestion = async (s) => {
    setSuggestions([]);
    setPincodeQuery(s.value);
    setNameQuery(s.name);
    if (s.lat) setLatQuery(s.lat);
    if (s.lng) setLngQuery(s.lng);

    // Auto-Trigger Search Logic
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const query = s.value || s.name;
      const lat = s.lat ? parseFloat(s.lat) : null;
      const lng = s.lng ? parseFloat(s.lng) : null;

      const data = await getWaterBalance(query, lat, lng, soilType);

      if (data.success) {
        setResult(data.data);
        if (data.data.pincode) setPincodeQuery(data.data.pincode);
        if (data.data.region) setNameQuery(data.data.region.split(" (")[0]);
        if (data.data.lat) setLatQuery(data.data.lat);
        if (data.data.lng) setLngQuery(data.data.lng);
      } else {
        setError('Failed to fetch data for selected location');
      }
    } catch (err) {
      setError('Error connecting to backend');
    } finally {
      setLoading(false);
    }
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
      setSoilSuggestions(soilList);
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
      setCropSuggestions(cropList);
    }
  }

  const selectSoil = (soilName) => {
    setSoilType(soilName);
    setSoilSuggestions([]);
  }

  const selectCrop = (cropName) => {
    setSelectedCrop(cropName);
    setCropSuggestions([]);
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
      setError(`Please enter a ${type === 'pincode' ? 'Pincode' : 'Area Name'} `)
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

            // Save location to database if user is logged in
            if (session) {
              const saveResult = await saveUserLocation(
                latitude,
                longitude,
                data.data.region,
                data.data.pincode
              );
              if (saveResult.success) {
                console.log("✅ Location saved to your account");
              } else {
                console.warn("⚠️ Could not save location:", saveResult.error);
              }
            }
            // Always save to localStorage as fallback
            try {
              localStorage.setItem('water_accountant_location', JSON.stringify({
                lat: latitude,
                lng: longitude,
                region: data.data.region,
                pincode: data.data.pincode
              }));
              console.log("📍 Location saved to localStorage");
            } catch (e) { console.error("localStorage save error", e); }
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
      soil_type: soilType,
      lat: result.lat,
      lng: result.lng
    });

    if (res.success) {
      setViabilityResult(res);
    }
  }

  const handleSimulate = async (crop) => {
    try {
      setLoading(true);
      setSimulatingCrop(crop); // Open modal immediately
      const currentBalance = result?.water_balance || 500;
      const res = await simulateWaterDepletion(crop.name, currentBalance);
      if (res.simulation) {
        setSimulationData(res.simulation);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>💧 Village Water Accountant</h1>
          <p className="tagline">Know your "Water Bank Balance" before you sow</p>
          <div className="header-badges">
            <span className="badge">🌾 Crop Advisor</span>
            <span className="badge">📊 Real Data</span>
            <span className="badge">🎯 Smart Planning</span>
          </div>
        </div>
        <div className="auth-header-actions">
          {session ? (
            <div className="user-profile">
              <span className="user-email">👤 {session.user.email.split('@')[0]}</span>
              <button className="auth-btn logout" onClick={() => supabase?.auth.signOut()}>
                🚪 Sign Out
              </button>
            </div>
          ) : (
            <button className="auth-btn login" onClick={() => setShowAuth(true)} disabled={!supabase}>
              🔐 Farmer Login
            </button>
          )}
        </div>
      </header>

      {showAuth && (
        <div className="modal-overlay" onClick={() => setShowAuth(false)}>
          <div className="modal-content auth-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAuth(false)}>×</button>
            <Auth />
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="search-section">
          {/* Configuration Panel (Soil & Seed - Requested "Before Location") */}
          <div className="filter-card filter-card-main">
            <h3 className="filter-card-title">⚙️ Step 1: Configure Soil & Crop</h3>

            <div className="filter-inputs-row">
              {/* 1. Soil Selector - HYBRID INPUT */}
              <div className="filter-input-item dropdown-wrapper">
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '600', color: 'var(--gray-800)' }}>
                  Soil Type:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={soilType}
                    onChange={handleSoilInput}
                    onFocus={() => setSoilSuggestions(soilList)}
                    // Slightly longer delay to allow click on suggestion
                    onBlur={() => setTimeout(() => setSoilSuggestions([]), 300)}
                    placeholder="Type or select soil..."
                    className="dropdown-input"
                  />
                  <span className={`dropdown-chevron ${soilSuggestions.length > 0 ? 'open' : ''}`}>
                    ▼
                  </span>
                </div>
                {soilSuggestions.length > 0 && (
                  <ul className="dropdown-list">
                    {soilSuggestions.map(s => (
                      <li
                        key={s.name}
                        onMouseDown={(e) => { e.preventDefault(); selectSoil(s.name); }}
                        onTouchStart={(e) => { e.preventDefault(); selectSoil(s.name); }}
                        className={`dropdown-item ${s.name === soilType ? 'selected' : ''}`}
                      >
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. Crop Selector - HYBRID INPUT */}
              <div className="filter-input-item dropdown-wrapper">
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '600', color: 'var(--gray-800)' }}>
                  Target Crop:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={selectedCrop}
                    onChange={handleCropInput}
                    onFocus={() => setCropSuggestions(cropList)}
                    onBlur={() => setTimeout(() => setCropSuggestions([]), 300)}
                    placeholder="Type or select crop..."
                    className="dropdown-input"
                  />
                  <span className={`dropdown-chevron ${cropSuggestions.length > 0 ? 'open' : ''}`}>
                    ▼
                  </span>
                </div>
                {cropSuggestions.length > 0 && (
                  <ul className="dropdown-list">
                    {cropSuggestions.map(crop => (
                      <li
                        key={crop.name}
                        onMouseDown={(e) => { e.preventDefault(); selectCrop(crop.name); }}
                        onTouchStart={(e) => { e.preventDefault(); selectCrop(crop.name); }}
                        className={`dropdown-item ${crop.name === selectedCrop ? 'selected' : ''}`}
                      >
                        {crop.name} <span style={{ color: 'var(--gray-500)', fontSize: '0.8em' }}>({crop.type})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 3. Land Area Input */}
              <div className="filter-input-item filter-input-small">
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600', color: '#555' }}>
                  🌾 Land Area (Acres):
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={landAcres}
                  onChange={(e) => setLandAcres(Math.max(0.5, parseFloat(e.target.value) || 1))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' }}
                  placeholder="e.g., 5"
                />
              </div>
            </div>

            {/* Inline Result for Manual Check */}
            {viabilityResult && (
              <div style={{
                padding: '1rem', borderRadius: '8px',
                background: viabilityResult.type === 'safe' ? '#E8F5E9' : '#FFEBEE',
                border: `1px solid ${viabilityResult.type === 'safe' ? 'green' : 'red'} `,
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
                onBlur={() => setTimeout(() => setSuggestions([]), 300)}
              />
              <button onClick={() => handleSearch('pincode')} disabled={loading}>
                Search Pin
              </button>
            </div>
            {activeSearch === 'pincode' && suggestions.length > 0 && (
              <ul className="dropdown-list">
                {suggestions.map((s) => (
                  <li key={s.value} onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }} onTouchStart={(e) => { e.preventDefault(); selectSuggestion(s); }} className="dropdown-item">
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
                onBlur={() => setTimeout(() => setSuggestions([]), 300)}
              />
              <button onClick={() => handleSearch('name')} disabled={loading} className="secondary-btn">
                Search Name
              </button>
            </div>
            {activeSearch === 'name' && suggestions.length > 0 && (
              <ul className="dropdown-list">
                {suggestions.map((s) => (
                  <li key={s.value} onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }} onTouchStart={(e) => { e.preventDefault(); selectSuggestion(s); }} className="dropdown-item">
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
            📍 Use GPS Location
          </button>
          {latQuery && lngQuery ? (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.85rem',
              color: '#2e7d32',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <span>✅ Location detected ({typeof latQuery === 'number' ? latQuery.toFixed(2) : latQuery}°, {typeof lngQuery === 'number' ? lngQuery.toFixed(2) : lngQuery}°)</span>
              <button
                onClick={async () => {
                  if (session) {
                    await clearUserLocation();
                  }
                  localStorage.removeItem('water_accountant_location');
                  setLatQuery('');
                  setLngQuery('');
                  setPincodeQuery('');
                  setNameQuery('');
                  console.log("Location cleared");
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d32f2f',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.8rem',
                  padding: '0',
                  boxShadow: 'none'
                }}
              >
                Clear
              </button>
              {!session && (
                <span style={{ fontSize: '0.75rem', color: '#888' }}>(Login to sync across devices)</span>
              )}
            </div>
          ) : null}
        </div>

        {/* Global Action Button (Requested at Bottom) */}
        <div className="action-button-wrapper">
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
              fontWeight: '700',
              border: 'none',
              cursor: (!selectedCrop) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.3s ease'
            }}
          >
            {selectedCrop
              ? (result ? "🧪 Check Viability Now" : "🔍 Click 'Search Pin' or 'Search Name' Above")
              : "👆 Select a Crop First"}
          </button>

          {/* Inline Result for Manual Check */}
          {viabilityResult && (
            <div style={{
              marginTop: '15px',
              padding: '1rem', borderRadius: '12px',
              background: viabilityResult.type === 'safe' ? '#E8F5E9' : '#FFEBEE',
              border: `1px solid ${viabilityResult.type === 'safe' ? 'green' : 'red'} `,
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
          <div className={`result - card ${result.status.toLowerCase().replace(" ", "-")} `}>
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
                style={{ width: `${Math.min(100, Math.max(10, (result.available_water_mm / 1500) * 100))}% ` }}
              ></div>
            </div>

            <div className="status-badge">
              Status: <strong>{result.status}</strong>
            </div>

            {/* Soil Health Dashboard */}
            {soilData && (
              <div className="soil-dashboard">
                <h3>📉 Soil Health (Live at 10cm depth)</h3>
                <div className="soil-metrics">
                  <div className="soil-metric">
                    <span className="metric-icon">🌡️</span>
                    <div className="metric-info">
                      <span className="metric-label">Soil Temp</span>
                      <span className="metric-value">{soilData.temp_c}°C</span>
                    </div>
                  </div>
                  <div className="soil-metric">
                    <span className="metric-icon">💧</span>
                    <div className="metric-info">
                      <span className="metric-label">Moisture</span>
                      <span className="metric-value">{soilData.moisture_percent}%</span>
                      <span className="metric-status">{soilData.status}</span>
                    </div>
                  </div>
                </div>
                <div className="soil-bar-container">
                  <div className="soil-bar-bg">
                    <div className="soil-bar-fill" style={{ width: `${Math.min(100, Math.max(5, soilData.moisture_percent))}% `, background: soilData.moisture_percent < 20 ? '#ef5350' : '#66bb6a' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>
                    <span>Dry (0%)</span>
                    <span>Saturation (100%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Market Prices Section */}
            {priceData && priceData.length > 0 && (
              <div className="market-dashboard">
                <h3>💰 Live Market Prices (APMC of MH)</h3>
                <div className="price-cards">
                  {priceData.map((p, idx) => (
                    <div key={idx} className="price-card">
                      <div className="price-header">
                        <span className="price-crop">{p.crop}</span>
                        <span className="price-trend" data-trend={p.trend}>
                          {p.trend === 'up' ? '📈 Rising' : p.trend === 'down' ? '📉 Falling' : '➡️ Stable'}
                        </span>
                      </div>
                      <div className="price-main">₹{p.modal_price} / quintal</div>
                      <div className="price-loc">
                        📍 {p.market}
                        <br /><small style={{ color: '#777' }}>{p.date}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="advice-section">
              <h3>🚜 Advisory</h3>
              <p>{result.advice}</p>
            </div>

            {/* 7-Day Weather Forecast */}
            {result.forecast && result.forecast.length > 0 && (
              <div className="forecast-section">
                <h3>🌤️ 7-Day Weather Forecast</h3>
                {result.forecast_summary && (
                  <div className="forecast-advice">
                    {result.forecast_summary.advice}
                    <span className="rain-badge">
                      💧 {result.forecast_summary.total_rain_mm}mm expected
                    </span>
                  </div>
                )}
                <div className="forecast-cards">
                  {result.forecast.map((day, idx) => (
                    <div key={idx} className={`forecast - card ${idx === 0 ? 'today' : ''} `}>
                      <div className="forecast-day">{idx === 0 ? 'Today' : day.day}</div>
                      <div className="forecast-icon">{day.icon}</div>
                      <div className="forecast-temps">
                        <span className="temp-max">{day.temp_max}°</span>
                        <span className="temp-min">{day.temp_min}°</span>
                      </div>
                      {day.rain_mm > 0 && (
                        <div className="forecast-rain">💧 {day.rain_mm}mm</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.smart_recommendations && result.smart_recommendations.length > 0 && (
              <div className="smart-recommendations">
                <h3 style={{ color: '#1b5e20', marginBottom: '1rem' }}>🌾 Recommended Crops ({result.season})</h3>
                <div className="recommendation-cards">
                  {result.smart_recommendations.map((crop, idx) => (
                    <div key={idx} className="recommendation-card">
                      <div className="rec-header">
                        <span className="rec-name">{crop.name}</span>
                        <span className="rec-type">{crop.type}</span>
                      </div>
                      <div className="rec-details">
                        <div className="rec-row">💧 Water: {crop.water_req}</div>
                        <div className="rec-row">☀️ {crop.sunlight}</div>
                        <div className="rec-row">🌡️ {crop.temperature}</div>
                      </div>
                      <div className="rec-reasons">
                        {crop.reasons && crop.reasons.map((reason, i) => (
                          <span key={i} className="reason-tag">{reason}</span>
                        ))}
                      </div>
                      <div className="rec-costs">
                        <div className="cost-item">
                          <span className="cost-label">🌱 Seed Rate:</span>
                          <span className="cost-value">₹{crop.seed_cost_per_kg}/kg</span>
                        </div>
                        <div className="cost-item">
                          <span className="cost-label">🚜 Input/Acre:</span>
                          <span className="cost-value">₹{crop.input_cost_per_acre?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="cost-item total-cost">
                          <span className="cost-label">💰 Total for {landAcres} Acre{landAcres > 1 ? 's' : ''}:</span>
                          <span className="cost-value highlight">₹{(crop.input_cost_per_acre * landAcres)?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <button className="simulate-btn" onClick={() => handleSimulate(crop)}>
                        📉 Simulate Water Risk
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phase 11: Water Savings Bank Account */}
            {result?.recommendations?.[0] && (
              <WaterSavingsCard
                recommendedCrop={result.recommendations[0]}
                landAcres={landAcres}
              />
            )}

            {/* Phase 12: Weather-Smart Sowing Window */}
            {result?.recommendations?.[0] && result?.forecast && (
              <SowingWindowCard
                crop={result.recommendations[0]}
                forecast={result.forecast}
              />
            )}
          </div>
        )}




        {/* --- WATER SIMULATION MODAL --- */}
        {simulatingCrop && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>📉 Water Risk: {simulatingCrop.name}</h3>
                <button className="close-btn" onClick={() => setSimulatingCrop(null)}>×</button>
              </div>

              <div className="chart-container">
                {simulationData ? (
                  <ResponsiveContainer>
                    <AreaChart data={activeSimData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                      <defs>
                        {/* Gradient for the "Cone" shaded area */}
                        <linearGradient id="coneGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4caf50" stopOpacity={0.3} />
                          <stop offset="50%" stopColor="#ffeb3b" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#f44336" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        label={{ value: 'Water Level (mm)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                        domain={[0, 'dataMax + 100']}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                        formatter={(value, name) => [`${value} mm`, name]}
                      />

                      {/* Critical Level Reference Line */}
                      <ReferenceLine y={200} stroke="#d32f2f" strokeWidth={2} strokeDasharray="5 5">
                        <label value="⚠️ CRITICAL LEVEL" fill="#d32f2f" position="top" fontSize={11} />
                      </ReferenceLine>

                      {/* Shaded Area: Best Case (Green - Top of Cone) */}
                      <Area
                        type="monotone"
                        dataKey="best"
                        stroke="#2e7d32"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        fill="url(#coneGradient)"
                        fillOpacity={0.5}
                        name="🟢 Best Case (Good Monsoon)"
                      />

                      {/* Shaded Area: Worst Case (Red - Bottom of Cone) */}
                      <Area
                        type="monotone"
                        dataKey="worst"
                        stroke="#c62828"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        fill="#fff"
                        fillOpacity={1}
                        name="🔴 Worst Case (Drought)"
                      />

                      {/* Likely Scenario: Solid Blue Line */}
                      <Area
                        type="monotone"
                        dataKey="likely"
                        stroke="#1565c0"
                        strokeWidth={4}
                        fill="none"
                        name="🔵 Most Likely (Median Rain)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '50px' }}>Running Simulation...</div>
                )}
              </div>

              {/* Chart Legend */}
              <div className="chart-legend" style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '30px', height: '3px', background: '#2e7d32', display: 'inline-block', borderRadius: '2px' }}></span>
                  <span style={{ fontSize: '0.85rem', color: '#2e7d32' }}>Best Case</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '30px', height: '4px', background: '#1565c0', display: 'inline-block', borderRadius: '2px' }}></span>
                  <span style={{ fontSize: '0.85rem', color: '#1565c0', fontWeight: '600' }}>Likely</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '30px', height: '3px', background: '#c62828', display: 'inline-block', borderRadius: '2px' }}></span>
                  <span style={{ fontSize: '0.85rem', color: '#c62828' }}>Worst Case</span>
                </div>
              </div>

              {/* Phase 10: Dynamic Interventions (Survival Mode) */}
              <div className="intervention-panel">
                <button
                  className={`toggle-btn ${interventions.drip ? 'active' : ''}`}
                  onClick={() => toggleIntervention('drip')}
                >
                  💧 Drip Irrigation (₹20k)
                </button>
                <button
                  className={`toggle-btn ${interventions.mulch ? 'active' : ''}`}
                  onClick={() => toggleIntervention('mulch')}
                >
                  🍂 Mulching (₹5k)
                </button>
              </div>

              {/* ROI Calculator Card - Always Show Before/After */}
              <div className="roi-card">
                <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: '#1565c0' }}>💰 Profit Calculator</h4>
                <div className="roi-columns-row">
                  {/* BEFORE (No Interventions) */}
                  <div className="roi-column before">
                    <div className="roi-label">❌ Without Interventions</div>
                    <div className="roi-stat">
                      <label>Investment</label>
                      <div className="val">₹0</div>
                    </div>
                    <div className="roi-stat">
                      <label>Water Saved</label>
                      <div className="val">0%</div>
                    </div>
                    <div className="roi-stat">
                      <label>Projected Profit</label>
                      <div className="val">₹80,000</div>
                    </div>
                    <div className="roi-stat risk">
                      <label>⚠️ Risk Level</label>
                      <div className="val negative">HIGH</div>
                    </div>
                  </div>

                  {/* AFTER (With Interventions) */}
                  <div className={`roi-column after ${(interventions.drip || interventions.mulch) ? 'active' : 'dimmed'}`}>
                    <div className="roi-label">✅ With Interventions</div>
                    <div className="roi-stat">
                      <label>Investment</label>
                      <div className="val negative">-₹{calculateROI().cost.toLocaleString()}</div>
                    </div>
                    <div className="roi-stat">
                      <label>Water Saved</label>
                      <div className="val positive">{(calculateROI().savings * 100).toFixed(0)}%</div>
                    </div>
                    <div className="roi-stat">
                      <label>Projected Profit</label>
                      <div className="val positive">₹{calculateROI().profit.toLocaleString()}</div>
                    </div>
                    <div className="roi-stat risk">
                      <label>🛡️ Risk Level</label>
                      <div className="val positive">{(interventions.drip || interventions.mulch) ? 'LOW' : '-'}</div>
                    </div>
                  </div>
                </div>
                {!(interventions.drip || interventions.mulch) && (
                  <div style={{ textAlign: 'center', marginTop: '1rem', color: '#666', fontSize: '0.85rem' }}>
                    👆 Toggle interventions above to see the impact!
                  </div>
                )}
              </div>

              {/* Simulation Inputs Display */}
              <div className="sim-inputs-display">
                <div>💧 Starting Water: <strong>{result?.water_balance || 500}mm</strong></div>
                <div>🌱 Crop: <strong>{simulatingCrop?.name}</strong></div>
                <div>💦 Water Need: <strong>{simulatingCrop?.water_req}</strong></div>
              </div>              <div className="sim-note">
                {(() => {
                  const typicalCrit = activeSimData?.find(d => d.likely < 200)?.month || "Safe";
                  const earlyCrit = activeSimData?.find(d => d.worst < 200)?.month || "Safe";

                  if (typicalCrit === "Safe" && earlyCrit === "Safe") {
                    return <span><strong>✅ SAFE HARVEST:</strong> With your interventions, your crop is now safe even in drought conditions! Good job!</span>;
                  }

                  return (
                    <span>
                      With current interventions, you reach critical levels in <strong>{typicalCrit}</strong>.
                      Worst case: <strong>{earlyCrit}</strong>.
                    </span>
                  );
                })()}
              </div>

              {/* Phase 6: Crop Swap Impact Visualizer */}
              <CropSwapCard recommendedCrop={simulatingCrop} allRecommendations={result?.recommendations} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
