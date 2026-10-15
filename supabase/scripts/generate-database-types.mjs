#!/usr/bin/env node
/**
 * Generates `src/types/database.ts` from the live Supabase schema.
 *
 * Why this exists
 * ---------------
 * `supabase gen types typescript` requires CLI authentication, which is not
 * available in every environment. This introspects `information_schema` and
 * `pg_catalog` directly over a Postgres connection and emits the same shape the
 * Supabase client expects, so the rest of the app gets full type inference.
 *
 * Regenerate after every schema change:
 *   node supabase/scripts/generate-database-types.mjs
 *
 * Required environment variables:
 *   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '../../src/types/database.ts')

const { default: pg } = await import('pg')
const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const q = async (sql) => (await client.query(sql)).rows

/* -------------------------------------------------------------------------- */
/* Introspection                                                               */
/* -------------------------------------------------------------------------- */

const allColumns = await q(`
  select table_name, column_name, ordinal_position, data_type, udt_name,
         is_nullable, column_default, is_identity, is_generated
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position
`)

const viewNames = new Set(
  (
    await q(`
      select table_name from information_schema.views where table_schema = 'public'
    `)
  ).map((r) => r.table_name),
)

const baseColumns = allColumns.filter((c) => !viewNames.has(c.table_name))
const viewColumns = allColumns.filter((c) => viewNames.has(c.table_name))
const baseTables = [...new Set(baseColumns.map((c) => c.table_name))]

const enumRows = await q(`
  select t.typname as name, e.enumlabel as value
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  order by t.typname, e.enumsortorder
`)

/** enum name -> union type string */
const enumMap = {}
for (const e of enumRows) {
  ;(enumMap[e.name] ??= []).push(`'${e.value}'`)
}

/* -------------------------------------------------------------------------- */
/* Type mapping                                                                */
/* -------------------------------------------------------------------------- */

/**
 * udt_name / SQL type name -> TypeScript.
 *
 * Two vocabularies appear: `information_schema.columns.udt_name` uses internal
 * names (int8, bool, varchar), while `format_type()` on function arguments uses
 * SQL standard names (bigint, boolean, character varying). Both are mapped.
 */
const PRIMITIVES = {
  // internal names (information_schema)
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  money: 'number',
  json: 'Json',
  jsonb: 'Json',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  citext: 'string',
  uuid: 'string',
  name: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  inet: 'string',
  cidr: 'string',
  interval: 'string',

  // SQL standard names (format_type)
  boolean: 'boolean',
  smallint: 'number',
  integer: 'number',
  bigint: 'number',
  real: 'number',
  'double precision': 'number',
  numeric: 'number',
  money: 'number',
  json: 'Json',
  jsonb: 'Json',
  text: 'string',
  'character varying': 'string',
  'character': 'string',
  citext: 'string',
  uuid: 'string',
  date: 'string',
  'time without time zone': 'string',
  'time with time zone': 'string',
  'timestamp without time zone': 'string',
  'timestamp with time zone': 'string',
}

function resolveBase(udt) {
  // Postgres reports a user-defined enum by its type name.
  if (enumMap[udt]) return enumMap[udt].join(' | ')
  return PRIMITIVES[udt] ?? 'string'
}

/** Render a TS type, parenthesising unions so `A | B` becomes `(A | B)[]`. */
function arrayOf(base) {
  return base.includes(' | ') ? `(${base})[]` : `${base}[]`
}

function tsType(col, { nullable = true } = {}) {
  const udt = col.udt_name
  const isArray = col.data_type === 'ARRAY' || udt.startsWith('_')

  const base = isArray ? arrayOf(resolveBase(udt.replace(/^_/, ''))) : resolveBase(udt)

  if (!nullable) return base
  return base.includes('| null') ? base : `${base} | null`
}

/** Column is computed by the database and cannot be supplied by a client. */
function isGenerated(col) {
  return (
    col.is_identity === 'YES' ||
    col.is_generated === 'ALWAYS' ||
    Boolean(col.column_default?.includes('nextval'))
  )
}

/**
 * Nullability for view columns.
 *
 * information_schema reports every view column as nullable because a view's
 * nullability cannot be proven from its definition alone. That produces
 * `| null` on every field and forces defensive null handling everywhere.
 *
 * Heuristic: if any base table declares the same column NOT NULL, treat the view
 * column as NOT NULL too. Columns absent from every base table stay nullable.
 */
const baseNullability = new Map()
for (const c of baseColumns) {
  if (c.is_nullable === 'NO') baseNullability.set(c.column_name, false)
}

function viewIsNullable(col) {
  const known = baseNullability.get(col.column_name)
  return known === false ? false : true
}

/* -------------------------------------------------------------------------- */
/* Foreign keys                                                                */
/* -------------------------------------------------------------------------- */

const fks = await q(`
  select tc.table_name, kcu.column_name,
         ccu.table_name as foreign_table_name, ccu.column_name as foreign_column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
  order by tc.table_name, kcu.column_name
`)

const fkByTable = {}
for (const fk of fks) {
  ;(fkByTable[fk.table_name] ??= []).push({
    foreignKeyName: `${fk.table_name}_${fk.column_name}_fkey`,
    columns: [fk.column_name],
    isOneToOne: false,
    referencedRelation: fk.foreign_table_name,
    referencedColumns: [fk.foreign_column_name],
  })
}

