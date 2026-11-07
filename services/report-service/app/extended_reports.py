"""RF-REP-04..08. Only persisted API data; no fabricated weather/event values."""
from collections import Counter
from datetime import datetime, timezone, timedelta
from statistics import mean
import math
from app.sensor_client import fetch_list, get_sensors, get_communities_raw, get_all_sensor_readings, ReportLimitError, SensorServiceError

TITLES = {'alerts':'Alertas', 'events':'Historial de fenómenos registrados',
    'sensor_status':'Estado de sensores', 'climate_statistics':'Estadísticas climáticas', 'executive':'Resumen ejecutivo'}

def utc(value):
    if not value: return None
    try:
        parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except (ValueError, TypeError): raise SensorServiceError('Fecha de fuente inválida') from None

def alerts_for(token, parameters, sensors):
    rows=fetch_list(token,'/api/alerts')
    if len(rows)>20000: raise ReportLimitError('Reduce la selección de alertas.')
    ids={s['sensorId'] for s in sensors}
    filtered=[]
    for row in rows:
        if parameters.get('sensorId') and row.get('sensorId')!=parameters['sensorId']: continue
        if parameters.get('communityId') and row.get('communityId')!=parameters['communityId']: continue
        if any(parameters.get(k) is not None for k in ['sensorTypeId','isActive']) and row.get('sensorId') not in ids: continue
        if parameters.get('alertStatus') and row.get('status')!=parameters['alertStatus']:continue
        if parameters.get('severity') and row.get('severity')!=parameters['severity']:continue
        if parameters.get('phenomenon') and row.get('phenomenon')!=parameters['phenomenon']:continue
        date=utc(row.get('createdAt'))
        if parameters.get('startDate') and (date is None or date<utc(parameters['startDate'])):continue
        if parameters.get('endDate') and (date is None or date>utc(parameters['endDate'])):continue
        filtered.append(row)
    return filtered

def statistics(token, sensors, parameters):
    groups=[];scanned=0
    for sensor in sensors:
        rows=get_all_sensor_readings(token,sensor['sensorId'],parameters,max_rows=20000-scanned);scanned+=len(rows)
        values=[r['value'] for r in rows]
        if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
            raise SensorServiceError('Valores estadísticos inválidos')
        code=str(sensor.get('sensorType','')).upper()
        rainfall=any(word in code for word in ['LLUVIA','RAIN','PRECIPIT','PLUVIO'])
        accumulated=None
        mode=parameters.get('accumulationMode')
        ordered=sorted(rows,key=lambda row:utc(row['timestamp']))
        ordered_values=[r['value'] for r in ordered]
        if rainfall and values and all(v>=0 for v in values):
            if mode=='increments':accumulated=sum(values)
            elif mode=='counter' and len(values)>=2 and all(a<=b for a,b in zip(ordered_values,ordered_values[1:])):
                accumulated=ordered_values[-1]-ordered_values[0]
        groups.append({'sensor':sensor['name'],'tipo':sensor.get('sensorType'), 'unidad':sensor.get('unit'),
            'muestras':len(values),'mínimo':min(values) if values else None,
            'máximo':max(values) if values else None,'promedio':mean(values) if values else None,
            'lluviaAcumulada':accumulated if rainfall else 'No aplica',
            'primera':min((r['timestamp'] for r in rows),default=None),'última':max((r['timestamp'] for r in rows),default=None)})
    return groups

