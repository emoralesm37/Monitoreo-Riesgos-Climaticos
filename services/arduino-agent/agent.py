"""Punto de entrada unificado del agente ClimateGuard."""

from config import AGENT_MODE


def main():
    print("ClimateGuard - Agente de sensores")
    print(f"Modo configurado: {AGENT_MODE}")
    print()

    if AGENT_MODE == "simulation":
        from runner import run
        run()

    elif AGENT_MODE == "serial":
        from serial_runner import run
        run()

    else:
        raise ValueError(
            f"Modo de agente no reconocido: {AGENT_MODE}. "
            "Utiliza 'simulation' o 'serial'."
        )


if __name__ == "__main__":
    main()
