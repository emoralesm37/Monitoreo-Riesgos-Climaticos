export function databaseSchema(value?: string) {
  const schema = value || 'public';
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema))
    throw new Error('DB_SCHEMA invalido.');
  return schema;
}