/**
 * Public, non-security-definer functions callable over PostgREST.
 *
 * Both arrays are built in SQL: the pg driver returns oid[] and "char"[] as
 * strings, which are awkward to split in JS. `format_type` is applied here so
 * argument types come back as text[] already resolved.
 */
const fns = await q(`
  select
    p.proname as name,
    p.proargnames as argnames,
    (select array_agg(m::text) from unnest(p.proargmodes) as m) as argmodes,
    array(
      select format_type(u.t, null)
      from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[]))
        with ordinality as u(t, ord)
    ) as argtypes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and not p.prosecdef
  order by p.proname
`)

/**
 * Render a Postgres type name (as produced by format_type) into TypeScript.
 * Reuses the same primitive mapping as columns so `text[]` and `bigint`
 * resolve identically wherever they appear.
 */
function typeFromPgName(pgType) {
  if (!pgType) return 'unknown'

  if (pgType.endsWith('[]')) {
    const inner = pgType.slice(0, -2)
    const base = enumMap[inner] ? enumMap[inner].join(' | ') : (PRIMITIVES[inner] ?? 'string')
    return base.includes(' | ') ? `(${base})[]` : `${base}[]`
  }

  if (enumMap[pgType]) return enumMap[pgType].join(' | ')

  return PRIMITIVES[pgType] ?? 'string'
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

const I = '  '
const FIELDS = (cols, mapFn) => {
  const body = cols.map((c) => `${I}${I}${I}${I}${c.column_name}: ${mapFn(c)}`)
  return `{\n${body.join('\n')}\n${I}${I}${I}}`
}

const renderTable = (name) => {
  const cols = baseColumns.filter((c) => c.table_name === name)
  return `${I}${I}${I}${name}: {
${I}${I}${I}${I}Row: ${FIELDS(cols, (c) => tsType(c, { nullable: c.is_nullable !== 'NO' }))}
${I}${I}${I}${I}Insert: ${FIELDS(cols.filter((c) => !isGenerated(c)), (c) => tsType(c))}
${I}${I}${I}${I}Update: ${FIELDS(cols, (c) => tsType(c))}
${I}${I}${I}${I}Relationships: ${renderRel(name)}
${I}${I}${I}}`
}

const renderView = (name) => {
  const cols = viewColumns.filter((c) => c.table_name === name)
  return `${I}${I}${I}${name}: {
${I}${I}${I}${I}Row: ${FIELDS(cols, (c) => tsType(c, { nullable: viewIsNullable(c) }))}
${I}${I}${I}${I}Relationships: ${renderRel(name)}
${I}${I}${I}}`
}

function renderRel(table) {
  const rel = fkByTable[table]
  if (!rel) return '[]'
  return `[\n${rel.map((r) => `${I}${I}${I}${I}${JSON.stringify(r)}`).join(',\n')}\n${I}${I}${I}]`
}

/* -------------------------------------------------------------------------- */
/* Emit                                                                        */
/* -------------------------------------------------------------------------- */

const out = `/**
 * Database types — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate after any schema change:
 *   node supabase/scripts/generate-database-types.mjs
 *
 * Source: live Supabase project, public schema only.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
${I}Tables: {
${baseTables.map(renderTable).join('\n')}
${I}}
${I}Views: {
${[...viewNames].map(renderView).join('\n')}
${I}}
${I}Functions: {
${fns
  .map((f) => {
    // For `returns table(...)`, proallargtypes contains OUT parameters too.
    // PostgREST only accepts input arguments in the JSON body, so keep only
    // modes 'i' (IN) and 'b' (INOUT).
    const names = f.argnames ?? []
    const types = f.argtypes ?? []
    const modes = f.argmodes

    const indexes = []
    if (modes && modes.length === types.length) {
      modes.forEach((m, i) => {
        if (m === 'i' || m === 'b') indexes.push(i)
      })
    } else {
      types.forEach((_, i) => indexes.push(i))
    }

    const args = indexes
      .map((i) => `${names[i] ?? `arg${i}`}?: ${typeFromPgName(types[i])}`)
      .join('; ')

    return `${I}${I}${I}${f.name}: { Args: {${args} }; Returns: unknown }`
  })
  .join('\n')}
${I}}
${I}Enums: {
${Object.entries(enumMap).map(([name, values]) => `${I}${I}${I}${name}: ${values.join(' | ')}`).join('\n')}
${I}}
${I}CompositeTypes: {}
${I}}
${I}}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database['public']['Tables'] & Database['public']['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database['public']['Tables'] & Database['public']['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] & Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Update: infer U } ? U : never

export type Enums<E extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][E]

/** A single row of a public table. */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Row: infer R } ? R : never

/** An insert payload for a public table (generated columns omitted). */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Insert: infer I } ? I : never

/** An update payload for a public table. */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Update: infer U } ? U : never
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out, 'utf8')

console.log(`wrote ${path.relative(process.cwd(), OUT)}`)
console.log(
  `  ${baseTables.length} tables, ${viewNames.size} views, ${Object.keys(enumMap).length} enums, ${fns.length} functions`,
)

await client.end()
