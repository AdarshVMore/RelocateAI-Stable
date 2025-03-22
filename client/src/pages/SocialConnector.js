import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as userStorage from '../utils/userStorage';
import { generateSocialEvents } from '../utils/geminiApi';
import '../styles/pages/SocialConnector.css';

const SocialConnector = () => {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    category: 'all',
    date: 'all'
  });
  const [locationData, setLocationData] = useState({
    coordinates: null,
    city: 'Pune', // Default city
    fetching: true
  });
  const [userProfile, setUserProfile] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [userPreferences, setUserPreferences] = useState(null);
  const [userAnalysis, setUserAnalysis] = useState(null);
  const [userPersona, setUserPersona] = useState(null);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);

  // Load user data from storage
  const loadUserData = useCallback(async () => {
    if (!user || !user.uid) return;
    
    try {
      // Get user preferences and analysis
      const preferences = userStorage.getUserPreferences(user.uid);
      const analysisResults = userStorage.getUserAnalysis(user.uid);
      const persona = userStorage.getUserPersona(user.uid);
      const neighborhood = userStorage.getSelectedNeighborhood(user.uid);
      
      // Save to state for future use
      if (preferences) setUserPreferences(preferences);
      if (analysisResults) setUserAnalysis(analysisResults);
      if (persona) setUserPersona(persona);
      if (neighborhood) setSelectedNeighborhood(neighborhood);
      
      // Combine all user data for profile
      const userProfileData = {
        userId: user.uid,
        name: user.displayName || 'Anonymous User',
        email: user.email,
        preferences: preferences || {},
        analysisResults: analysisResults || {},
        persona: persona || 'balanced',
        selectedNeighborhood: neighborhood || null,
        timestamp: new Date().toISOString()
      };
      
      setUserProfile(userProfileData);
      
      // Check if we have data for personalization
      const hasPersonalization = !!(
        (preferences && preferences.lifestylePreferences && preferences.lifestylePreferences.length > 0) ||
        (analysisResults && analysisResults.lifestyle_indicators && analysisResults.lifestyle_indicators.length > 0) ||
        persona ||
        neighborhood
      );
      
      setIsPersonalized(hasPersonalization);
      
      console.log('User data loaded:', {
        preferences: !!preferences, 
        analysisResults: !!analysisResults, 
        persona: persona || 'none',
        neighborhood: neighborhood ? neighborhood.name : 'none'
      });
      
      // Update location based on selected neighborhood if available
      if (neighborhood && neighborhood.coordinates) {
        setLocationData(prev => ({
          ...prev,
          coordinates: neighborhood.coordinates,
          city: neighborhood.city || neighborhood.name || 'Pune',
          fetching: false,
          source: 'neighborhood'
        }));
        
        console.log(`Using location from selected neighborhood: ${neighborhood.name}`);
      }
      
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }, [user]);

  // Get user's location
  const getUserLocation = useCallback(() => {
    // Skip if we already have location from neighborhood
    if (locationData.source === 'neighborhood') return;
    
    setLocationData(prev => ({ ...prev, fetching: true }));
    
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Try to reverse geocode to get city name
          let cityName = 'Pune'; // Default
          
          try {
            // Use Google Maps Geocoding API if available
            if (window.google && window.google.maps) {
              const geocoder = new window.google.maps.Geocoder();
              const response = await new Promise((resolve, reject) => {
                geocoder.geocode({ location: coords }, (results, status) => {
                  if (status === 'OK' && results[0]) {
                    resolve(results);
                  } else {
                    reject(new Error(`Geocoding failed: ${status}`));
                  }
                });
              });
              
              // Parse the results to find city
              for (const result of response) {
                for (const component of result.address_components) {
                  if (component.types.includes('locality')) {
                    cityName = component.long_name;
                    break;
                  }
                }
                if (cityName !== 'Pune') break; // Stop if we found a city
              }
            }
          } catch (err) {
            console.error('Error geocoding location:', err);
          }
          
          setLocationData({
            coordinates: coords,
            city: cityName,
            fetching: false,
            source: 'geolocation'
          });
          
          console.log(`Location detected: ${cityName} (${coords.lat}, ${coords.lng})`);
        },
        (error) => {
          console.error('Error getting location:', error);
          
          // If user denied location or other error, use neighborhood location if available
          if (selectedNeighborhood && selectedNeighborhood.coordinates) {
            setLocationData({
              coordinates: selectedNeighborhood.coordinates,
              city: selectedNeighborhood.city || selectedNeighborhood?.name || 'Pune',
              fetching: false,
              source: 'neighborhood_fallback'
            });
          } else {
            // Default to Pune if no other location is available
            setLocationData({
              coordinates: { lat: 18.5204, lng: 73.8567 }, // Pune coordinates
              city: 'Pune',
              fetching: false,
              source: 'default'
            });
          }
        }
      );
    } else {
      // Geolocation not supported, use default location
      setLocationData({
        coordinates: { lat: 18.5204, lng: 73.8567 }, // Pune coordinates
        city: 'Pune',
        fetching: false,
        source: 'default'
      });
    }
  }, [selectedNeighborhood, locationData.source]);

  // Define fetchEvents to get social events
  const fetchEvents = useCallback(async () => {
    // Don't fetch if location is still being determined
    if (locationData.fetching || !selectedNeighborhood.name) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Fetching events for ${selectedNeighborhood.name}...`);
      
      // Prepare context for event generation
      let context = '';
      let hasPersonalization = false;
      
      // Add user preferences to context if available
      if (userPreferences && userPreferences.lifestylePreferences) {
        context += `User Lifestyle Preferences: ${userPreferences.lifestylePreferences.join(', ')}\n`;
        hasPersonalization = true;
      }
      
      // Add user persona to context if available
      if (userPersona) {
        context += `User Persona: ${userPersona}\n`;
        hasPersonalization = true;
      }
      
      // Add personality traits from analysis to context if available
      if (userAnalysis && userAnalysis.personality_traits) {
        context += `User Personality Traits: ${userAnalysis.personality_traits.join(', ')}\n`;
        hasPersonalization = true;
      }
      
      // Add lifestyle indicators from analysis to context if available
      if (userAnalysis && userAnalysis.lifestyle_indicators) {
        context += `User Lifestyle Indicators: ${userAnalysis.lifestyle_indicators.join(', ')}\n`;
        hasPersonalization = true;
      }
      
      // Add selected neighborhood to context if available
      if (selectedNeighborhood) {
        context += `User Selected Neighborhood: ${selectedNeighborhood.name}, ${selectedNeighborhood.city || ''}\n`;
        if (selectedNeighborhood.description) {
          context += `Neighborhood Description: ${selectedNeighborhood.description}\n`;
        }
        hasPersonalization = true;
      }
      
      // Use Gemini API to generate social events
      console.log('Generating social events using Gemini API...');
      console.log('User context for personalization:', context || 'None available');
      
      // Pass city to the generateSocialEvents function
      const eventsData = await generateSocialEvents(selectedNeighborhood.name);
      console.log(`Received ${eventsData.length} events from Gemini API`);
      
      // Add a personalization score to each event if we have user data
      let processedEvents = eventsData;
      
      if (hasPersonalization) {
        processedEvents = eventsData.map(event => {
          const event_category = event.category.toLowerCase();
          let score = 0;
          
          // Match against lifestyle preferences
          if (userPreferences && userPreferences.lifestylePreferences) {
            const lifestyleToCategories = {
              'activeLifestyle': ['sports', 'fitness', 'marathon', 'run', 'yoga'],
              'outdoorActivities': ['hiking', 'adventure', 'outdoors', 'nature', 'trekking'],
              'shopping': ['shopping', 'market', 'fair', 'sale'],
              'casualDining': ['food', 'dining', 'culinary', 'taste'],
              'fineDining': ['fine dining', 'gourmet', 'luxury'],
              'nightlife': ['party', 'nightlife', 'club', 'dance'],
              'cultural': ['cultural', 'culture', 'heritage', 'traditional'],
              'artsAndMusic': ['concert', 'music', 'art', 'exhibition', 'performance'],
              'familyFriendly': ['family', 'kids', 'children'],
              'quiet': ['workshop', 'seminar', 'lecture', 'book'],
              'community': ['community', 'social', 'volunteer'],
              'socialGatherings': ['meetup', 'networking', 'conference', 'social']
            };
            
            userPreferences.lifestylePreferences.forEach(pref => {
              const matchTerms = lifestyleToCategories[pref] || [];
              if (matchTerms.some(term => event_category.includes(term) || 
                                 event.name.toLowerCase().includes(term))) {
                score += 2;
              }
            });
          }
          
          // Match against personality traits and lifestyle indicators
          if (userAnalysis) {
            const traitKeywords = {
              'social': ['networking', 'party', 'meetup', 'social'],
              'active': ['sports', 'fitness', 'run', 'marathon'],
              'creative': ['art', 'music', 'creative', 'workshop'],
              'intellectual': ['lecture', 'seminar', 'book', 'talk'],
              'adventurous': ['adventure', 'outdoor', 'hiking', 'travel']
            };
            
            // Check personality traits
            if (userAnalysis.personality_traits) {
              userAnalysis.personality_traits.forEach(trait => {
                Object.entries(traitKeywords).forEach(([key, keywords]) => {
                  if (trait.toLowerCase().includes(key)) {
                    if (keywords.some(word => 
                      event_category.includes(word) || 
                      event.name.toLowerCase().includes(word)
                    )) {
                      score += 1;
                    }
                  }
                });
              });
            }
            
            // Check lifestyle indicators
            if (userAnalysis.lifestyle_indicators) {
              userAnalysis.lifestyle_indicators.forEach(indicator => {
                Object.entries(traitKeywords).forEach(([key, keywords]) => {
                  if (indicator.toLowerCase().includes(key)) {
                    if (keywords.some(word => 
                      event_category.includes(word) || 
                      event.name.toLowerCase().includes(word)
                    )) {
                      score += 1;
                    }
                  }
                });
              });
            }
          }
          
          return {
            ...event,
            personalScore: score,
            isPersonalized: score > 0
          };
        });
        
        // Sort by personalization score (high to low)
        processedEvents.sort((a, b) => b.personalScore - a.personalScore);
      }
      
      // Apply manual filters from UI
      let filteredEvents = [...processedEvents];
      
      if (filters.category !== 'all') {
        filteredEvents = filteredEvents.filter(event => 
          event.category.toLowerCase() === filters.category.toLowerCase()
        );
      }
      
      if (filters.date !== 'all') {
        const filterMonth = new Date(filters.date).getMonth();
        filteredEvents = filteredEvents.filter(event => {
          const eventDate = new Date(event.date);
          return eventDate.getMonth() === filterMonth;
        });
      }
      
      // Set the filtered events
      setEvents(filteredEvents);
      
      // Update personalization state
      setIsPersonalized(hasPersonalization);
      
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [locationData, userPreferences, userPersona, userAnalysis, selectedNeighborhood, filters]);

  // Load user data when component mounts
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Get user's location after loading user data
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Fetch events when location is determined
  useEffect(() => {
    if (!locationData.fetching && selectedNeighborhood.name) {
      fetchEvents();
    }
  }, [locationData, fetchEvents]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Get unique categories from events
  const getCategories = () => {
    const categories = events.map(event => event.category);
    return ['all', ...new Set(categories)];
  };

  // Get unique months from events
  const getMonths = () => {
    const months = events.map(event => {
      const date = new Date(event.date);
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    });
    return ['all', ...new Set(months)];
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div className="social-connector-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Social Events</h1>
          <p>Find events and connect with like-minded people in {selectedNeighborhood?.name}</p>
        </div>
        
        <div className="header-actions">
          {isPersonalized && (
            <div className="personalization-badge">
              <span className="personalization-icon">✨</span> Personalized
            </div>
          )}
        </div>
      </div>
      
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="category">Category</label>
          <select 
            id="category" 
            name="category" 
            value={filters.category} 
            onChange={handleFilterChange}
          >
            {getCategories().map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="date">Month</label>
          <select 
            id="date" 
            name="date" 
            value={filters.date} 
            onChange={handleFilterChange}
          >
            {getMonths().map(month => (
              <option key={month} value={month}>
                {month === 'all' ? 'All Months' : month}
              </option>
            ))}
          </select>
        </div>
        
        {selectedNeighborhood && (
          <div className="location-info">
            <span className="location-icon">📍</span>
            <span>Events near {selectedNeighborhood?.name}</span>
          </div>
        )}
      </div>

      <div className="events-container">
        {loading ? (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading events in {selectedNeighborhood?.name}...</p>
          </div>
        ) : error ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={fetchEvents}>Try Again</button>
          </div>
        ) : events.length === 0 ? (
          <div className="no-events-message">
            <h3>No events found</h3>
            <p>Try changing your filters or check back later for new events.</p>
          </div>
        ) : (
          <div className="events-list">
            {events.map((event, index) => (
              <div 
                key={index} 
                className={`event-card ${event.isPersonalized ? 'personalized' : ''}`}
              >
                {event.isPersonalized && (
                  <div className="personalized-tag">
                    <span>✨ Recommended for you</span>
                  </div>
                )}
                <div className="event-header">
                  <div className="event-category">{event.category}</div>
                  <h3 className="event-name">{event.name}</h3>
                </div>
                
                <div className="event-details">
                  <div className="event-date">
                    <span className="icon">📅</span>
                    {formatDate(event.date)}
                  </div>
                  <div className="event-location">
                    <span className="icon">📍</span>
                    {event.location}
                  </div>
                </div>
                
                <div className="event-ticket">
                  <div className="ticket-price">
                    <span className="icon">🎟️</span>
                    {event.ticket_details.price}
                  </div>
                </div>
                
                <div className="event-actions">
                  <a 
                    href={event.ticket_details.booking_link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="book-button"
                  >
                    Book Tickets
                  </a>
                  <a 
                    href={event.official_source} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="more-info-button"
                  >
                    More Info
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialConnector; 