/* ClimateGuard - Arduino Uno R3 (ATmega328P, 5 V)
 * HC-SR04: VCC=5V, GND=GND, TRIG=D9, ECHO=D8.
 * DHT11: VCC=5V, GND=GND, DATA=D2.
 * Library: "DHT sensor library" by Adafruit (+ Adafruit Unified Sensor).
 * USB serial: 115200 baud, one JSON object per line every 5 seconds.
 * No credentials, Wi-Fi or HTTPS client in this firmware.
 */
#include <DHT.h>
#include <math.h>

const uint8_t DHT_PIN = 2;
const uint8_t TRIG_PIN = 9;
const uint8_t ECHO_PIN = 8;
const unsigned long INTERVAL_MS = 5000UL;
const unsigned long ECHO_TIMEOUT_US = 30000UL;

// REQUIRED calibration for water level: distance from the sensor face to the
// chosen zero-water reference, in cm. NAN keeps water_level_m=null until set.
// Example ONLY: replace NAN with 35.0f if YOUR measured reference is 35 cm.
const float ZERO_WATER_DISTANCE_CM = 30.0f;
// Conservative usable HC-SR04 distance limits; verify with your actual sensor.
const float MIN_DISTANCE_CM = 2.0f;
const float MAX_DISTANCE_CM = 400.0f;

DHT dht(DHT_PIN, DHT11);
unsigned long lastSample = 0;
unsigned long sequence = 0;

float readDistanceCm() {
  float samples[3];
  uint8_t count = 0;
  for (uint8_t i = 0; i < 3; ++i) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(3);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    const unsigned long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
    const float cm = duration * 0.0343f / 2.0f;
    if (duration != 0 && cm >= MIN_DISTANCE_CM && cm <= MAX_DISTANCE_CM) {
      samples[count++] = cm;
    }
    delay(65); // Separate acoustic pulses; do not overlap echoes.
  }
  if (count < 2) return NAN; // A timeout is missing data, never zero water.
  for (uint8_t i = 0; i < count; ++i) {
    for (uint8_t j = i + 1; j < count; ++j) {
      if (samples[j] < samples[i]) {
        const float swap = samples[i]; samples[i] = samples[j]; samples[j] = swap;
      }
    }
  }
  return count == 3 ? samples[1] : (samples[0] + samples[1]) / 2.0f;
}

void printValue(float value) {
  if (isnan(value) || isinf(value)) Serial.print(F("null"));
  else Serial.print(value, 2);
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  pinMode(ECHO_PIN, INPUT);
  dht.begin();
  delay(2000); // DHT11 startup; first sample follows the interval.
  lastSample = millis();
}

void loop() {
  const unsigned long now = millis();
  if ((unsigned long)(now - lastSample) < INTERVAL_MS) return;
  lastSample = now; // Unsigned subtraction tolerates millis() rollover.

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (humidity < 0 || humidity > 100) humidity = NAN;
  // Standard DHT11 rated range. Do not publish out-of-range values as valid.
  if (temperature < 0 || temperature > 50) temperature = NAN;
  const float distance = readDistanceCm();
  const bool calibrated = !isnan(ZERO_WATER_DISTANCE_CM) &&
    ZERO_WATER_DISTANCE_CM > MIN_DISTANCE_CM && ZERO_WATER_DISTANCE_CM <= MAX_DISTANCE_CM;
  float waterLevel = NAN;
  if (calibrated && !isnan(distance) && distance <= ZERO_WATER_DISTANCE_CM) {
    waterLevel = (ZERO_WATER_DISTANCE_CM - distance) / 100.0f;
  }

  Serial.print(F("{\"schema\":\"climateguard.uno.v1\",\"sequence\":"));
  Serial.print(++sequence);
  Serial.print(F(",\"uptime_ms\":")); Serial.print(now);
  Serial.print(F(",\"temperature_c\":")); printValue(temperature);
  Serial.print(F(",\"humidity_pct\":")); printValue(humidity);
  Serial.print(F(",\"distance_cm\":")); printValue(distance);
  Serial.print(F(",\"water_level_m\":")); printValue(waterLevel);
  Serial.print(F(",\"water_calibrated\":")); Serial.print(calibrated ? F("true") : F("false"));
  Serial.println(F("}"));
}
