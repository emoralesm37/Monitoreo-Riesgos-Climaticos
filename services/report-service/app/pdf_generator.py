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

def generate_extended_pdf(report_type, data, parameters, user_id):
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    content=environment.get_template('extended.html').render(**data,parameters=parameters,user_id=user_id,
        generated_at=datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC'))
    output=GENERATED_DIR/f'{report_type}_{uuid4().hex}.pdf'
    # The template contains only escaped data and inline styling; never fetch remote content.
    def deny_external(url, *args, **kwargs):
        raise ValueError('Recursos externos no permitidos en PDF')
    HTML(string=content,base_url=str(TEMPLATES_DIR),url_fetcher=deny_external).write_pdf(str(output))
    return output


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


def generate_data_pdf(report_type: str, rows: list[dict], parameters: dict) -> Path:
    if report_type not in ('sensors', 'readings'):
        raise ValueError('Tipo de PDF no válido')
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    content = environment.get_template(report_type + '.html').render(
        generated_at=datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC'),
        parameters=parameters, **{report_type: rows})
    output = GENERATED_DIR / f'{report_type}_{uuid4().hex}.pdf'
    try:
        HTML(string=content, base_url=str(TEMPLATES_DIR)).write_pdf(str(output))
    except Exception:
        output.unlink(missing_ok=True)
        raise
    return output
