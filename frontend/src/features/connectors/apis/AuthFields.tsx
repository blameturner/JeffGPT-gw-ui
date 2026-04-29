import type { ApiAuthType } from '../types';
import { Field, SelectInput, TextInput } from '../components/Field';
import { SecretRefSelect } from '../components/SecretRefSelect';

const AUTH_OPTIONS: { value: ApiAuthType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'basic', label: 'Basic auth' },
  { value: 'api_key_header', label: 'API key (header)' },
  { value: 'api_key_query', label: 'API key (query)' },
  { value: 'oauth2', label: 'OAuth2 client credentials' },
];

export interface AuthFieldsValue {
  authType: ApiAuthType;
  authSecretRef: string | null;
  authExtra: Record<string, unknown>;
}

export function AuthFields({
  authType,
  authSecretRef,
  authExtra,
  onChange,
  onCreateNewSecret,
}: AuthFieldsValue & {
  onChange: (next: AuthFieldsValue) => void;
  onCreateNewSecret?: () => void;
}) {
  function update(patch: Partial<AuthFieldsValue>) {
    onChange({
      authType,
      authSecretRef,
      authExtra,
      ...patch,
    });
  }

  function setExtra(key: string, value: unknown) {
    const next = { ...authExtra };
    if (value === '' || value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    update({ authExtra: next });
  }

  const username = typeof authExtra.username === 'string' ? authExtra.username : '';
  const headerName = typeof authExtra.header_name === 'string' ? authExtra.header_name : '';
  const queryName = typeof authExtra.query_name === 'string' ? authExtra.query_name : '';
  const tokenUrl = typeof authExtra.token_url === 'string' ? authExtra.token_url : '';
  const scopes = Array.isArray(authExtra.scopes)
    ? (authExtra.scopes as unknown[]).map(String).join(', ')
    : typeof authExtra.scopes === 'string'
      ? authExtra.scopes
      : '';

  return (
    <div className="space-y-3">
      <Field label="Auth type">
        <SelectInput
          value={authType}
          onChange={(e) => {
            // Reset auth-extra and secret when switching type to keep payload clean.
            onChange({
              authType: e.target.value as ApiAuthType,
              authSecretRef: null,
              authExtra: {},
            });
          }}
        >
          {AUTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      {authType === 'bearer' && (
        <>
          <Field label="Token secret" required>
            <SecretRefSelect
              value={authSecretRef}
              onChange={(v) => update({ authSecretRef: v })}
              onCreateNew={onCreateNewSecret}
            />
          </Field>
          <div className="text-[11px] text-muted font-mono">
            uses Authorization: Bearer …
          </div>
        </>
      )}

      {authType === 'basic' && (
        <>
          <Field label="Username" required>
            <TextInput
              value={username}
              onChange={(e) => setExtra('username', e.target.value)}
            />
          </Field>
          <Field label="Password secret" required>
            <SecretRefSelect
              value={authSecretRef}
              onChange={(v) => update({ authSecretRef: v })}
              onCreateNew={onCreateNewSecret}
            />
          </Field>
        </>
      )}

      {authType === 'api_key_header' && (
        <>
          <Field label="Header name" required hint="e.g. X-API-Key">
            <TextInput
              value={headerName}
              onChange={(e) => setExtra('header_name', e.target.value)}
              placeholder="X-API-Key"
            />
          </Field>
          <Field label="Key secret" required>
            <SecretRefSelect
              value={authSecretRef}
              onChange={(v) => update({ authSecretRef: v })}
              onCreateNew={onCreateNewSecret}
            />
          </Field>
        </>
      )}

      {authType === 'api_key_query' && (
        <>
          <Field label="Query parameter name" required hint="e.g. api_key">
            <TextInput
              value={queryName}
              onChange={(e) => setExtra('query_name', e.target.value)}
              placeholder="api_key"
            />
          </Field>
          <Field label="Key secret" required>
            <SecretRefSelect
              value={authSecretRef}
              onChange={(v) => update({ authSecretRef: v })}
              onCreateNew={onCreateNewSecret}
            />
          </Field>
        </>
      )}

      {authType === 'oauth2' && (
        <>
          <Field label="Scopes" hint="comma-separated">
            <TextInput
              value={scopes}
              onChange={(e) => {
                const raw = e.target.value;
                const arr = raw
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                setExtra('scopes', arr.length ? arr : '');
              }}
              placeholder="read, write"
            />
          </Field>
          <Field label="Token URL" required>
            <TextInput
              value={tokenUrl}
              onChange={(e) => setExtra('token_url', e.target.value)}
              placeholder="https://auth.example.com/oauth/token"
            />
          </Field>
          <Field label="Client secret" required>
            <SecretRefSelect
              value={authSecretRef}
              onChange={(v) => update({ authSecretRef: v })}
              onCreateNew={onCreateNewSecret}
            />
          </Field>
        </>
      )}
    </div>
  );
}
