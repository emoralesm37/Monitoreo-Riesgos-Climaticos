"""Punto de entrada del agente multisensor ClimateGuard."""

import os

from auth_client import get_access_token
from gateway_client import send_reading
from sensor_registry import get_active_sensors
from simulator import generate_readings


def main():
    print("ClimateGuard - Agente multisensor")
    print("Modo: simulación\n")

    readings = generate_readings()

    send_enabled = (
        os.getenv("ARDUINO_SEND_ENABLED", "true").lower() == "true"
    )

    print(f"Mediciones generadas: {len(readings)}")
    print(
        "Envío a Gateway:",
        "HABILITADO" if send_enabled else "DESHABILITADO"
    )

    if not send_enabled:
        for reading in readings:
            print(
                f"{reading['sensor_type']}: "
                f"{reading['value']:.2f} {reading['unit']}"
            )

        print("\nSimulación completada sin modificar SQL Server.")
        return

    token = get_access_token()
    active_sensors = get_active_sensors(token)

    print("\nSensores activos consultados correctamente.")

    for reading in readings:
        sensor_type = reading["sensor_type"]
        sensor_ids = active_sensors.get(sensor_type, [])

        # Solo se envían sensores configurados explícitamente
        # y confirmados como activos por Gateway.
        configured_id = reading["sensor_id"]

        if configured_id is None or configured_id not in sensor_ids:
            print(f"{sensor_type}: omitido (sin sensor activo asignado)")
            continue

        result = send_reading(
            configured_id,
            reading["value"],
            token
        )

        if result["success"]:
            print(
                f"{sensor_type}: HTTP {result['status']} - "
                f"Lectura ID {result['reading_id']}"
            )
        else:
            print(
                f"{sensor_type}: "
                f"{result.get('error', 'Error desconocido')}"
            )


if __name__ == "__main__":
    main()
