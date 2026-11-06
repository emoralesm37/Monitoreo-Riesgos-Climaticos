from decimal import Decimal


SEVERITY_STATUS = {
    1: "Normal",   # Verde
    2: "Alerta",   # Amarillo
    3: "Alerta",   # Naranja
    4: "Crítico",  # Rojo
}

def classify_reading(
    value,
    sensor_type_id: int,
    rules: list[dict] | None,
) -> str:
    """Clasifica una lectura utilizando reglas activas de alertas."""

    if not rules:
        return "No evaluado"
    
    applicable_rules = [
        rule for rule in rules
        if rule.get("isActive", False)
        and int(rule["sensorTypeId"]) == sensor_type_id
    ]
    
    if not applicable_rules:
        return "No evaluado"

    matching_rules = []

    for rule in rules:
        if not rule.get("isActive", False):
            continue

        if int(rule["sensorTypeId"]) != sensor_type_id:
            continue

        minimum = Decimal(str(rule["minimumValue"]))
        maximum = Decimal(str(rule["maximumValue"]))
        reading_value = Decimal(str(value))

        if reading_value < minimum or reading_value > maximum:
            matching_rules.append(rule)

    if not matching_rules:
        return "Normal"

    highest_severity = max(
        int(rule["alertSeverityId"])
        for rule in matching_rules
    )

    return SEVERITY_STATUS.get(
        highest_severity,
        "No evaluado",
    )