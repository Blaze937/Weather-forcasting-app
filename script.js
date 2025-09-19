// Redirect if not logged in
if (localStorage.getItem("isLoggedIn") !== "true") {
  window.location.href = "login.html";
}

class WeatherApp {
    constructor() {
        this.currentCity = '';
        this.currentLat = null;
        this.currentLon = null;
        this.geocodingCache = new Map();
        this.isCelsius = true;
        this.parallaxEnabled = true;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateTime();
        this.getCurrentLocation();
        setInterval(() => this.updateTime(), 1000);
        this.evaluatePerformanceForParallax();
        this.setupParallaxIfAllowed();
    }

    bindEvents() {
        const searchInput = document.getElementById('search-city');
        const searchBtn = document.getElementById('search-btn');
        const celsiusBtn = document.getElementById('celsius-btn');
        const fahrenheitBtn = document.getElementById('fahrenheit-btn');
        const profileBtn = document.getElementById('profile-btn');

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchWeather();
            }
        });

        searchBtn.addEventListener('click', () => {
            this.searchWeather();
        });

        celsiusBtn.addEventListener('click', () => {
            this.toggleUnits(true);
        });

        fahrenheitBtn.addEventListener('click', () => {
            this.toggleUnits(false);
        });

        profileBtn.addEventListener('click', () => {
            this.refreshWeather();
        });

        // Add pull-to-refresh for mobile
        let startY = 0;
        let currentY = 0;
        let pullDistance = 0;
        const overlay = document.querySelector('.overlay');

        overlay.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        });

        overlay.addEventListener('touchmove', (e) => {
            currentY = e.touches[0].clientY;
            pullDistance = currentY - startY;
            
            if (pullDistance > 0 && window.scrollY === 0) {
                e.preventDefault();
                const opacity = Math.min(pullDistance / 100, 1);
                overlay.style.transform = `translateY(${Math.min(pullDistance * 0.5, 50)}px)`;
                overlay.style.opacity = 1 - (opacity * 0.3);
            }
        });

        overlay.addEventListener('touchend', () => {
            if (pullDistance > 80 && window.scrollY === 0) {
                this.refreshWeather();
            }
            overlay.style.transform = '';
            overlay.style.opacity = '';
            pullDistance = 0;
        });
    }

    toggleUnits(celsius) {
        this.isCelsius = celsius;
        const celsiusBtn = document.getElementById('celsius-btn');
        const fahrenheitBtn = document.getElementById('fahrenheit-btn');
        
        celsiusBtn.classList.toggle('active', celsius);
        fahrenheitBtn.classList.toggle('active', !celsius);
        
        // Update all temperature displays
        this.updateTemperatureUnits();
    }

    updateTemperatureUnits() {
    const convert = (temp) => {
        return this.isCelsius 
            ? Math.round((temp - 32) * 5/9) 
            : Math.round((temp * 9/5) + 32);
    };

    // Current, high, low, feels like
    const currentTemp = document.getElementById('current-temp');
    const tempHigh = document.getElementById('temp-high');
    const tempLow = document.getElementById('temp-low');
    const feelsLike = document.getElementById('feels-like');

    [currentTemp, tempHigh, tempLow, feelsLike].forEach(el => {
        if (el && el.textContent !== '--' && el.textContent.match(/-?\d+/)) {
            const val = parseInt(el.textContent);
            el.textContent = convert(val) + '°';
        }
    });

    // Hourly forecast temps
    document.querySelectorAll('.hourly-temp').forEach(el => {
        if (el.textContent.match(/-?\d+/)) {
            const val = parseInt(el.textContent);
            el.textContent = convert(val) + '°';
        }
    });

    // Weekly forecast temps
    document.querySelectorAll('.forecast-card .temp').forEach(el => {
        if (el.textContent.match(/-?\d+/)) {
            const val = parseInt(el.textContent);
            el.textContent = convert(val) + '°';
        }
    });
}


    refreshWeather() {
        const icon = document.querySelector('#profile-btn i');
        icon.style.animation = 'spin 1s linear';
        
        if (this.currentLat && this.currentLon) {
            this.fetchWeatherByCoords(this.currentLat, this.currentLon);
        }
        
        setTimeout(() => {
            icon.style.animation = '';
        }, 1000);
    }

    evaluatePerformanceForParallax() {
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const deviceMemory = navigator.deviceMemory || 4;
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        if (prefersReducedMotion || deviceMemory < 2 || isTouch) {
            this.parallaxEnabled = false;
        }
    }

    setupParallaxIfAllowed() {
        if (!this.parallaxEnabled) return;

        let rafId = null;
        const background = document.getElementById('background');

        const onMove = (e) => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth - 0.5) * 6;
                const y = (e.clientY / window.innerHeight - 0.5) * 6;
                background.style.transform = `translate(${x}px, ${y}px)`;
            });
        };

        if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
            document.addEventListener('mousemove', onMove);
        }
    }

    getCurrentLocation() {
        if (navigator.geolocation) {
            const options = { 
                enableHighAccuracy: false, 
                timeout: 8000, 
                maximumAge: 10 * 60 * 1000 
            };
            
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
                options
            );
        } else {
            this.setFallbackLocation();
        }
    }

    setFallbackLocation() {
        this.currentLat = 28.4744;
        this.currentLon = 77.5040;
        this.currentCity = 'Greater Noida';
        this.fetchWeatherByCoords(this.currentLat, this.currentLon);
        this.updateLocationDisplay('Greater Noida, India');
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.textContent = `Updated: ${timeString}`;
        }
    }

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

    async fetchWeatherByCoords(lat, lon) {
        try {
            this.showLoading(true);

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum&timezone=auto&forecast_days=7`;

            const response = await fetch(weatherUrl);

            if (!response.ok) {
                throw new Error('Weather API request failed');
            }

            const data = await response.json();
            this.currentData = data;

            this.updateWeatherDisplay(data);
            this.updateHourlyForecast();
            this.updateForecastDisplay(data.daily);

            this.showLoading(false);
            this.showNotification('Weather updated successfully!', 'success');
        } catch (error) {
            console.error('Error fetching weather:', error);
            this.showError('Failed to fetch weather data');
        }
    }

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

    updateLocationDisplay(locationName) {
        const el = document.getElementById('location-text');
        if (el) el.textContent = locationName;
    }

    getWeatherDescription(weatherCode) {
        const weatherCodes = {
            0: { desc: 'Clear skies', condition: 'sunny' },
            1: { desc: 'Mainly clear', condition: 'sunny' },
            2: { desc: 'Partly cloudy', condition: 'cloudy' },
            3: { desc: 'Overcast', condition: 'cloudy' },
            45: { desc: 'Foggy', condition: 'cloudy' },
            48: { desc: 'Depositing rime fog', condition: 'cloudy' },
            51: { desc: 'Light drizzle', condition: 'rainy' },
            53: { desc: 'Moderate drizzle', condition: 'rainy' },
            55: { desc: 'Dense drizzle', condition: 'rainy' },
            61: { desc: 'Slight rain', condition: 'rainy' },
            63: { desc: 'Moderate rain', condition: 'rainy' },
            65: { desc: 'Heavy rain', condition: 'rainy' },
            71: { desc: 'Slight snow fall', condition: 'snowy' },
            73: { desc: 'Moderate snow fall', condition: 'snowy' },
            75: { desc: 'Heavy snow fall', condition: 'snowy' },
            80: { desc: 'Slight rain showers', condition: 'rainy' },
            81: { desc: 'Moderate rain showers', condition: 'rainy' },
            82: { desc: 'Violent rain showers', condition: 'rainy' },
            95: { desc: 'Thunderstorm', condition: 'stormy' },
            96: { desc: 'Thunderstorm with hail', condition: 'stormy' },
            99: { desc: 'Thunderstorm with heavy hail', condition: 'stormy' }
        };

        return weatherCodes[weatherCode] || { desc: 'Unknown weather', condition: 'cloudy' };
    }

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
            61: 'fas fa-cloud-rain',
            63: 'fas fa-cloud-rain',
            65: 'fas fa-cloud-rain',
            71: 'fas fa-snowflake',
            73: 'fas fa-snowflake',
            75: 'fas fa-snowflake',
            80: 'fas fa-cloud-rain',
            81: 'fas fa-cloud-rain',
            82: 'fas fa-cloud-rain',
            95: 'fas fa-bolt',
            96: 'fas fa-bolt',
            99: 'fas fa-bolt'
        };

        return iconMap[weatherCode] || 'fas fa-cloud';
    }

    updateWeatherDisplay(data) {
        const current = data.current;
        const daily = data.daily;

        // Temperature
        const tempEl = document.getElementById('current-temp');
        if (tempEl && current.temperature_2m !== null) {
            const temp = this.isCelsius ? current.temperature_2m : (current.temperature_2m * 9/5) + 32;
            tempEl.textContent = Math.round(temp);
        }

        // High/Low
        const highEl = document.getElementById('temp-high');
        const lowEl = document.getElementById('temp-low');
        if (highEl && daily.temperature_2m_max[0] !== null) {
            const temp = this.isCelsius ? daily.temperature_2m_max[0] : (daily.temperature_2m_max[0] * 9/5) + 32;
            highEl.textContent = `${Math.round(temp)}°`;
        }
        if (lowEl && daily.temperature_2m_min[0] !== null) {
            const temp = this.isCelsius ? daily.temperature_2m_min[0] : (daily.temperature_2m_min[0] * 9/5) + 32;
            lowEl.textContent = `${Math.round(temp)}°`;
        }

        // Additional weather details
        const feelsLikeEl = document.getElementById('feels-like');
        if (feelsLikeEl && current.apparent_temperature !== null) {
            const temp = this.isCelsius ? current.apparent_temperature : (current.apparent_temperature * 9/5) + 32;
            feelsLikeEl.textContent = `${Math.round(temp)}°`;
        }

        const humidityEl = document.getElementById('humidity');
        if (humidityEl) humidityEl.textContent = `${Math.round(current.relative_humidity_2m || 0)}%`;

        const windSpeedEl = document.getElementById('wind-speed');
        if (windSpeedEl) windSpeedEl.textContent = `${Math.round(current.wind_speed_10m || 0)} km/h`;

        const pressureEl = document.getElementById('pressure');
        if (pressureEl) pressureEl.textContent = `${Math.round(current.pressure_msl || current.surface_pressure || 0)} hPa`;

        // Weather description and icon
        const weatherInfo = this.getWeatherDescription(current.weather_code);
        
        const mainHeading = document.getElementById('weather-main');
        const descEl = document.getElementById('weather-description');
        if (mainHeading) mainHeading.textContent = weatherInfo.desc;
        if (descEl) descEl.textContent = `Current conditions with ${Math.round(current.cloud_cover || 0)}% cloud cover`;

        const iconElement = document.getElementById('main-weather-icon');
        if (iconElement) {
            iconElement.className = this.getWeatherIcon(current.weather_code);
        }

        // Update unit display
        document.querySelector('.unit').textContent = this.isCelsius ? '°C' : '°F';

        this.updateBackground(weatherInfo.condition, current.is_day);
    }

    updateHourlyForecast() {
        const hourlyContainer = document.getElementById('hourly-forecast');
        if (!this.currentData?.hourly) return;

        hourlyContainer.innerHTML = '';
        const hourly = this.currentData.hourly;
        
        // Show next 24 hours
        for (let i = 0; i < Math.min(24, hourly.time.length); i++) {
            const time = new Date(hourly.time[i++]);
            const temp = this.isCelsius ? hourly.temperature_2m[i] : (hourly.temperature_2m[i] * 9/5) + 32;
            
            const hourlyItem = document.createElement('div');
            hourlyItem.className = 'hourly-item';
            
            hourlyItem.innerHTML = `
                <div class="hourly-time">${time.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true })}</div>
                <i class="${this.getWeatherIcon(hourly.weather_code[i])} hourly-icon"></i>
                <div class="hourly-temp">${Math.round(temp)}°</div>
            `;
            
            hourlyContainer.appendChild(hourlyItem);
        }
    }

    updateBackground(weatherCondition, isDay) {
        const background = document.getElementById('background');
        if (!background) return;

        background.className = 'background';
        
        // Apply day/night and weather condition
        if (!isDay) {
            background.classList.add(`night-${weatherCondition}`);
        } else {
            background.classList.add(weatherCondition);
        }
    }

    updateForecastDisplay(dailyData) {
        const forecastContainer = document.getElementById('forecast-cards');
        forecastContainer.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const date = new Date(dailyData.time[i]);
            const dayName = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }));

            const weatherCode = dailyData.weather_code[i];
            const weatherInfo = this.getWeatherDescription(weatherCode);
            
            const highTemp = this.isCelsius ? dailyData.temperature_2m_max[i] : (dailyData.temperature_2m_max[i] * 9/5) + 32;
            const lowTemp = this.isCelsius ? dailyData.temperature_2m_min[i] : (dailyData.temperature_2m_min[i] * 9/5) + 32;

            const card = document.createElement('div');
            card.className = `forecast-card ${i === 0 ? 'today' : ''}`;
            card.setAttribute('tabindex', '0');
            
            card.innerHTML = `
                <p class="day">${dayName}</p>
                <i class="${this.getWeatherIcon(weatherCode)}"></i>
                <p class="temp">${Math.round(highTemp)}°/${Math.round(lowTemp)}°</p>
                <p class="desc">${weatherInfo.desc}</p>
            `;

            card.addEventListener('click', () => {
                this.showDayDetail(i, dailyData);
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.showDayDetail(i, dailyData);
                }
            });

            forecastContainer.appendChild(card);
        }
    }

    showDayDetail(dayIndex, dailyData) {
        const date = new Date(dailyData.time[dayIndex]);
        const weatherInfo = this.getWeatherDescription(dailyData.weather_code[dayIndex]);
        
        const highTemp = this.isCelsius ? dailyData.temperature_2m_max[dayIndex] : (dailyData.temperature_2m_max[dayIndex] * 9/5) + 32;
        const lowTemp = this.isCelsius ? dailyData.temperature_2m_min[dayIndex] : (dailyData.temperature_2m_min[dayIndex] * 9/5) + 32;
        
        const message = `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n${weatherInfo.desc}\nHigh: ${Math.round(highTemp)}° Low: ${Math.round(lowTemp)}°\nPrecipitation: ${Math.round(dailyData.precipitation_sum[dayIndex] || 0)}mm`;
        
        this.showNotification(message, 'info');
    }

    showLoading(show) {
        const spinner = document.getElementById('loading-spinner');
        spinner.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        this.showLoading(false);
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }
}

// CSS animation for spin
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize the weather app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});