def collect(kind, token, parameters):
    from app.report_service import select_sensors
    sensors=select_sensors(get_sensors(token),parameters)
    if len(sensors)>20000:raise ReportLimitError('Demasiados sensores.')
    notes=['Fuentes: APIs autenticadas; fechas UTC. Sin datos se informa explícitamente. No representa observaciones adicionales a las persistidas.']
    if kind in ['alerts','events']:
        rows=alerts_for(token,parameters,sensors)
        # An event here is an observed alert/phenomenon, not an invented disaster registry.
        if kind=='events':
            rows=[r for r in rows if r.get('phenomenon') not in [None,'SISTEMA']]
            notes.append('Cada fila es una ocurrencia de fenómeno registrada por una alerta; no es un registro independiente de desastres.')
        rules=fetch_list(token,'/api/alert-rules')
        by_rule={r['alertRuleId']:r for r in rules}
        columns=['alertId','createdAt','communityName','sensorName','phenomenon','severity','triggerValue','minimumValue','maximumValue','message','status']
        rows=[{**r,'minimumValue':by_rule.get(r.get('ruleId'),{}).get('minimumValue'),
            'maximumValue':by_rule.get(r.get('ruleId'),{}).get('maximumValue')} for r in rows]
        notes.append('Umbrales consultados de la regla actual; no se afirma que sean el umbral histórico si la regla fue modificada.')
    elif kind=='sensor_status':
        now=datetime.now(timezone.utc);minutes=parameters.get('staleAfterMinutes',60)
        columns=['sensorId','name','community','isActive','lastValue','unit','lastUpdatedAt','estadoLecturas']
        rows=[]
        for sensor in sensors:
            last=utc(sensor.get('lastUpdatedAt'))
            state='Sin lecturas registradas' if last is None else 'Sin lectura reciente' if now-last>timedelta(minutes=minutes) else 'Lectura reciente'
            rows.append({**sensor,'estadoLecturas':state})
        notes.append(f'Umbral de lectura reciente: {minutes} minutos. No diagnostica conectividad física; activo/inactivo es estado administrativo.')
    elif kind=='climate_statistics':
        rows=statistics(token,sensors,parameters)
        columns=['sensor','tipo','unidad','muestras','mínimo','máximo','promedio','lluviaAcumulada','primera','última']
        notes.append('Agrupación por sensor y unidad. Lluvia acumulada no disponible sin semántica declarada por el responsable: increments suma cantidades de intervalos; counter resta primera/última muestra de contador monotónico. Reinicios, negativos o ausencia de muestras no se estiman. Se conserva la unidad del sensor.')
    elif kind=='executive':
        communities=get_communities_raw(token)
        if parameters.get('communityId'):communities=[c for c in communities if c['communityId']==parameters['communityId']]
        if any(parameters.get(k) is not None for k in ['sensorId','sensorTypeId','isActive']):
            selected_communities={s['communityId'] for s in sensors}
            communities=[c for c in communities if c['communityId'] in selected_communities]
        alerts=alerts_for(token,parameters,sensors);stats=statistics(token,sensors,parameters)
        rows=[{'indicador':'Comunidades','valor':len(communities)}, {'indicador':'Sensores','valor':len(sensors)},
            {'indicador':'Sensores activos','valor':sum(s['isActive'] is True for s in sensors)},
            {'indicador':'Alertas activas','valor':sum(a['status']=='ACTIVA' for a in alerts)},
            {'indicador':'Alertas resueltas','valor':sum(a['status']=='RESUELTA' for a in alerts)},
            {'indicador':'Mediciones en rango','valor':sum(s['muestras'] for s in stats)}]
        for name,count in sorted(Counter(a.get('severity') or 'Sin nivel' for a in alerts).items()):rows.append({'indicador':'Nivel '+name,'valor':count})
        for name,count in sorted(Counter(a.get('phenomenon') or 'Sin fenómeno' for a in alerts).items()):rows.append({'indicador':'Fenómeno '+name,'valor':count})
        for stat in stats:
            rows.append({'indicador':f"{stat['sensor']} ({stat['unidad'] or 'unidad no informada'}) promedio/mínimo/máximo",'valor':f"{stat['promedio']} / {stat['mínimo']} / {stat['máximo']}" if stat['muestras'] else 'Sin datos'})
            if stat['lluviaAcumulada']!='No aplica':rows.append({'indicador':stat['sensor']+' lluvia acumulada (semántica declarada)','valor':stat['lluviaAcumulada'] if stat['lluviaAcumulada'] is not None else 'No disponible'})
        columns=['indicador','valor'];notes.append('Resumen de registros consultados; ausencia de alertas no confirma ausencia de riesgo.')
    else:raise ValueError('Tipo extendido no válido')
    return {'title':TITLES[kind],'rows':rows,'columns':columns,'notes':notes}
