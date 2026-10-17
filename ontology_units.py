"""Independent Pint checks; quantity kinds remain more specific than dimensions."""
import math
from functools import lru_cache

from pint import UnitRegistry


@lru_cache(maxsize=1)
def registry():
    units = UnitRegistry()
    # Reference gas volumes must never silently become actual gas volumes.
    units.define('standard_cc = [reference_gas_volume]')
    units.define('standard_liter = 1000 * standard_cc')
    return units


ALIASES = {
    '': 'dimensionless', 'dimensionless': 'dimensionless', 'count': 'dimensionless',
    '°C': 'degC', '°F': 'degF', '°': 'degree',
    '°C/min': 'delta_degC/minute', '°C/s': 'delta_degC/second',
    '°F/min': 'delta_degF/minute',
    'K/min': 'kelvin/minute', 'K/s': 'kelvin/second',
    'rpm': 'revolution/minute', 'rps': 'revolution/second',
    'Torr': 'torr', 'mTorr': 'millitorr',
    'sccm': 'standard_cc/minute', 'slm': 'standard_liter/minute',
    '×g': 'dimensionless', 'pH': 'dimensionless',
    'wt%': 'percent', 'vol%': 'percent', '%RH': 'percent',
    '% amplitude': 'percent', '% of reference mass': 'percent',
    'A/cm²': 'ampere/centimeter**2', 'A/m²': 'ampere/meter**2',
    'mA/cm²': 'milliampere/centimeter**2',
    'J/cm²': 'joule/centimeter**2', 'mJ/cm²': 'millijoule/centimeter**2',
    'ug/cm2': 'microgram/centimeter**2', 'm2/g': 'meter**2/gram',
}


def convert(value, source, target):
    if not math.isfinite(value):
        raise ValueError('Unit conversion requires a finite value')
    quantity = registry().Quantity(value, ALIASES.get(source, source))
    result = float(quantity.to(ALIASES.get(target, target)).magnitude)
    if not math.isfinite(result):
        raise ValueError('Nonfinite converted quantity')
    return result


def normalize_condition(condition, definitions):
    definition = definitions[condition['parameter']]
    if condition['operator'] == 'text':
        return None
    unit = next((u for u in definition['units'] if u['unit'] == condition['unit']), None)
    if not unit:
        raise ValueError('Numeric condition requires compatible units')
    target = unit.get('canonical', definition['canonical'])
    result = {
        'value': convert(condition['value'], condition['unit'], target),
        'upper_value': None if condition['upper_value'] is None else convert(condition['upper_value'], condition['unit'], target),
        'unit': target,
        'quantity_kind': condition['parameter'],
        'semantic_dimension': unit.get('dimension', definition['dimension']),
    }
    for value in [result['value'], result['upper_value']]:
        if value is None:
            continue
        if value < definition.get('minimum', -math.inf) - 1e-9 or value > definition.get('maximum', math.inf):
            raise ValueError('Condition outside physical bounds: ' + condition['template_id'])
        if condition['parameter'] == 'cycles' and (not value.is_integer() or abs(value) > 2**53-1):
            raise ValueError('Cycle counts must be whole safe integers')
    return result


def check_registry(definitions):
    """Check every browser factor and temperature offset against Pint."""
    count = 0
    for parameter, definition in definitions.items():
        if definition.get('text'):
            continue
        for unit in definition['units']:
            target = unit.get('canonical', definition['canonical'])
            for probe in (0.0, 1.0, 23.4):
                actual = convert(probe, unit['unit'], target)
                declared = probe * unit['factor'] + unit.get('offset', 0)
                if not math.isclose(actual, declared, rel_tol=1e-10, abs_tol=1e-9):
                    raise ValueError(f'Unit conversion mismatch: {parameter} {unit["unit"]}: {declared} vs {actual}')
            count += 1
    return count
