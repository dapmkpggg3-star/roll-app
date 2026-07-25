const REQUIRED_ROLE_FIELDS = [
  'id', 'name', 'status', 'memo', 'updatedAt', 'requestSent', 'workProgress',
  'history', 'currentDiameter', 'useStartDate', 'coatingStatus',
  'orderExpectedDeliveryDate', 'assemblyInstructionDue', 'useEndDate',
  'isActiveThreeSet', 'nextAssemblyPlanned'
];

const DATE_FIELDS = [
  'useStartDate', 'orderExpectedDeliveryDate', 'useEndDate'
];

function normalizeDate(value, field) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value).trim().replaceAll('/', '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new Error(`${field} must be an empty string or YYYY-MM-DD`);
  }
  return text;
}

function normalizeRole(input, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`roles[${index}] must be an object`);
  }
  const missing = REQUIRED_ROLE_FIELDS.filter(field => !(field in input));
  if (missing.length) throw new Error(`roles[${index}] is missing: ${missing.join(', ')}`);
  if (String(input.name).trim() === '') throw new Error(`roles[${index}].name is required`);
  if (!Array.isArray(input.history)) throw new Error(`roles[${index}].history must be an array`);
  if (!input.workProgress || typeof input.workProgress !== 'object' || Array.isArray(input.workProgress)) {
    throw new Error(`roles[${index}].workProgress must be an object`);
  }
  const updatedAt = new Date(input.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) throw new Error(`roles[${index}].updatedAt must be an ISO date-time`);

  const normalized = {
    ...input,
    id: input.id,
    name: String(input.name).trim(),
    status: String(input.status || '').trim(),
    memo: String(input.memo || ''),
    updatedAt: updatedAt.toISOString(),
    requestSent: input.requestSent === true,
    workProgress: { ...input.workProgress },
    history: input.history.map(item => ({ ...item })),
    currentDiameter: input.currentDiameter === '' ? '' : Number(input.currentDiameter),
    coatingStatus: String(input.coatingStatus || ''),
    assemblyInstructionDue: String(input.assemblyInstructionDue || ''),
    isActiveThreeSet: input.isActiveThreeSet === true,
    nextAssemblyPlanned: input.isActiveThreeSet === true && input.nextAssemblyPlanned === true
  };
  if (normalized.currentDiameter !== '' && !Number.isFinite(normalized.currentDiameter)) {
    throw new Error(`roles[${index}].currentDiameter must be numeric or empty`);
  }
  DATE_FIELDS.forEach(field => { normalized[field] = normalizeDate(input[field], `roles[${index}].${field}`); });
  return normalized;
}

function validateRolesPayload(payload) {
  if (!payload || !Array.isArray(payload.roles)) throw new Error('roles must be an array');
  if (payload.roles.length === 0) throw new Error('roles must not be empty');
  const roles = payload.roles.map(normalizeRole);
  const ids = roles.map(role => String(role.id));
  if (new Set(ids).size !== ids.length) throw new Error('role ids must be unique');
  return roles;
}

module.exports = { REQUIRED_ROLE_FIELDS, normalizeRole, validateRolesPayload };
