"""Kinds of equipment-supported materials workflows in the public catalog."""

PROCESS_KINDS = frozenset({'manufacturing_process', 'computational_workflow'})
ROUTE_CLASSES = {
    'material_family': 'MaterialFamily',
    'manufacturing_process': 'ManufacturingProcess',
    'computational_workflow': 'ComputationalWorkflow',
}


def route_class(kind):
    """Keep calculated data workflows distinct from physical manufacturing."""
    if kind not in ROUTE_CLASSES:
        raise ValueError('Unknown route kind: ' + kind)
    return ROUTE_CLASSES[kind]
