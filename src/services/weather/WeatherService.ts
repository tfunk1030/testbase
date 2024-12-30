import { Environment } from '@/types';

interface WeatherResponse {
  temperature: number;
  humidity: number; 
  pressure: number;
  altitude: number;
  wind: {
    speed: number;
    direction: number;
    gust: number;
  };
}

export class WeatherService {
  private readonly tomorrowApiKey: string;
  
  constructor() {
    const apiKey = process.env.TOMORROW_API_KEY;
    if (!apiKey) {
      throw new Error('Missing TOMORROW_API_KEY environment variable');
    }
    this.tomorrowApiKey = apiKey;
  }

  async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherResponse> {
    // Get weather data from Tomorrow.io
    const tomorrowResponse = await fetch(
      `https://api.tomorrow.io/v4/weather/realtime?location=${latitude},${longitude}&apikey=${this.tomorrowApiKey}`
    );
    const tomorrowData = await tomorrowResponse.json();

    // Get elevation data from Open-Meteo
    const elevationResponse = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`
    );
    const elevationData = await elevationResponse.json();

    return {
      temperature: tomorrowData.data.values.temperature,
      humidity: tomorrowData.data.values.humidity,
      pressure: tomorrowData.data.values.pressureSeaLevel,
      altitude: elevationData.elevation,
      wind: {
        speed: tomorrowData.data.values.windSpeed,
        direction: tomorrowData.data.values.windDirection,
        gust: tomorrowData.data.values.windGust
      }
    };
  }

  convertToEnvironment(weather: WeatherResponse): Environment {
    return {
      temperature: weather.temperature,
      pressure: weather.pressure,
      humidity: weather.humidity / 100, // Convert from percentage to decimal
      altitude: weather.altitude,
      wind: {
        x: weather.wind.speed * Math.cos(weather.wind.direction * Math.PI / 180),
        y: 0,
        z: weather.wind.speed * Math.sin(weather.wind.direction * Math.PI / 180)
      }
    };
  }
}
