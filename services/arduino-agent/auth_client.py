"""Cliente de autenticación JWT para el agente ClimateGuard."""

import json
import os
import urllib.error
import urllib.request

from config import AUTH_URL


def get_access_token():
    """Obtiene un JWT desde Auth Service sin mostrar credenciales."""

    email = os.getenv("CLIMATEGUARD_AGENT_EMAIL")
    password = os.getenv("CLIMATEGUARD_AGENT_PASSWORD")

    if not email or not password:
        raise ValueError(
            "Faltan CLIMATEGUARD_AGENT_EMAIL "
            "o CLIMATEGUARD_AGENT_PASSWORD."
        )

    payload = json.dumps({
        "email": email,
        "password": password,
    }).encode("utf-8")

    request = urllib.request.Request(
        f"{AUTH_URL}/auth/login",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)

    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"Auth Service rechazó la solicitud: HTTP {error.code}"
        ) from None

    except urllib.error.URLError:
        raise RuntimeError(
            "No fue posible conectar con Auth Service."
        ) from None

    token = result.get("accessToken")

    if not token:
        raise RuntimeError(
            "Auth Service no devolvió un accessToken."
        )

    return token
