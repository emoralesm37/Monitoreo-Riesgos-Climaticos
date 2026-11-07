import httpx

from app.config import settings
from app.community_mapper import map_communities


class CommunityServiceError(Exception):
    """Error al consultar el servicio de comunidades."""


def get_communities(access_token: str) -> list[dict]:
    url = (
        f"{settings.community_service_url.rstrip('/')}"
        "/api/communities"
    )

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
            )

            response.raise_for_status()

            communities = response.json()

            if not isinstance(communities, list):
                raise CommunityServiceError(
                    "La respuesta de comunidades no tiene el formato esperado"
                )

            return map_communities(communities)

    except httpx.HTTPStatusError as exc:
        raise CommunityServiceError(
            f"El servicio de comunidades respondió HTTP "
            f"{exc.response.status_code}"
        ) from exc

    except httpx.RequestError as exc:
        raise CommunityServiceError(
            "No fue posible conectar con el servicio de comunidades"
        ) from exc

    except ValueError as exc:
        raise CommunityServiceError(
            "El servicio de comunidades devolvió un JSON inválido"
        ) from exc