export function hasAssignmentRole(user, role) {
  return (user?.roles || []).some((value) => {
    const normalized = String(value).trim().toLowerCase();
    return normalized === role || normalized.endsWith(`.${role}`);
  });
}

export function canAccessAssignments(user) {
  return hasAssignmentRole(user, 'pag') || hasAssignmentRole(user, 'dndp');
}
