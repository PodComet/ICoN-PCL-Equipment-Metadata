"""Typed contracts for science records and the core identity of catalog records."""
from datetime import date
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, HttpUrl, StrictBool, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Operator = Literal['eq', 'range', 'gte', 'lte', 'gt', 'lt', 'text']


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Quantity(Contract):
    value: FiniteFloat | None
    upper_value: FiniteFloat | None
    operator: Operator
    unit: str
    text_value: str

    @model_validator(mode='after')
    def consistent_value(self) -> Self:
        if self.operator == 'text':
            if self.value is not None or self.upper_value is not None or not self.text_value.strip():
                raise ValueError('Descriptive quantity needs text and no numbers')
        else:
            if self.value is None or not self.unit:
                raise ValueError('Numeric quantity requires a value and unit')
            if self.operator == 'range':
                if self.upper_value is None or self.upper_value < self.value:
                    raise ValueError('Invalid quantity range')
            elif self.upper_value is not None:
                raise ValueError('Upper value requires a range operator')
        return self


class ConditionRecord(Quantity):
    template_id: Text
    route_id: Text
    formulation_id: Text
    source_step_order: str
    parameter: Text
    label: Text
    evidence_id: Text
    scope: Text
    match_scope: Literal['example', 'parameter_study', 'ambiguous']

    @model_validator(mode='after')
    def separate_condition_text(self) -> Self:
        if self.operator != 'text' and self.text_value.strip():
            raise ValueError('Put numeric condition qualifiers in scope, not text_value')
        return self


class EvidenceRecord(Contract):
    evidence_id: Text
    classification: Literal['literature_reported', 'curator_interpretation', 'manufacturer_fact']
    claim: Text
    source_url: HttpUrl
    source_title: Text
    source_locator: Text
    reference_ids: list[Text] = Field(min_length=1)
    scope: str
    reviewed_date: date


class Uncertainty(Contract):
    value: Annotated[FiniteFloat, Field(ge=0)]
    unit: Text
    kind: Text


class PropertyRecord(Quantity):
    anchor_id: Text
    route_id: Text
    formulation_id: Text
    property: Text
    label: Text
    evidence_id: Text
    required_condition_ids: list[Text]
    scope: Text
    material_scope: Text
    supports_expectation: StrictBool
    uncertainty: Uncertainty | None
    approximate: StrictBool


class EquipmentIdentity(BaseModel):
    model_config = ConfigDict(extra='ignore')
    equipment_id: Text
    category_id: Text
    model_name: Text
    manufacturer: Text


class Requirements(Contract):
    required_branches: list[list[Text]]
    optional_category_ids: list[Text]
    optional_branches: list[list[Text]] = Field(default_factory=list)
    allowed_subtypes_by_category: dict[str, list[Text]] = Field(default_factory=dict)
    when_selected: list[dict] = Field(default_factory=list)
    unresolved_required_equipment: StrictBool
    readiness_review_required: StrictBool
    notes: Text


def validate_science(data):
    for key, contract in [('conditions', ConditionRecord), ('evidence', EvidenceRecord), ('properties', PropertyRecord)]:
        for record in data[key]:
            contract.model_validate(record)


def schemas():
    return {contract.__name__: contract.model_json_schema() for contract in
            [ConditionRecord, EvidenceRecord, PropertyRecord, EquipmentIdentity, Requirements]}
