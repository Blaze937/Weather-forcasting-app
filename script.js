// Main Weather Application Class
class WeatherApp {
    // Initialize app properties and start the application
    constructor() {
        this.currentCity = '';
        this.currentLat = null;
        this.currentLon = null;
        this.geocodingCache = new Map();
        this.parallaxEnabled = true;
        this.init();
    }

    // App initialization - bind events, start clock, get location
    init() {
        this.bindEvents();
        this.updateTime();
        this.getCurrentLocation();
        setInterval(() => this.updateTime(), 1000);

        this.evaluatePerformanceForParallax();
        this.setupParallaxIfAllowed();
    }

    // Set up event listeners for user interactions
    bindEvents() {
        const searchInput = document.getElementById('search-city');

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchWeather();
            }
        });

        const profileBtn = document.getElementById('profile-btn');
        profileBtn.addEventListener('click', () => {
            alert('Profile action — implement as needed.');
        });
    }

    // Check device capabilities to determine if parallax should be enabled
    evaluatePerformanceForParallax() {
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const deviceMemory = navigator.deviceMemory || 4; 
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        if (prefersReducedMotion || deviceMemory < 2 || isTouch) {
            this.parallaxEnabled = false;
        } else {
            this.parallaxEnabled = true;
        }
    }

    // Enable mouse-following parallax background effect if allowed
    setupParallaxIfAllowed() {
        if (!this.parallaxEnabled) {
            const background = document.getElementById('background');
            if (background) background.style.transform = '';
            return;
        }

        let rafId = null;
        const background = document.getElementById('background');

        const onMove = (e) => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth - 0.5) * 8; 
                const y = (e.clientY / window.innerHeight - 0.5) * 8;
                background.style.transform = `translate(${x}px, ${y}px)`;
            });
        };

        if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
            document.addEventListener('mousemove', onMove);
        }
    }

    // Get user's current geographic location
    getCurrentLocation() {
        if (navigator.geolocation) {
            const geoOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 };
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLat = position.coords.latitude;
                    this.currentLon = position.coords.longitude;
                    this.fetchWeatherByCoords(this.currentLat, this.currentLon);
                    this.reverseGeocode(this.currentLat, this.currentLon);
                },
                (error) => {
                    console.log('Geolocation error:', error);
                    this.setFallbackLocation();
                },
                geoOptions
            );
        } else {
            this.setFallbackLocation();
        }
    }

    // Set default location when geolocation fails
    setFallbackLocation() {
        this.currentLat = 28.4744;
        this.currentLon = 77.5040;
        this.currentCity = 'Greater Noida';
        this.fetchWeatherByCoords(this.currentLat, this.currentLon);
        this.updateLocationDisplay('Greater Noida, India');
    }

    // Update the displayed current time every second
    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    }

    // Convert coordinates to readable location name
    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const data = await response.json();

            const parts = [];
            if (data.city) parts.push(data.city);
            else if (data.locality) parts.push(data.locality);
            if (data.principalSubdivision) parts.push(data.principalSubdivision); 
            if (data.countryName) parts.push(data.countryName);

            const locationName = parts.length ? parts.join(', ') : 'Current Location';
            this.updateLocationDisplay(locationName);
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            this.updateLocationDisplay('Current Location');
        }
    }

    // Convert city name to coordinates with caching
    async geocodeCity(cityName) {
        const key = cityName.trim().toLowerCase();
        if (this.geocodingCache.has(key)) {
            return this.geocodingCache.get(key);
        }

        try {
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {

                const result = data.results[0];
                const parsed = {
                    lat: result.latitude,
                    lon: result.longitude,
                    name: result.name,
                    admin1: result.admin1 || '', 
                    country: result.country || ''
                };

                this.geocodingCache.set(key, parsed);
                return parsed;
            } else {
                throw new Error('City not found');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }

    // Fetch weather data from API using coordinates
    async fetchWeatherByCoords(lat, lon) {
        try {
            this.showLoading(true);

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`;

            const response = await fetch(weatherUrl);

            if (!response.ok) {
                throw new Error('Weather API request failed');
            }

            const data = await response.json();

            const adapted = this.adaptOpenMeteoResponse(data);

            this.updateWeatherDisplay(adapted);
            this.updateForecastDisplay(adapted.daily);

            this.showLoading(false);
        } catch (error) {
            console.error('Error fetching weather:', error);
            this.showError('Failed to fetch weather data');
        }
    }

    // Transform API response to expected format
    adaptOpenMeteoResponse(raw) {
        const current = {
            temperature_2m: raw.current_weather?.temperature ?? null,
            wind_speed_10m: raw.current_weather?.windspeed ?? null,
            weather_code: raw.current_weather?.weathercode ?? null,
            relative_humidity_2m: (() => {
                try {
                    if (raw.hourly && raw.hourly.relativehumidity_2m && raw.hourly.time) {
                        const nowISO = new Date().toISOString().slice(0,16); 
                        for (let i=0;i<raw.hourly.time.length;i++){
                            if (raw.hourly.time[i].slice(0,13) === nowISO.slice(0,13)) {
                                return raw.hourly.relativehumidity_2m[i];
                            }
                        }
                    }
                } catch(e){}
                return null;
            })()
        };

        return {
            current,
            daily: {
                time: raw.daily?.time || [],
                temperature_2m_max: raw.daily?.temperature_2m_max || [],
                temperature_2m_min: raw.daily?.temperature_2m_min || [],
                weather_code: raw.daily?.weathercode || []
            }
        };
    }

    // Handle city search functionality
    async searchWeather() {
        const searchInput = document.getElementById('search-city');
        const city = searchInput.value.trim();

        if (!city) return;

        try {
            this.showLoading(true);
            const location = await this.geocodeCity(city);

            this.currentLat = location.lat;
            this.currentLon = location.lon;
            this.currentCity = `${location.name}${location.admin1 ? ', ' + location.admin1 : ''}${location.country ? ', ' + location.country : ''}`;

            this.updateLocationDisplay(this.currentCity);
            await this.fetchWeatherByCoords(location.lat, location.lon);

            searchInput.value = '';
        } catch (error) {
            console.error('Search error:', error);
            this.showError('City not found. Please try another city.');
        }
    }

    // Update location name in UI
    updateLocationDisplay(locationName) {
        const el = document.getElementById('location-text');
        if (el) el.textContent = locationName;
    }

    // Map weather codes to descriptions and conditions
    getWeatherDescription(weatherCode) {
        const weatherCodes = {
            0: { desc: 'clear skies', condition: 'sunny' },
            1: { desc: 'mainly clear', condition: 'sunny' },
            2: { desc: 'partly cloudy', condition: 'cloudy' },
            3: { desc: 'overcast', condition: 'cloudy' },
            45: { desc: 'foggy', condition: 'cloudy' },
            48: { desc: 'depositing rime fog', condition: 'cloudy' },
            51: { desc: 'light drizzle', condition: 'rainy' },
            53: { desc: 'moderate drizzle', condition: 'rainy' },
            55: { desc: 'dense drizzle', condition: 'rainy' },
            56: { desc: 'light freezing drizzle', condition: 'rainy' },
            57: { desc: 'dense freezing drizzle', condition: 'rainy' },
            61: { desc: 'slight rain', condition: 'rainy' },
            63: { desc: 'moderate rain', condition: 'rainy' },
            65: { desc: 'heavy rain', condition: 'rainy' },
            66: { desc: 'light freezing rain', condition: 'rainy' },
            67: { desc: 'heavy freezing rain', condition: 'rainy' },
            71: { desc: 'slight snow fall', condition: 'snowy' },
            73: { desc: 'moderate snow fall', condition: 'snowy' },
            75: { desc: 'heavy snow fall', condition: 'snowy' },
            77: { desc: 'snow grains', condition: 'snowy' },
            80: { desc: 'slight rain showers', condition: 'rainy' },
            81: { desc: 'moderate rain showers', condition: 'rainy' },
            82: { desc: 'violent rain showers', condition: 'rainy' },
            85: { desc: 'slight snow showers', condition: 'snowy' },
            86: { desc: 'heavy snow showers', condition: 'snowy' },
            95: { desc: 'thunderstorm', condition: 'stormy' },
            96: { desc: 'thunderstorm with slight hail', condition: 'stormy' },
            99: { desc: 'thunderstorm with heavy hail', condition: 'stormy' }
        };

        return weatherCodes[weatherCode] || { desc: 'unknown weather', condition: 'cloudy' };
    }

    // Map weather codes to FontAwesome icons
    getWeatherIcon(weatherCode) {
        const iconMap = {
            0: 'fas fa-sun',
            1: 'fas fa-sun',
            2: 'fas fa-cloud-sun',
            3: 'fas fa-cloud',
            45: 'fas fa-smog',
            48: 'fas fa-smog',
            51: 'fas fa-cloud-rain',
            53: 'fas fa-cloud-rain',
            55: 'fas fa-cloud-rain',
            56: 'fas fa-cloud-rain',
            57: 'fas fa-cloud-rain',
            61: 'fas fa-cloud-rain',
            63: 'fas fa-cloud-rain',
            65: 'fas fa-cloud-rain',
            66: 'fas fa-cloud-rain',
            67: 'fas fa-cloud-rain',
            71: 'fas fa-snowflake',
            73: 'fas fa-snowflake',
            75: 'fas fa-snowflake',
            77: 'fas fa-snowflake',
            80: 'fas fa-cloud-rain',
            81: 'fas fa-cloud-rain',
            82: 'fas fa-cloud-rain',
            85: 'fas fa-snowflake',
            86: 'fas fa-snowflake',
            95: 'fas fa-bolt',
            96: 'fas fa-bolt',
            99: 'fas fa-bolt'
        };

        return iconMap[weatherCode] || 'fas fa-cloud';
    }

    // Update main weather display with current conditions
    updateWeatherDisplay(data) {
        const current = data.current;
        const daily = data.daily;

        const tempEl = document.getElementById('current-temp');
        if (tempEl) tempEl.textContent = current.temperature_2m !== null ? Math.round(current.temperature_2m) : '--';

        const highEl = document.getElementById('temp-high');
        const lowEl = document.getElementById('temp-low');
        if (highEl) highEl.textContent = daily.temperature_2m_max.length ? `${Math.round(daily.temperature_2m_max[0])}°` : '--';
        if (lowEl) lowEl.textContent = daily.temperature_2m_min.length ? `${Math.round(daily.temperature_2m_min[0])}°` : '--';

        const weatherInfo = this.getWeatherDescription(current.weather_code);

        const mainHeading = document.getElementById('weather-main');
        const descEl = document.getElementById('weather-description');
        if (mainHeading) mainHeading.textContent = this.capitalize(weatherInfo.desc);
        if (descEl) descEl.textContent = `Current conditions: ${this.capitalize(weatherInfo.desc)}`;

        const iconElement = document.getElementById('main-weather-icon');
        if (iconElement) {
            iconElement.className = this.getWeatherIcon(current.weather_code);
            iconElement.setAttribute('aria-hidden', 'true');
        }

        const humWind = document.getElementById('humidity-windspeed');
        if (humWind) {
            humWind.innerHTML = `
                <div><i class="fas fa-tint" aria-hidden="true"></i> Humidity ${current.relative_humidity_2m !== null ? Math.round(current.relative_humidity_2m) + '%' : '--'}</div>
                <div><i class="fas fa-wind" aria-hidden="true"></i> ${current.wind_speed_10m !== null ? Math.round(current.wind_speed_10m) + ' km/h' : '--'}</div>
            `;
        }

        this.updateBackground(weatherInfo.condition);
    }

    // Utility function to capitalize first letter
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Update background styling based on weather conditions
    updateBackground(weatherCondition) {
        const background = document.getElementById('background');
        if (!background) return;

        background.className = 'background';

        const valid = ['sunny','cloudy','rainy','stormy','snowy','night-time-weather'];
        if (valid.includes(weatherCondition)) {
            background.classList.add(weatherCondition);
        } else {
            background.classList.add('cloudy');
        }

        const hours = new Date().getHours();
        if (hours < 6 || hours >= 19) {
            if (!background.classList.contains('night-time-weather')) {
                background.classList.add('night-time-weather');
            }
        }
    }

    // Generate and display 7-day weather forecast
    updateForecastDisplay(dailyData) {
        const forecastContainer = document.getElementById('forecast-cards');
        forecastContainer.innerHTML = '';

        const now = new Date();

        for (let i = 0; i < 7; i++) {
            const dateStr = dailyData.time[i];
            const date = dateStr ? new Date(dateStr) : new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
            const dayName = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'long' }));

            const weatherCode = dailyData.weather_code[i];
            const weatherInfo = this.getWeatherDescription(weatherCode);

            const card = document.createElement('div');
            card.className = `forecast-card ${i === 0 ? 'today' : ''}`;
            card.setAttribute('role','button');
            card.setAttribute('tabindex','0');
            card.setAttribute('aria-label', `${dayName}: ${this.capitalize(weatherInfo.desc)}. High ${Math.round(dailyData.temperature_2m_max[i] || 0)}°, Low ${Math.round(dailyData.temperature_2m_min[i] || 0)}°`);

            card.innerHTML = `
                <p class="day">${dayName}</p>
                <i class="${this.getWeatherIcon(weatherCode)}" aria-hidden="true"></i>
                <p class="temp">${Math.round(dailyData.temperature_2m_max[i] || 0)}°/${Math.round(dailyData.temperature_2m_min[i] || 0)}°</p>
                <p class="desc">${this.capitalize(weatherInfo.desc)}</p>
            `;

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });

            card.addEventListener('click', () => {
                card.classList.add('selected');
                setTimeout(() => card.classList.remove('selected'), 250);
            });

            forecastContainer.appendChild(card);
        }
    }

    // Show/hide loading spinner
    showLoading(show) {
        const spinner = document.getElementById('loading-spinner');
        const mainWeather = document.getElementById('main-weather');

        if (spinner) spinner.style.display = show ? 'block' : 'none';
        if (mainWeather) mainWeather.style.opacity = show ? '0.5' : '1';
        this.hideError();
    }

    // Display error message to user
    showError(message) {
        this.hideError();
        this.showLoading(false);

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.id = 'error-message';
        errorDiv.textContent = message;

        const header = document.querySelector('.header');
        header.parentNode.insertBefore(errorDiv, header.nextSibling);

        setTimeout(() => this.hideError(), 5000);
    }

    // Remove error message from display
    hideError() {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.remove();
        }
    }
}

// Initialize the weather app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});