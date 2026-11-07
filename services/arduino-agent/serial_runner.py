"""Ejecución continua del agente serial ClimateGuard."""

import os
import time

import serial

from config import SERIAL_PORT, SERIAL_BAUDRATE
from sensor_registry import get_active_sensors
from serial_reader import parse_sensor_reading
from serial_processor import process_reading
from token_manager import TokenManager


CATALOG_REFRESH_SECONDS = 60


def run():
    send_enabled = (
        os.getenv("ARDUINO_SEND_ENABLED", "false").lower() == "true"
    )

    print("ClimateGuard - Agente serial Arduino")
    print(f"Puerto: {SERIAL_PORT}")
    print(f"Velocidad: {SERIAL_BAUDRATE} baudios")
    print(
        "Envío a Gateway:",
        "HABILITADO" if send_enabled else "DESHABILITADO"
    )
    print("Presiona Ctrl+C para detener.\n")

    token_manager = TokenManager()
    active_sensors = {}
    catalog_updated_at = 0

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

                reading = parse_sensor_reading(
                    raw_line.decode(
                        "utf-8", errors="replace"
                    ).strip()
                )

                if reading is None:
                    print("Mensaje serial descartado.")
                    continue

                token = None

                if send_enabled:
                    try:
                        token = token_manager.get_token()

                        if (
                            time.monotonic() - catalog_updated_at
                            >= CATALOG_REFRESH_SECONDS
                        ):
                            active_sensors = get_active_sensors(token)
                            catalog_updated_at = time.monotonic()
                            print("Catálogo de sensores actualizado.")

                    except Exception as error:
                        print(
                            "Error de autenticación o catálogo:",
                            type(error).__name__
                        )
                        continue

                else:
                    # Catálogo local para pruebas sin Gateway.
                    from sensors import SENSORS

                    active_sensors = {
                        sensor.sensor_type: [sensor.sensor_id]
                        for sensor in SENSORS
                        if sensor.enabled and sensor.sensor_id is not None
                    }

                result = process_reading(
                    reading,
                    active_sensors,
                    token,
                )

                print(
                    f"{reading['sensor_type']}: "
                    f"{result.get('status', 'UNKNOWN')}",
                    flush=True,
                )

    except serial.SerialException as error:
        print(f"Error de comunicación serial: {error}")

    except KeyboardInterrupt:
        print("\nAgente serial detenido.")


if __name__ == "__main__":
    run()
