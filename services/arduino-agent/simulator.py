"""Simulador multisensor para ClimateGuard."""

import random
import time

from config import SIMULATION_INTERVAL
from sensors import SENSORS


def generate_reading(sensor):
    """Genera una medición simulada para un sensor."""
    return round(
        random.uniform(sensor.min_value, sensor.max_value),
        2
    )


def generate_readings():
    """Genera las mediciones de todos los sensores habilitados."""
    readings = []

    for sensor in SENSORS:
        if not sensor.enabled:
            continue

        readings.append({
            "sensor_id": sensor.sensor_id,
            "sensor_type": sensor.sensor_type,
            "value": generate_reading(sensor),
            "unit": sensor.unit,
        })

    return readings


def run_simulator():
    """Ejecuta ciclos de simulación multisensor."""
    print("ClimateGuard - Simulador multisensor")
    print(f"Intervalo: {SIMULATION_INTERVAL} segundos")
    print("Presiona Ctrl+C para detener.\n")

    try:
        while True:
            print("--- Nuevo ciclo de mediciones ---")

            for reading in generate_readings():
                sensor_id = reading["sensor_id"]
                identifier = (
                    str(sensor_id)
                    if sensor_id is not None
                    else "SIN REGISTRAR"
                )

                print(
                    f"Sensor ID: {identifier} | "
                    f"Tipo: {reading['sensor_type']} | "
                    f"Valor: {reading['value']:.2f} "
                    f"{reading['unit']}"
                )

            print(flush=True)
            time.sleep(SIMULATION_INTERVAL)

    except KeyboardInterrupt:
        print("\nSimulación finalizada.")


if __name__ == "__main__":
    run_simulator()
