from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class SensorFilters(BaseModel):
    model_config = ConfigDict(extra='forbid')
    sensorId: int | None = Field(default=None, gt=0)
    communityId: int | None = Field(default=None, gt=0)
    sensorTypeId: int | None = Field(default=None, gt=0)
    isActive: bool | None = None

class ReadingFilters(SensorFilters):
    startDate: datetime | None = None
    endDate: datetime | None = None
    evaluationStatus: Literal['delivered', 'pending', 'unrecorded'] | None = None

    @model_validator(mode='after')
    def validate_dates(self):
        for value in (self.startDate, self.endDate):
            if value is not None and value.utcoffset() is None:
                raise ValueError('Las fechas deben incluir zona horaria.')
        if self.startDate and self.endDate and self.startDate > self.endDate:
            raise ValueError('El inicio debe ser anterior al fin.')
        return self

class ExtendedFilters(ReadingFilters):
    alertStatus: Literal['ACTIVA', 'RESUELTA'] | None = None
    severity: Literal['VERDE', 'AMARILLO', 'NARANJA', 'ROJO'] | None = None
    phenomenon: Literal['INUNDACION','SEQUIA','TORMENTA','HELADA','INCENDIO_FORESTAL','SISTEMA'] | None = None
    staleAfterMinutes: int = Field(default=60, ge=1, le=525600)
    accumulationMode: Literal['increments','counter'] | None = None
