// Clave de color por usuario: nico → menta, cristi → coral; otros según su orden.
export function userKey(users, uid) {
  const u = users.find((x) => x.id === uid);
  const n = (u?.name || '').toLowerCase();
  if (n.includes('nico')) return 'nico';
  if (n.includes('cristi')) return 'cristi';
  const i = Math.max(0, users.findIndex((x) => x.id === uid));
  return 'u' + (i % 4);
}
