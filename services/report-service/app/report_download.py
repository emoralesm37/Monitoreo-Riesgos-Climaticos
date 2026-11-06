from pathlib import Path

from app.repository import get_report_metadata


GENERATED_DIR = (
    Path(__file__).resolve().parent / "generated"
).resolve()


class ReportDownloadError(Exception):
    """Error al recuperar un reporte PDF."""


def get_report_file(report_id: str) -> Path:
    """
    Obtiene un PDF generado previamente.
    Valida su estado y ubicación.
    """

    report = get_report_metadata(report_id)

    if report is None:
        raise ReportDownloadError(
            "El reporte solicitado no existe"
        )

    if report.get("status") != "completed":
        raise ReportDownloadError(
            "El reporte todavía no está disponible"
        )

    file_name = report.get("file_name")

    if not isinstance(file_name, str) or not file_name:
        raise ReportDownloadError(
            "El reporte no tiene un archivo asociado"
        )

    # No aceptar rutas ni nombres que intenten salir
    # del directorio autorizado.
    if Path(file_name).name != file_name:
        raise ReportDownloadError(
            "Nombre de archivo no permitido"
        )

    file_path = (GENERATED_DIR / file_name).resolve()

    if not file_path.is_relative_to(GENERATED_DIR):
        raise ReportDownloadError(
            "Ruta de archivo no permitida"
        )

    if file_path.suffix.lower() != ".pdf":
        raise ReportDownloadError(
            "El archivo solicitado no es un PDF"
        )

    if not file_path.is_file():
        raise ReportDownloadError(
            "El archivo PDF no está disponible"
        )

    return file_path