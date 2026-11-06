from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML


BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
GENERATED_DIR = BASE_DIR / "generated"

environment = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"])
)


def generate_communities_pdf(communities: list[dict]) -> Path:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    template = environment.get_template("communities.html")

    html_content = template.render(
        generated_at=datetime.now(
            timezone.utc
        ).strftime("%d/%m/%Y %H:%M UTC"),
        communities=communities
    )

    file_name = f"communities_{uuid4().hex}.pdf"
    output_file = GENERATED_DIR / file_name

    HTML(
        string=html_content,
        base_url=str(TEMPLATES_DIR)
    ).write_pdf(str(output_file))

    return output_file


def generate_sensors_pdf(sensors: list[dict]) -> Path:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    template = environment.get_template("sensors.html")

    html_content = template.render(
        generated_at=datetime.now(
            timezone.utc
        ).strftime("%d/%m/%Y %H:%M UTC"),
        sensors=sensors,
    )

    file_name = f"sensors_{uuid4().hex}.pdf"
    output_file = GENERATED_DIR / file_name

    HTML(
        string=html_content,
        base_url=str(TEMPLATES_DIR),
    ).write_pdf(str(output_file))

    return output_file

def generate_readings_pdf(readings: list[dict]) -> Path:
    """Genera el reporte PDF de lecturas."""

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    template = environment.get_template("readings.html")

    html_content = template.render(
        generated_at=datetime.now(
            timezone.utc
        ).strftime("%d/%m/%Y %H:%M UTC"),
        readings=readings,
    )

    file_name = f"readings_{uuid4().hex}.pdf"
    output_file = GENERATED_DIR / file_name

    HTML(
        string=html_content,
        base_url=str(TEMPLATES_DIR),
    ).write_pdf(str(output_file))

    return output_file