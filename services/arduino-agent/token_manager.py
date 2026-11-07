"""Gestión de autenticación JWT para ClimateGuard."""

import time

from auth_client import get_access_token


class TokenManager:
    """Administra la renovación del token de acceso."""

    def __init__(self, lifetime_seconds=3600, safety_margin=120):
        self.lifetime_seconds = lifetime_seconds
        self.safety_margin = safety_margin
        self.access_token = None
        self.expires_at = 0

    def get_token(self):
        """Obtiene un token y lo renueva antes de su vencimiento."""

        if (
            self.access_token is None
            or time.monotonic() >= self.expires_at
        ):
            token = get_access_token()

            self.access_token = token
            self.expires_at = (
                time.monotonic()
                + max(0, self.lifetime_seconds - self.safety_margin)
            )

            print("Token JWT obtenido o renovado correctamente.")

        return self.access_token

    def invalidate(self):
        """Invalida el token para solicitar uno nuevo."""
        self.access_token = None
        self.expires_at = 0
