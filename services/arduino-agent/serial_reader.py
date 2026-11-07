"""Lectura de sensores físicos mediante Arduino Uno."""

import json
import serial

from config import SERIAL_PORT, SERIAL_BAUDRATE


def parse_sensor_reading(line):
    """Interpreta una medición JSON recibida por puerto serial."""

    try:
        data = json.loads(line)

        if not isinstance(data, dict):
            return None

        sensor_type = data.get("sensorType")
        value = data.get("value")

        if not isinstance(sensor_type, str):
            return None

        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return None

        return {
            "sensor_type": sensor_type.strip().upper(),
            "value": float(value),
        }

    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def read_serial():
    """Recibe continuamente mediciones desde Arduino."""

    print("ClimateGuard - Lectura serial Arduino")
    print(f"Puerto configurado: {SERIAL_PORT}")
    print(f"Velocidad: {SERIAL_BAUDRATE} baudios")
    print("Presiona Ctrl+C para detener.\n")

    try:
        with serial.Serial(
            port=SERIAL_PORT,
            baudrate=SERIAL_BAUDRATE,
            timeout=2,
        ) as connection:

            while True:
                raw_line = connection.readline()

                if not raw_line:
                    continue

                line = raw_line.decode(
                    "utf-8", errors="replace"
                ).strip()

                reading = parse_sensor_reading(line)

                if reading is None:
                    print("Medición descartada: formato inválido.")
                    continue

                print(
                    f"Sensor: {reading['sensor_type']} | "
                    f"Valor: {reading['value']:.2f}",
                    flush=True,
                )

    except serial.SerialException as error:
        print(f"Error de comunicación serial: {error}")

    except KeyboardInterrupt:
        print("\nLectura serial detenida.")


if __name__ == "__main__":
    read_serial()
