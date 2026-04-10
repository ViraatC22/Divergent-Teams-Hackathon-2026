#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h> // Required for HTTPS
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>

// --- Network Settings ---
// Replace with your actual WiFi credentials before flashing. Do NOT commit real values.
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --- ngrok URL ---
// Run `ngrok http 3001` and paste the https URL here each time ngrok restarts.
// Free-tier ngrok generates a new URL on every restart — update and reflash when it changes.
const char* serverName = "https://doily-plant-gigolo.ngrok-free.dev/data";

Adafruit_BMP280 bmp; 
Adafruit_MPU6050 mpu;
const int moisturePin = 34;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  // Initialize Sensors
  if (!bmp.begin(0x76)) Serial.println("BMP280 error");
  if (!mpu.begin()) Serial.println("MPU6050 error");

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // WiFiClientSecure is needed for HTTPS (ngrok default)
    WiFiClientSecure client;
    client.setInsecure(); // Skips certificate validation for easier setup

    HTTPClient http;

    // 1. Collect Data
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    float roll = atan2(a.acceleration.y, a.acceleration.z) * 180 / M_PI;
    float pitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 180 / M_PI;
    
    // Create the data string
    char payload[200];
    snprintf(payload, sizeof(payload), 
             "T:%.1fC | P:%.1fhPa | Alt:%.1fm | Acc:%.1f,%.1f,%.1f | Tilt:%.1f,%.1f | M:%d",
             bmp.readTemperature(), (bmp.readPressure()/100.0F), bmp.readAltitude(1013.25),
             a.acceleration.x, a.acceleration.y, a.acceleration.z, roll, pitch, analogRead(moisturePin));

    // 2. Send POST Request
    Serial.print("Sending to: "); Serial.println(serverName);
    
    if (http.begin(client, serverName)) {
      http.addHeader("Content-Type", "text/plain");
      // This header prevents the ngrok landing page from blocking the request
      http.addHeader("ngrok-skip-browser-warning", "true"); 
      
      int httpResponseCode = http.POST(payload);

      // 3. Status Report
      if (httpResponseCode > 0) {
        Serial.print("Data Sent: ");
        Serial.println(payload);
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
      } else {
        Serial.print("Error on sending POST: ");
        Serial.println(httpResponseCode); // -1 usually means SSL/Connection issue
      }
      
      http.end();
    }
  } else {
    Serial.println("WiFi Disconnected. Reconnecting...");
    WiFi.begin(ssid, password);
  }

  delay(5000); // Wait 5 seconds before next update
}
