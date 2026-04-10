#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>

// --- Network Settings ---
const char* ssid     = "ATTSreepada";
const char* password = "Sreep@d@0415";
// Replace with your Webhook.site URL or any public endpoint
const char* serverName = "https://webhook.site/22759280-d4c4-440b-a18b-a199ade63995";

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
    HTTPClient http;

    // 1. Collect Data
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    float roll = atan2(a.acceleration.y, a.acceleration.z) * 180 / M_PI;
    float pitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 180 / M_PI;
    
    // Create the data string
    char payload[150];
    snprintf(payload, sizeof(payload), 
             "T:%.1fC,P:%.1fhPa,Alt:%.1fm,Acc:%.1f|%.1f|%.1f,Tilt:%.1f|%.1f,M:%d",
             bmp.readTemperature(), (bmp.readPressure()/100.0F), bmp.readAltitude(1013.25),
             a.acceleration.x, a.acceleration.y, a.acceleration.z, roll, pitch, analogRead(moisturePin));

    // 2. Send POST Request
    http.begin(serverName);
    http.addHeader("Content-Type", "text/plain");
    
    int httpResponseCode = http.POST(payload);

    // 3. Status Report
    Serial.print("Data Sent: ");
    Serial.println(payload);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    
    http.end();
  } else {
    Serial.println("WiFi Disconnected");
  }

  delay(5000); // Send every 5 seconds
}
