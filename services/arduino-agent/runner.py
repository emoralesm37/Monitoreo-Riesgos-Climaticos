"""Ejecución periódica del agente multisensor ClimateGuard."""

import time

from config import SIMULATION_INTERVAL
from main import main


def run():
    print("ClimateGuard - Ejecución periódica")
    print(f"Intervalo configurado: {SIMULATION_INTERVAL} segundos")
    print("Presiona Ctrl+C para detener.\n")

    try:
        while True:
            try:
                main()
            except Exception as error:
                print(
                    f"Error durante el ciclo: "
                    f"{type(error).__name__}: {error}",
                    flush=True
                )

            print(
                f"\nPróximo ciclo en {SIMULATION_INTERVAL} segundos.\n",
                flush=True
            )

            time.sleep(SIMULATION_INTERVAL)

    except KeyboardInterrupt:
        print("\nAgente ClimateGuard detenido.")


if __name__ == "__main__":
    run()
